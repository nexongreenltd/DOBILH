import "server-only";
import { createReadStream, promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { DeleteObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { db } from "./db";

/**
 * Private object storage. Two drivers:
 * - local (development): files live under STORAGE_DIR.
 * - Cloudflare R2 (production, when R2_BUCKET is set): S3-compatible bucket with no public access.
 *
 * Files are never served by guessable public URL. Every read goes through /api/files/[id], which checks
 * access first and then streams the local file or redirects to a short-lived signed R2 link.
 * STORAGE_DIR is also the scratch space for live-class recordings while they are being processed.
 */
const ROOT = path.resolve(process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage", "uploads"));
const MAX_BYTES = 50 * 1024 * 1024; // uploads that pass through the app server
export const MAX_DIRECT_BYTES = 3 * 1024 * 1024 * 1024; // browser → R2 direct uploads (lesson videos)

const ALLOWED = new Set([
  "application/pdf",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "image/png",
  "image/jpeg",
  "image/webp",
  "video/mp4",
  "video/webm",
  "text/plain",
]);

export class UploadError extends Error {}

// ───────── driver ─────────

let client: S3Client | null = null;
function r2() {
  const bucket = process.env.R2_BUCKET;
  if (!bucket) return null;
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "", secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "" },
  });
  return { s3: client, bucket };
}

export const usesCloudStorage = () => Boolean(process.env.R2_BUCKET);

/** Absolute path for a key on local disk (local driver + recording scratch space). Rejects keys that escape the root. */
export function objectPath(key: string) {
  const full = path.join(ROOT, key);
  if (!full.startsWith(ROOT + path.sep)) throw new Error("Invalid key");
  return full;
}

async function putObject(key: string, body: Buffer, contentType: string) {
  const cloud = r2();
  if (cloud) {
    await cloud.s3.send(new PutObjectCommand({ Bucket: cloud.bucket, Key: key, Body: body, ContentType: contentType }));
    return;
  }
  const full = objectPath(key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, body);
}

/** Moves a finished local file (e.g. a transcoded recording) into storage. Local driver: already in place. */
export async function storeLocalFile(key: string, contentType: string) {
  const cloud = r2();
  const full = objectPath(key);
  const { size } = await fs.stat(full);
  if (!cloud) return size;
  await cloud.s3.send(
    new PutObjectCommand({ Bucket: cloud.bucket, Key: key, Body: createReadStream(full), ContentLength: size, ContentType: contentType }),
  );
  await fs.rm(full, { force: true });
  return size;
}

export async function deleteObject(key: string) {
  const cloud = r2();
  if (cloud) await cloud.s3.send(new DeleteObjectCommand({ Bucket: cloud.bucket, Key: key }));
  else await fs.rm(objectPath(key), { force: true });
}

export async function readObject(key: string) {
  const cloud = r2();
  if (cloud) {
    const res = await cloud.s3.send(new GetObjectCommand({ Bucket: cloud.bucket, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }
  return fs.readFile(objectPath(key));
}

/** Short-lived signed link to an R2 object (null for the local driver, which streams through the app). */
export async function signedReadUrl(key: string, opts: { filename: string; contentType: string; download: boolean }) {
  const cloud = r2();
  if (!cloud) return null;
  return getSignedUrl(
    cloud.s3,
    new GetObjectCommand({
      Bucket: cloud.bucket,
      Key: key,
      ResponseContentType: opts.contentType,
      ResponseContentDisposition: `${opts.download ? "attachment" : "inline"}; filename="${encodeURIComponent(opts.filename)}"`,
      ResponseCacheControl: "private, max-age=600",
    }),
    { expiresIn: 600 },
  );
}

// ───────── uploads ─────────

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "file";
}

function newKey(name: string, owner?: string) {
  const now = new Date();
  const month = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return `${owner ? `direct/${owner}/` : ""}${month}/${crypto.randomBytes(12).toString("hex")}-${safeName(name)}`;
}

function checkType(type: string) {
  if (!ALLOWED.has(type)) throw new UploadError(`File type ${type || "unknown"} is not allowed`);
}

/** Upload that passes through the app server (forms, assignments). */
export async function saveUpload(file: File, uploadedById: string) {
  if (file.size === 0) throw new UploadError("File is empty");
  if (file.size > MAX_BYTES) throw new UploadError("File is larger than 50 MB");
  const type = file.type || "application/octet-stream";
  checkType(type);
  const key = newKey(file.name);
  await putObject(key, Buffer.from(await file.arrayBuffer()), type);
  return db.storedFile.create({ data: { key, originalName: file.name, mimeType: type, size: file.size, uploadedById } });
}

/** Step 1 of a direct browser → R2 upload: a signed PUT link scoped to one new key owned by the uploader. */
export async function createDirectUpload(name: string, type: string, size: number, uploadedById: string) {
  const cloud = r2();
  if (!cloud) throw new UploadError("Direct uploads need cloud storage (R2).");
  if (!(size > 0)) throw new UploadError("File is empty");
  if (size > MAX_DIRECT_BYTES) throw new UploadError("File is larger than 3 GB");
  checkType(type);
  const key = newKey(name, uploadedById);
  const url = await getSignedUrl(cloud.s3, new PutObjectCommand({ Bucket: cloud.bucket, Key: key, ContentType: type }), { expiresIn: 3600 });
  return { key, url };
}

/** Step 2: after the browser finished the PUT, verify the object and record it. */
export async function completeDirectUpload(key: string, name: string, uploadedById: string) {
  const cloud = r2();
  if (!cloud) throw new UploadError("Direct uploads need cloud storage (R2).");
  if (!key.startsWith(`direct/${uploadedById}/`)) throw new UploadError("This upload doesn't belong to you.");
  const existing = await db.storedFile.findUnique({ where: { key } });
  if (existing) return existing;
  let head;
  try {
    head = await cloud.s3.send(new HeadObjectCommand({ Bucket: cloud.bucket, Key: key }));
  } catch {
    throw new UploadError("The upload didn't finish. Please try again.");
  }
  const type = head.ContentType ?? "application/octet-stream";
  checkType(type);
  return db.storedFile.create({ data: { key, originalName: name.slice(0, 200) || "file", mimeType: type, size: head.ContentLength ?? 0, uploadedById } });
}

export function fileFromForm(form: FormData, field: string): File | null {
  const f = form.get(field);
  return f instanceof File && f.size > 0 ? f : null;
}

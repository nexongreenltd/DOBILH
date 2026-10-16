import "server-only";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { db } from "./db";

/**
 * Bucket abstraction. The local driver writes to STORAGE_DIR; swap `putObject`/`getObject`
 * for S3/R2/GCS calls in production. Files are never served by guessable public URL —
 * every read goes through /api/files/[id], which checks access first.
 */
const ROOT = path.resolve(process.env.STORAGE_DIR ?? path.join(process.cwd(), "storage", "uploads"));
const MAX_BYTES = 50 * 1024 * 1024;

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
  "text/plain",
]);

export class UploadError extends Error {}

function safeName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80) || "file";
}

export async function saveUpload(file: File, uploadedById: string) {
  if (file.size === 0) throw new UploadError("File is empty");
  if (file.size > MAX_BYTES) throw new UploadError("File is larger than 50 MB");
  const type = file.type || "application/octet-stream";
  if (!ALLOWED.has(type)) throw new UploadError(`File type ${type} is not allowed`);

  const now = new Date();
  const key = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${crypto
    .randomBytes(12)
    .toString("hex")}-${safeName(file.name)}`;
  const full = path.join(ROOT, key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, Buffer.from(await file.arrayBuffer()));

  return db.storedFile.create({
    data: { key, originalName: file.name, mimeType: type, size: file.size, uploadedById },
  });
}

export async function readObject(key: string) {
  const full = path.join(ROOT, key);
  if (!full.startsWith(ROOT)) throw new Error("Invalid key");
  return fs.readFile(full);
}

export function fileFromForm(form: FormData, field: string): File | null {
  const f = form.get(field);
  return f instanceof File && f.size > 0 ? f : null;
}

/**
 * Nightly database backup: pg_dump (custom format) → Cloudflare R2 under backups/, keeping the last
 * BACKUP_KEEP (default 14) dumps. Runs as a Railway cron service: `npm run backup`.
 * Restore: pg_restore --clean --no-owner -d "$DATABASE_URL" db-YYYY-MM-DD.dump
 */
import { spawn } from "child_process";
import { createReadStream, promises as fs } from "fs";
import os from "os";
import path from "path";
import { DeleteObjectsCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const need = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
};

async function main() {
  // pg_dump rejects Prisma's ?schema= parameter.
  const url = new URL(need("DATABASE_URL"));
  url.searchParams.delete("schema");
  const bucket = need("R2_BUCKET");
  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${need("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: need("R2_ACCESS_KEY_ID"), secretAccessKey: need("R2_SECRET_ACCESS_KEY") },
  });

  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
  const file = path.join(os.tmpdir(), `db-${stamp}.dump`);
  await new Promise<void>((resolve, reject) => {
    const p = spawn("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", "--file", file, url.toString()], { stdio: ["ignore", "inherit", "inherit"] });
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`pg_dump exited ${code}`))));
  });
  const { size } = await fs.stat(file);
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: `backups/db-${stamp}.dump`, Body: createReadStream(file), ContentLength: size, ContentType: "application/octet-stream" }));
  await fs.rm(file, { force: true });
  console.log(`Backup uploaded: backups/db-${stamp}.dump (${(size / 1024 / 1024).toFixed(1)} MB)`);

  const keep = Number(process.env.BACKUP_KEEP ?? 14);
  const listed = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: "backups/db-" }));
  const old = (listed.Contents ?? []).map((o) => o.Key!).sort().reverse().slice(keep);
  if (old.length) {
    await s3.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: old.map((Key) => ({ Key })) } }));
    console.log(`Removed ${old.length} old backup(s).`);
  }
}

main().catch((e) => {
  console.error("Backup failed:", e instanceof Error ? e.message : e);
  process.exit(1);
});

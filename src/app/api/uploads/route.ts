import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { createDirectUpload, UploadError } from "@/lib/storage";

const body = z.object({ name: z.string().min(1).max(200), type: z.string().max(120), size: z.number().int().positive() });

/** Signed PUT link for a direct browser → R2 upload (instructors and staff only, e.g. lesson videos). */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!["INSTRUCTOR", "ADMIN", "SUPER_ADMIN"].includes(user.role)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!rateLimit(`upload:${user.id}`, 30, 60 * 60_000).ok) return NextResponse.json({ error: "Too many uploads. Try again later." }, { status: 429 });
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid upload request" }, { status: 400 });
  try {
    const { key, url } = await createDirectUpload(parsed.data.name, parsed.data.type, parsed.data.size, user.id);
    return NextResponse.json({ key, url });
  } catch (e) {
    return NextResponse.json({ error: e instanceof UploadError ? e.message : "Upload failed" }, { status: 400 });
  }
}

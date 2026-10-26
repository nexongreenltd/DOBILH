import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { spawn } from "child_process";
import { AccessToken, DataPacket_Kind, RoomServiceClient } from "livekit-server-sdk";
import type { ClassSession, Batch, Course } from "@prisma/client";
import { db } from "./db";
import { getSettings } from "./settings";
import { objectPath, storeLocalFile, usesCloudStorage } from "./storage";
import { notifyMany, learnerIds } from "./notify";
import { audit } from "./audit";
import { formatDate } from "./utils";
import type { CurrentUser } from "./auth";

/**
 * DoB Live — in-app live classes on LiveKit (WebRTC).
 *
 * Lifecycle: SCHEDULED → (instructor opens studio, goes live) LIVE → (instructor ends) COMPLETED.
 * While live, the host's browser records the class and streams chunks here; on end we finalise
 * attendance from presence, transcode the recording with ffmpeg and auto-publish it to the
 * course as a replay lesson. All access rules live in this module.
 */

// ───────── configuration ─────────

export function liveConfig() {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) return null;
  return { url, apiKey, apiSecret, httpUrl: url.replace(/^ws/, "http") };
}

export const roomNameFor = (sessionId: string) => `dob-class-${sessionId}`;

let rooms: RoomServiceClient | null = null;
function roomService() {
  const cfg = liveConfig();
  if (!cfg) return null;
  rooms ??= new RoomServiceClient(cfg.httpUrl, cfg.apiKey, cfg.apiSecret);
  return rooms;
}

// ───────── access ─────────

export type LiveRole = "host" | "moderator" | "learner";
export type LiveState = "too-early" | "waiting" | "live" | "ended" | "cancelled";

type SessionWithCourse = ClassSession & { batch: Batch & { course: Course } };

export async function loadLiveSession(sessionId: string) {
  return db.classSession.findUnique({ where: { id: sessionId }, include: { batch: { include: { course: true } }, lesson: true } });
}

/** Who may enter this class, in what role, and whether they can connect right now. */
export async function liveAccess(user: CurrentUser, session: SessionWithCourse) {
  const settings = await getSettings();
  const now = Date.now();
  const starts = session.startsAt.getTime();

  let role: LiveRole | null = null;
  if (user.role === "ADMIN" || user.role === "SUPER_ADMIN") role = "moderator";
  const teaches = await db.courseInstructor.findUnique({ where: { courseId_userId: { courseId: session.batch.courseId, userId: user.id } } });
  if (teaches) role = "host";
  if (!role) {
    const enrolled = await db.enrollment.findFirst({
      where: { userId: user.id, courseId: session.batch.courseId, batchId: session.batchId, status: { in: ["ACTIVE", "COMPLETED"] } },
    });
    if (enrolled) role = "learner";
  }

  let state: LiveState;
  if (session.status === "CANCELLED") state = "cancelled";
  else if (session.liveEndedAt || session.status === "COMPLETED") state = "ended";
  else if (session.status === "LIVE") state = "live";
  else {
    const early = (role === "learner" ? settings.liveJoinEarlyMinutes : settings.liveHostEarlyMinutes) * 60000;
    state = now < starts - early ? "too-early" : "waiting";
  }

  // Hosts and moderators may open a waiting room; learners connect only once the host is live.
  const canConnect = role !== null && (state === "live" || (state === "waiting" && role !== "learner"));
  return { role, state, canConnect, settings };
}

export async function createJoinToken(user: CurrentUser, sessionId: string, role: LiveRole) {
  const cfg = liveConfig();
  if (!cfg) throw new Error("Live streaming is not configured (LIVEKIT_URL / LIVEKIT_API_KEY / LIVEKIT_API_SECRET).");
  const at = new AccessToken(cfg.apiKey, cfg.apiSecret, {
    identity: user.id,
    name: user.name,
    ttl: "4h",
    metadata: JSON.stringify({ role }),
    attributes: { role },
  });
  at.addGrant({
    room: roomNameFor(sessionId),
    roomJoin: true,
    canSubscribe: true,
    // Learners watch by default; the host can grant them the floor (see moderate()).
    canPublish: role !== "learner",
    canPublishData: true,
    canUpdateOwnMetadata: true,
  });
  return { token: await at.toJwt(), url: cfg.url };
}

// ───────── realtime helpers ─────────

/** Server → everyone in the room (chat messages, Q&A updates, class ended). */
export async function broadcast(sessionId: string, payload: unknown) {
  const svc = roomService();
  if (!svc) return;
  try {
    await svc.sendData(roomNameFor(sessionId), new TextEncoder().encode(JSON.stringify(payload)), DataPacket_Kind.RELIABLE, { topic: "dob" });
  } catch {
    /* room not open yet — nothing to deliver */
  }
}

export async function moderate(sessionId: string, action: "allow-speak" | "revoke-speak" | "remove" | "mute", identity: string, trackSid?: string) {
  const svc = roomService();
  if (!svc) throw new Error("Live streaming is not configured.");
  const room = roomNameFor(sessionId);
  if (action === "allow-speak" || action === "revoke-speak") {
    const allow = action === "allow-speak";
    await svc.updateParticipant(room, identity, {
      permission: { canSubscribe: true, canPublishData: true, canUpdateMetadata: true, canPublish: allow },
      attributes: { hand: "", speaker: allow ? "1" : "" },
    });
  } else if (action === "remove") {
    await svc.removeParticipant(room, identity);
  } else if (action === "mute" && trackSid) {
    await svc.mutePublishedTrack(room, identity, trackSid, true);
  }
}

// ───────── presence & attendance ─────────

/** Heartbeat from a connected participant (every ~30 s). Gaps longer than 90 s count as a re-join. */
export async function recordPresence(sessionId: string, userId: string, isHost: boolean) {
  const now = new Date();
  const existing = await db.livePresence.findUnique({ where: { sessionId_userId: { sessionId, userId } } });
  if (!existing) {
    await db.livePresence.create({ data: { sessionId, userId, isHost, firstJoinedAt: now, lastSeenAt: now } });
    return;
  }
  const gap = now.getTime() - existing.lastSeenAt.getTime();
  const counted = gap <= 90_000 ? Math.min(Math.round(gap / 1000), 45) : 0;
  await db.livePresence.update({
    where: { id: existing.id },
    data: { lastSeenAt: now, seconds: { increment: counted }, joins: gap > 90_000 ? { increment: 1 } : undefined },
  });
}

/**
 * Attendance policy: present if the learner watched at least `livePresentPercent` of the class,
 * marked LATE when they first joined more than `liveLateAfterMinutes` after go-live; absent otherwise.
 * Manual marks by an instructor are never overwritten.
 */
export async function computeLiveAttendance(sessionId: string) {
  const session = await db.classSession.findUniqueOrThrow({ where: { id: sessionId }, include: { batch: true } });
  if (!session.liveStartedAt || !session.liveEndedAt) return 0;
  const settings = await getSettings();
  const duration = Math.max(1, (session.liveEndedAt.getTime() - session.liveStartedAt.getTime()) / 1000);
  const roster = await db.enrollment.findMany({ where: { batchId: session.batchId, status: { in: ["ACTIVE", "COMPLETED"] } }, select: { userId: true } });
  const presence = new Map((await db.livePresence.findMany({ where: { sessionId } })).map((p) => [p.userId, p]));
  let marked = 0;
  for (const { userId } of roster) {
    const manual = await db.attendance.findUnique({ where: { sessionId_studentId: { sessionId, studentId: userId } } });
    if (manual?.markedById) continue;
    const p = presence.get(userId);
    // Heartbeats arrive every ~30 s; credit learners still connected at the end for the final interval.
    const tail = p ? session.liveEndedAt.getTime() - p.lastSeenAt.getTime() : Infinity;
    const watched = p ? p.seconds + (tail >= 0 && tail <= 45_000 ? Math.round(tail / 1000) : 0) : 0;
    const share = (watched / duration) * 100;
    const late = p ? p.firstJoinedAt.getTime() - session.liveStartedAt.getTime() > settings.liveLateAfterMinutes * 60000 : false;
    const status = share >= settings.livePresentPercent ? (late ? "LATE" : "PRESENT") : "ABSENT";
    await db.attendance.upsert({
      where: { sessionId_studentId: { sessionId, studentId: userId } },
      create: { sessionId, studentId: userId, status, markedById: null },
      update: { status, markedAt: new Date() },
    });
    marked++;
  }
  return marked;
}

// ───────── going live / ending ─────────

export async function goLive(sessionId: string, actorId: string) {
  const s = await db.classSession.findUniqueOrThrow({ where: { id: sessionId }, include: { batch: { include: { course: true } } } });
  if (s.status === "LIVE") return s;
  const settings = await getSettings();
  const updated = await db.classSession.update({
    where: { id: sessionId },
    data: { status: "LIVE", liveStartedAt: s.liveStartedAt ?? new Date(), recordingStatus: settings.liveRecordingEnabled ? "RECORDING" : "NONE" },
  });
  await notifyMany(await learnerIds(s.batch.courseId, s.batchId), {
    type: "session",
    title: "Your class is live now",
    body: `${s.title} — ${s.batch.course.title}. Join from your schedule.`,
    link: `/live/${sessionId}`,
    email: true,
  });
  await audit(actorId, "live.start", "ClassSession", sessionId);
  return updated;
}

/** Ends the class for everyone (idempotent), finalises attendance and starts recording processing. */
export async function endLive(sessionId: string, actorId: string | null) {
  const s = await db.classSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (s.liveEndedAt) return s;
  const now = new Date();
  const hasRecording = (await listSegments(sessionId)).length > 0;
  const updated = await db.classSession.update({
    where: { id: sessionId },
    data: {
      status: "COMPLETED",
      liveEndedAt: now,
      recordingSeconds: s.liveStartedAt ? Math.round((now.getTime() - s.liveStartedAt.getTime()) / 1000) : null,
      recordingStatus: hasRecording ? "PROCESSING" : "NONE",
    },
  });
  await broadcast(sessionId, { type: "ended" });
  try {
    await roomService()?.deleteRoom(roomNameFor(sessionId));
  } catch {
    /* room already closed */
  }
  await computeLiveAttendance(sessionId);
  await audit(actorId, "live.end", "ClassSession", sessionId);
  if (hasRecording) {
    // In-process job — move to a queue (Redis/BullMQ) when running several instances.
    void processRecording(sessionId, actorId).catch(async (e) => {
      console.error("[live] recording processing failed", e);
      await db.classSession.update({ where: { id: sessionId }, data: { recordingStatus: "FAILED" } });
    });
  }
  return updated;
}

// ───────── recording ─────────

const SEGMENT = /^\d{10,16}$/;
const liveDir = (sessionId: string) => `live/${sessionId}`;

export async function appendRecordingChunk(sessionId: string, segment: string, seq: number, data: Buffer) {
  if (!SEGMENT.test(segment) || !Number.isInteger(seq) || seq < 0) return { ok: false as const, status: 400 };
  const dir = objectPath(liveDir(sessionId));
  await fs.mkdir(dir, { recursive: true });
  const meta = path.join(dir, `${segment}.json`);
  let next = 0;
  try {
    next = JSON.parse(await fs.readFile(meta, "utf8")).next;
  } catch {
    /* first chunk */
  }
  if (seq < next) return { ok: true as const, duplicate: true }; // retried chunk already stored
  if (seq > next) return { ok: false as const, status: 409, expected: next };
  await fs.appendFile(path.join(dir, `${segment}.webm`), data);
  await fs.writeFile(meta, JSON.stringify({ next: next + 1 }));
  return { ok: true as const };
}

async function listSegments(sessionId: string) {
  try {
    const dir = objectPath(liveDir(sessionId));
    const files = (await fs.readdir(dir)).filter((f) => f.endsWith(".webm")).sort();
    const out: string[] = [];
    for (const f of files) {
      const st = await fs.stat(path.join(dir, f));
      if (st.size > 10_000) out.push(path.join(dir, f));
    }
    return out;
  } catch {
    return [];
  }
}

function run(cmd: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "pipe"] });
    let err = "";
    p.stderr.on("data", (d) => (err = (err + d).slice(-2000)));
    p.on("error", reject);
    p.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}: ${err}`))));
  });
}

async function hasFfmpeg(bin: string) {
  try {
    await run(bin, ["-version"]);
    return true;
  } catch {
    return false;
  }
}

/** Transcode the host's recording segments to one MP4 and publish it as the class replay. */
export async function processRecording(sessionId: string, actorId: string | null) {
  const segments = await listSegments(sessionId);
  if (!segments.length) {
    await db.classSession.update({ where: { id: sessionId }, data: { recordingStatus: "NONE" } });
    return;
  }
  const dir = objectPath(liveDir(sessionId));
  const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
  let key: string;
  let mime: string;

  if (await hasFfmpeg(ffmpeg)) {
    const parts: string[] = [];
    for (const [i, seg] of segments.entries()) {
      const out = path.join(dir, `part-${i}.mp4`);
      await run(ffmpeg, ["-y", "-i", seg, "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "96k", "-ar", "48000", "-movflags", "+faststart", out]);
      parts.push(out);
    }
    key = `${liveDir(sessionId)}/recording.mp4`;
    const final = objectPath(key);
    if (parts.length === 1) await fs.rename(parts[0]!, final);
    else {
      const list = path.join(dir, "parts.txt");
      await fs.writeFile(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));
      await run(ffmpeg, ["-y", "-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", final]);
    }
    mime = "video/mp4";
  } else {
    // No ffmpeg on this server: publish the longest raw segment as WebM.
    let best = segments[0]!;
    for (const s of segments) if ((await fs.stat(s)).size > (await fs.stat(best)).size) best = s;
    key = `${liveDir(sessionId)}/recording.webm`;
    await fs.copyFile(best, objectPath(key));
    mime = "video/webm";
  }

  // Clean up raw segments once the replay file exists.
  for (const f of await fs.readdir(dir)) {
    if (/\.(webm|json|txt)$/.test(f) && !key.endsWith(f) || /^part-\d+\.mp4$/.test(f)) await fs.rm(path.join(dir, f), { force: true });
  }

  // Upload the finished replay to storage (R2 in production) and drop the local copy.
  const size = await storeLocalFile(key, mime);
  if (usesCloudStorage()) await fs.rm(dir, { recursive: true, force: true });
  await publishReplay(sessionId, key, mime, size, actorId);
}

/** Attach the recording to the course as a video material (creating a replay lesson if needed). */
async function publishReplay(sessionId: string, key: string, mime: string, size: number, actorId: string | null) {
  const s = await db.classSession.findUniqueOrThrow({ where: { id: sessionId }, include: { batch: { include: { course: true } } } });
  const file = await db.storedFile.upsert({
    where: { key },
    create: { key, originalName: `${s.title}.${mime === "video/mp4" ? "mp4" : "webm"}`, mimeType: mime, size, uploadedById: actorId },
    update: { size, mimeType: mime },
  });

  let lessonId = s.lessonId;
  if (!lessonId) {
    const last = await db.lesson.findFirst({ where: { courseId: s.batch.courseId }, orderBy: { orderNo: "desc" } });
    const lesson = await db.lesson.create({
      data: {
        courseId: s.batch.courseId,
        title: `Live class: ${s.title}`,
        summary: `Recording of the live class on ${formatDate(s.liveStartedAt ?? s.startsAt)}.`,
        orderNo: (last?.orderNo ?? 0) + 1,
        durationMin: Math.max(1, Math.round((s.recordingSeconds ?? 0) / 60)),
        publishAt: new Date(),
      },
    });
    lessonId = lesson.id;
    await db.classSession.update({ where: { id: sessionId }, data: { lessonId } });
  }

  const title = `Class recording · ${formatDate(s.liveStartedAt ?? s.startsAt)}`;
  const material = s.recordingMaterialId
    ? await db.material.update({ where: { id: s.recordingMaterialId }, data: { fileId: file.id, url: null, title } })
    : await db.material.create({ data: { lessonId, type: "VIDEO", title, fileId: file.id, visibility: "ENROLLED", orderNo: -1 } });

  await db.classSession.update({
    where: { id: sessionId },
    data: { recordingStatus: "READY", recordingFileId: file.id, recordingMaterialId: material.id },
  });
  await notifyMany(await learnerIds(s.batch.courseId, s.batchId), {
    type: "session",
    title: "Class recording is ready",
    body: `Watch the replay of “${s.title}” anytime in ${s.batch.course.title}.`,
    link: `/dashboard/courses/${s.batch.courseId}?lesson=${lessonId}`,
    email: true,
  });
  await audit(actorId, "live.replay_published", "ClassSession", sessionId, { materialId: material.id, size });
}

// ───────── replay policy ─────────

/**
 * Replay access: staff and the course's instructors always; learners need an active enrollment,
 * the same batch when the policy scope is BATCH, and the replay must be within the retention window.
 */
export async function replayAccess(userId: string, role: string, session: { batchId: string; liveEndedAt: Date | null; batch: { courseId: string } }) {
  if (role === "ADMIN" || role === "SUPER_ADMIN") return { ok: true as const };
  const teaches = await db.courseInstructor.findUnique({ where: { courseId_userId: { courseId: session.batch.courseId, userId } } });
  if (teaches) return { ok: true as const };
  const settings = await getSettings();
  const enrollment = await db.enrollment.findFirst({ where: { userId, courseId: session.batch.courseId, status: { in: ["ACTIVE", "COMPLETED"] } } });
  if (!enrollment) return { ok: false as const, reason: "Enroll in this course to watch class recordings." };
  if (settings.replayScope === "BATCH" && enrollment.batchId !== session.batchId) {
    return { ok: false as const, reason: "This recording is available to learners of the batch that attended the class." };
  }
  if (settings.replayRetentionDays > 0 && session.liveEndedAt) {
    const until = session.liveEndedAt.getTime() + settings.replayRetentionDays * 86400000;
    if (Date.now() > until) return { ok: false as const, reason: `Replays are available for ${settings.replayRetentionDays} days after the class.` };
  }
  return { ok: true as const };
}

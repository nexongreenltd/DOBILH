import "server-only";
import { db } from "./db";

export type PlatformSettings = {
  siteName: string;
  supportEmail: string;
  supportPhone: string;
  aiEnabled: boolean;
  aiGenerative: boolean;
  allowSelfRegistration: boolean;
  certificateSignatory: string;
  certificateSignatoryTitle: string;
  // ── Live class policy ──
  /** Minutes before the start time the instructor can open the studio. */
  liveHostEarlyMinutes: number;
  /** Minutes before the start time learners can enter the waiting room. */
  liveJoinEarlyMinutes: number;
  /** Joining later than this (minutes after go-live) is marked LATE. */
  liveLateAfterMinutes: number;
  /** Share of the class a learner must watch live to be marked present (%). */
  livePresentPercent: number;
  liveRecordingEnabled: boolean;
  liveChatEnabled: boolean;
  /** Days a replay stays available after the class (0 = for as long as the course runs). */
  replayRetentionDays: number;
  /** BATCH = only learners of the class's batch can watch the replay; COURSE = any enrolled learner. */
  replayScope: "BATCH" | "COURSE";
  // ── Payments ──
  /** Shown on the payment page while payments are confirmed manually (PAYMENT_MODE=manual). */
  paymentInstructions: string;
};

export const DEFAULT_SETTINGS: PlatformSettings = {
  siteName: "DoB Innovation & Learning Hub",
  supportEmail: "learn@dreamsofbangladesh.org",
  supportPhone: "+880 1700-000000",
  aiEnabled: true,
  aiGenerative: true,
  allowSelfRegistration: true,
  certificateSignatory: "Program Director",
  certificateSignatoryTitle: "DoB Innovation & Learning Hub",
  liveHostEarlyMinutes: 30,
  liveJoinEarlyMinutes: 15,
  liveLateAfterMinutes: 10,
  livePresentPercent: 60,
  liveRecordingEnabled: true,
  liveChatEnabled: true,
  replayRetentionDays: 90,
  replayScope: "BATCH",
  paymentInstructions:
    "Your seat is reserved. Our team will send you a PayPlus payment link by SMS or email within one working day. Your course opens as soon as the payment is confirmed.",
};

export async function getSettings(): Promise<PlatformSettings> {
  const rows = await db.setting.findMany();
  const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
  for (const r of rows) out[r.key] = r.value;
  return out as PlatformSettings;
}

export async function setSetting<K extends keyof PlatformSettings>(key: K, value: PlatformSettings[K]) {
  await db.setting.upsert({ where: { key }, create: { key, value }, update: { value } });
}

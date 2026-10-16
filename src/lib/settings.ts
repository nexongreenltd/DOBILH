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

import "server-only";

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { PlaybackProtocol } from "@/types/media";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "admin-media.json");

export type AdminMediaEntry = {
  id: string;
  title: string;
  kind: "movie" | "series";
  year: string | null;
  poster: string | null;
  overview: string;
  protocol: PlaybackProtocol;
  sourceUrl: string;
  subtitleUrl: string | null;
  subtitleLanguage: string | null;
  createdAt: string;
};

async function readEntries(): Promise<AdminMediaEntry[]> {
  try {
    const content = await readFile(DATA_FILE, "utf8");
    const parsed: unknown = JSON.parse(content);
    return Array.isArray(parsed) ? (parsed as AdminMediaEntry[]) : [];
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

export async function listAdminMedia(): Promise<AdminMediaEntry[]> {
  return readEntries();
}

export async function addAdminMedia(
  input: Omit<AdminMediaEntry, "id" | "createdAt">,
): Promise<AdminMediaEntry> {
  const entries = await readEntries();
  const entry: AdminMediaEntry = {
    ...input,
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, `${JSON.stringify([entry, ...entries], null, 2)}\n`, "utf8");
  return entry;
}

import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { makePrivateStreamLocator } from "./private-locator";
import { getPrivateSourceConfig } from "./private-channels";

export type ResolvedPrivateTarget = {
  target: string;
  headers: Headers;
  healthKey: string;
};

function bridgeConfig(): { base: URL; secret: string } {
  const rawBase = process.env.PINFLIX_BD_BRIDGE_URL?.trim();
  const secret = process.env.PINFLIX_BD_BRIDGE_SECRET?.trim();
  if (!rawBase || !secret) throw new Error("Bangladesh IPTV bridge is not configured");

  const base = new URL(rawBase);
  if (base.protocol !== "https:" && base.protocol !== "http:") {
    throw new Error("Invalid bridge URL");
  }
  return { base, secret };
}

function ensureBridgeTarget(target: URL, base: URL): void {
  if (target.origin !== base.origin) {
    throw new Error("Private bridge target origin mismatch");
  }
}

export async function resolvePrivateTarget(
  channelId: string,
  sourceId: string,
  targetOverride?: string | null,
): Promise<ResolvedPrivateTarget> {
  const configured = getPrivateSourceConfig(channelId, sourceId);
  if (!configured) throw new Error("Private channel source is not configured");

  const { base, secret } = bridgeConfig();
  const target = targetOverride
    ? new URL(targetOverride)
    : new URL(
        `/v1/channel/${encodeURIComponent(configured.source.bridgeStreamId)}/master.m3u8`,
        base,
      );

  ensureBridgeTarget(target, base);

  const headers = new Headers({
    authorization: `Bearer ${secret}`,
    "x-pinflix-bridge": "1",
  });

  return {
    target: target.href,
    headers,
    healthKey: makePrivateStreamLocator(channelId, sourceId),
  };
}

type SealedTarget = {
  c: string;
  s: string;
  u: string;
  e: number;
};

function cryptoKey(): Buffer {
  const secret =
    process.env.PINFLIX_PRIVATE_PROXY_KEY?.trim() ??
    process.env.PINFLIX_BD_BRIDGE_SECRET?.trim();
  if (!secret || secret.length < 24) {
    throw new Error("Private proxy encryption key is missing or too short");
  }
  return createHash("sha256").update(secret).digest();
}

export function sealPrivateTarget(channelId: string, sourceId: string, target: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cryptoKey(), iv);
  const body = Buffer.from(
    JSON.stringify({
      c: channelId,
      s: sourceId,
      u: target,
      e: Date.now() + 60 * 60_000,
    } satisfies SealedTarget),
    "utf8",
  );
  const encrypted = Buffer.concat([cipher.update(body), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function openPrivateTarget(token: string): SealedTarget {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid private stream token");
  const [ivRaw, tagRaw, bodyRaw] = parts;
  if (!ivRaw || !tagRaw || !bodyRaw) throw new Error("Invalid private stream token");

  const decipher = createDecipheriv("aes-256-gcm", cryptoKey(), Buffer.from(ivRaw, "base64url"));
  decipher.setAuthTag(Buffer.from(tagRaw, "base64url"));
  const body = Buffer.concat([
    decipher.update(Buffer.from(bodyRaw, "base64url")),
    decipher.final(),
  ]).toString("utf8");

  const payload = JSON.parse(body) as Partial<SealedTarget>;
  if (
    typeof payload.c !== "string" ||
    typeof payload.s !== "string" ||
    typeof payload.u !== "string" ||
    typeof payload.e !== "number" ||
    payload.e < Date.now()
  ) {
    throw new Error("Expired or invalid private stream token");
  }

  return payload as SealedTarget;
}

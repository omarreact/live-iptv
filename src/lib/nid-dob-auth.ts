import crypto from "crypto";
import type { NextRequest } from "next/server";

export const NID_DOB_COOKIE = "pinflix_nid_dob_session";
export const NID_DOB_SESSION_MAX_AGE = 8 * 60 * 60;

const PASSWORD_SALT = "3F0_R1HPdxhc-T8CE9pTbQ";
const PASSWORD_HASH = "w3Wyg8KfnHzEeeFAeUt8ZarEkXUoiorrj4VJuUQx3Kw";
const PBKDF2_ITERATIONS = 210000;

function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function verifyAccessPassword(password: string) {
  const supplied = String(password || "");
  const configured = process.env.NID_DOB_PASSWORD?.trim();

  if (configured) {
    const left = crypto.createHash("sha256").update(supplied).digest();
    const right = crypto.createHash("sha256").update(configured).digest();
    return crypto.timingSafeEqual(left, right);
  }

  const salt = Buffer.from(PASSWORD_SALT, "base64url");
  const derived = crypto.pbkdf2Sync(supplied, salt, PBKDF2_ITERATIONS, 32, "sha256");
  return safeEqual(derived.toString("base64url"), PASSWORD_HASH);
}

function signingSecret() {
  const configured = process.env.NID_DOB_SESSION_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;

  return crypto
    .createHash("sha256")
    .update(`pinflix-live:nid-dob:${PASSWORD_HASH}:session-v1`)
    .digest("hex");
}

function sign(value: string) {
  return crypto.createHmac("sha256", signingSecret()).update(value).digest("base64url");
}

export function createAccessSessionToken() {
  const payload = {
    v: 1,
    exp: Math.floor(Date.now() / 1000) + NID_DOB_SESSION_MAX_AGE,
    nonce: crypto.randomBytes(12).toString("base64url"),
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${encoded}.${sign(encoded)}`;
}

export function verifyAccessSessionToken(token?: string | null) {
  if (!token) return false;
  const [encoded, signature, extra] = token.split(".");
  if (!encoded || !signature || extra) return false;
  if (!safeEqual(signature, sign(encoded))) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return payload?.v === 1 &&
      Number.isFinite(payload?.exp) &&
      payload.exp > Math.floor(Date.now() / 1000);
  } catch {
    return false;
  }
}

export function isIdentityAuthorized(request: NextRequest) {
  return verifyAccessSessionToken(request.cookies.get(NID_DOB_COOKIE)?.value);
}

export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (!host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function noStoreHeaders() {
  return {
    "cache-control": "private, no-store, no-cache, max-age=0, must-revalidate",
    pragma: "no-cache",
    expires: "0",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-robots-tag": "noindex, nofollow, noarchive, nosnippet",
  };
}

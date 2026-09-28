import { NextRequest, NextResponse } from "next/server";
import { isIdentityAuthorized, noStoreHeaders, sameOrigin } from "@/lib/nid-dob-auth";
import { DghsError, verifyWithDghs } from "@/lib/dghs-nid-proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const NID_PATTERN = /^(?:\d{10}|\d{13}|\d{17})$/;
const BRN_PATTERN = /^\d{17}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const MOBILE_PATTERN = /^01\d{9}$/;

function validDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function POST(request: NextRequest) {
  if (!isIdentityAuthorized(request)) {
    return NextResponse.json(
      { ok: false, provider: "DGHS NID Proxy", error: "Authentication required." },
      { status: 401, headers: noStoreHeaders() },
    );
  }

  if (!sameOrigin(request)) {
    return NextResponse.json(
      { ok: false, provider: "DGHS NID Proxy", error: "Cross-origin request rejected." },
      { status: 403, headers: noStoreHeaders() },
    );
  }

  let body: {
    mode?: "nid" | "birth";
    identifier?: string;
    dateOfBirth?: string;
    name?: string;
    mobile?: string;
    authorizedUse?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, provider: "DGHS NID Proxy", error: "Invalid JSON request." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  const mode = body.mode === "birth" ? "birth" : "nid";
  const identifier = String(body.identifier || "").replace(/\D/g, "");
  const dateOfBirth = String(body.dateOfBirth || "").trim();
  const name = String(body.name || "").trim();
  const mobile = String(body.mobile || "").replace(/\D/g, "");

  if (body.authorizedUse !== true) {
    return NextResponse.json(
      { ok: false, provider: "DGHS NID Proxy", error: "Authorization/consent confirmation is required." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  if (mode === "nid" && !NID_PATTERN.test(identifier)) {
    return NextResponse.json(
      { ok: false, provider: "DGHS NID Proxy", error: "NID must be 10, 13, or 17 digits." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  if (mode === "birth" && !BRN_PATTERN.test(identifier)) {
    return NextResponse.json(
      { ok: false, provider: "DGHS NID Proxy", error: "Birth Registration Number must be exactly 17 digits." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  if (!validDate(dateOfBirth)) {
    return NextResponse.json(
      { ok: false, provider: "DGHS NID Proxy", error: "Date of birth must be a valid YYYY-MM-DD date." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  if (name.length < 2) {
    return NextResponse.json(
      { ok: false, provider: "DGHS NID Proxy", error: "Full name is required by the DGHS NID proxy." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  if (!MOBILE_PATTERN.test(mobile)) {
    return NextResponse.json(
      { ok: false, provider: "DGHS NID Proxy", error: "A valid 11-digit Bangladesh mobile number is required by the DGHS NID proxy." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  try {
    const result = await verifyWithDghs({
      type: mode === "birth" ? "brn" : "nid",
      nidOrBrn: identifier,
      name,
      dob: dateOfBirth,
      mobile,
    });

    return NextResponse.json(
      {
        ok: true,
        provider: "DGHS NID Proxy",
        requestType: mode === "birth" ? "BRN verification" : "NID verification",
        httpStatus: result.status,
        responseTimeMs: result.durationMs,
        data: result.data,
      },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    if (error instanceof DghsError) {
      return NextResponse.json(
        {
          ok: false,
          provider: "DGHS NID Proxy",
          code: error.code,
          error: error.message,
          upstreamStatus: error.upstreamStatus ?? null,
        },
        { status: error.status, headers: noStoreHeaders() },
      );
    }

    return NextResponse.json(
      { ok: false, provider: "DGHS NID Proxy", error: "Unexpected DGHS verification error." },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}

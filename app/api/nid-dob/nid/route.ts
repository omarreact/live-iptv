import { NextRequest, NextResponse } from "next/server";
import { isIdentityAuthorized, noStoreHeaders, sameOrigin } from "@/lib/nid-dob-auth";
import { PorichoyError, verifyNid } from "@/lib/porichoy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

const NID_PATTERN = /^(?:\d{10}|\d{13}|\d{17})$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function validDate(value: string) {
  if (!DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export async function POST(request: NextRequest) {
  if (!isIdentityAuthorized(request)) {
    return NextResponse.json(
      { ok: false, error: "Authentication required." },
      { status: 401, headers: noStoreHeaders() },
    );
  }

  if (!sameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: "Cross-origin request rejected." },
      { status: 403, headers: noStoreHeaders() },
    );
  }

  let body: { nidNumber?: string; dateOfBirth?: string; authorizedUse?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON request." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  const nidNumber = String(body.nidNumber || "").replace(/\D/g, "");
  const dateOfBirth = String(body.dateOfBirth || "").trim();

  if (body.authorizedUse !== true) {
    return NextResponse.json(
      { ok: false, error: "Authorization/consent confirmation is required." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  if (!NID_PATTERN.test(nidNumber)) {
    return NextResponse.json(
      { ok: false, error: "NID must be 10, 13, or 17 digits." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  if (!validDate(dateOfBirth)) {
    return NextResponse.json(
      { ok: false, error: "Date of birth must be a valid YYYY-MM-DD date." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  try {
    const result = await verifyNid(nidNumber, dateOfBirth);
    return NextResponse.json(
      {
        ok: true,
        provider: "Porichoy",
        requestType: "NID Autofill",
        httpStatus: result.status,
        responseTimeMs: result.durationMs,
        data: result.data,
      },
      { headers: noStoreHeaders() },
    );
  } catch (error) {
    if (error instanceof PorichoyError) {
      return NextResponse.json(
        {
          ok: false,
          provider: "Porichoy",
          code: error.code,
          error: error.message,
          upstreamStatus: error.upstreamStatus ?? null,
        },
        { status: error.status, headers: noStoreHeaders() },
      );
    }

    return NextResponse.json(
      { ok: false, error: "Unexpected NID verification error." },
      { status: 500, headers: noStoreHeaders() },
    );
  }
}

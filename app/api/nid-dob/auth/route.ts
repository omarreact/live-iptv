import { NextRequest, NextResponse } from "next/server";
import {
  createAccessSessionToken,
  isIdentityAuthorized,
  NID_DOB_COOKIE,
  NID_DOB_SESSION_MAX_AGE,
  noStoreHeaders,
  sameOrigin,
  verifyAccessPassword,
} from "@/lib/nid-dob-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return NextResponse.json(
    { ok: true, authenticated: isIdentityAuthorized(request) },
    { headers: noStoreHeaders() },
  );
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: "Cross-origin request rejected." },
      { status: 403, headers: noStoreHeaders() },
    );
  }

  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid request." },
      { status: 400, headers: noStoreHeaders() },
    );
  }

  if (!verifyAccessPassword(String(body.password || ""))) {
    return NextResponse.json(
      { ok: false, error: "Incorrect password." },
      { status: 401, headers: noStoreHeaders() },
    );
  }

  const response = NextResponse.json(
    { ok: true, authenticated: true },
    { headers: noStoreHeaders() },
  );

  response.cookies.set({
    name: NID_DOB_COOKIE,
    value: createAccessSessionToken(),
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: NID_DOB_SESSION_MAX_AGE,
  });

  return response;
}

export async function DELETE(request: NextRequest) {
  if (!sameOrigin(request)) {
    return NextResponse.json(
      { ok: false, error: "Cross-origin request rejected." },
      { status: 403, headers: noStoreHeaders() },
    );
  }

  const response = NextResponse.json(
    { ok: true, authenticated: false },
    { headers: noStoreHeaders() },
  );

  response.cookies.set({
    name: NID_DOB_COOKIE,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });

  return response;
}

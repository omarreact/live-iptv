"use client";

import { FormEvent, useEffect, useState } from "react";

type Mode = "nid" | "birth";

type Status = {
  ok: boolean;
  porichoyConfigured: boolean;
  providerNetwork: {
    reachable: boolean;
    status: number | null;
    state: "reachable" | "degraded" | "unreachable";
    reason?: string;
  };
  ready: boolean;
  time: string;
};

export default function NidDobPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [statusError, setStatusError] = useState("");
  const [mode, setMode] = useState<Mode>("nid");
  const [identifier, setIdentifier] = useState("");
  const [dob, setDob] = useState("");
  const [consent, setConsent] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [verificationBusy, setVerificationBusy] = useState(false);
  const [verificationResult, setVerificationResult] = useState<Record<string, unknown> | null>(null);

  async function refreshStatus() {
    setStatusError("");
    try {
      const response = await fetch("/api/nid-dob/status", {
        cache: "no-store",
        credentials: "same-origin",
      });
      const data = await response.json();
      if (response.status === 401) {
        setAuthenticated(false);
        setStatus(null);
        return;
      }
      if (!response.ok) throw new Error(data.error || "Status check failed.");
      setStatus(data);
    } catch (error) {
      setStatusError(error instanceof Error ? error.message : "Status check failed.");
    }
  }

  useEffect(() => {
    let active = true;

    void (async () => {
      try {
        const response = await fetch("/api/nid-dob/auth", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const data = await response.json();
        if (!active) return;
        const ok = Boolean(response.ok && data.authenticated);
        setAuthenticated(ok);
        if (ok) void refreshStatus();
      } catch {
        if (active) setAuthenticated(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    setAuthError("");
    setAuthBusy(true);

    try {
      const response = await fetch("/api/nid-dob/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        cache: "no-store",
        credentials: "same-origin",
        body: JSON.stringify({ password }),
      });

      const data = await response.json();
      if (!response.ok || !data.authenticated) {
        throw new Error(data.error || "Access denied.");
      }

      setPassword("");
      setAuthenticated(true);
      await refreshStatus();
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Access denied.");
    } finally {
      setAuthBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/nid-dob/auth", {
      method: "DELETE",
      cache: "no-store",
      credentials: "same-origin",
    }).catch(() => undefined);

    setAuthenticated(false);
    setStatus(null);
    setIdentifier("");
    setDob("");
    setConsent(false);
    setVerificationResult(null);
  }

  async function submitVerification(event: FormEvent) {
    event.preventDefault();
    setFormMessage("");
    setVerificationResult(null);
    setVerificationBusy(true);

    const endpoint = mode === "nid" ? "/api/nid-dob/nid" : "/api/nid-dob/birth";
    const payload =
      mode === "nid"
        ? {
            nidNumber: identifier,
            dateOfBirth: dob,
            authorizedUse: consent,
          }
        : {
            birthRegistrationNumber: identifier,
            dateOfBirth: dob,
            authorizedUse: consent,
          };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        cache: "no-store",
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => ({
        ok: false,
        error: `Verification endpoint returned HTTP ${response.status}.`,
      }))) as Record<string, unknown>;

      setVerificationResult(data);

      if (!response.ok || data.ok !== true) {
        setFormMessage(
          typeof data.error === "string"
            ? data.error
            : `Verification failed with HTTP ${response.status}.`,
        );
      } else {
        setFormMessage("");
      }

      void refreshStatus();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Verification request could not be completed.";
      setFormMessage(message);
      setVerificationResult({ ok: false, error: message });
    } finally {
      setVerificationBusy(false);
    }
  }

  if (authenticated === null) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#f4f8fb] p-5 text-slate-900">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-500 shadow-sm">
          Checking protected session…
        </div>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[radial-gradient(circle_at_15%_10%,#e6f7ef_0,transparent_30%),radial-gradient(circle_at_85%_90%,#e8f4fb_0,transparent_32%),#f4f8fb] p-5 text-slate-900">
        <section className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-7 shadow-[0_24px_80px_rgba(30,60,45,.12)]">
          <div className="mb-5 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-xl text-emerald-700">
            🔐
          </div>
          <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[.15em] text-emerald-700">
            Protected tool
          </p>
          <h1 className="text-3xl font-black tracking-tight text-slate-950">
            Bangladesh identity verification
          </h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Password-only access. No username is required.
          </p>

          <form className="mt-6 space-y-3" onSubmit={login}>
            <label className="block text-xs font-bold text-slate-700" htmlFor="identity-password">
              Access password
            </label>
            <input
              id="identity-password"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-13 w-full rounded-2xl border border-slate-300 bg-white px-4 text-slate-950 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
              required
            />
            {authError ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {authError}
              </div>
            ) : null}
            <button
              type="submit"
              disabled={authBusy}
              className="h-12 w-full rounded-full bg-emerald-700 font-extrabold text-white transition hover:bg-emerald-800 disabled:opacity-50"
            >
              {authBusy ? "Checking…" : "Unlock console"}
            </button>
          </form>

          <p className="mt-5 border-t border-slate-100 pt-4 text-[11px] leading-5 text-slate-500">
            The password is verified server-side and is not stored in browser local storage.
          </p>
        </section>
      </main>
    );
  }

  const ready = status?.ready === true;

  return (
    <main className="min-h-dvh bg-[#f4f8fb] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-slate-950 text-sm font-black text-white">
              P
            </div>
            <div>
              <div className="text-sm font-black tracking-[.12em]">PINFLIX</div>
              <div className="text-[10px] font-semibold text-slate-500">Protected identity console</div>
            </div>
          </div>
          <button
            onClick={() => void logout()}
            className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700"
          >
            Logout
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-7 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[.14em] text-emerald-700">
              NID + Birth Registration
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Bangladesh identity verification
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Native Pinflix route — no iframe and no dependency on ilm.pincodeit.com.
            </p>
          </div>
          <button
            onClick={() => void refreshStatus()}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 shadow-sm"
          >
            Refresh status
          </button>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.25fr_.75fr]">
          <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(36,63,82,.08)]">
            <div className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-slate-50 p-2">
              <button
                type="button"
                onClick={() => {
                  setMode("nid");
                  setIdentifier("");
                  setFormMessage("");
                  setVerificationResult(null);
                  setVerificationResult(null);
                }}
                className={`rounded-2xl px-4 py-3 text-left text-sm font-extrabold transition ${
                  mode === "nid" ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500"
                }`}
              >
                National ID
                <span className="mt-1 block text-[10px] font-semibold">NID + Date of Birth</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode("birth");
                  setIdentifier("");
                  setFormMessage("");
                }}
                className={`rounded-2xl px-4 py-3 text-left text-sm font-extrabold transition ${
                  mode === "birth" ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500"
                }`}
              >
                Birth Registration
                <span className="mt-1 block text-[10px] font-semibold">BRN + Date of Birth</span>
              </button>
            </div>

            <form onSubmit={submitVerification} className="space-y-5 p-5 sm:p-6">
              <label className="block">
                <span className="mb-2 block text-xs font-extrabold text-slate-700">
                  {mode === "nid" ? "NID number" : "Birth Registration Number"}
                </span>
                <input
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value.replace(/\D/g, "").slice(0, 17))}
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder={mode === "nid" ? "10 / 13 / 17 digit NID" : "17 digit BRN"}
                  className="h-13 w-full rounded-2xl border border-slate-300 bg-white px-4 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-extrabold text-slate-700">Date of birth</span>
                <input
                  type="date"
                  value={dob}
                  onChange={(event) => setDob(event.target.value)}
                  className="h-13 w-full rounded-2xl border border-slate-300 bg-white px-4 outline-none focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
                  required
                />
              </label>

              <label className="flex gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs leading-5 text-slate-600">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  className="mt-0.5 size-4 accent-emerald-700"
                />
                <span>I confirm that I am lawfully authorized to verify this identity record.</span>
              </label>

              {formMessage ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-5 text-amber-900">
                  {formMessage}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={!identifier || !dob || !consent || verificationBusy}
                className="h-12 w-full rounded-2xl bg-emerald-700 font-extrabold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {verificationBusy
                  ? "Checking live provider…"
                  : mode === "nid"
                    ? "Check NID"
                    : "Check Birth Registration"}
              </button>

              {verificationResult ? (
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-slate-100">
                  <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">
                        Live provider response
                      </div>
                      <div className="mt-1 text-xs font-bold">
                        {verificationResult.ok === true ? "Request succeeded" : "Request failed"}
                      </div>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                        verificationResult.ok === true
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-red-500/15 text-red-300"
                      }`}
                    >
                      {verificationResult.ok === true ? "LIVE DATA" : "ERROR"}
                    </span>
                  </div>
                  <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words p-4 text-[11px] leading-5">
                    {JSON.stringify(verificationResult, null, 2)}
                  </pre>
                </section>
              ) : null}
            </form>
          </section>

          <aside className="space-y-4">
            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(36,63,82,.08)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-500">Backend status</p>
                  <h2 className="mt-1 text-lg font-black">{ready ? "Ready" : "Setup required"}</h2>
                </div>
                <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${
                  ready
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}>
                  {ready ? "READY" : "NOT READY"}
                </span>
              </div>

              {status ? (
                <dl className="mt-5 space-y-3 text-xs">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="font-bold text-slate-500">Porichoy production credential</dt>
                    <dd className="mt-1 font-extrabold text-slate-800">
                      {status.porichoyConfigured ? "Configured" : "Not configured"}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <dt className="font-bold text-slate-500">Provider network</dt>
                    <dd className="mt-1 font-extrabold text-slate-800">{status.providerNetwork.state}</dd>
                  </div>
                </dl>
              ) : (
                <p className="mt-4 text-xs text-slate-500">Checking provider…</p>
              )}

              {statusError ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {statusError}
                </div>
              ) : null}
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-5 text-xs leading-5 text-slate-600 shadow-sm">
              <h2 className="text-sm font-black text-slate-900">Why this page is different</h2>
              <p className="mt-2">
                This is a native route on the working Pinflix deployment. It does not load another website inside an iframe, so the broken embedded-page problem is removed.
              </p>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}

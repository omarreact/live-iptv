"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Mode = "nid" | "birth";

type NetworkState = {
  reachable: boolean;
  status: number | null;
  state: "reachable" | "degraded" | "unreachable";
  reason?: string;
};

type ProviderState = {
  configured: boolean;
  network: NetworkState;
  ready: boolean;
  endpoint?: string;
};

type Status = {
  ok: boolean;
  providers: {
    porichoy: ProviderState;
    dghs: ProviderState;
  };
  ready: boolean;
  time: string;
};

type ProviderResult = Record<string, unknown> | null;

function ResultCard({
  title,
  subtitle,
  result,
}: {
  title: string;
  subtitle: string;
  result: ProviderResult;
}) {
  if (!result) return null;
  const ok = result.ok === true;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-slate-100">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[.12em] text-slate-400">
            {title}
          </div>
          <div className="mt-1 text-xs font-bold">{subtitle}</div>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
            ok ? "bg-emerald-500/15 text-emerald-300" : "bg-red-500/15 text-red-300"
          }`}
        >
          {ok ? "LIVE DATA" : "ERROR"}
        </span>
      </div>
      <pre className="max-h-[520px] overflow-auto whitespace-pre-wrap break-words p-4 text-[11px] leading-5">
        {JSON.stringify(result, null, 2)}
      </pre>
    </section>
  );
}

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
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [consent, setConsent] = useState(false);

  const [verificationBusy, setVerificationBusy] = useState(false);
  const [porichoyResult, setPorichoyResult] = useState<ProviderResult>(null);
  const [dghsResult, setDghsResult] = useState<ProviderResult>(null);
  const [formMessage, setFormMessage] = useState("");

  const providerReady = useMemo(
    () => Boolean(status?.providers?.porichoy?.ready || status?.providers?.dghs?.ready),
    [status],
  );

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
      setStatus(data as Status);
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
    setFullName("");
    setMobile("");
    setConsent(false);
    setPorichoyResult(null);
    setDghsResult(null);
  }

  async function requestJson(url: string, payload: Record<string, unknown>) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      cache: "no-store",
      credentials: "same-origin",
      body: JSON.stringify(payload),
    });

    return (await response.json().catch(() => ({
      ok: false,
      error: `Provider endpoint returned HTTP ${response.status}.`,
    }))) as Record<string, unknown>;
  }

  async function submitVerification(event: FormEvent) {
    event.preventDefault();
    setFormMessage("");
    setPorichoyResult(null);
    setDghsResult(null);
    setVerificationBusy(true);

    const porichoyEndpoint = mode === "nid" ? "/api/nid-dob/nid" : "/api/nid-dob/birth";
    const porichoyPayload =
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

    const dghsPayload = {
      mode,
      identifier,
      dateOfBirth: dob,
      name: fullName,
      mobile,
      authorizedUse: consent,
    };

    try {
      const porichoyPromise = requestJson(porichoyEndpoint, porichoyPayload);

      const dghsPromise =
        fullName.trim().length >= 2 && /^01\d{9}$/.test(mobile.replace(/\D/g, ""))
          ? requestJson("/api/nid-dob/dghs", dghsPayload)
          : Promise.resolve({
              ok: false,
              provider: "DGHS NID Proxy",
              code: "INPUT_REQUIRED",
              error: "DGHS requires the citizen full name and an 11-digit Bangladesh mobile number.",
            });

      const [porichoy, dghs] = await Promise.all([porichoyPromise, dghsPromise]);

      setPorichoyResult(porichoy);
      setDghsResult(dghs);

      if (porichoy.ok !== true && dghs.ok !== true) {
        setFormMessage("No live provider returned a successful record. See each provider box below for the exact reason.");
      }

      void refreshStatus();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Verification request could not be completed.";
      setFormMessage(message);
    } finally {
      setVerificationBusy(false);
    }
  }

  function switchMode(next: Mode) {
    setMode(next);
    setIdentifier("");
    setFormMessage("");
    setPorichoyResult(null);
    setDghsResult(null);
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
            Provider credentials stay server-side and are never returned to the browser.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-[#f4f8fb] text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
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

      <section className="mx-auto max-w-6xl px-4 py-7 sm:py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-[.14em] text-emerald-700">
              NID + Birth Registration
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Live identity provider comparison
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              One submission checks Porichoy and the official DGHS NID proxy separately and keeps each provider response in its own box.
            </p>
          </div>
          <button
            onClick={() => void refreshStatus()}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-extrabold text-slate-700 shadow-sm"
          >
            Refresh status
          </button>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[1.35fr_.65fr]">
          <section className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_55px_rgba(36,63,82,.08)]">
            <div className="grid grid-cols-2 gap-2 border-b border-slate-200 bg-slate-50 p-2">
              <button
                type="button"
                onClick={() => switchMode("nid")}
                className={`rounded-2xl px-4 py-3 text-left text-sm font-extrabold transition ${
                  mode === "nid" ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500"
                }`}
              >
                National ID
                <span className="mt-1 block text-[10px] font-semibold">NID + Date of Birth</span>
              </button>
              <button
                type="button"
                onClick={() => switchMode("birth")}
                className={`rounded-2xl px-4 py-3 text-left text-sm font-extrabold transition ${
                  mode === "birth" ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500"
                }`}
              >
                Birth Registration
                <span className="mt-1 block text-[10px] font-semibold">BRN + Date of Birth</span>
              </button>
            </div>

            <form onSubmit={submitVerification} className="space-y-5 p-5 sm:p-6">
              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>

              <div className="rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
                <div className="mb-3">
                  <div className="text-xs font-black text-cyan-950">DGHS additional fields</div>
                  <div className="mt-1 text-[11px] leading-5 text-cyan-800">
                    The official DGHS NID proxy documentation includes full name and mobile in its request body. Porichoy does not need these two fields.
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs font-extrabold text-slate-700">Full name</span>
                    <input
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      autoComplete="name"
                      placeholder="Required for DGHS"
                      className="h-12 w-full rounded-2xl border border-cyan-200 bg-white px-4 outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-extrabold text-slate-700">Mobile number</span>
                    <input
                      value={mobile}
                      onChange={(event) => setMobile(event.target.value.replace(/\D/g, "").slice(0, 11))}
                      inputMode="tel"
                      autoComplete="tel"
                      placeholder="01XXXXXXXXX"
                      className="h-12 w-full rounded-2xl border border-cyan-200 bg-white px-4 outline-none focus:border-cyan-600 focus:ring-4 focus:ring-cyan-100"
                    />
                  </label>
                </div>
              </div>

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
                {verificationBusy ? "Checking live providers…" : "Check all live providers"}
              </button>

              <div className="grid gap-4">
                <ResultCard
                  title="Porichoy"
                  subtitle={mode === "nid" ? "NID Autofill response" : "Birth Autofill response"}
                  result={porichoyResult}
                />
                <ResultCard
                  title="DGHS NID Proxy"
                  subtitle={mode === "nid" ? "NID verification response" : "BRN verification response"}
                  result={dghsResult}
                />
              </div>
            </form>
          </section>

          <aside className="space-y-4">
            <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_18px_55px_rgba(36,63,82,.08)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[.12em] text-slate-500">Backend status</p>
                  <h2 className="mt-1 text-lg font-black">{providerReady ? "At least one provider ready" : "Setup required"}</h2>
                </div>
                <span className={`rounded-full border px-3 py-1.5 text-[10px] font-black ${
                  providerReady
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-amber-200 bg-amber-50 text-amber-700"
                }`}>
                  {providerReady ? "READY" : "NOT READY"}
                </span>
              </div>

              {status ? (
                <div className="mt-5 space-y-3 text-xs">
                  {(["porichoy", "dghs"] as const).map((key) => {
                    const item = status.providers[key];
                    return (
                      <div key={key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-black text-slate-900">
                            {key === "porichoy" ? "Porichoy" : "DGHS NID Proxy"}
                          </div>
                          <span className={`rounded-full px-2 py-1 text-[9px] font-black ${
                            item.ready ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-800"
                          }`}>
                            {item.ready ? "READY" : "NOT READY"}
                          </span>
                        </div>
                        <dl className="mt-3 grid grid-cols-2 gap-2">
                          <div>
                            <dt className="text-slate-500">Credentials</dt>
                            <dd className="mt-1 font-extrabold">{item.configured ? "Configured" : "Missing"}</dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Network</dt>
                            <dd className="mt-1 font-extrabold">{item.network.state}</dd>
                          </div>
                        </dl>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 text-xs text-slate-500">Checking providers…</p>
              )}

              {statusError ? (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {statusError}
                </div>
              ) : null}
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-white p-5 text-xs leading-5 text-slate-600 shadow-sm">
              <h2 className="text-sm font-black text-slate-900">Provider rules</h2>
              <p className="mt-2">
                Porichoy and DGHS use separate server-side credentials. A failure in one provider does not stop the other provider from being tested.
              </p>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}

"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type AdminItem = {
  id: string;
  title: string;
  kind: string;
  protocol: string;
  createdAt: string;
};

const inputClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm outline-none placeholder:text-subtle focus:border-brand";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [items, setItems] = useState<AdminItem[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadItems = useCallback(
    async (secret = password) => {
      const response = await fetch("/api/admin/media", {
        headers: { "x-admin-password": secret },
      });
      const data = (await response.json()) as { items?: AdminItem[]; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to load content");
      setItems(data.items ?? []);
    },
    [password],
  );

  useEffect(() => {
    const saved = window.sessionStorage.getItem("pinflix-admin-password");
    if (saved) {
      setPassword(saved);
      void loadItems(saved).catch(() => window.sessionStorage.removeItem("pinflix-admin-password"));
    }
  }, [loadItems]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const secret = String(form.get("adminPassword") ?? "");
    const response = await fetch("/api/admin/media", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-admin-password": secret },
      body: JSON.stringify(Object.fromEntries(form)),
    });
    const data = (await response.json()) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setMessage(data.error ?? "Unable to save content.");
      return;
    }
    window.sessionStorage.setItem("pinflix-admin-password", secret);
    setPassword(secret);
    setMessage("Content saved.");
    event.currentTarget.reset();
    await loadItems(secret);
  }

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">Pinflix admin</p>
      <h1 className="mt-1 text-3xl font-black">Add licensed movie or show content</h1>
      <p className="mt-2 text-sm text-muted">
        Enter a source you own or are licensed to distribute. MP4, HLS, and DASH are supported.
      </p>

      <form
        onSubmit={submit}
        className="mt-8 grid gap-4 rounded-2xl border border-border bg-surface p-5 sm:grid-cols-2"
      >
        <input
          name="adminPassword"
          type="password"
          required
          placeholder="Admin password"
          className={inputClass}
          defaultValue={password}
        />
        <input name="title" required placeholder="Title" className={inputClass} />
        <select name="kind" className={inputClass} defaultValue="movie">
          <option value="movie">Movie</option>
          <option value="series">TV series</option>
        </select>
        <select name="protocol" className={inputClass} defaultValue="hls">
          <option value="mp4">MP4</option>
          <option value="hls">HLS (.m3u8)</option>
          <option value="dash">DASH (.mpd)</option>
        </select>
        <input name="year" inputMode="numeric" placeholder="Year" className={inputClass} />
        <input
          name="poster"
          type="url"
          placeholder="Poster URL (optional)"
          className={inputClass}
        />
        <input
          name="sourceUrl"
          required
          type="url"
          placeholder="Licensed playback URL"
          className={`${inputClass} sm:col-span-2`}
        />
        <input
          name="subtitleUrl"
          type="url"
          placeholder="Subtitle URL (optional)"
          className={inputClass}
        />
        <input
          name="subtitleLanguage"
          placeholder="Subtitle language, e.g. en"
          className={inputClass}
        />
        <textarea
          name="overview"
          placeholder="Description (optional)"
          rows={4}
          className={`${inputClass} sm:col-span-2`}
        />
        <button
          disabled={busy}
          className="rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 sm:col-span-2"
        >
          {busy ? "Saving…" : "Save content"}
        </button>
        {message ? <p className="text-sm text-muted sm:col-span-2">{message}</p> : null}
      </form>

      <section className="mt-8">
        <h2 className="text-xl font-bold">Saved content</h2>
        <div className="mt-3 divide-y divide-border rounded-xl border border-border bg-surface">
          {items.length ? (
            items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <span className="font-semibold">{item.title}</span>
                <span className="text-muted">
                  {item.kind} · {item.protocol}
                </span>
              </div>
            ))
          ) : (
            <p className="px-4 py-5 text-sm text-muted">No content added yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}

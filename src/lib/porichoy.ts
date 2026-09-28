const DEFAULT_BASE_URL = "https://api.porichoybd.com";
const DEFAULT_NID_PATH = "/api/v2/verifications/autofill";
const DEFAULT_BIRTH_PATH = "/api/v1/verifications/autofill";

export class PorichoyError extends Error {
  status: number;
  code: string;
  upstreamStatus?: number;

  constructor(message: string, status = 502, code = "PORICHOY_ERROR", upstreamStatus?: number) {
    super(message);
    this.name = "PorichoyError";
    this.status = status;
    this.code = code;
    this.upstreamStatus = upstreamStatus;
  }
}

function apiKey() {
  return process.env.PORICHOY_API_KEY?.trim() || "";
}

function baseUrl() {
  const raw = (process.env.PORICHOY_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
  const parsed = new URL(raw);
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new PorichoyError("Porichoy production URL must use HTTPS.", 503, "PORICHOY_BAD_CONFIG");
  }
  return parsed.toString().replace(/\/$/, "");
}

function pathFromEnv(name: "PORICHOY_NID_PATH" | "PORICHOY_BIRTH_PATH", fallback: string) {
  const value = process.env[name]?.trim() || fallback;
  return value.startsWith("/") ? value : `/${value}`;
}

function parseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 1000) };
  }
}

async function request(path: string, payload: Record<string, unknown>) {
  const key = apiKey();
  if (!key) {
    throw new PorichoyError(
      "Porichoy production API key is not configured on this deployment.",
      503,
      "PORICHOY_NOT_CONFIGURED",
    );
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(3000, Number(process.env.PORICHOY_TIMEOUT_MS || 15000));
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const endpoint = `${baseUrl()}${path}`;
  const startedAt = Date.now();

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        "x-api-key": key,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: controller.signal,
    });

    const raw = await response.text();
    const data = parseBody(raw);

    if (!response.ok) {
      const message =
        response.status === 401 || response.status === 403
          ? "Porichoy rejected the configured API credential."
          : response.status === 404
            ? "No matching record was returned."
            : response.status === 429
              ? "Porichoy rate limit reached."
              : response.status >= 500
                ? "Porichoy is temporarily unavailable."
                : "Porichoy returned an unsuccessful response.";

      throw new PorichoyError(
        message,
        response.status === 429 ? 429 : response.status >= 500 ? 503 : 502,
        "PORICHOY_UPSTREAM_ERROR",
        response.status,
      );
    }

    return {
      endpoint,
      status: response.status,
      durationMs: Date.now() - startedAt,
      data,
    };
  } catch (error) {
    if (error instanceof PorichoyError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new PorichoyError("Porichoy request timed out.", 504, "PORICHOY_TIMEOUT");
    }
    throw new PorichoyError("Porichoy cannot be reached from this deployment.", 503, "PORICHOY_NETWORK_ERROR");
  } finally {
    clearTimeout(timer);
  }
}

export function porichoyConfigured() {
  return Boolean(apiKey());
}

export function verifyNid(nidNumber: string, dateOfBirth: string) {
  return request(pathFromEnv("PORICHOY_NID_PATH", DEFAULT_NID_PATH), {
    nidNumber,
    dateOfBirth,
    englishTranslation: true,
  });
}

export function verifyBirthRegistration(birthRegistrationNumber: string, dateOfBirth: string) {
  return request(pathFromEnv("PORICHOY_BIRTH_PATH", DEFAULT_BIRTH_PATH), {
    birthRegistrationNumber,
    dateOfBirth,
  });
}

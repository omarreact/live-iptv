const DEFAULT_DGHS_URL = "https://nidproxy.mcishr.dghs.gov.bd/verify-and-get-data";

export class DghsError extends Error {
  status: number;
  code: string;
  upstreamStatus?: number;

  constructor(message: string, status = 502, code = "DGHS_ERROR", upstreamStatus?: number) {
    super(message);
    this.name = "DghsError";
    this.status = status;
    this.code = code;
    this.upstreamStatus = upstreamStatus;
  }
}

function config() {
  const url = (process.env.DGHS_NID_PROXY_URL?.trim() || DEFAULT_DGHS_URL).trim();
  const token = process.env.DGHS_X_AUTH_TOKEN?.trim() || "";
  const clientId = process.env.DGHS_CLIENT_ID?.trim() || "";
  const email = process.env.DGHS_EMAIL?.trim() || "";
  const performer = process.env.DGHS_PERFORMER?.trim() || "";

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new DghsError("DGHS NID proxy URL is invalid.", 503, "DGHS_BAD_CONFIG");
  }

  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new DghsError("DGHS production URL must use HTTPS.", 503, "DGHS_BAD_CONFIG");
  }

  return { url: parsed.toString(), token, clientId, email, performer };
}

export function dghsConfigured() {
  const { token, clientId, email, performer } = config();
  return Boolean(token && clientId && email && performer);
}

function parseBody(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 1000) };
  }
}

export async function verifyWithDghs(input: {
  type: "nid" | "brn";
  nidOrBrn: string;
  name: string;
  dob: string;
  mobile: string;
}) {
  const { url, token, clientId, email, performer } = config();

  if (!(token && clientId && email && performer)) {
    throw new DghsError(
      "DGHS credentials are not configured on this deployment.",
      503,
      "DGHS_NOT_CONFIGURED",
    );
  }

  const controller = new AbortController();
  const timeoutMs = Math.max(3000, Number(process.env.DGHS_TIMEOUT_MS || 15000));
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        email,
        "x-auth-token": token,
        "client-id": clientId,
      },
      body: JSON.stringify({
        performer,
        nidOrBrn: input.nidOrBrn,
        Type: input.type,
        name: input.name,
        dob: input.dob,
        mobile: input.mobile,
      }),
      cache: "no-store",
      signal: controller.signal,
    });

    const raw = await response.text();
    const data = parseBody(raw);

    if (!response.ok) {
      const message =
        response.status === 401 || response.status === 403
          ? "DGHS rejected the configured facility credentials."
          : response.status === 404
            ? "DGHS NID proxy endpoint was not found."
            : response.status === 422
              ? "DGHS rejected one or more identity fields."
              : response.status === 429
                ? "DGHS rate limit reached."
                : response.status >= 500
                  ? "DGHS NID proxy is temporarily unavailable."
                  : "DGHS returned an unsuccessful response.";

      throw new DghsError(
        message,
        response.status === 429 ? 429 : response.status >= 500 ? 503 : 502,
        "DGHS_UPSTREAM_ERROR",
        response.status,
      );
    }

    return {
      endpoint: url,
      status: response.status,
      durationMs: Date.now() - startedAt,
      data,
    };
  } catch (error) {
    if (error instanceof DghsError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new DghsError("DGHS request timed out.", 504, "DGHS_TIMEOUT");
    }
    throw new DghsError(
      "DGHS NID proxy cannot be reached from this deployment.",
      503,
      "DGHS_NETWORK_ERROR",
    );
  } finally {
    clearTimeout(timer);
  }
}

export function dghsEndpoint() {
  return config().url;
}

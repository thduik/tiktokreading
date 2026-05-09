import { createHmac, timingSafeEqual } from "node:crypto";

export const ADMIN_SESSION_COOKIE = "readtok_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

type AdminSessionPayload = {
  username: string;
  expiresAt: number;
};

export type AdminAuthConfig = {
  username: string;
  password: string;
  sessionSecret: string;
};

export function readAdminAuthConfig(env: NodeJS.ProcessEnv): AdminAuthConfig | null {
  const username = env.ADMIN_USERNAME?.trim();
  const password = env.ADMIN_PASSWORD ?? "";
  const sessionSecret = env.ADMIN_SESSION_SECRET ?? password;

  if (!username || !password || !sessionSecret) {
    return null;
  }

  return { username, password, sessionSecret };
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function encodePayload(payload: AdminSessionPayload) {
  return Buffer.from(JSON.stringify(payload)).toString("base64url");
}

function decodePayload(value: string): AdminSessionPayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as {
      username?: unknown;
      expiresAt?: unknown;
    };

    if (
      typeof parsed.username !== "string" ||
      typeof parsed.expiresAt !== "number" ||
      !Number.isFinite(parsed.expiresAt)
    ) {
      return null;
    }

    return {
      username: parsed.username,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return null;
  }
}

export function verifyAdminCredentials({
  config,
  username,
  password,
}: {
  config: AdminAuthConfig;
  username: string;
  password: string;
}) {
  return safeEqual(username, config.username) && safeEqual(password, config.password);
}

export function createAdminSessionToken({
  config,
  now = Date.now(),
}: {
  config: AdminAuthConfig;
  now?: number;
}) {
  const body = encodePayload({
    username: config.username,
    expiresAt: now + SESSION_TTL_MS,
  });
  return `${body}.${sign(body, config.sessionSecret)}`;
}

export function verifyAdminSessionToken({
  config,
  token,
  now = Date.now(),
}: {
  config: AdminAuthConfig;
  token: string | undefined;
  now?: number;
}) {
  if (!token) {
    return null;
  }

  const [body, signature] = token.split(".");
  if (!body || !signature) {
    return null;
  }

  if (!safeEqual(signature, sign(body, config.sessionSecret))) {
    return null;
  }

  const payload = decodePayload(body);
  if (!payload || payload.expiresAt <= now || payload.username !== config.username) {
    return null;
  }

  return {
    username: payload.username,
    expiresAt: payload.expiresAt,
  };
}


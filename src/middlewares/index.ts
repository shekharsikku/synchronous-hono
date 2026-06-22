import { inflateSync } from "node:zlib";
import type { Context, Next } from "hono";
import { getSignedCookie } from "hono/cookie";
import { rateLimiter } from "hono-rate-limiter";
import { compactDecrypt } from "jose";
import pino from "pino";
import type { ZodType } from "zod";
import env from "#/configs/env.js";
import { accessSecret } from "#/utilities/crypto.js";
import type { UserInfo } from "#/utilities/helpers.js";
import { HttpError } from "#/utilities/response.js";

const authorizeAccess = async (ctx: Context): Promise<UserInfo> => {
  const accessToken = await getSignedCookie(ctx, env.SIGNED_SECRET, "access");
  if (!accessToken) throw new Error("No access token available!");

  const decryptedAccess = await compactDecrypt(accessToken, accessSecret);
  return JSON.parse(inflateSync(decryptedAccess.plaintext).toString());
};

export const authAccess = async (ctx: Context, next: Next) => {
  try {
    ctx.req.user = await authorizeAccess(ctx);
    return await next();
  } catch {
    throw new HttpError(401, "Unauthorized access request!");
  }
};

export const authEvents = async (ctx: Context, next: Next) => {
  try {
    ctx.req.user = await authorizeAccess(ctx);
    return await next();
  } catch {
    return ctx.text("Unauthorized events request!", 401);
  }
};

export const validate =
  <T>(schema: ZodType<T>) =>
  async (ctx: Context, next: Next) => {
    const payload = await ctx.req.json();
    ctx.set("validated", schema.parse(payload));
    return await next();
  };

const getClientIp = (ctx: Context): string => {
  return (
    ctx.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    ctx.req.header("cf-connecting-ip") ??
    ctx.req.header("true-client-ip") ??
    ctx.req.header("x-real-ip") ??
    ctx.req.header("x-client-ip") ??
    "unknown-ip"
  );
};

export const limiter = (minutes = 10, limit = 1000) => {
  return rateLimiter({
    windowMs: minutes * 60 * 1000,
    limit: limit,
    standardHeaders: true,
    keyGenerator: (ctx) => {
      return getClientIp(ctx);
    },
    handler: (ctx) => {
      ctx.var.logger.error("Rate limit exceeded for ip: %s", getClientIp(ctx));
      throw new HttpError(429, "You've made too many requests!");
    },
  });
};

const otherOptions = env.isDev ? { transport: { target: "pino-pretty", options: { colorize: true } } } : { base: null };

export const logger = pino({
  level: env.LOG_LEVEL,
  serializers: {
    res(res) {
      const headers = res.headers instanceof Headers ? Object.fromEntries(res.headers.entries()) : res.headers;
      delete headers["set-cookie"];
      return { status: res.status, headers };
    },
  },
  redact: {
    paths: ["req.headers.cookie", "res.headers['set-cookie']"],
    remove: true,
  },
  msgPrefix: "[SYNCHRONOUS] ",
  ...otherOptions,
});

import { inflateSync } from "node:zlib";
import type { Context, MiddlewareHandler } from "hono";
import { getSignedCookie } from "hono/cookie";
import { rateLimiter } from "hono-rate-limiter";
import { compactDecrypt } from "jose";
import pino from "pino";
import env from "#/configs/env.js";
import type { AppBindings } from "#/openapi/index.js";
import { accessSecret } from "#/utilities/crypto.js";
import type { UserInfo } from "#/utilities/helpers.js";
import { HttpResponse, HttpStatus } from "#/utilities/http/index.js";

const authorizeAccess = async <C extends Context>(ctx: C): Promise<UserInfo> => {
  const accessToken = await getSignedCookie(ctx, env.SIGNED_SECRET, "access");
  if (!accessToken) throw new Error("No access token available!");

  const decryptedAccess = await compactDecrypt(accessToken, accessSecret);
  return JSON.parse(inflateSync(decryptedAccess.plaintext).toString());
};

export const authAccess: MiddlewareHandler<AppBindings> = async (ctx, next) => {
  try {
    ctx.set("user", await authorizeAccess(ctx));
    return await next();
  } catch {
    return HttpResponse.error(ctx, HttpStatus.UNAUTHORIZED, "Unauthorized request!");
  }
};

export const authEvents: MiddlewareHandler<AppBindings> = async (ctx, next) => {
  try {
    ctx.set("user", await authorizeAccess(ctx));
    return await next();
  } catch {
    return ctx.text("Unauthorized request!", HttpStatus.UNAUTHORIZED);
  }
};

const getClientIp = <C extends Context>(ctx: C): string => {
  return (
    ctx.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    ctx.req.header("cf-connecting-ip") ??
    ctx.req.header("true-client-ip") ??
    ctx.req.header("x-real-ip") ??
    ctx.req.header("x-client-ip") ??
    "unknown-ip"
  );
};

export const limiter = (minutes = 10, limit = 10000) => {
  return rateLimiter({
    windowMs: minutes * 60 * 1000,
    limit: limit,
    standardHeaders: true,
    keyGenerator: (ctx) => {
      return getClientIp(ctx);
    },
    handler: (ctx) => {
      ctx.var.logger.error("Rate limit exceeded for ip: %s", getClientIp(ctx));
      return HttpResponse.error(
        ctx,
        HttpStatus.TOO_MANY_REQUESTS,
        "You've made too many requests!",
      );
    },
  });
};

const otherOptions = env.isDev
  ? { transport: { target: "pino-pretty", options: { colorize: true } } }
  : { base: null };

export const logger = pino({
  level: env.LOG_LEVEL,
  serializers: {
    res(res) {
      const headers =
        res.headers instanceof Headers ? Object.fromEntries(res.headers.entries()) : res.headers;
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

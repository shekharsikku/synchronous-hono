import { inflateSync } from "node:zlib";
import type { Context, Next } from "hono";
import { getSignedCookie } from "hono/cookie";
import { rateLimiter } from "hono-rate-limiter";
import { compactDecrypt } from "jose";
import pino from "pino";
import { ZodError, type ZodType } from "zod";
import env from "#/configs/env.js";
import type { UserInterface } from "#/interfaces/index.js";
import { generateSecret } from "#/utils/helpers.js";
import { HttpError, HttpResponse } from "#/utils/response.js";

const authorizeAccess = async (ctx: Context): Promise<UserInterface> => {
  const accessToken = await getSignedCookie(ctx, env.SIGNED_SECRET, "access");
  if (!accessToken) throw new Error("No access token available!");

  const accessSecret = await generateSecret();
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
    try {
      const payload = await ctx.req.json();
      ctx.set("validated", schema.parse(payload));
      return await next();
    } catch (error: any) {
      const response = new HttpResponse(400, "Validation error occurred!", { error });
      if (error instanceof ZodError && error.name === "ZodError") {
        response.error = JSON.parse(error.message);
      }
      return response.send(ctx);
    }
  };

export const limiter = (minutes = 10, limit = 1000) => {
  return rateLimiter({
    windowMs: minutes * 60 * 1000,
    limit: limit,
    standardHeaders: true,
    keyGenerator: (ctx) => {
      return ctx.req.header("x-device-id") ?? "unknown-device";
    },
    handler: (ctx: Context) => {
      ctx.var.logger.error(`Rate limit exceeded for ID: ${ctx.req.header("x-device-id")}`);
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

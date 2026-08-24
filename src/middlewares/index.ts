import { inflateSync } from "node:zlib";
import type { Context, MiddlewareHandler } from "hono";
import { getSignedCookie } from "hono/cookie";
import { compactDecrypt } from "jose";
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

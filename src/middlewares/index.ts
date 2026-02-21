import { inflateSync } from "node:zlib";
import type { Context, Next } from "hono";
import { deleteCookie, getSignedCookie } from "hono/cookie";
import { rateLimiter } from "hono-rate-limiter";
import { compactDecrypt, jwtVerify } from "jose";
import { Types } from "mongoose";
import { ZodError, type ZodObject } from "zod";
import env from "#/configs/env.js";
import type { UserInterface } from "#/interfaces/index.js";
import { User } from "#/models/index.js";
import { createUserInfo, generateAccess, generateHash, generateRefresh, generateSecret } from "#/utils/helpers.js";
import { ErrorResponse, HttpError, SuccessResponse } from "#/utils/response.js";

const parseAuthKey = (authKey: any) => {
  const [firstKey, secondKey] = authKey.split(":", 2);

  if (!Types.ObjectId.isValid(firstKey) || !Types.ObjectId.isValid(secondKey)) {
    throw new Error("Invalid authentication key!");
  }

  return {
    userId: new Types.ObjectId(firstKey),
    authId: new Types.ObjectId(secondKey),
  };
};

export const revokeToken = async (ctx: Context, authKey: any) => {
  try {
    const { userId, authId } = parseAuthKey(authKey);

    await User.updateOne(
      {
        _id: userId,
        authentication: {
          $elemMatch: { _id: authId },
        },
      },
      {
        $pull: {
          authentication: { _id: authId },
        },
      },
    );
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
  } finally {
    deleteCookie(ctx, "access");
    deleteCookie(ctx, "refresh");
    deleteCookie(ctx, "current");
  }
};

export const authAccess = async (ctx: Context, next: Next) => {
  try {
    const accessToken = await getSignedCookie(ctx, env.SIGNED_SECRET, "access");

    if (!accessToken) {
      throw new HttpError(401, "Unauthorized access request!");
    }

    let accessPayload: UserInterface;

    try {
      const accessSecret = await generateSecret();
      const decrypted = await compactDecrypt(accessToken, accessSecret);
      accessPayload = JSON.parse(inflateSync(decrypted.plaintext).toString());
    } catch (_error: any) {
      throw new HttpError(401, "Invalid or expired access request!");
    }

    ctx.req.user = accessPayload;
    return await next();
  } catch (error: any) {
    return ErrorResponse(ctx, error.code || 500, error.message || "Error while auth access!");
  }
};

export const authRefresh = async (ctx: Context) => {
  try {
    const deviceId = ctx.req.header("x-device-id") ?? "unknown-device";
    const refreshToken = await getSignedCookie(ctx, env.SIGNED_SECRET, "refresh");
    const currentAuthKey = await getSignedCookie(ctx, env.SIGNED_SECRET, "current");

    if (!refreshToken || !currentAuthKey) {
      throw new HttpError(401, "Unauthorized refresh request!");
    }

    let userId: Types.ObjectId;
    let authorizeId: Types.ObjectId;
    let hashedRefresh: string;
    let refreshExpiry: number | undefined;

    try {
      const parsedPayload = parseAuthKey(currentAuthKey);
      authorizeId = parsedPayload.authId;

      const refreshSecret = new TextEncoder().encode(env.REFRESH_SECRET);

      const [jwtResult, hashedToken] = await Promise.all([
        jwtVerify(refreshToken, refreshSecret),
        generateHash(refreshToken),
      ]);

      hashedRefresh = hashedToken;
      refreshExpiry = jwtResult.payload.exp;

      if (
        !Types.ObjectId.isValid(jwtResult.payload.uid!) ||
        !parsedPayload.userId.equals(new Types.ObjectId(jwtResult.payload.uid)) ||
        jwtResult.payload.jti !== deviceId
      ) {
        throw new Error("Refresh request mismatch!");
      }

      userId = parsedPayload.userId;
    } catch (_error: any) {
      await revokeToken(ctx, currentAuthKey);
      throw new HttpError(403, "Please, signin again to continue!");
    }

    const currentTime = Math.floor(Date.now() / 1000);
    const expiresAt = refreshExpiry ?? currentTime;

    const authFilter = {
      _id: userId,
      authentication: {
        $elemMatch: { _id: authorizeId, token: hashedRefresh },
      },
    };

    const requestUser = await User.findOne(authFilter);

    if (!requestUser) {
      throw new HttpError(401, "Invalid authorization!");
    }

    const userInfo = createUserInfo(requestUser);
    const shouldRotate = currentTime >= expiresAt - env.REFRESH_EXPIRY / 2;

    if (shouldRotate) {
      const newRefreshToken = await generateRefresh(ctx, userId, authorizeId, deviceId);
      const newHashedRefresh = await generateHash(newRefreshToken);
      const newRefreshExpiry = new Date(Date.now() + env.REFRESH_EXPIRY * 1000);

      const updatedResult = await User.updateOne(authFilter, {
        $set: {
          "authentication.$.token": newHashedRefresh,
          "authentication.$.expiry": newRefreshExpiry,
        },
      });

      if (updatedResult.modifiedCount === 0) {
        await revokeToken(ctx, currentAuthKey);
        throw new HttpError(403, "Please, signin again to continue!");
      }
    }

    await generateAccess(ctx, userInfo);

    return SuccessResponse(ctx, 200, "Token refreshed successfully!");
  } catch (error: any) {
    return ErrorResponse(ctx, error.code || 500, error.message || "Error while token refresh!");
  }
};

export const authEvents = async (ctx: Context, next: Next) => {
  try {
    const accessToken = await getSignedCookie(ctx, env.SIGNED_SECRET, "access");

    if (!accessToken) {
      return ctx.text("Unauthorized events request!", 401);
    }

    const accessSecret = await generateSecret();
    const decrypted = await compactDecrypt(accessToken, accessSecret);
    const accessPayload = JSON.parse(inflateSync(decrypted.plaintext).toString());

    ctx.req.user = accessPayload;
    return await next();
  } catch (_error: any) {
    return ctx.text("Unauthorized events request!", 401);
  }
};

export const validate = (schema: ZodObject) => async (ctx: Context, next: Next) => {
  try {
    const payload = await ctx.req.json();
    ctx.set("validated", schema.parse(payload));
    return await next();
  } catch (error: any) {
    if (error instanceof ZodError) {
      return ErrorResponse(ctx, 400, "Validation error occurred!", error.issues);
    }
    return ErrorResponse(ctx, 400, "Invalid request body!");
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
      console.error(`Rate limit exceeded for ID: ${ctx.req.header("x-device-id")}`);
      throw new HttpError(429, "You've made too many requests!");
    },
  });
};

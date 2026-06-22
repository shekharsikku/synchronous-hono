import { hash, verify } from "argon2";
import type { Context } from "hono";
import { deleteCookie, getSignedCookie } from "hono/cookie";
import { jwtVerify } from "jose";
import { Types } from "mongoose";
import env from "#/configs/env.js";
import { logger } from "#/middlewares/index.js";
import { User } from "#/models/index.js";
import type { AppRouteHandler } from "#/openapi/index.js";
import type { RefreshRoute, SignInRoute, SignOutRoute, SignUpRoute } from "#/routes/auth.js";
import { decryptAuth, generateHash, refreshSecret } from "#/utilities/crypto.js";
import {
  argonOptions,
  cookieOptions,
  createUserInfo,
  generateAccess,
  generateRefresh,
} from "#/utilities/helpers.js";
import { HttpError, HttpResponse, HttpStatus } from "#/utilities/http/index.js";

const parseAuthKey = (token: string) => {
  const { uid, aid } = decryptAuth(token);

  if (!Types.ObjectId.isValid(uid) || !Types.ObjectId.isValid(aid)) {
    throw new Error("Invalid authentication key!");
  }

  return { userId: new Types.ObjectId(uid), authId: new Types.ObjectId(aid) };
};

export const revokeToken = async <C extends Context>(ctx: C, token: string) => {
  try {
    const { userId, authId } = parseAuthKey(token);

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
  } catch (err) {
    logger.error({ err }, "Unknown error occurred!");
  } finally {
    deleteCookie(ctx, "access", cookieOptions);
    deleteCookie(ctx, "refresh", cookieOptions);
    deleteCookie(ctx, "current", cookieOptions);
  }
};

export const signUpUser: AppRouteHandler<SignUpRoute> = async (ctx) => {
  const { email, password } = ctx.req.valid("json");

  const existsEmail = await User.exists({ email });

  if (existsEmail) {
    return HttpResponse.error(ctx, HttpStatus.CONFLICT, "Email already exists!");
  }

  const hashed = await hash(password, argonOptions);

  const newUser = await User.create({ email, password: hashed });
  const userInfo = createUserInfo(newUser);
  await generateAccess(ctx, userInfo);

  return HttpResponse.success(ctx, HttpStatus.CREATED, "Signed up successfully!", userInfo);
};

export const signInUser: AppRouteHandler<SignInRoute> = async (ctx) => {
  const deviceId = ctx.req.header("x-device-id") ?? "unknown-device";
  const { email, username, password } = ctx.req.valid("json");
  const conditions = [];

  if (email) {
    conditions.push({ email });
  } else if (username) {
    conditions.push({ username });
  } else {
    return HttpResponse.error(ctx, HttpStatus.BAD_REQUEST, "Required email or username!");
  }

  const existsUser = await User.findOne({
    $or: conditions,
  }).select("+password +authentication");

  if (!existsUser || !(await verify(existsUser.password, password))) {
    return HttpResponse.error(ctx, HttpStatus.UNAUTHORIZED, "Invalid credentials!");
  }

  const userInfo = createUserInfo(existsUser);
  await generateAccess(ctx, userInfo);

  if (!userInfo.setup) {
    return HttpResponse.success(ctx, HttpStatus.OK, "Complete your profile!", userInfo);
  }

  const authorizeId = new Types.ObjectId();
  const refreshToken = await generateRefresh(ctx, userInfo._id, authorizeId, deviceId);
  const hashedRefresh = generateHash(refreshToken);
  const refreshExpiry = new Date(Date.now() + env.REFRESH_EXPIRY * 1000);

  existsUser.authentication?.push({
    _id: authorizeId,
    token: hashedRefresh,
    expiry: refreshExpiry,
  });

  await existsUser.save();

  return HttpResponse.success(ctx, HttpStatus.OK, "Signed in successfully!", userInfo);
};

export const signOutUser: AppRouteHandler<SignOutRoute> = async (ctx) => {
  const currentAuthKey = await getSignedCookie(ctx, env.SIGNED_SECRET, "current");

  if (currentAuthKey) {
    await revokeToken(ctx, currentAuthKey);
  }

  deleteCookie(ctx, "access", cookieOptions);
  deleteCookie(ctx, "refresh", cookieOptions);
  deleteCookie(ctx, "current", cookieOptions);

  return HttpResponse.success(ctx, HttpStatus.OK, "Signed out successfully!");
};

export const authRefresh: AppRouteHandler<RefreshRoute> = async (ctx) => {
  const deviceId = ctx.req.header("x-device-id") ?? "unknown-device";
  const refreshToken = await getSignedCookie(ctx, env.SIGNED_SECRET, "refresh");
  const currentAuthKey = await getSignedCookie(ctx, env.SIGNED_SECRET, "current");

  if (!refreshToken || !currentAuthKey) {
    return HttpResponse.error(ctx, HttpStatus.UNAUTHORIZED, "Unauthorized request!");
  }

  const verifiedData = await (async () => {
    try {
      const parsedPayload = parseAuthKey(currentAuthKey);

      const [jwtResult, hashedToken] = await Promise.all([
        jwtVerify<{ uid: string }>(refreshToken, refreshSecret, {
          algorithms: ["HS512"],
        }),
        generateHash(refreshToken),
      ]);

      if (
        !Types.ObjectId.isValid(jwtResult.payload.uid) ||
        !parsedPayload.userId.equals(new Types.ObjectId(jwtResult.payload.uid)) ||
        jwtResult.payload.jti !== deviceId
      ) {
        throw new Error("Refresh request mismatch!");
      }

      return {
        userId: parsedPayload.userId,
        authorizeId: parsedPayload.authId,
        hashedRefresh: hashedToken,
        refreshExpiry: jwtResult.payload.exp,
      };
    } catch {
      await revokeToken(ctx, currentAuthKey);
      throw new HttpError(HttpStatus.UNAUTHORIZED, "Please, sign in again!");
    }
  })();

  const { userId, authorizeId, hashedRefresh, refreshExpiry } = verifiedData;
  const currentTime = Math.floor(Date.now() / 1000);
  const expiresAt = refreshExpiry ?? currentTime;

  const authFilter = {
    _id: userId,
    authentication: {
      $elemMatch: { _id: authorizeId, token: hashedRefresh, expiry: { $gt: new Date() } },
    },
  };

  const requestUser = await User.findOne(authFilter);

  if (!requestUser) {
    return HttpResponse.error(ctx, HttpStatus.UNAUTHORIZED, "Please, sign in again!");
  }

  const userInfo = createUserInfo(requestUser);
  const shouldRotate = currentTime >= expiresAt - env.REFRESH_EXPIRY / 2;

  if (shouldRotate) {
    const newRefreshToken = await generateRefresh(ctx, userId, authorizeId, deviceId);
    const newHashedRefresh = generateHash(newRefreshToken);
    const newRefreshExpiry = new Date(Date.now() + env.REFRESH_EXPIRY * 1000);

    const updatedResult = await User.updateOne(authFilter, {
      $set: {
        "authentication.$.token": newHashedRefresh,
        "authentication.$.expiry": newRefreshExpiry,
      },
    });

    if (updatedResult.modifiedCount === 0) {
      await revokeToken(ctx, currentAuthKey);
      return HttpResponse.error(ctx, HttpStatus.UNAUTHORIZED, "Please, sign in again!");
    }
  }

  await generateAccess(ctx, userInfo);

  return HttpResponse.success(ctx, HttpStatus.OK, "Refreshed successfully!", userInfo);
};

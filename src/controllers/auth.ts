import { hash, verify } from "argon2";
import type { Context } from "hono";
import { deleteCookie, getSignedCookie } from "hono/cookie";
import { jwtVerify } from "jose";
import { Types } from "mongoose";
import env from "#/configs/env.js";
import { logger } from "#/middlewares/index.js";
import { User } from "#/models/index.js";
import {
  argonOptions,
  cookieOptions,
  createUserInfo,
  generateAccess,
  generateHash,
  generateRefresh,
} from "#/utilities/helpers.js";
import { HttpError, HttpResponse } from "#/utilities/response.js";
import type { SignIn, SignUp } from "#/utilities/schema.js";

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

const revokeToken = async (ctx: Context, authKey: any) => {
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
  } catch (err) {
    logger.error({ err }, "Unknown error occurred!");
  } finally {
    deleteCookie(ctx, "access", cookieOptions);
    deleteCookie(ctx, "refresh", cookieOptions);
    deleteCookie(ctx, "current", cookieOptions);
  }
};

export const signUpUser = async (ctx: Context) => {
  const { email, password } = ctx.get("validated") as SignUp;

  const existsEmail = await User.exists({ email });

  if (existsEmail) {
    throw new HttpError(409, "Email already exists!");
  }

  const hashedPassword = await hash(password, argonOptions);

  const newUser = await User.create({ email, password: hashedPassword });
  const userInfo = createUserInfo(newUser);
  await generateAccess(ctx, userInfo);

  return new HttpResponse(201, "Signed up successfully!", { data: newUser }).send(ctx);
};

export const signInUser = async (ctx: Context) => {
  const deviceId = ctx.req.header("x-device-id") ?? "unknown-device";
  const { email, username, password } = ctx.get("validated") as SignIn;
  const conditions = [];

  if (email) {
    conditions.push({ email });
  } else if (username) {
    conditions.push({ username });
  } else {
    throw new HttpError(400, "Email or Username required!");
  }

  const existsUser = await User.findOne({
    $or: conditions,
  }).select("+password +authentication");

  if (!existsUser) {
    throw new HttpError(404, "User not exists!");
  }

  const isCorrect = await verify(existsUser.password!, password);

  if (!isCorrect) {
    throw new HttpError(403, "Incorrect password!");
  }

  const userInfo = createUserInfo(existsUser);
  await generateAccess(ctx, userInfo);

  if (!userInfo.setup) {
    return new HttpResponse(200, "Please, complete your profile!", { data: userInfo }).send(ctx);
  }

  const authorizeId = new Types.ObjectId();
  const refreshToken = await generateRefresh(ctx, userInfo._id!, authorizeId, deviceId);
  const hashedRefresh = await generateHash(refreshToken);
  const refreshExpiry = new Date(Date.now() + env.REFRESH_EXPIRY * 1000);

  existsUser.authentication?.push({
    _id: authorizeId,
    token: hashedRefresh,
    expiry: refreshExpiry,
  });

  await existsUser.save();

  return new HttpResponse(200, "Signed in successfully!", { data: userInfo }).send(ctx);
};

export const signOutUser = async (ctx: Context) => {
  const currentAuthKey = await getSignedCookie(ctx, env.SIGNED_SECRET, "current");

  if (currentAuthKey) {
    await revokeToken(ctx, currentAuthKey);
  }

  deleteCookie(ctx, "access", cookieOptions);
  deleteCookie(ctx, "refresh", cookieOptions);
  deleteCookie(ctx, "current", cookieOptions);

  return new HttpResponse(200, "Signed out successfully!").send(ctx);
};

export const authRefresh = async (ctx: Context) => {
  const deviceId = ctx.req.header("x-device-id") ?? "unknown-device";
  const refreshToken = await getSignedCookie(ctx, env.SIGNED_SECRET, "refresh");
  const currentAuthKey = await getSignedCookie(ctx, env.SIGNED_SECRET, "current");

  if (!refreshToken || !currentAuthKey) {
    throw new HttpError(401, "Unauthorized refresh request!");
  }

  const verifiedData = await (async () => {
    try {
      const parsedPayload = parseAuthKey(currentAuthKey);
      const refreshSecret = new TextEncoder().encode(env.REFRESH_SECRET);

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
      throw new HttpError(403, "Please, signin again to continue!");
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

  return new HttpResponse(200, "Token refreshed successfully!").send(ctx);
};

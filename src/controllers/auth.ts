import { hash, verify } from "argon2";
import type { Context } from "hono";
import { getSignedCookie } from "hono/cookie";
import { Types } from "mongoose";
import env from "#/configs/env.js";
import { revokeToken } from "#/middlewares/index.js";
import { User } from "#/models/index.js";
import { argonOptions, createUserInfo, generateAccess, generateHash, generateRefresh } from "#/utils/helpers.js";
import { ErrorResponse, HttpError, SuccessResponse } from "#/utils/response.js";
import type { SignIn, SignUp } from "#/utils/schema.js";

export const signUpUser = async (ctx: Context) => {
  try {
    const { email, password } = ctx.get("validated") as SignUp;

    const existsEmail = await User.exists({ email });

    if (existsEmail) {
      throw new HttpError(409, "Email already exists!");
    }

    const hashedPassword = await hash(password, argonOptions);

    User.create({ email, password: hashedPassword });

    return SuccessResponse(ctx, 201, "Signed up successfully!");
  } catch (error: any) {
    return ErrorResponse(ctx, error.code || 500, error.message || "Error while user signup!");
  }
};

export const signInUser = async (ctx: Context) => {
  try {
    const deviceId = ctx.req.header("x-device-id") ?? env.SIGNED_SECRET;
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
      return SuccessResponse(ctx, 200, "Please, complete your profile!", userInfo);
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

    return SuccessResponse(ctx, 200, "Signed in successfully!", userInfo);
  } catch (error: any) {
    return ErrorResponse(ctx, error.code || 500, error.message || "Error while user signin!");
  }
};

export const signOutUser = async (ctx: Context) => {
  const currentAuthKey = await getSignedCookie(ctx, env.SIGNED_SECRET, "current");

  if (currentAuthKey) {
    await revokeToken(ctx, currentAuthKey);
  }

  return SuccessResponse(ctx, 200, "Signed out successfully!");
};

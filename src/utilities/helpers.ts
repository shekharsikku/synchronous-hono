import { randomBytes } from "node:crypto";
import { deflateSync } from "node:zlib";
import type { Options } from "argon2";
import type { Context } from "hono";
import { setSignedCookie } from "hono/cookie";
import type { CookieOptions } from "hono/utils/cookie";
import { CompactEncrypt, SignJWT } from "jose";
import type { Types } from "mongoose";
import env from "#/configs/env.js";
import type { UserDocument } from "#/models/index.js";
import { accessSecret, encryptAuth, refreshSecret } from "./crypto.js";

export type UserInfo =
  | Pick<UserDocument, "_id" | "name" | "email" | "username" | "setup">
  | Omit<UserDocument, "password" | "authentication">;

export const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "none" as const,
  secure: true,
};

export const generateAccess = async (ctx: Context, user?: UserInfo) => {
  const accessExpiry = env.ACCESS_EXPIRY;
  const accessPayload = deflateSync(JSON.stringify(user));

  const accessToken = await new CompactEncrypt(accessPayload)
    .setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .encrypt(accessSecret);

  await setSignedCookie(ctx, "access", accessToken, env.SIGNED_SECRET, {
    maxAge: accessExpiry,
    ...cookieOptions,
  });

  return accessToken;
};

export const generateRefresh = async (ctx: Context, uid: Types.ObjectId, aid: Types.ObjectId, jti: string) => {
  const refreshExpiry = env.REFRESH_EXPIRY;
  const currentAuthKey = encryptAuth(uid.toString(), aid.toString());

  const refreshToken = await new SignJWT({ uid: uid.toString() })
    .setProtectedHeader({ alg: "HS512" })
    .setIssuedAt()
    .setExpirationTime(`${refreshExpiry}sec`)
    .setJti(jti)
    .sign(refreshSecret);

  await setSignedCookie(ctx, "refresh", refreshToken, env.SIGNED_SECRET, {
    maxAge: refreshExpiry * 2,
    ...cookieOptions,
  });

  await setSignedCookie(ctx, "current", currentAuthKey, env.SIGNED_SECRET, {
    maxAge: refreshExpiry * 2,
    ...cookieOptions,
  });

  return refreshToken;
};

export const hasEmptyField = (fields: object) => {
  return Object.values(fields).some((value) => value === "" || value === undefined || value === null);
};

export const createUserInfo = (user: UserDocument) => {
  if (!user.setup) {
    return {
      _id: user._id,
      email: user.email,
      setup: user.setup,
    };
  }
  const { password, authentication, ...safeUser } = user.toObject();
  return safeUser;
};

export const argonOptions: Options = {
  hashLength: 48,
  timeCost: 4,
  memoryCost: 2 ** 16,
  parallelism: 2,
  type: 2,
  salt: randomBytes(32),
};

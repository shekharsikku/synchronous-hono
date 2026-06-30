import { randomBytes } from "node:crypto";
import { deflateSync } from "node:zlib";
import type { Options } from "argon2";
import type { Context } from "hono";
import { setSignedCookie } from "hono/cookie";
import type { CookieOptions } from "hono/utils/cookie";
import { CompactEncrypt, SignJWT } from "jose";
import env from "#/configs/env.js";
import type { UserDocument } from "#/models/index.js";
import { accessSecret, encryptAuth, refreshSecret } from "./crypto.js";

export const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "none" as const,
  secure: true,
};

export const generateAccess = async (ctx: Context, user: UserInfo) => {
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

export const generateRefresh = async (ctx: Context, uid: string, aid: string) => {
  const refreshExpiry = env.REFRESH_EXPIRY;
  const currentToken = encryptAuth(uid, aid);

  const refreshToken = await new SignJWT({})
    .setProtectedHeader({ alg: "HS512" })
    .setSubject(uid)
    .setJti(aid)
    .setIssuedAt()
    .setExpirationTime(`${refreshExpiry}sec`)
    .sign(refreshSecret);

  await setSignedCookie(ctx, "refresh", refreshToken, env.SIGNED_SECRET, {
    maxAge: refreshExpiry * 2,
    ...cookieOptions,
  });

  await setSignedCookie(ctx, "current", currentToken, env.SIGNED_SECRET, {
    maxAge: refreshExpiry * 2,
    ...cookieOptions,
  });

  return refreshToken;
};

export const hasEmptyField = (fields: object) => {
  return Object.values(fields).some(
    (value) => value === "" || value === undefined || value === null,
  );
};

export const createUserInfo = (user: UserDocument) => {
  if (!user.setup) {
    return {
      _id: user._id,
      email: user.email,
      name: user.name ?? null,
      username: user.username ?? null,
      setup: user.setup,
    };
  }
  return {
    _id: user._id,
    email: user.email,
    name: user.name ?? null,
    username: user.username ?? null,
    gender: user.gender ?? null,
    image: user.image ?? null,
    bio: user.bio ?? null,
    setup: user.setup,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
};

export type UserInfo = ReturnType<typeof createUserInfo>;

export const argonOptions: Options = {
  hashLength: 48,
  timeCost: 4,
  memoryCost: 2 ** 16,
  parallelism: 2,
  type: 2,
  salt: randomBytes(32),
};

import { createHash, createSecretKey, randomBytes } from "node:crypto";
import { deflateSync } from "node:zlib";
import type { Options } from "argon2";
import type { Context } from "hono";
import { setSignedCookie } from "hono/cookie";
import type { CookieOptions } from "hono/utils/cookie";
import { CompactEncrypt, SignJWT } from "jose";
import type { Types } from "mongoose";
import env from "#/configs/env.js";
import type { UserInterface } from "#/interfaces/index.js";

export const generateSecret = async () => {
  return createSecretKey(createHash("sha256").update(env.ACCESS_SECRET).digest());
};

export const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "none" as const,
  secure: true,
};

export const generateAccess = async (ctx: Context, user?: UserInterface) => {
  const accessExpiry = env.ACCESS_EXPIRY;

  const accessPayload = deflateSync(JSON.stringify(user));
  const accessSecret = await generateSecret();

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
  const refreshSecret = new TextEncoder().encode(env.REFRESH_SECRET);
  const currentAuthKey = `${uid.toString()}:${aid.toString()}`;

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

export const generateHash = async (token: string) => {
  return createHash("sha256").update(token).digest("hex");
};

export const hasEmptyField = (fields: object) => {
  return Object.values(fields).some((value) => value === "" || value === undefined || value === null);
};

export const createUserInfo = (user: UserInterface) => {
  let userInfo: Partial<UserInterface>;

  if (user.setup) {
    userInfo = {
      ...user.toObject(),
      password: undefined,
      authentication: undefined,
    };
  } else {
    userInfo = {
      _id: user._id,
      email: user.email,
      setup: user.setup,
    };
  }

  return userInfo as UserInterface;
};

export const argonOptions: Options = {
  hashLength: 48,
  timeCost: 4,
  memoryCost: 2 ** 16,
  parallelism: 2,
  type: 2,
  salt: randomBytes(32),
};

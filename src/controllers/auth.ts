/** biome-ignore-all lint/style/noNonNullAssertion: <issue and expiry timestamp available> */
import type { Context } from "hono";
import { deleteCookie, getSignedCookie } from "hono/cookie";
import { jwtVerify } from "jose";
import { Types } from "mongoose";
import env from "#/configs/env.js";
import { User } from "#/models/index.js";
import type { AppRouteHandler } from "#/openapi/index.js";
import type { RefreshRoute, SignInRoute, SignOutRoute, SignUpRoute } from "#/routes/auth.js";
import { decryptAuth, generateHash, refreshSecret } from "#/utilities/crypto.js";
import {
  cookieOptions,
  createUserInfo,
  generateAccess,
  generateRefresh,
} from "#/utilities/helpers.js";
import { HttpError, HttpResponse, HttpStatus } from "#/utilities/http/index.js";

const parseToken = (token: string) => {
  const { uid, aid } = decryptAuth(token);

  if (!Types.ObjectId.isValid(uid) || !Types.ObjectId.isValid(aid)) {
    throw new Error("Invalid authentication token!");
  }

  return { userId: new Types.ObjectId(uid), authId: new Types.ObjectId(aid) };
};

export const revokeToken = async <C extends Context>(ctx: C, token: string) => {
  try {
    const { userId, authId } = parseToken(token);

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
    ctx.var.logger.error({ err }, "Unknown error occurred!");
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

  const hashed = await Bun.password.hash(password);

  const newUser = await User.create({ email, password: hashed });
  const userInfo = createUserInfo(newUser);
  await generateAccess(ctx, userInfo);

  return HttpResponse.success(ctx, HttpStatus.CREATED, "Signed up successfully!", userInfo);
};

export const signInUser: AppRouteHandler<SignInRoute> = async (ctx) => {
  const { email, username, password } = ctx.req.valid("json");
  const query = email ? { email } : username ? { username } : null;

  if (!query) {
    return HttpResponse.error(ctx, HttpStatus.BAD_REQUEST, "Email or Username required!");
  }

  const existsUser = await User.findOne(query).select("+password +authentication");

  if (!existsUser || !(await Bun.password.verify(password, existsUser.password))) {
    return HttpResponse.error(ctx, HttpStatus.UNAUTHORIZED, "Invalid credentials!");
  }

  const userInfo = createUserInfo(existsUser);
  await generateAccess(ctx, userInfo);

  if (!userInfo.setup) {
    return HttpResponse.success(ctx, HttpStatus.OK, "Complete your profile!", userInfo);
  }

  const authId = new Types.ObjectId();
  const refreshToken = await generateRefresh(ctx, userInfo._id.toString(), authId.toString());

  existsUser.authentication?.push({
    _id: authId,
    token: generateHash(refreshToken),
    expiry: new Date(Date.now() + env.REFRESH_EXPIRY * 1000),
  });

  await existsUser.save();

  return HttpResponse.success(ctx, HttpStatus.OK, "Signed in successfully!", userInfo);
};

export const signOutUser: AppRouteHandler<SignOutRoute> = async (ctx) => {
  const currentToken = await getSignedCookie(ctx, env.SIGNED_SECRET, "current");

  if (currentToken) await revokeToken(ctx, currentToken);

  deleteCookie(ctx, "access", cookieOptions);
  deleteCookie(ctx, "refresh", cookieOptions);
  deleteCookie(ctx, "current", cookieOptions);

  return HttpResponse.success(ctx, HttpStatus.OK, "Signed out successfully!");
};

export const authRefresh: AppRouteHandler<RefreshRoute> = async (ctx) => {
  const [refreshToken, currentToken] = await Promise.all([
    getSignedCookie(ctx, env.SIGNED_SECRET, "refresh"),
    getSignedCookie(ctx, env.SIGNED_SECRET, "current"),
  ]);

  if (!refreshToken || !currentToken) {
    return HttpResponse.error(ctx, HttpStatus.UNAUTHORIZED, "Unauthorized request!");
  }

  const { userId, authId, shouldRotate } = await (async () => {
    try {
      const { userId, authId } = parseToken(currentToken);

      const jwtResult = await jwtVerify(refreshToken, refreshSecret, {
        algorithms: ["HS512"],
      });

      if (!userId.equals(jwtResult.payload.sub) || !authId.equals(jwtResult.payload.jti)) {
        throw new Error("Refresh request mismatch!");
      }

      const issuedAt = jwtResult.payload.iat!;
      const expiresAt = jwtResult.payload.exp!;
      const currentTs = Math.floor(Date.now() / 1000);

      const shouldRotate = currentTs >= issuedAt + (expiresAt - issuedAt) / 2;

      return { userId, authId, shouldRotate };
    } catch {
      await revokeToken(ctx, currentToken);
      throw new HttpError(HttpStatus.UNAUTHORIZED, "Please, sign in again!");
    }
  })();

  const authFilter = {
    _id: userId,
    authentication: {
      $elemMatch: { _id: authId, token: generateHash(refreshToken), expiry: { $gt: new Date() } },
    },
  };

  const requestUser = await User.findOne(authFilter);

  if (!requestUser) {
    return HttpResponse.error(ctx, HttpStatus.UNAUTHORIZED, "Please, sign in again!");
  }

  const userInfo = createUserInfo(requestUser);

  if (shouldRotate) {
    const refreshedToken = await generateRefresh(ctx, userId.toString(), authId.toString());

    const updatedResult = await User.updateOne(authFilter, {
      $set: {
        "authentication.$.token": generateHash(refreshedToken),
        "authentication.$.expiry": new Date(Date.now() + env.REFRESH_EXPIRY * 1000),
      },
    });

    if (updatedResult.modifiedCount === 0) {
      await revokeToken(ctx, currentToken);
      return HttpResponse.error(ctx, HttpStatus.UNAUTHORIZED, "Please, sign in again!");
    }
  }

  await generateAccess(ctx, userInfo);

  return HttpResponse.success(ctx, HttpStatus.OK, "Refreshed successfully!", userInfo);
};

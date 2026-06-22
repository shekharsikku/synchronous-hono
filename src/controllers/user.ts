import { hash, verify } from "argon2";
import { getSignedCookie } from "hono/cookie";
import env from "#/configs/env.js";
import { imagekitDelete, imagekitUpload } from "#/configs/imagekit.js";
import { User } from "#/models/index.js";
import type { AppRouteHandler } from "#/openapi/index.js";
import type { DeleteImageRoute, PasswordChangeRoute, ProfileSetupRoute, UpdateImageRoute, UserInformationRoute } from "#/routes/user.js";
import { emitEvent, getSockets } from "#/server.js";
import { eventsService } from "#/services/events.js";
import { argonOptions, createUserInfo, generateAccess, hasEmptyField, type UserInfo } from "#/utilities/helpers.js";
import { HttpResponse, HttpStatusCodes } from "#/utilities/http/index.js";
import { revokeToken } from "./auth.js";

const profileUpdateEvents = async (userData: UserInfo) => {
  const sockets = getSockets(userData._id.toString());
  emitEvent(sockets, "profile:update", userData);
};

export const profileSetup: AppRouteHandler<ProfileSetupRoute> = async (ctx) => {
  const { name, username, gender, bio } = ctx.req.valid("json");
  const requestUser = ctx.req.user!;

  if (username !== requestUser?.username) {
    const existsUsername = await User.exists({ username });

    if (existsUsername) {
      return HttpResponse.error(ctx, HttpStatusCodes.CONFLICT, "Username already exists!");
    }
  }

  const wasSetup = requestUser?.setup;
  const userDetails = { name, username, gender, bio, setup: false };

  if (!hasEmptyField({ name, username, gender })) {
    userDetails.setup = true;
  }

  const updatedProfile = await User.findByIdAndUpdate(requestUser._id, userDetails, {
    returnDocument: "after",
  });

  if (!updatedProfile) {
    const currentAuthKey = await getSignedCookie(ctx, env.SIGNED_SECRET, "current");

    if (currentAuthKey) {
      await revokeToken(ctx, currentAuthKey);
    }

    return HttpResponse.error(ctx, HttpStatusCodes.UNAUTHORIZED, "Please, sign in again!");
  }

  const userInfo = createUserInfo(updatedProfile);

  if (!wasSetup && userInfo.setup) {
    eventsService.send(requestUser._id.toString(), "profile-setup-complete", userInfo);
  }

  if (!userInfo.setup) {
    return HttpResponse.success(ctx, HttpStatusCodes.OK, "Complete your profile!", userInfo);
  }

  await generateAccess(ctx, userInfo);
  await profileUpdateEvents(userInfo);

  return HttpResponse.success(ctx, HttpStatusCodes.OK, "Profile updated successfully!", userInfo);
};

export const updateImage: AppRouteHandler<UpdateImageRoute> = async (ctx) => {
  const { "profile-image": imageFile } = ctx.req.valid("form");

  if (!imageFile || !(imageFile instanceof File)) {
    return HttpResponse.error(ctx, HttpStatusCodes.BAD_REQUEST, "Invalid image file upload!");
  }

  const requestUser = await User.findById(ctx.req.user?._id);

  if (!requestUser) {
    const currentAuthKey = await getSignedCookie(ctx, env.SIGNED_SECRET, "current");

    if (currentAuthKey) {
      await revokeToken(ctx, currentAuthKey);
    }

    return HttpResponse.error(ctx, HttpStatusCodes.UNAUTHORIZED, "Please, sign in again!");
  }

  const uploadedImage = await imagekitUpload(imageFile);

  if (!uploadedImage?.url) {
    return HttpResponse.error(ctx, HttpStatusCodes.INTERNAL_SERVER_ERROR, "Error while uploading image!");
  }

  if (requestUser.image) {
    const imageUrl = new URL(requestUser.image);
    const fileId = imageUrl.searchParams.get("fid");

    if (fileId) {
      imagekitDelete(fileId).catch(() => {});
    }
  }

  requestUser.image = `${uploadedImage.url}?fid=${uploadedImage.fileId}`;
  await requestUser.save({ validateBeforeSave: false });

  const userInfo = createUserInfo(requestUser);
  await generateAccess(ctx, userInfo);
  await profileUpdateEvents(userInfo);

  return HttpResponse.success(ctx, HttpStatusCodes.OK, "Image updated successfully!", userInfo);
};

export const deleteImage: AppRouteHandler<DeleteImageRoute> = async (ctx) => {
  const requestUser = await User.findById(ctx.req.user?._id);

  if (!requestUser) {
    const currentAuthKey = await getSignedCookie(ctx, env.SIGNED_SECRET, "current");

    if (currentAuthKey) {
      await revokeToken(ctx, currentAuthKey);
    }

    return HttpResponse.error(ctx, HttpStatusCodes.UNAUTHORIZED, "Please, sign in again!");
  }

  if (!requestUser?.image) {
    return HttpResponse.error(ctx, HttpStatusCodes.NOT_FOUND, "Image not available!");
  }

  const imageUrl = new URL(requestUser.image);
  const fileId = imageUrl.searchParams.get("fid");

  if (fileId) {
    imagekitDelete(fileId).catch(() => {});
  }

  requestUser.image = null;
  await requestUser.save({ validateBeforeSave: false });

  const userInfo = createUserInfo(requestUser);
  await generateAccess(ctx, userInfo);
  await profileUpdateEvents(userInfo);

  return HttpResponse.success(ctx, HttpStatusCodes.OK, "Image deleted successfully!", userInfo);
};

export const changePassword: AppRouteHandler<PasswordChangeRoute> = async (ctx) => {
  const { old_password, new_password } = ctx.req.valid("json");

  if (old_password === new_password) {
    return HttpResponse.error(ctx, HttpStatusCodes.BAD_REQUEST, "New password must be different!");
  }

  const requestUser = await User.findById(ctx.req.user?._id).select("+password");

  if (!requestUser) {
    const currentAuthKey = await getSignedCookie(ctx, env.SIGNED_SECRET, "current");

    if (currentAuthKey) {
      await revokeToken(ctx, currentAuthKey);
    }

    return HttpResponse.error(ctx, HttpStatusCodes.UNAUTHORIZED, "Please, sign in again!");
  }

  if (!(await verify(requestUser.password, old_password))) {
    return HttpResponse.error(ctx, HttpStatusCodes.FORBIDDEN, "Incorrect old password!");
  }

  requestUser.password = await hash(new_password, argonOptions);
  await requestUser.save({ validateBeforeSave: true });

  const userInfo = createUserInfo(requestUser);
  await generateAccess(ctx, userInfo);
  await profileUpdateEvents(userInfo);

  return HttpResponse.success(ctx, HttpStatusCodes.OK, "Password changed successfully!", userInfo);
};

export const userInformation: AppRouteHandler<UserInformationRoute> = async (ctx) => {
  return HttpResponse.success(ctx, HttpStatusCodes.OK, "User information!", ctx.req.user);
};

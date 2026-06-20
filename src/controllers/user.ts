import { hash, verify } from "argon2";
import type { Context } from "hono";
import { imagekitDelete, imagekitUpload } from "#/configs/imagekit.js";
import { User } from "#/models/index.js";
import { emitEvent, getSockets } from "#/server.js";
import { eventsService } from "#/services/events.js";
import { argonOptions, createUserInfo, generateAccess, hasEmptyField, type UserInfo } from "#/utilities/helpers.js";
import { HttpError, HttpResponse } from "#/utilities/response.js";
import type { Password, Profile } from "#/utilities/schema.js";

const profileUpdateEvents = async (userData: UserInfo) => {
  const sockets = getSockets(userData._id.toString());
  emitEvent(sockets, "profile:update", userData);
};

export const profileSetup = async (ctx: Context) => {
  const { name, username, gender, bio } = ctx.get("validated") as Profile;
  const requestUser = ctx.req.user!;

  if (username !== requestUser?.username) {
    const existsUsername = await User.exists({ username });

    if (existsUsername) {
      throw new HttpError(409, "Username already exists!");
    }
  }

  const wasSetup = requestUser?.setup;
  const userDetails = { name, username, gender, bio, setup: false };
  const isCompleted = !hasEmptyField({ name, username, gender });

  if (isCompleted) {
    userDetails.setup = true;
  }

  const updatedProfile = await User.findByIdAndUpdate(requestUser?._id, userDetails, { returnDocument: "after" });

  if (!updatedProfile) {
    throw new HttpError(400, "Profile setup not completed!");
  }

  const userInfo = createUserInfo(updatedProfile);

  if (!wasSetup && userInfo.setup) {
    eventsService.send(requestUser._id.toString(), "profile-setup-complete", userInfo);
  }

  if (!userInfo.setup) {
    return new HttpResponse(200, "Please, complete your profile!").send(ctx);
  }

  await generateAccess(ctx, userInfo);
  await profileUpdateEvents(userInfo);

  return new HttpResponse(200, "Profile updated successfully!").send(ctx);
};

export const updateImage = async (ctx: Context) => {
  const requestUser = ctx.req.user?._id!;

  const dataBody = await ctx.req.parseBody();
  const imageFile = dataBody["profile-image"];

  if (!imageFile || !(imageFile instanceof File)) {
    throw new HttpError(400, "Invalid profile image file upload!");
  }

  const userProfile = await User.findById(requestUser);

  if (!userProfile) {
    throw new HttpError(404, "Can't get current user profile!");
  }

  const uploadedImage = await imagekitUpload(imageFile);

  if (!uploadedImage?.url) {
    throw new HttpError(500, "Error while uploading profile image!");
  }

  if (userProfile.image) {
    const imageUrl = new URL(userProfile.image);
    const fileId = imageUrl.searchParams.get("fid");

    if (fileId) {
      imagekitDelete(fileId).catch(() => {});
    }
  }

  userProfile.image = `${uploadedImage.url}?fid=${uploadedImage.fileId}`;
  await userProfile.save({ validateBeforeSave: false });

  const userInfo = createUserInfo(userProfile);

  await generateAccess(ctx, userInfo);
  await profileUpdateEvents(userInfo);

  return new HttpResponse(200, "Profile image updated successfully!").send(ctx);
};

export const deleteImage = async (ctx: Context) => {
  const requestUser = ctx.req.user;

  const userProfile = await User.findById(requestUser);

  if (!userProfile) {
    throw new HttpError(404, "Can't get current user profile!");
  }

  if (!userProfile?.image) {
    throw new HttpError(400, "Profile image is not available!");
  }

  const imageUrl = new URL(userProfile.image);
  const fileId = imageUrl.searchParams.get("fid");

  if (fileId) {
    imagekitDelete(fileId).catch(() => {});
  }

  userProfile.image = null;
  await userProfile.save({ validateBeforeSave: false });

  const userInfo = createUserInfo(userProfile);

  await generateAccess(ctx, userInfo);
  await profileUpdateEvents(userInfo);

  return new HttpResponse(200, "Profile image deleted successfully!").send(ctx);
};

export const changePassword = async (ctx: Context) => {
  const { old_password, new_password } = ctx.get("validated") as Password;

  if (old_password === new_password) {
    throw new HttpError(400, "Please, choose a different password!");
  }

  const userId = ctx.req.user?._id;

  const requestUser = await User.findById(userId).select("+password");

  if (!requestUser) {
    throw new HttpError(403, "Invalid authorization!");
  }

  const isCorrect = await verify(requestUser.password!, old_password);

  if (!isCorrect) {
    throw new HttpError(403, "Incorrect old password!");
  }

  requestUser.password = await hash(new_password, argonOptions);
  await requestUser.save({ validateBeforeSave: true });

  const userInfo = createUserInfo(requestUser);
  await generateAccess(ctx, userInfo);

  return new HttpResponse(200, "Password changed successfully!").send(ctx);
};

export const userInformation = async (ctx: Context) => {
  return new HttpResponse(200, "User profile information!", { data: ctx.req.user! }).send(ctx);
};

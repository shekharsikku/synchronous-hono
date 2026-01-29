import { hash, verify } from "argon2";
import type { Context } from "hono";
import { imagekitDelete, imagekitUpload } from "#/configs/imagekit.js";
import type { UserInterface } from "#/interfaces/index.js";
import { User } from "#/models/index.js";
import { getSocketId, io } from "#/server.js";
import { eventsService } from "#/services/events.js";
import { argonOptions, createUserInfo, generateAccess, hasEmptyField } from "#/utils/helpers.js";
import { ErrorResponse, HttpError, SuccessResponse } from "#/utils/response.js";

const profileUpdateEvents = async (userData: UserInterface) => {
  const userSocketIds = getSocketId(userData._id?.toString()!);
  io.to(userSocketIds).emit("profile:update", userData);
};

export const profileSetup = async (ctx: Context) => {
  try {
    const { name, username, gender, bio } = ctx.get("validated");
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

    const updatedProfile = await User.findByIdAndUpdate(requestUser?._id, userDetails, { new: true });

    if (!updatedProfile) {
      throw new HttpError(400, "Profile setup not completed!");
    }

    const userInfo = createUserInfo(updatedProfile);

    if (!wasSetup && userInfo.setup) {
      eventsService.send(requestUser._id.toString(), "profile-setup-complete", userInfo);
    }

    if (!userInfo.setup) {
      return SuccessResponse(ctx, 200, "Please, complete your profile!", userInfo);
    }

    await generateAccess(ctx, userInfo);
    await profileUpdateEvents(userInfo);

    return SuccessResponse(ctx, 200, "Profile updated successfully!");
  } catch (error: any) {
    return ErrorResponse(ctx, error.code || 500, error.message || "Error while updating profile!");
  }
};

export const updateImage = async (ctx: Context) => {
  try {
    const requestUser = ctx.req.user;

    const dataBody = await ctx.req.parseBody();
    const imageFile = dataBody["profile-image"];

    if (!imageFile || !(imageFile instanceof File)) {
      throw new HttpError(400, "Invalid image file upload!");
    }

    const userProfile = await User.findById(requestUser?._id);

    if (!userProfile) {
      throw new HttpError(500, "Profile image not updated!");
    }

    if (userProfile.image && userProfile.image !== "") {
      const imageUrl = new URL(userProfile.image);
      const fileId = imageUrl.searchParams.get("fid");
      fileId && (await imagekitDelete(fileId));
    }

    const uploadedImage = await imagekitUpload(imageFile);

    if (uploadedImage?.url) {
      userProfile.image = `${uploadedImage.url}?fid=${uploadedImage.fileId}`;
      await userProfile.save({ validateBeforeSave: true });

      const userInfo = createUserInfo(userProfile);
      await generateAccess(ctx, userInfo);
      await profileUpdateEvents(userInfo);

      return SuccessResponse(ctx, 200, "Profile image updated successfully!");
    }

    throw new HttpError(500, "Profile image not updated!");
  } catch (error: any) {
    return ErrorResponse(ctx, error.code || 500, error.message || "Error while updating profile image!");
  }
};

export const deleteImage = async (ctx: Context) => {
  try {
    const requestUser = ctx.req.user;

    if (!requestUser || requestUser?.image === "") {
      throw new HttpError(400, "Profile image not available!");
    }

    const imageUrl = new URL(requestUser.image!);
    const fileId = imageUrl.searchParams.get("fid");
    fileId && (await imagekitDelete(fileId));

    const updatedProfile = await User.findByIdAndUpdate(requestUser?._id, { image: "" }, { new: true });

    if (!updatedProfile) {
      throw new HttpError(400, "Error while deleting image!");
    }

    const userInfo = createUserInfo(updatedProfile);
    await generateAccess(ctx, userInfo);
    await profileUpdateEvents(userInfo);

    return SuccessResponse(ctx, 200, "Profile image deleted successfully!");
  } catch (error: any) {
    return ErrorResponse(ctx, error.code || 500, error.message || "Error while deleting profile image!");
  }
};

export const changePassword = async (ctx: Context) => {
  try {
    const { old_password, new_password } = ctx.get("validated");

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

    return SuccessResponse(ctx, 200, "Password changed successfully!");
  } catch (error: any) {
    return ErrorResponse(ctx, error.code || 500, error.message || "Error while changing password!");
  }
};

export const userInformation = async (ctx: Context) => {
  try {
    return SuccessResponse(ctx, 200, "User profile information!", ctx.req.user);
  } catch (error: any) {
    return ErrorResponse(ctx, error.code || 500, error.message || "Error while getting user info!");
  }
};

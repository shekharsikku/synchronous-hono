import type { Context } from "hono";
import { Types } from "mongoose";
import { imagekitDelete, imagekitUpload } from "#/configs/imagekit.js";
import { Conversation, Group, User } from "#/models/index.js";
import { getSocketId, io } from "#/server.js";
import { ErrorResponse, HttpError, SuccessResponse } from "#/utils/response.js";
import type { CreateGroup, UpdateDetails, UpdateMembers } from "#/utils/schema.js";

export const createGroup = async (ctx: Context) => {
  try {
    const groupData = ctx.get("validated") as CreateGroup;
    const reqUser = ctx.req.user?._id;

    if (groupData.admin !== reqUser?.toString()) {
      throw new HttpError(400, "Invalid group admin assignment!");
    }

    if (!groupData.members.includes(reqUser.toString())) {
      groupData.members.push(reqUser.toString());
    }

    groupData.members = [...new Set(groupData.members)];

    const [existingGroup, existingUsers] = await Promise.all([
      Group.exists({ name: groupData.name, admin: reqUser }),
      User.find({ _id: { $in: groupData.members } }).select("_id"),
    ]);

    if (existingGroup) {
      throw new HttpError(400, "You already have a group with this name!");
    }

    if (existingUsers.length !== groupData.members.length) {
      throw new HttpError(400, "One or more members are invalid users!");
    }

    const newGroup = await Group.create({
      name: groupData.name,
      description: groupData.description,
      admin: new Types.ObjectId(groupData.admin),
      members: groupData.members.map((id) => new Types.ObjectId(id)),
    });

    const socketIds = newGroup.members.flatMap((member) => getSocketId(member.toString())).filter(Boolean);

    /** Notify to all members after group created */
    io.to(socketIds).emit("group:created", {
      ...newGroup.toJSON(),
      interaction: new Date().toISOString(),
    });

    await Conversation.create({
      participants: [newGroup._id],
      models: "Group",
    });

    return SuccessResponse(ctx, 200, "Group created successfully!");
  } catch (error: any) {
    return ErrorResponse(ctx, error.code || 500, error.message || "Error while creating group!");
  }
};

export const updateDetails = async (ctx: Context) => {
  try {
    const groupId = ctx.req.param("id");
    const updateData = ctx.get("validated") as UpdateDetails;
    const reqUser = ctx.req.user?._id!;

    if (updateData.name) {
      const existingGroup = await Group.exists({
        name: updateData.name,
        admin: reqUser,
        _id: { $ne: groupId },
      });

      if (existingGroup) {
        throw new HttpError(400, "You already have another group with this name!");
      }
    }

    const updatedGroup = await Group.findOneAndUpdate(
      { _id: groupId, admin: reqUser },
      { $set: updateData },
      { returnDocument: "after" },
    );

    if (!updatedGroup) {
      throw new HttpError(404, "Group not found or you are not authorized!");
    }

    return SuccessResponse(ctx, 200, "Group details updated successfully!", updatedGroup);
  } catch (error: any) {
    return ErrorResponse(ctx, error.code || 500, error.message || "Error while updating group details!");
  }
};

export const updateMembers = async (ctx: Context) => {
  try {
    const groupId = ctx.req.param("id");
    const { add, remove } = ctx.get("validated") as UpdateMembers;
    const reqUser = ctx.req.user?._id!;

    if (!add?.length && !remove?.length) {
      throw new HttpError(400, "Provide at least one member to add or remove!");
    }

    if (remove.includes(reqUser?.toString()!)) {
      throw new HttpError(400, "Admin cannot be removed from the group!");
    }

    const updateMembers = [...add, ...remove];

    if (updateMembers.length > 0) {
      const existingUsers = await User.find({
        _id: { $in: updateMembers },
      }).select("_id");
      const validUserIds = existingUsers.map((cur) => cur._id.toString());
      const invalidIds = updateMembers.filter((cur) => !validUserIds.includes(cur));

      if (invalidIds.length > 0) {
        throw new HttpError(400, `Invalid user IDs: ${invalidIds.join(", ")}`);
      }
    }

    const updateOps: any = {};

    if (add.length) updateOps.$addToSet = { members: { $each: add } };
    if (remove.length) updateOps.$pull = { members: { $in: remove } };

    const updatedGroup = await Group.findOneAndUpdate({ _id: groupId, admin: reqUser }, updateOps, {
      returnDocument: "after",
    });

    if (!updatedGroup) {
      throw new HttpError(404, "Group not found or you are not authorized!");
    }

    return SuccessResponse(ctx, 200, "Group members updated successfully!", updatedGroup);
  } catch (error: any) {
    return ErrorResponse(ctx, error.code || 500, error.message || "Error while updating group member!");
  }
};

export const updateAvatar = async (ctx: Context) => {
  try {
    const groupId = ctx.req.param("id");
    const reqUser = ctx.req.user?._id!;

    const dataBody = await ctx.req.parseBody();
    const imageFile = dataBody["group-avatar"];

    if (!imageFile || !(imageFile instanceof File)) {
      throw new HttpError(400, "Invalid group avatar file upload!");
    }

    const currentGroup = await Group.findOne({ _id: groupId, admin: reqUser });

    if (!currentGroup) {
      throw new HttpError(403, "You're not allowed for update this group!");
    }

    const uploadedImage = await imagekitUpload(imageFile);

    if (!uploadedImage?.url) {
      throw new HttpError(500, "Error while uploading group avatar!");
    }

    if (currentGroup.avatar) {
      const imageUrl = new URL(currentGroup.avatar);
      const fileId = imageUrl.searchParams.get("fid");

      if (fileId) {
        await imagekitDelete(fileId);
      }
    }

    currentGroup.avatar = `${uploadedImage.url}?fid=${uploadedImage.fileId}`;
    await currentGroup.save({ validateBeforeSave: false });

    return SuccessResponse(ctx, 200, "Group avatar updated successfully!", currentGroup);
  } catch (error: any) {
    return ErrorResponse(ctx, error.code || 500, error.message || "Error while updating group avatar!");
  }
};

export const deleteAvatar = async (ctx: Context) => {
  try {
    const groupId = ctx.req.param("id");
    const reqUser = ctx.req.user?._id!;

    const currentGroup = await Group.findOne({ _id: groupId, admin: reqUser });

    if (!currentGroup) {
      throw new HttpError(403, "You're not allowed for update this group!");
    }

    if (!currentGroup.avatar) {
      throw new HttpError(400, "Group avatar is not available!");
    }

    const imageUrl = new URL(currentGroup.avatar);
    const fileId = imageUrl.searchParams.get("fid");

    if (fileId) {
      await imagekitDelete(fileId);
    }

    currentGroup.avatar = null;
    await currentGroup.save({ validateBeforeSave: false });

    return SuccessResponse(ctx, 200, "Group avatar deleted successfully!", currentGroup);
  } catch (error: any) {
    return ErrorResponse(ctx, error.code || 500, error.message || "Error while deleting group avatar!");
  }
};

export const fetchGroups = async (ctx: Context) => {
  try {
    const uid = new Types.ObjectId(ctx.req.user?._id);

    const groups = await Group.aggregate([
      { $match: { members: uid } },
      {
        $lookup: {
          from: "conversations",
          localField: "_id",
          foreignField: "participants",
          as: "conversation",
        },
      },
      {
        $addFields: {
          interaction: { $arrayElemAt: ["$conversation.interaction", 0] },
        },
      },
      {
        $project: {
          name: 1,
          description: 1,
          avatar: 1,
          admin: 1,
          members: 1,
          createdAt: 1,
          updatedAt: 1,
          __v: 1,
          interaction: 1,
        },
      },
    ]);

    return SuccessResponse(ctx, 200, "Groups fetched successfully!", groups);
  } catch (error: any) {
    return ErrorResponse(ctx, error.code || 500, error.message || "Error while fetching groups!");
  }
};

export const fetchMembers = async (gid: Types.ObjectId) => {
  const group = await Group.findById(gid).select("-_id members").lean();
  return group?.members.map((id) => id.toString()) || [];
};

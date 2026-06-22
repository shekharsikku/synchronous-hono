import { Types } from "mongoose";
import { imagekitDelete, imagekitUpload } from "#/configs/imagekit.js";
import { Conversation, Group, User } from "#/models/index.js";
import type { AppRouteHandler } from "#/openapi/index.js";
import type {
  CreateGroupRoute,
  DeleteAvatarRoute,
  FetchGroupRoute,
  UpdateAvatarRoute,
  UpdateDetailsRoute,
  UpdateMembersRoute,
} from "#/routes/group.js";
import { emitEvent, getSockets } from "#/server.js";
import { HttpError, HttpResponse, HttpStatusCodes } from "#/utilities/http/index.js";

export const createGroup: AppRouteHandler<CreateGroupRoute> = async (ctx) => {
  const groupData = ctx.req.valid("json");
  const reqUser = ctx.req.user?._id;

  if (groupData.admin !== reqUser?.toString()) {
    return HttpResponse.error(ctx, HttpStatusCodes.FORBIDDEN, "Invalid group admin assignment!");
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
    return HttpResponse.error(ctx, HttpStatusCodes.CONFLICT, "Group name already exists!");
  }

  if (existingUsers.length !== groupData.members.length) {
    return HttpResponse.error(ctx, HttpStatusCodes.BAD_REQUEST, "Some members don't exists!");
  }

  const newGroup = await Group.create({
    name: groupData.name,
    description: groupData.description,
    admin: new Types.ObjectId(groupData.admin),
    members: groupData.members.map((id) => new Types.ObjectId(id)),
  });

  const sockets = newGroup.members.flatMap((m) => getSockets(m.toString())).filter(Boolean);

  /** Notify to all members after group created */
  emitEvent(sockets, "group:created", {
    ...newGroup.toJSON(),
    interaction: new Date().toISOString(),
  });

  await Conversation.create({
    participants: [newGroup._id],
    models: "Group",
  });

  return HttpResponse.success(ctx, HttpStatusCodes.CREATED, "Group created successfully!");
};

export const updateDetails: AppRouteHandler<UpdateDetailsRoute> = async (ctx) => {
  const { id: groupId } = ctx.req.valid("param");
  const updateData = ctx.req.valid("json");
  const reqUser = ctx.req.user?._id!;

  if (updateData.name) {
    const existingGroup = await Group.exists({
      name: updateData.name,
      admin: reqUser,
      _id: { $ne: groupId! },
    });

    if (existingGroup) {
      return HttpResponse.error(ctx, HttpStatusCodes.CONFLICT, "Group name already exists!");
    }
  }

  const updatedGroup = await Group.findOneAndUpdate({ _id: groupId!, admin: reqUser }, { $set: updateData }, { returnDocument: "after" });

  if (!updatedGroup) {
    return HttpResponse.error(ctx, HttpStatusCodes.NOT_FOUND, "Group not found!");
  }

  return HttpResponse.success(ctx, HttpStatusCodes.OK, "Group details updated successfully!", updatedGroup);
};

const toObjectIds = (ids: string[]) =>
  ids.map((id) => {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpError(HttpStatusCodes.BAD_REQUEST, `Invalid ObjectId: ${id}`);
    }
    return new Types.ObjectId(id);
  });

export const updateMembers: AppRouteHandler<UpdateMembersRoute> = async (ctx) => {
  const { id: groupId } = ctx.req.valid("param");
  const { add, remove } = ctx.req.valid("json");
  const reqUser = ctx.req.user?._id!;

  if (!add?.length && !remove?.length) {
    return HttpResponse.error(ctx, HttpStatusCodes.BAD_REQUEST, "Provide at least one member!");
  }

  if (remove.includes(reqUser?.toString()!)) {
    return HttpResponse.error(ctx, HttpStatusCodes.FORBIDDEN, "Admin can't be removed!");
  }

  const addIds = toObjectIds(add);
  const removeIds = toObjectIds(remove);
  const memberIds = [...add, ...remove];

  const existingUsers = new Set((await User.distinct("_id", { _id: { $in: memberIds } })).map(String));
  const missingUsers = memberIds.filter((id) => !existingUsers.has(id));

  if (missingUsers.length > 0) {
    return HttpResponse.error(ctx, HttpStatusCodes.BAD_REQUEST, `Users not found: ${missingUsers.join(", ")}`);
  }

  const updatedGroup = await Group.findOneAndUpdate(
    { _id: groupId, admin: reqUser },
    [
      {
        $set: {
          members: {
            $setUnion: [
              {
                $setDifference: ["$members", removeIds],
              },
              addIds,
            ],
          },
        },
      },
    ],
    { returnDocument: "after", updatePipeline: true },
  );

  if (!updatedGroup) {
    return HttpResponse.error(ctx, HttpStatusCodes.NOT_FOUND, "Group not found!");
  }

  return HttpResponse.success(ctx, HttpStatusCodes.OK, "Group members updated successfully!", updatedGroup);
};

export const updateAvatar: AppRouteHandler<UpdateAvatarRoute> = async (ctx) => {
  const { id: groupId } = ctx.req.valid("param");
  const { "group-avatar": imageFile } = ctx.req.valid("form");

  if (!imageFile || !(imageFile instanceof File)) {
    return HttpResponse.error(ctx, HttpStatusCodes.BAD_REQUEST, "Invalid avatar file upload!");
  }

  const currentGroup = await Group.findOne({ _id: groupId!, admin: ctx.req.user?._id! });

  if (!currentGroup) {
    return HttpResponse.error(ctx, HttpStatusCodes.NOT_FOUND, "Group not found!");
  }

  const uploadedImage = await imagekitUpload(imageFile);

  if (!uploadedImage?.url) {
    return HttpResponse.error(ctx, HttpStatusCodes.INTERNAL_SERVER_ERROR, "Error while uploading avatar!");
  }

  if (currentGroup.avatar) {
    const imageUrl = new URL(currentGroup.avatar);
    const fileId = imageUrl.searchParams.get("fid");

    if (fileId) {
      imagekitDelete(fileId).catch(() => {});
    }
  }

  currentGroup.avatar = `${uploadedImage.url}?fid=${uploadedImage.fileId}`;
  await currentGroup.save({ validateBeforeSave: false });

  return HttpResponse.success(ctx, HttpStatusCodes.OK, "Group avatar updated successfully!", currentGroup);
};

export const deleteAvatar: AppRouteHandler<DeleteAvatarRoute> = async (ctx) => {
  const { id: groupId } = ctx.req.valid("param");

  const currentGroup = await Group.findOne({ _id: groupId!, admin: ctx.req.user?._id! });

  if (!currentGroup) {
    return HttpResponse.error(ctx, HttpStatusCodes.NOT_FOUND, "Group not found!");
  }

  if (!currentGroup.avatar) {
    return HttpResponse.error(ctx, HttpStatusCodes.BAD_REQUEST, "Group avatar not available!");
  }

  const imageUrl = new URL(currentGroup.avatar);
  const fileId = imageUrl.searchParams.get("fid");

  if (fileId) {
    imagekitDelete(fileId).catch(() => {});
  }

  currentGroup.avatar = null;
  await currentGroup.save({ validateBeforeSave: false });

  return HttpResponse.success(ctx, HttpStatusCodes.OK, "Group avatar deleted successfully!", currentGroup);
};

export const fetchGroups: AppRouteHandler<FetchGroupRoute> = async (ctx) => {
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

  return HttpResponse.success(ctx, HttpStatusCodes.OK, "Groups fetched successfully!", groups);
};

export const fetchMembers = async (gid: Types.ObjectId) => {
  const group = await Group.findById(gid).select("-_id members").lean();
  return group?.members.map((id) => id.toString()) || [];
};

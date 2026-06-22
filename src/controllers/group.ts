import { Types } from "mongoose";
import { imagekitDelete, imagekitUpload } from "#/configs/imagekit.js";
import { Conversation, Group, type GroupDocument, User } from "#/models/index.js";
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
import { HttpError, HttpResponse, HttpStatus } from "#/utilities/http/index.js";

const createGroupInfo = (group: GroupDocument) => ({
  _id: group._id,
  name: group.name,
  description: group.description,
  avatar: group.avatar,
  admin: group.admin,
  members: group.members,
  interaction: group.updatedAt,
});

export const createGroup: AppRouteHandler<CreateGroupRoute> = async (ctx) => {
  const groupData = ctx.req.valid("json");
  const userId = ctx.var.user._id;

  if (groupData.admin !== userId.toString()) {
    return HttpResponse.error(ctx, HttpStatus.FORBIDDEN, "Invalid group admin assignment!");
  }

  if (!groupData.members.includes(userId.toString())) {
    groupData.members.push(userId.toString());
  }

  groupData.members = [...new Set(groupData.members)];

  const [existingGroup, existingUsers] = await Promise.all([
    Group.exists({ name: groupData.name, admin: userId }),
    User.find({ _id: { $in: groupData.members } }).select("_id"),
  ]);

  if (existingGroup) {
    return HttpResponse.error(ctx, HttpStatus.CONFLICT, "Group name already exists!");
  }

  if (existingUsers.length !== groupData.members.length) {
    return HttpResponse.error(ctx, HttpStatus.BAD_REQUEST, "Some members don't exists!");
  }

  const newGroup = await Group.create({
    name: groupData.name,
    description: groupData.description,
    admin: new Types.ObjectId(groupData.admin),
    members: groupData.members.map((id) => new Types.ObjectId(id)),
  });

  const groupInfo = createGroupInfo(newGroup);
  const sockets = groupData.members.flatMap(getSockets).filter(Boolean);

  /** Notify to all members after group created */
  emitEvent(sockets, "group:created", groupInfo);

  await Conversation.create({
    participants: [newGroup._id],
    models: "Group",
  });

  return HttpResponse.success(ctx, HttpStatus.CREATED, "Group created successfully!", groupInfo);
};

export const updateDetails: AppRouteHandler<UpdateDetailsRoute> = async (ctx) => {
  const { id: groupId } = ctx.req.valid("param");
  const updateData = ctx.req.valid("json");
  const userId = ctx.var.user._id;

  if (updateData.name) {
    const existingGroup = await Group.exists({
      name: updateData.name,
      admin: userId,
      _id: { $ne: groupId },
    });

    if (existingGroup) {
      return HttpResponse.error(ctx, HttpStatus.CONFLICT, "Group name already exists!");
    }
  }

  const updatedGroup = await Group.findOneAndUpdate(
    { _id: groupId, admin: userId },
    { $set: updateData },
    { returnDocument: "after" },
  );

  if (!updatedGroup) {
    return HttpResponse.error(ctx, HttpStatus.NOT_FOUND, "Group not found!");
  }

  const groupInfo = createGroupInfo(updatedGroup);
  return HttpResponse.success(ctx, HttpStatus.OK, "Group details updated successfully!", groupInfo);
};

const toObjectIds = (ids: string[]) =>
  ids.map((id) => {
    if (!Types.ObjectId.isValid(id)) {
      throw new HttpError(HttpStatus.BAD_REQUEST, `Invalid ObjectId: ${id}`);
    }
    return new Types.ObjectId(id);
  });

export const updateMembers: AppRouteHandler<UpdateMembersRoute> = async (ctx) => {
  const { id: groupId } = ctx.req.valid("param");
  const { add, remove } = ctx.req.valid("json");
  const userId = ctx.var.user._id;

  if (!add?.length && !remove?.length) {
    return HttpResponse.error(ctx, HttpStatus.BAD_REQUEST, "Provide at least one member!");
  }

  if (remove.includes(userId.toString())) {
    return HttpResponse.error(ctx, HttpStatus.FORBIDDEN, "Admin can't be removed!");
  }

  const addIds = toObjectIds(add);
  const removeIds = toObjectIds(remove);
  const memberIds = [...add, ...remove];

  const existingUsers = new Set(
    (await User.distinct("_id", { _id: { $in: memberIds } })).map(String),
  );
  const missingUsers = memberIds.filter((id) => !existingUsers.has(id));

  if (missingUsers.length > 0) {
    return HttpResponse.error(
      ctx,
      HttpStatus.BAD_REQUEST,
      `Users not found: ${missingUsers.join(", ")}`,
    );
  }

  const updatedGroup = await Group.findOneAndUpdate(
    { _id: groupId, admin: userId },
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
    return HttpResponse.error(ctx, HttpStatus.NOT_FOUND, "Group not found!");
  }

  const groupInfo = createGroupInfo(updatedGroup);
  return HttpResponse.success(ctx, HttpStatus.OK, "Group members updated successfully!", groupInfo);
};

export const updateAvatar: AppRouteHandler<UpdateAvatarRoute> = async (ctx) => {
  const { id: groupId } = ctx.req.valid("param");
  const { "group-avatar": imageFile } = ctx.req.valid("form");
  const userId = ctx.var.user._id;

  if (!imageFile || !(imageFile instanceof File)) {
    return HttpResponse.error(ctx, HttpStatus.BAD_REQUEST, "Invalid avatar file upload!");
  }

  const currentGroup = await Group.findOne({ _id: groupId, admin: userId });

  if (!currentGroup) {
    return HttpResponse.error(ctx, HttpStatus.NOT_FOUND, "Group not found!");
  }

  const uploadedImage = await imagekitUpload(imageFile);

  if (!uploadedImage?.url) {
    return HttpResponse.error(
      ctx,
      HttpStatus.INTERNAL_SERVER_ERROR,
      "Error while uploading avatar!",
    );
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

  const groupInfo = createGroupInfo(currentGroup);
  return HttpResponse.success(ctx, HttpStatus.OK, "Group avatar updated successfully!", groupInfo);
};

export const deleteAvatar: AppRouteHandler<DeleteAvatarRoute> = async (ctx) => {
  const { id: groupId } = ctx.req.valid("param");
  const userId = ctx.var.user._id;

  const currentGroup = await Group.findOne({ _id: groupId, admin: userId });

  if (!currentGroup) {
    return HttpResponse.error(ctx, HttpStatus.NOT_FOUND, "Group not found!");
  }

  if (!currentGroup.avatar) {
    return HttpResponse.error(ctx, HttpStatus.BAD_REQUEST, "Group avatar not available!");
  }

  const imageUrl = new URL(currentGroup.avatar);
  const fileId = imageUrl.searchParams.get("fid");

  if (fileId) {
    imagekitDelete(fileId).catch(() => {});
  }

  currentGroup.avatar = null;
  await currentGroup.save({ validateBeforeSave: false });

  const groupInfo = createGroupInfo(currentGroup);
  return HttpResponse.success(ctx, HttpStatus.OK, "Group avatar deleted successfully!", groupInfo);
};

export const fetchGroups: AppRouteHandler<FetchGroupRoute> = async (ctx) => {
  const userId = new Types.ObjectId(ctx.var.user._id);

  const groups = await Group.aggregate([
    { $match: { members: userId } },
    {
      $lookup: {
        from: "conversations",
        let: { groupId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $in: ["$$groupId", "$participants"],
              },
            },
          },
          {
            $project: {
              _id: 0,
              interaction: 1,
            },
          },
        ],
        as: "conversation",
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        description: 1,
        avatar: 1,
        admin: 1,
        members: 1,
        interaction: {
          $arrayElemAt: ["$conversation.interaction", 0],
        },
      },
    },
  ]);

  return HttpResponse.success(ctx, HttpStatus.OK, "Groups fetched successfully!", groups);
};

export const fetchMembers = async (groupId: Types.ObjectId) => {
  const group = await Group.findById(groupId).select("members -_id").lean();
  return group?.members.map(String) ?? [];
};

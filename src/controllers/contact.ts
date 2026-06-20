import type { Context } from "hono";
import { Types } from "mongoose";
import { Conversation, User } from "#/models/index.js";
import { HttpError, HttpResponse } from "#/utilities/response.js";

export const searchContact = async (ctx: Context) => {
  const search = ctx.req.query("search");

  if (!search) {
    throw new HttpError(400, "Search query is required!");
  }

  const terms = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(terms, "i");

  const result = await User.find({
    $and: [
      { _id: { $ne: ctx.req.user?._id! } },
      { setup: true },
      { $or: [{ name: regex }, { username: regex }, { email: regex }] },
    ],
  })
    .select("-setup -createdAt -updatedAt -__v")
    .lean();

  if (result.length === 0) {
    throw new HttpError(404, "No any user found!");
  }

  return new HttpResponse(200, "Available contacts!", { data: result }).send(ctx);
};

export const availableContact = async (ctx: Context) => {
  const contacts = await User.find({
    _id: { $ne: ctx.req.user?._id! },
    setup: true,
  })
    .select("-setup -createdAt -updatedAt -__v")
    .lean();

  if (contacts.length === 0) {
    throw new HttpError(404, "No any contact available!");
  }

  return new HttpResponse(200, "Contacts fetched successfully!", { data: contacts }).send(ctx);
};

export const fetchContacts = async (ctx: Context) => {
  const uid = new Types.ObjectId(ctx.req.user?._id);

  const contacts = await Conversation.aggregate([
    { $match: { participants: uid } },
    { $sort: { interaction: -1 } },
    {
      $lookup: {
        from: "users",
        let: { participantIds: "$participants" },
        pipeline: [
          { $match: { $expr: { $in: ["$_id", "$$participantIds"] } } },
          {
            $project: {
              _id: 1,
              name: 1,
              email: 1,
              username: 1,
              gender: 1,
              image: 1,
              bio: 1,
            },
          },
        ],
        as: "participantsData",
      },
    },
    {
      $addFields: {
        contact: {
          $filter: {
            input: "$participantsData",
            as: "p",
            cond: { $ne: ["$$p._id", uid] },
          },
        },
      },
    },
    {
      $replaceRoot: {
        newRoot: {
          $mergeObjects: [{ $arrayElemAt: ["$contact", 0] }, { interaction: "$interaction" }],
        },
      },
    },
    { $match: { _id: { $ne: null } } },
  ]);

  return new HttpResponse(200, "Contacts fetched successfully!", { data: contacts }).send(ctx);
};

export const fetchContact = async (ctx: Context) => {
  const userId = ctx.req.param("id");

  const userContact = await User.findById(userId).select("-setup -createdAt -updatedAt -__v");

  if (!userContact) {
    throw new HttpError(404, "Contact not found!");
  }

  return new HttpResponse(200, "Contact fetched successfully!", { data: userContact }).send(ctx);
};

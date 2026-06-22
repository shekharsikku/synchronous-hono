import { Types } from "mongoose";
import { Conversation, User } from "#/models/index.js";
import type { AppRouteHandler } from "#/openapi/types.js";
import type { AvailableContactRoute, FetchContactRoute, FetchContactsRoute, SearchContactRoute } from "#/routes/contact.js";
import { HttpResponse, HttpStatusCodes } from "#/utilities/http/index.js";

export const searchContact: AppRouteHandler<SearchContactRoute> = async (ctx) => {
  const { search } = ctx.req.valid("query");

  if (!search) {
    return HttpResponse.error(ctx, HttpStatusCodes.BAD_REQUEST, "Search query can't empty!");
  }

  const terms = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(terms, "i");

  const result = await User.find({
    $and: [{ _id: { $ne: ctx.req.user?._id! } }, { setup: true }, { $or: [{ name: regex }, { username: regex }, { email: regex }] }],
  })
    .select("-setup -createdAt -updatedAt -__v")
    .lean();

  return HttpResponse.success(ctx, HttpStatusCodes.OK, "Contacts searched successfully!", result);
};

export const availableContact: AppRouteHandler<AvailableContactRoute> = async (ctx) => {
  const contacts = await User.find({
    _id: { $ne: ctx.req.user?._id! },
    setup: true,
  })
    .select("-setup -createdAt -updatedAt -__v")
    .lean();

  return HttpResponse.success(ctx, HttpStatusCodes.OK, "Contacts fetched successfully!", contacts);
};

export const fetchContacts: AppRouteHandler<FetchContactsRoute> = async (ctx) => {
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

  return HttpResponse.success(ctx, HttpStatusCodes.OK, "Contacts fetched successfully!", contacts);
};

export const fetchContact: AppRouteHandler<FetchContactRoute> = async (ctx) => {
  const uid = ctx.req.param("id");

  const contact = await User.findById(uid).select("-setup -createdAt -updatedAt -__v");

  if (!contact) {
    return HttpResponse.error(ctx, HttpStatusCodes.NOT_FOUND, "Contact not found!");
  }

  return HttpResponse.success(ctx, HttpStatusCodes.OK, "Contact fetched successfully!", contact);
};

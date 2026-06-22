import { Types } from "mongoose";
import { Conversation, User } from "#/models/index.js";
import type { AppRouteHandler } from "#/openapi/types.js";
import type {
  AvailableContactRoute,
  FetchContactRoute,
  FetchContactsRoute,
  SearchContactRoute,
} from "#/routes/contact.js";
import { HttpResponse, HttpStatus } from "#/utilities/http/index.js";

export const searchContact: AppRouteHandler<SearchContactRoute> = async (ctx) => {
  const { search } = ctx.req.valid("query");
  const userId = ctx.var.user._id;

  if (!search) {
    return HttpResponse.error(ctx, HttpStatus.BAD_REQUEST, "Search query can't empty!");
  }

  const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");

  const result = await User.find({
    _id: { $ne: userId },
    setup: true,
    $or: [{ name: regex }, { username: regex }],
  })
    .select("-setup -createdAt -updatedAt -__v")
    .lean();

  return HttpResponse.success(ctx, HttpStatus.OK, "Contacts searched successfully!", result);
};

export const availableContact: AppRouteHandler<AvailableContactRoute> = async (ctx) => {
  const userId = ctx.var.user._id;

  const contacts = await User.find({
    _id: { $ne: userId },
    setup: true,
  })
    .select("-setup -createdAt -updatedAt -__v")
    .lean();

  return HttpResponse.success(ctx, HttpStatus.OK, "Contacts fetched successfully!", contacts);
};

export const fetchContacts: AppRouteHandler<FetchContactsRoute> = async (ctx) => {
  const userId = new Types.ObjectId(ctx.var.user._id);

  const contacts = await Conversation.aggregate([
    { $match: { participants: userId } },
    { $sort: { interaction: -1 } },
    {
      $lookup: {
        from: "users",
        let: { participants: "$participants" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [{ $in: ["$_id", "$$participants"] }, { $ne: ["$_id", userId] }],
              },
            },
          },
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
        as: "contacts",
      },
    },
    {
      $replaceRoot: {
        newRoot: {
          $mergeObjects: [{ $arrayElemAt: ["$contacts", 0] }, { interaction: "$interaction" }],
        },
      },
    },
    { $match: { _id: { $ne: null } } },
  ]);

  return HttpResponse.success(ctx, HttpStatus.OK, "Contacts fetched successfully!", contacts);
};

export const fetchContact: AppRouteHandler<FetchContactRoute> = async (ctx) => {
  const userId = ctx.req.param("id");

  const contact = await User.findById(userId).select("-setup -createdAt -updatedAt -__v");

  if (!contact) {
    return HttpResponse.error(ctx, HttpStatus.NOT_FOUND, "Contact not found!");
  }

  return HttpResponse.success(ctx, HttpStatus.OK, "Contact fetched successfully!", contact);
};

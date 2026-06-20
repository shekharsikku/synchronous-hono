import type { Context } from "hono";
import { Subscription } from "#/models/index.js";
import { HttpError, HttpResponse } from "#/utilities/response.js";
import type { Subscribe, Unsubscribe } from "#/utilities/schema.js";

export const subscribe = async (ctx: Context) => {
  const userId = ctx.req.user?._id!;
  const { endpoint, keys } = ctx.get("validated") as Subscribe;

  const result = await Subscription.findOneAndUpdate(
    { userId, endpoint },
    { $set: { keys }, $setOnInsert: { userId, endpoint } },
    { upsert: true, returnDocument: "after" },
  );

  return new HttpResponse(200, "Subscribed successfully!", { data: result }).send(ctx);
};

export const unsubscribe = async (ctx: Context) => {
  const userId = ctx.req.user?._id!;
  const { endpoint } = ctx.get("validated") as Unsubscribe;

  const result = await Subscription.findOneAndDelete({ userId, endpoint });

  if (!result) {
    throw new HttpError(404, "No subscription found with this endpoint!");
  }

  return new HttpResponse(200, "Unsubscribed successfully!", { data: result }).send(ctx);
};

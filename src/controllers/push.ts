import { Subscription } from "#/models/index.js";
import type { AppRouteHandler } from "#/openapi/types.js";
import type { SubscribeRoute, UnsubscribeRoute } from "#/routes/push.js";
import { HttpResponse, HttpStatusCodes } from "#/utilities/http/index.js";

export const subscribePush: AppRouteHandler<SubscribeRoute> = async (ctx) => {
  const userId = ctx.req.user?._id!;
  const { endpoint, keys } = ctx.req.valid("json");

  const result = await Subscription.findOneAndUpdate(
    { userId, endpoint },
    { $set: { keys }, $setOnInsert: { userId, endpoint } },
    { upsert: true, returnDocument: "after" },
  );

  return HttpResponse.success(ctx, HttpStatusCodes.CREATED, "Subscribed successfully!", result);
};

export const unsubscribePush: AppRouteHandler<UnsubscribeRoute> = async (ctx) => {
  const userId = ctx.req.user?._id!;
  const { endpoint } = ctx.req.valid("json");

  const result = await Subscription.findOneAndDelete({ userId, endpoint });

  if (!result) {
    return HttpResponse.error(ctx, HttpStatusCodes.NOT_FOUND, "No subscription found!");
  }

  return HttpResponse.success(ctx, HttpStatusCodes.OK, "Unsubscribed successfully!", result);
};

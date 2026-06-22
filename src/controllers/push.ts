import { Subscription } from "#/models/index.js";
import type { AppRouteHandler } from "#/openapi/types.js";
import type { SubscribeRoute, UnsubscribeRoute } from "#/routes/push.js";
import { HttpResponse, HttpStatus } from "#/utilities/http/index.js";

export const subscribePush: AppRouteHandler<SubscribeRoute> = async (ctx) => {
  const userId = ctx.var.user._id;
  const { endpoint, keys } = ctx.req.valid("json");

  const result = await Subscription.findOneAndUpdate(
    { userId, endpoint },
    { $set: { keys }, $setOnInsert: { userId, endpoint } },
    { upsert: true, returnDocument: "after" },
  );

  return HttpResponse.success(ctx, HttpStatus.CREATED, "Subscribed successfully!", result);
};

export const unsubscribePush: AppRouteHandler<UnsubscribeRoute> = async (ctx) => {
  const userId = ctx.var.user._id;
  const { endpoint } = ctx.req.valid("json");

  const result = await Subscription.findOneAndDelete({ userId, endpoint });

  if (!result) {
    return HttpResponse.error(ctx, HttpStatus.NOT_FOUND, "No subscription found!");
  }

  return HttpResponse.success(ctx, HttpStatus.OK, "Unsubscribed successfully!", result);
};

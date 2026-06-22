import { createRoute } from "@hono/zod-openapi";
import { subscribePush, unsubscribePush } from "#/controllers/push.js";
import { authAccess, limiter } from "#/middlewares/index.js";
import { createRouter, errorSchema, jsonContent, jsonRequired, successSchema, Tags } from "#/openapi/index.js";
import { HttpStatusCodes, HttpStatusPhrases } from "#/utilities/http/index.js";
import { subscribeSchema, unsubscribeSchema } from "#/utilities/schema.js";

const subscribeRoute = createRoute({
  tags: Tags.Push,
  method: "post",
  path: "/subscribe",
  request: {
    body: jsonRequired(subscribeSchema, "Subscribe payload!"),
  },
  responses: {
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(errorSchema({ message: "Unauthorized request!" }), HttpStatusPhrases.UNAUTHORIZED),
    [HttpStatusCodes.CREATED]: jsonContent(successSchema({ message: "Subscribed successfully!" }), HttpStatusPhrases.CREATED),
  },
});

const unsubscribeRoute = createRoute({
  tags: Tags.Push,
  method: "post",
  path: "/unsubscribe",
  request: {
    body: jsonRequired(unsubscribeSchema, "Unsubscribe payload!"),
  },
  responses: {
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(errorSchema({ message: "Unauthorized request!" }), HttpStatusPhrases.UNAUTHORIZED),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema({ message: "No subscription found!" }), HttpStatusPhrases.NOT_FOUND),
    [HttpStatusCodes.OK]: jsonContent(successSchema({ message: "Unsubscribed successfully!" }), HttpStatusPhrases.OK),
  },
});

const pushRouter = createRouter();

pushRouter.use(limiter(10, 10), authAccess);

pushRouter.openapi(subscribeRoute, subscribePush);
pushRouter.openapi(unsubscribeRoute, unsubscribePush);

export type SubscribeRoute = typeof subscribeRoute;
export type UnsubscribeRoute = typeof unsubscribeRoute;

export default pushRouter;

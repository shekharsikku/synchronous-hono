import { createRoute } from "@hono/zod-openapi";
import limiter from "#/configs/limiter.js";
import { subscribePush, unsubscribePush } from "#/controllers/push.js";
import { authAccess } from "#/middlewares/index.js";
import {
  createRouter,
  errorSchema,
  jsonContent,
  jsonRequired,
  successSchema,
  Tags,
} from "#/openapi/index.js";
import { HttpPhrases, HttpStatus } from "#/utilities/http/index.js";
import { subscribeSchema, unsubscribeSchema } from "#/utilities/schema.js";

const subscribeRoute = createRoute({
  tags: Tags.Push,
  method: "post",
  path: "/subscribe",
  request: {
    body: jsonRequired(subscribeSchema, "Subscribe payload!"),
  },
  responses: {
    [HttpStatus.UNAUTHORIZED]: jsonContent(
      errorSchema({ message: "Unauthorized request!" }),
      HttpPhrases.UNAUTHORIZED,
    ),
    [HttpStatus.CREATED]: jsonContent(
      successSchema({ message: "Subscribed successfully!" }),
      HttpPhrases.CREATED,
    ),
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
    [HttpStatus.UNAUTHORIZED]: jsonContent(
      errorSchema({ message: "Unauthorized request!" }),
      HttpPhrases.UNAUTHORIZED,
    ),
    [HttpStatus.NOT_FOUND]: jsonContent(
      errorSchema({ message: "No subscription found!" }),
      HttpPhrases.NOT_FOUND,
    ),
    [HttpStatus.OK]: jsonContent(
      successSchema({ message: "Unsubscribed successfully!" }),
      HttpPhrases.OK,
    ),
  },
});

const pushRouter = createRouter();

pushRouter.use(limiter(10, 10), authAccess);

pushRouter.openapi(subscribeRoute, subscribePush);
pushRouter.openapi(unsubscribeRoute, unsubscribePush);

export type SubscribeRoute = typeof subscribeRoute;
export type UnsubscribeRoute = typeof unsubscribeRoute;

export default pushRouter;

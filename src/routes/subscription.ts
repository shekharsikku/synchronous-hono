import { Hono } from "hono";
import { subscribe, unsubscribe } from "#/controllers/subscription.js";
import { authAccess, limiter, validate } from "#/middlewares/index.js";
import { subscribeSchema, unsubscribeSchema } from "#/utilities/schema.js";

const auth = new Hono()
  .use(limiter(10, 10))
  .post("/subscribe", authAccess, validate(subscribeSchema), subscribe)
  .post("/unsubscribe", authAccess, validate(unsubscribeSchema), unsubscribe);

export default auth;

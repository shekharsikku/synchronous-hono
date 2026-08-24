import { createRoute, z } from "@hono/zod-openapi";
import limiter from "#/configs/limiter.js";
import { authEvents } from "#/middlewares/index.js";
import { type AppRouteHandler, createRouter, jsonContent, successSchema } from "#/openapi/index.js";
import { connectEvents, eventsRoute } from "#/services/events.js";
import { HttpPhrases, HttpResponse, HttpStatus } from "#/utilities/http/index.js";
import authRoutes from "./auth.js";
import contactRoute from "./contact.js";
import groupRoutes from "./group.js";
import messageRoutes from "./message.js";
import pushRoutes from "./push.js";
import userRoutes from "./user.js";

const helloRoute = createRoute({
  tags: ["Hello"],
  method: "get",
  path: "/hello",
  request: {
    query: z.object({
      name: z.string().min(1).default("Stranger"),
    }),
  },
  responses: {
    [HttpStatus.OK]: jsonContent(successSchema({ message: "Hello, Stranger!" }), HttpPhrases.OK),
  },
});

const handleHello: AppRouteHandler<typeof helloRoute> = (ctx) => {
  const { name } = ctx.req.valid("query");
  return HttpResponse.success(ctx, HttpStatus.OK, `Hello, ${name}!`);
};

const router = createRouter();

router.use(limiter());
router.use("/events", authEvents);

router.openapi(helloRoute, handleHello);
router.openapi(eventsRoute, connectEvents);

router.route("/auth", authRoutes);
router.route("/user", userRoutes);
router.route("/contact", contactRoute);
router.route("/group", groupRoutes);
router.route("/message", messageRoutes);
router.route("/push", pushRoutes);

export default router;

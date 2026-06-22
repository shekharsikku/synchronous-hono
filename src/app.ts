import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { pinoLogger } from "hono-pino";
import webpush from "web-push";
import { ZodError } from "zod";
import env from "#/configs/env.js";
import { logger } from "#/middlewares/index.js";
import routes from "#/routes/index.js";
import { HttpError, HttpResponse } from "#/utilities/response.js";

webpush.setVapidDetails(env.VAPID_MAILTO, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

const app = new Hono({ strict: env.isProd });

app.use(requestId());
app.use(pinoLogger({ pino: logger }));

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    maxAge: 3600,
  }),
);

app.use(
  bodyLimit({
    maxSize: env.BODY_LIMIT * 1024 * 1024,
    onError: () => {
      throw new HttpError(413, "Request payload is too large!");
    },
  }),
);

app.all("/", (ctx) => {
  return ctx.redirect(env.CORS_ORIGIN);
});

app.get("/hello", (ctx) => {
  const to = ctx.req.query("to") ?? "Unknown";
  const ts = new Date().toISOString();
  return new HttpResponse(200, `Bun + Hono says hello to ${to} at ${ts}!`).send(ctx);
});

app.route("/api", routes);

app.onError((err, ctx) => {
  if (err instanceof ZodError) {
    return new HttpResponse(400, "Validation error occurred!", { error: err.issues }).send(ctx);
  }

  if (err instanceof HttpError) {
    return new HttpResponse(err.code, err.message).send(ctx);
  }

  ctx.var.logger.error({ err }, "Unhandled server error!");
  return new HttpResponse(500, "Internal server error!").send(ctx);
});

app.notFound((ctx) => {
  const message = `Requested url '${ctx.req.path}' not found on the server!`;
  return new HttpResponse(404, message).send(ctx);
});

export default app;

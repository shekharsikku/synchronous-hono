import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { pinoLogger } from "hono-pino";
import { ZodError } from "zod";
import env from "#/configs/env.js";
import { logger } from "#/middlewares/index.js";
import routes from "#/routes/index.js";
import { HttpError, HttpResponse } from "#/utils/response.js";

const app = new Hono({ strict: env.STRICT_MODE });

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
    onError: (_ctx: Context) => {
      throw new HttpError(413, "Request payload is too large!");
    },
  }),
);

app.all("/", (ctx: Context) => {
  return ctx.redirect(env.CORS_ORIGIN);
});

app.get("/hello", (ctx: Context) => {
  const to = ctx.req.query("to") ?? "Unknown";
  const ts = new Date().toISOString();
  const message = `Hono + Bun says hello to ${to} at ${ts}!`;
  return new HttpResponse(200, message).send(ctx);
});

app.route("/api", routes);

app.onError((err: any, ctx: Context) => {
  if (err instanceof ZodError) {
    return new HttpResponse(400, "Validation error occurred!", { error: err.issues }).send(ctx);
  }

  if (err instanceof HttpError) {
    return new HttpResponse(err.code, err.message).send(ctx);
  }

  ctx.var.logger.error({ err }, "Unhandled server error!");
  return new HttpResponse(500, "Internal server error!").send(ctx);
});

app.notFound((ctx: Context) => {
  const message = `Requested url '${ctx.req.path}' not found on the server!`;
  return new HttpResponse(404, message).send(ctx);
});

export default app;

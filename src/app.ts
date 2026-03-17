import { type Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import env from "#/configs/env.js";
import routes from "#/routes/index.js";
import { ErrorResponse, HttpError, SuccessResponse } from "#/utils/response.js";

const app = new Hono({ strict: env.STRICT_MODE });

app.use(logger());

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
  return SuccessResponse(ctx, 200, message);
});

app.route("/api", routes);

app.onError((err: Error, ctx: Context) => {
  if (err instanceof HttpError) {
    return ErrorResponse(ctx, err.code, err.message);
  }
  const message = err.message || "Oops! Something went wrong!";
  console.error(`Error: ${message}`);
  return ErrorResponse(ctx, 500, message);
});

app.notFound((ctx: Context) => {
  const message = `Requested url '${ctx.req.path}' not found on the server!`;
  return ErrorResponse(ctx, 404, message);
});

export default app;

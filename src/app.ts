import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { requestId } from "hono/request-id";
import { pinoLogger } from "hono-pino";
import webpush from "web-push";
import { ZodError } from "zod";
import env from "#/configs/env.js";
import { logger } from "#/middlewares/index.js";
import { configOpenAPI, createRouter } from "#/openapi/index.js";
import routes from "#/routes/index.js";
import { HttpError, HttpResponse, HttpStatus } from "#/utilities/http/index.js";

webpush.setVapidDetails(env.VAPID_MAILTO, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);

const app = createRouter();

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
    onError: (ctx) => {
      return HttpResponse.error(ctx, HttpStatus.REQUEST_TOO_LONG, "Request payload is too large!");
    },
  }),
);

app.all("/", (ctx) => {
  if (env.isProd) return ctx.redirect(env.CORS_ORIGIN);
  return HttpResponse.success(ctx, HttpStatus.OK, "Bun + Hono says hello!");
});

configOpenAPI(app);

app.route("/api", routes);

app.onError((err, ctx) => {
  if (err instanceof HttpError) {
    return HttpResponse.error(ctx, err.status, err.message);
  }

  if (err instanceof ZodError) {
    return HttpResponse.error(
      ctx,
      HttpStatus.UNPROCESSABLE_ENTITY,
      "Validation error occurred!",
      err.issues,
    );
  }

  ctx.var.logger.error({ err }, "Unhandled server error!");
  return HttpResponse.error(ctx, HttpStatus.INTERNAL_SERVER_ERROR, "Internal server error!");
});

app.notFound((ctx) => {
  const message = `Requested url '${ctx.req.path}' not found on the server!`;
  return HttpResponse.error(ctx, HttpStatus.NOT_FOUND, message);
});

export default app;

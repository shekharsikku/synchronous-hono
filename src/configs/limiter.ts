import type { Context } from "hono";
import { rateLimiter } from "hono-rate-limiter";
import { HttpResponse, HttpStatus } from "#/utilities/http/index.js";

const getClientIp = <C extends Context>(ctx: C): string => {
  return (
    ctx.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    ctx.req.header("cf-connecting-ip") ??
    ctx.req.header("true-client-ip") ??
    ctx.req.header("x-real-ip") ??
    ctx.req.header("x-client-ip") ??
    "unknown-ip"
  );
};

const limiter = (minutes = 10, limit = 10000) => {
  return rateLimiter({
    windowMs: minutes * 60 * 1000,
    limit: limit,
    standardHeaders: true,
    keyGenerator: (ctx) => {
      return getClientIp(ctx);
    },
    handler: (ctx) => {
      ctx.var.logger.error("Rate limit exceeded for ip: %s", getClientIp(ctx));
      return HttpResponse.error(
        ctx,
        HttpStatus.TOO_MANY_REQUESTS,
        "You've made too many requests!",
      );
    },
  });
};

export default limiter;

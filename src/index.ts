import type { Context } from "hono";
import { connect } from "mongoose";
import app from "#/app.js";
import env from "#/configs/env.js";
import { logger } from "#/middlewares/index.js";
import { engine } from "#/server.js";
import jobs from "#/services/jobs.js";

app.all("/socket.io/*", (ctx: Context) => {
  return engine.handleRequest(ctx.req.raw, ctx.env);
});

void (async () => {
  try {
    const { connection } = await connect(env.MONGODB_URI);

    if (connection.readyState !== 1) {
      throw new Error("Database connection error!");
    }

    logger.info("Database connection success!");

    jobs.start();

    const server = Bun.serve({
      ...engine.handler(),
      fetch: app.fetch,
      port: env.PORT,
      maxRequestBodySize: env.BODY_LIMIT * 1024 * 1024,
    });

    logger.info("Server is running at: %s", server.url);
  } catch (err) {
    logger.error({ err }, "Server startup failed!");
    process.exit(1);
  }
})();

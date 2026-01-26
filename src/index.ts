import type { Context } from "hono";
import { connect } from "mongoose";
import app from "#/app.js";
import env from "#/configs/env.js";
import { engine } from "#/server.js";

app.all("/socket.io/*", (ctx: Context) => {
  return engine.handleRequest(ctx.req.raw, ctx.env);
});

void (async () => {
  try {
    const { connection } = await connect(env.MONGODB_URI);

    if (connection.readyState !== 1) {
      throw new Error("Database connection error!");
    }

    console.log("\nDatabase connection success!");

    const server = Bun.serve({
      ...engine.handler(),
      fetch: app.fetch,
      port: env.PORT,
      maxRequestBodySize: env.BODY_LIMIT * 1024 * 1024,
    });

    console.log(`Server is running at: ${server.url}`);
  } catch (error: any) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
})();

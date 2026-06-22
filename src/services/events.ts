import { createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { logger } from "#/middlewares/index.js";
import { HttpPhrases, HttpStatus } from "#/utilities/http/index.js";

type EventsClient = {
  controller: ReadableStreamDefaultController<string>;
};

class EventsService {
  private clients = new Map<string, EventsClient>();

  connect(uid: string, controller: ReadableStreamDefaultController<string>) {
    this.clients.set(uid, { controller });
    logger.info("Event user connected: %s", uid);
  }

  disconnect(uid: string) {
    this.clients.delete(uid);
    logger.info("Event user disconnected: %s", uid);
  }

  send(uid: string, event: string, data: unknown) {
    const client = this.clients.get(uid);

    if (!client) {
      logger.info("Event client not found: %s", uid);
      return;
    }

    client.controller.enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

export const eventsService = new EventsService();

export const connectEvents = <C extends Context>(ctx: C) => {
  const uid = ctx.var.user._id.toString();

  if (!uid) {
    logger.info("Event user not authenticated!");
    return ctx.text("Unauthorized request!", HttpStatus.UNAUTHORIZED);
  }

  const stream = new ReadableStream<string>({
    start(controller) {
      eventsService.connect(uid, controller);

      controller.enqueue(": connected\n\n");

      const heartbeat = setInterval(() => {
        controller.enqueue(": ping\n\n");
      }, 30 * 1000);

      ctx.req.raw.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
        controller.close();
        eventsService.disconnect(uid);
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Credentials": "true",
    },
  });
};

export const eventsRoute = createRoute({
  tags: ["Events"],
  method: "get",
  path: "/events",
  responses: {
    [HttpStatus.UNAUTHORIZED]: {
      content: { "text/plain": { schema: z.string() } },
      description: HttpPhrases.UNAUTHORIZED,
    },
    [HttpStatus.OK]: {
      content: { "text/event-stream": { schema: z.string() } },
      description: HttpPhrases.OK,
    },
  },
});

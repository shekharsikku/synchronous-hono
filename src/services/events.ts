import type { Context } from "hono";

type EventsClient = {
  controller: ReadableStreamDefaultController<string>;
};

class EventsService {
  private clients = new Map<string, EventsClient>();

  connect(uid: string, controller: ReadableStreamDefaultController<string>) {
    this.clients.set(uid, { controller });
    console.log("Event user connected:", uid);
  }

  disconnect(uid: string) {
    this.clients.delete(uid);
    console.log("Event user disconnected:", uid);
  }

  send(uid: string, event: string, data: unknown) {
    const client = this.clients.get(uid);

    if (!client) {
      console.log("Event client not found!");
      return;
    }

    client.controller.enqueue(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
}

export const eventsService = new EventsService();

export const connectEvents = (ctx: Context) => {
  const uid = ctx.req.user?._id.toString();

  if (!uid) {
    return ctx.text("Unauthorized events request!", 401);
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

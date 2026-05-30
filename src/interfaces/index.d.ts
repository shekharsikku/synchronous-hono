import type { PinoLogger } from "hono-pino";

declare module "hono" {
  interface ContextVariableMap {
    user?: UserInterface;
    logger: PinoLogger;
  }

  interface HonoRequest {
    user?: UserInterface;
  }
}

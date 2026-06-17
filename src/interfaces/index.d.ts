import type { PinoLogger } from "hono-pino";
import type { UserInfo } from "#/utils/helpers.ts";

declare module "hono" {
  interface ContextVariableMap {
    user?: UserInfo;
    logger: PinoLogger;
  }

  interface HonoRequest {
    user?: UserInfo;
  }
}

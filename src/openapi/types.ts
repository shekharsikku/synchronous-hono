import type { OpenAPIHono, RouteConfig, RouteHandler } from "@hono/zod-openapi";
import type { Schema } from "hono";
import type { PinoLogger } from "hono-pino";
import type { UserInfo } from "#/utilities/helpers.ts";

export interface AppVariables {
  logger: PinoLogger;
  user: UserInfo;
}

export interface AppBindings {
  Variables: AppVariables;
}

export type AppOpenAPI<S extends Schema = Record<string, never>> = OpenAPIHono<AppBindings, S>;

export type AppRouteHandler<R extends RouteConfig> = RouteHandler<R, AppBindings>;

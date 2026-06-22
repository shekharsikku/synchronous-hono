import { type Hook, OpenAPIHono } from "@hono/zod-openapi";
import { HttpResponse, HttpStatusCodes } from "#/utilities/http/index.js";
import type { AppBindings } from "./types.js";

const defaultHook: Hook<any, any, any, any> = (result, ctx) => {
  if (!result.success) {
    return HttpResponse.error(ctx, HttpStatusCodes.UNPROCESSABLE_ENTITY, "Validation error occurred!", result.error.issues);
  }
  return;
};

export const createRouter = () => {
  return new OpenAPIHono<AppBindings>({ defaultHook });
};

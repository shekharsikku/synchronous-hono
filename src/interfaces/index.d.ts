import type { AppVariables } from "#/openapi/index.ts";

declare module "hono" {
  interface ContextVariableMap extends AppVariables {}
}

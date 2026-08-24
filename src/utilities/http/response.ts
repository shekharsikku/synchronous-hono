/** biome-ignore-all lint/complexity/noStaticOnlyClass: <just need this> */
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

type ErrorResponse<E = unknown> = { success: false; message: string; error?: E };
type SuccessResponse<T = unknown> = { success: true; message: string; data?: T };

export class HttpResponse {
  static success = <C extends Context, S extends ContentfulStatusCode, T>(
    ctx: C,
    status: S,
    message: string,
    data?: T,
  ) => {
    const response: SuccessResponse<T> = { success: true, message };
    if (data !== undefined) response.data = data;
    return ctx.json<SuccessResponse<T>, S>(response, status);
  };

  static error = <C extends Context, S extends ContentfulStatusCode, E>(
    ctx: C,
    status: S,
    message: string,
    error?: E,
  ) => {
    const response: ErrorResponse<E> = { success: false, message };
    if (error !== undefined) response.error = error;
    return ctx.json<ErrorResponse<E>, S>(response, status);
  };
}

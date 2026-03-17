import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export class HttpError extends Error {
  public code: ContentfulStatusCode;

  constructor(code: ContentfulStatusCode, message: string, stack: string = "") {
    super(message);
    this.code = code;
    this.message = message;
    this.stack = stack;
  }
}

type TypeResponse<T = unknown, E = unknown> =
  | { success: true; message: string; data?: T }
  | { success: false; message: string; error?: E };

export const ErrorResponse = <E>(ctx: Context, code: ContentfulStatusCode, message: string, error?: E) => {
  const response: TypeResponse<never, E> = { success: false, message };
  if (error !== undefined) response.error = error;
  return ctx.json<TypeResponse<never, E>>(response, code);
};

export const SuccessResponse = <T>(ctx: Context, code: ContentfulStatusCode, message: string, data?: T) => {
  const response: TypeResponse<T, never> = { success: true, message };
  if (data !== undefined) response.data = data;
  return ctx.json<TypeResponse<T, never>>(response, code);
};

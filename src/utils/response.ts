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

type TypeResponse<T = any, E = any> = {
  code?: ContentfulStatusCode;
  success: boolean;
  message: string;
  data?: T;
  error?: E;
};

export const ErrorResponse = <E = any>(ctx: Context, code: ContentfulStatusCode, message: string, error?: E) => {
  const response: TypeResponse<undefined, E> = { success: false, message };
  if (error !== undefined) response.error = error;
  return ctx.json<TypeResponse<undefined, E>>(response, code);
};

export const SuccessResponse = <T = any>(ctx: Context, code: ContentfulStatusCode, message: string, data?: T) => {
  const response: TypeResponse<T, undefined> = { success: true, message };
  if (data !== undefined) response.data = data;
  return ctx.json<TypeResponse<T, undefined>>(response, code);
};

import type { Context } from "hono";
import type {
  ClientErrorStatusCode,
  ContentlessStatusCode,
  ServerErrorStatusCode,
  SuccessStatusCode,
} from "hono/utils/http-status";

type SuccessCodes = Exclude<SuccessStatusCode, ContentlessStatusCode>;
type ErrorStatusCodes = Exclude<ClientErrorStatusCode | ServerErrorStatusCode, ContentlessStatusCode>;

export class HttpError extends Error {
  public readonly code: ErrorStatusCodes;

  constructor(code: ErrorStatusCodes, message: string) {
    super(message);
    this.code = code;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class HttpResponse<T = any, E = any> {
  private code: SuccessCodes | ErrorStatusCodes;
  private success: boolean;
  private message: string;
  public data?: T | undefined;
  public error?: E | undefined;

  constructor(code: SuccessCodes | ErrorStatusCodes, message: string);
  constructor(code: SuccessCodes, message: string, options?: { data?: T });
  constructor(code: ErrorStatusCodes, message: string, options?: { error?: E });

  constructor(code: SuccessCodes | ErrorStatusCodes, message: string, options?: { data?: T; error?: E }) {
    this.code = code;
    this.success = code < 400;
    this.message = message;

    if (this.success) {
      if (options?.error !== undefined) {
        throw new Error("Cannot set error for success response!");
      }
      this.data = options?.data;
    } else {
      if (options?.data !== undefined) {
        throw new Error("Cannot set data for error response!");
      }
      this.error = options?.error;
    }
  }

  private toJSON() {
    return {
      success: this.success,
      message: this.message,
      data: this.data,
      error: this.error,
    };
  }

  send(ctx: Context) {
    return ctx.json(this.toJSON(), this.code);
  }
}

/*

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

*/

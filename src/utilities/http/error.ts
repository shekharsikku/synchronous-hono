import type {
  ClientErrorStatusCode,
  ContentlessStatusCode,
  ServerErrorStatusCode,
} from "hono/utils/http-status";

type ErrorStatusCodes = Exclude<
  ClientErrorStatusCode | ServerErrorStatusCode,
  ContentlessStatusCode
>;

export class HttpError extends Error {
  constructor(
    public readonly status: ErrorStatusCodes,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
    Error.captureStackTrace?.(this, new.target);
  }
}

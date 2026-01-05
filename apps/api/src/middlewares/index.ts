import { rateLimit } from "express-rate-limit";

import { HttpError } from "#/utils/response.js";

import type { NextFunction, Request, Response } from "express";

/** Rate Limiter */
export const limiter = (minute = 10, limit = 1000) => {
  return rateLimit({
    windowMs: minute * 60 * 1000,
    limit: limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req: Request, _res: Response) => {
      return req.clientIp!;
    },
    handler: (req: Request, _res: Response, _next: NextFunction) => {
      console.error(`Rate limit exceeded for ip: ${req.clientIp}`);
      throw new HttpError(429, "Maximum number of requests exceeded!");
    },
  });
};

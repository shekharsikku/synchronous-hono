import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import requestIp from "request-ip";

import env from "#/configs/env.js";
import routers from "#/routers/index.js";
import { limiter } from "#/middlewares/index.js";
import { HttpError, ErrorResponse, SuccessResponse } from "#/utils/response.js";

import type { NextFunction, Request, Response, ErrorRequestHandler } from "express";

const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Helmet - Security Headers */
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "res.cloudinary.com", "data:", "https://cdn.jsdelivr.net"],
        scriptSrc: [
          "'self'",
          "'unsafe-eval'",
          "https://cdn.jsdelivr.net",
          "https://unpkg.com",
          "static.cloudflareinsights.com",
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: ["'self'", "wss://0.peerjs.com", "https://0.peerjs.com"],
      },
    },
  })
);

/** CORS - Allow Origin */
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
  })
);

/** Body Parser - Json & Form Data */
app.use(
  express.json({
    limit: env.PAYLOAD_LIMIT,
    strict: true,
  })
);

app.use(
  express.urlencoded({
    limit: env.PAYLOAD_LIMIT,
    extended: true,
  })
);

/** Morgan Logging + Trust Proxy */
if (env.isDev) {
  app.use(morgan("dev"));
} else {
  app.set("trust proxy", 1);
  app.use(morgan("tiny"));
}

/** Request IP Address */
app.use(requestIp.mw());

/** Cookies Parser */
app.use(cookieParser(env.COOKIES_SECRET));

/** Body Compression */
app.use(compression());

/** Public Static Assets */
app.use("/public/temp", express.static(join(__dirname, "../public/temp")));

/** Rate Limiter & Api Routers */
app.use("/api", limiter(), routers);

app.get("*path", (_req: Request, res: Response) => {
  return SuccessResponse(res, 200, "Welcome to Turbo FullStack!");
});

/**  Global Error Handler */
app.use(((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);

  if (err instanceof HttpError) {
    return ErrorResponse(res, err.code || 500, err.message || "Unknown error occurred!");
  }

  let error = new HttpError(500, "Internal server error!");

  /* Mongoose Bad ObjectId */
  if (err.name === "CastError") {
    error = new HttpError(404, "Resource not found!");
  }

  /* Mongoose Duplicate Key */
  if (err.code === 11000) {
    error = new HttpError(400, "Duplicate field value entered!");
  }

  /* Mongoose Validation Error */
  if (err.name === "ValidationError" && err.errors) {
    const message = Object.values(err.errors).map((val: any) => val.message);
    error = new HttpError(400, message.join(", "));
  }

  console.error(`Error: ${err.message}`);
  return ErrorResponse(res, error.code, error.message);
}) as ErrorRequestHandler);

export default app;

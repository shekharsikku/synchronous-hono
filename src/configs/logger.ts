import pino from "pino";
import env from "./env.js";

const otherOptions = env.isDev
  ? { transport: { target: "pino-pretty", options: { colorize: true } } }
  : { base: null };

const logger = pino({
  level: env.LOG_LEVEL,
  serializers: {
    res(res) {
      const headers =
        res.headers instanceof Headers ? Object.fromEntries(res.headers.entries()) : res.headers;
      delete headers["set-cookie"];
      return { status: res.status, headers };
    },
  },
  redact: {
    paths: ["req.headers.cookie", "res.headers['set-cookie']"],
    remove: true,
  },
  msgPrefix: "[SYNCHRONOUS] ",
  ...otherOptions,
});

export default logger;

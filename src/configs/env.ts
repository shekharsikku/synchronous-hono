import { bool, cleanEnv, num, port, str, url } from "envalid";
import "dotenv/config";

const env = cleanEnv(process.env, {
  IMAGEKIT_PUBLIC_KEY: str(),
  IMAGEKIT_PRIVATE_KEY: str(),
  IMAGEKIT_URL_ENDPOINT: url(),

  ACCESS_SECRET: str(),
  ACCESS_EXPIRY: num(),
  REFRESH_SECRET: str(),
  REFRESH_EXPIRY: num(),
  SIGNED_SECRET: str(),
  SOCKET_PUBLIC: str(),
  MONGODB_URI: url(),

  STRICT_MODE: bool({ default: false }),
  BODY_LIMIT: num({ default: 1 }),
  CORS_ORIGIN: str({ default: "*" }),
  PORT: port({ default: 4000 }),
  NODE_ENV: str({
    choices: ["development", "production"],
    default: "development",
  }),
  LOG_LEVEL: str({
    choices: ["fatal", "error", "warn", "info", "debug", "trace", "silent"],
    default: "info",
  }),
});

export default env;

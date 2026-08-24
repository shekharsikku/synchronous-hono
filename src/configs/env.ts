import { cleanEnv, num, port, str, url } from "envalid";

const env = cleanEnv(process.env, {
  IMAGEKIT_PUBLIC_KEY: str(),
  IMAGEKIT_PRIVATE_KEY: str(),
  IMAGEKIT_URL_ENDPOINT: url(),
  VAPID_MAILTO: str(),
  VAPID_PUBLIC_KEY: str(),
  VAPID_PRIVATE_KEY: str(),

  ACCESS_SECRET: str(),
  ACCESS_EXPIRY: num(),
  REFRESH_SECRET: str(),
  REFRESH_EXPIRY: num(),
  SIGNED_SECRET: str(),
  SIGNED_SALT: str(),
  MONGODB_URI: url(),

  BODY_LIMIT: num(),
  CORS_ORIGIN: str(),
  PORT: port(),
  NODE_ENV: str({
    choices: ["development", "production"],
    default: "development",
  }),
  LOG_LEVEL: str({
    choices: ["fatal", "error", "warn", "info", "debug", "trace", "silent"],
    default: "trace",
  }),
});

export default env;

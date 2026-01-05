import { cleanEnv, str, port } from "envalid";
import "dotenv/config";

const env = cleanEnv(process.env, {
  CORS_ORIGIN: str(),
  COOKIES_SECRET: str(),
  PAYLOAD_LIMIT: str(),
  PORT: port(),
  NODE_ENV: str({ choices: ["development", "production"] }),
});

export default env;

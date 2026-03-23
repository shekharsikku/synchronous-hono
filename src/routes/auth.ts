import { Hono } from "hono";
import { authRefresh, signInUser, signOutUser, signUpUser } from "#/controllers/auth.js";
import { limiter, validate } from "#/middlewares/index.js";
import { signInSchema, signUpSchema } from "#/utils/schema.js";

const auth = new Hono()
  .post("/sign-up", limiter(10, 5), validate(signUpSchema), signUpUser)
  .post("/sign-in", limiter(10, 10), validate(signInSchema), signInUser)
  .all("/sign-out", signOutUser)
  .get("/auth-refresh", limiter(10, 10), authRefresh);

export default auth;

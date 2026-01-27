import { Hono } from "hono";
import { signInUser, signOutUser, signUpUser } from "#/controllers/auth.js";
import { authRefresh, limiter, validate } from "#/middlewares/index.js";
import { SignInSchema, SignUpSchema } from "#/utils/schema.js";

const auth = new Hono()
  .post("/sign-up", limiter(10, 5), validate(SignUpSchema), signUpUser)
  .post("/sign-in", limiter(10, 10), validate(SignInSchema), signInUser)
  .all("/sign-out", signOutUser)
  .get("/auth-refresh", limiter(10, 10), authRefresh);

export default auth;

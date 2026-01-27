import { Hono } from "hono";
import { signInUser, signOutUser, signUpUser } from "#/controllers/auth.js";
import { authRefresh, validate } from "#/middlewares/index.js";
import { SignInSchema, SignUpSchema } from "#/utils/schema.js";

const auth = new Hono()
  .post("/sign-up", validate(SignUpSchema), signUpUser)
  .post("/sign-in", validate(SignInSchema), signInUser)
  .all("/sign-out", signOutUser)
  .get("/auth-refresh", authRefresh);

export default auth;

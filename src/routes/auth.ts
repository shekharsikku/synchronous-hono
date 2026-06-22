import { createRoute } from "@hono/zod-openapi";
import { authRefresh, signInUser, signOutUser, signUpUser } from "#/controllers/auth.js";
import { limiter } from "#/middlewares/index.js";
import {
  createRouter,
  errorSchema,
  jsonContent,
  jsonRequired,
  successSchema,
  Tags,
} from "#/openapi/index.js";
import { HttpPhrases, HttpStatus } from "#/utilities/http/index.js";
import { signInSchema, signUpSchema } from "#/utilities/schema.js";

const signUpRoute = createRoute({
  tags: Tags.Auth,
  method: "post",
  path: "/sign-up",
  request: {
    body: jsonRequired(signUpSchema, "Sign up payload!"),
  },
  responses: {
    [HttpStatus.CONFLICT]: jsonContent(
      errorSchema({ message: "Email already exists!" }),
      HttpPhrases.CONFLICT,
    ),
    [HttpStatus.CREATED]: jsonContent(
      successSchema({ message: "Signed up successfully!" }),
      HttpPhrases.CREATED,
    ),
  },
});

const signInRoute = createRoute({
  tags: Tags.Auth,
  method: "post",
  path: "/sign-in",
  request: {
    body: jsonRequired(signInSchema, "Sign in payload!"),
  },
  responses: {
    [HttpStatus.BAD_REQUEST]: jsonContent(
      errorSchema({ message: "Required email or username!" }),
      HttpPhrases.BAD_REQUEST,
    ),
    [HttpStatus.UNAUTHORIZED]: jsonContent(
      errorSchema({ message: "Invalid credentials!" }),
      HttpPhrases.UNAUTHORIZED,
    ),
    [HttpStatus.OK]: jsonContent(
      successSchema({ message: "Signed in successfully!" }),
      HttpPhrases.OK,
    ),
  },
});

const signOutRoute = createRoute({
  tags: Tags.Auth,
  method: "delete",
  path: "/sign-out",
  responses: {
    [HttpStatus.OK]: jsonContent(
      successSchema({ message: "Signed out successfully!" }),
      HttpPhrases.OK,
    ),
  },
});

const refreshRoute = createRoute({
  tags: Tags.Auth,
  method: "get",
  path: "/auth-refresh",
  responses: {
    [HttpStatus.UNAUTHORIZED]: jsonContent(
      errorSchema({ message: "Unauthorized request!" }),
      HttpPhrases.UNAUTHORIZED,
    ),
    [HttpStatus.OK]: jsonContent(
      successSchema({ message: "Refreshed successfully!" }),
      HttpPhrases.OK,
    ),
  },
});

const authRouter = createRouter();

authRouter.use("/sign-up", limiter(10, 10));
authRouter.use("/sign-in", limiter(10, 10));
authRouter.use("/sign-out", limiter(10, 20));
authRouter.use("/auth-refresh", limiter(10, 20));

authRouter.openapi(signUpRoute, signUpUser);
authRouter.openapi(signInRoute, signInUser);
authRouter.openapi(signOutRoute, signOutUser);
authRouter.openapi(refreshRoute, authRefresh);

export type SignUpRoute = typeof signUpRoute;
export type SignInRoute = typeof signInRoute;
export type SignOutRoute = typeof signOutRoute;
export type RefreshRoute = typeof refreshRoute;

export default authRouter;

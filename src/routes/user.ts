import { createRoute } from "@hono/zod-openapi";
import limiter from "#/configs/limiter.js";
import {
  changePassword,
  deleteImage,
  profileSetup,
  updateImage,
  userInformation,
} from "#/controllers/user.js";
import { authAccess } from "#/middlewares/index.js";
import {
  createRouter,
  errorSchema,
  jsonContent,
  jsonRequired,
  multipartRequired,
  successSchema,
  Tags,
} from "#/openapi/index.js";
import { HttpPhrases, HttpStatus } from "#/utilities/http/index.js";
import { passwordSchema, profileSchema } from "#/utilities/schema.js";

const profileSetupRoute = createRoute({
  tags: Tags.User,
  method: "patch",
  path: "/profile-setup",
  request: {
    body: jsonRequired(profileSchema, "Profile payload!"),
  },
  responses: {
    [HttpStatus.UNAUTHORIZED]: jsonContent(
      errorSchema({ message: "Unauthorized request!" }),
      HttpPhrases.UNAUTHORIZED,
    ),
    [HttpStatus.CONFLICT]: jsonContent(
      errorSchema({ message: "Username already exists!" }),
      HttpPhrases.CONFLICT,
    ),
    [HttpStatus.OK]: jsonContent(
      successSchema({ message: "Profile updated successfully!" }),
      HttpPhrases.OK,
    ),
  },
});

const updateImageRoute = createRoute({
  tags: Tags.User,
  method: "patch",
  path: "/profile-image",
  request: {
    body: multipartRequired("profile-image", "Image file for upload!"),
  },
  responses: {
    [HttpStatus.BAD_REQUEST]: jsonContent(
      errorSchema({ message: "Invalid image file upload!" }),
      HttpPhrases.BAD_REQUEST,
    ),
    [HttpStatus.UNAUTHORIZED]: jsonContent(
      errorSchema({ message: "Unauthorized request!" }),
      HttpPhrases.UNAUTHORIZED,
    ),
    [HttpStatus.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema({ message: "Error while uploading image!" }),
      HttpPhrases.INTERNAL_SERVER_ERROR,
    ),
    [HttpStatus.OK]: jsonContent(
      successSchema({ message: "Image updated successfully!" }),
      HttpPhrases.OK,
    ),
  },
});

const deleteImageRoute = createRoute({
  tags: Tags.User,
  method: "delete",
  path: "/profile-image",
  responses: {
    [HttpStatus.UNAUTHORIZED]: jsonContent(
      errorSchema({ message: "Unauthorized request!" }),
      HttpPhrases.UNAUTHORIZED,
    ),
    [HttpStatus.NOT_FOUND]: jsonContent(
      errorSchema({ message: "Image not available!" }),
      HttpPhrases.NOT_FOUND,
    ),
    [HttpStatus.OK]: jsonContent(
      successSchema({ message: "Image deleted successfully!" }),
      HttpPhrases.OK,
    ),
  },
});

const changePasswordRoute = createRoute({
  tags: Tags.User,
  method: "patch",
  path: "/change-password",
  request: {
    body: jsonRequired(passwordSchema, "Password payload!"),
  },
  responses: {
    [HttpStatus.BAD_REQUEST]: jsonContent(
      errorSchema({ message: "New password must be different!" }),
      HttpPhrases.BAD_REQUEST,
    ),
    [HttpStatus.UNAUTHORIZED]: jsonContent(
      errorSchema({ message: "Unauthorized request!" }),
      HttpPhrases.UNAUTHORIZED,
    ),
    [HttpStatus.FORBIDDEN]: jsonContent(
      errorSchema({ message: "Incorrect old password!" }),
      HttpPhrases.FORBIDDEN,
    ),
    [HttpStatus.OK]: jsonContent(
      successSchema({ message: "Password changed successfully!" }),
      HttpPhrases.OK,
    ),
  },
});

const userInformationRoute = createRoute({
  tags: Tags.User,
  method: "get",
  path: "/user-information",
  responses: {
    [HttpStatus.UNAUTHORIZED]: jsonContent(
      errorSchema({ message: "Unauthorized request!" }),
      HttpPhrases.UNAUTHORIZED,
    ),
    [HttpStatus.OK]: jsonContent(successSchema({ message: "User information!" }), HttpPhrases.OK),
  },
});

const userRouter = createRouter();

userRouter.use(limiter(10, 100), authAccess);

userRouter.openapi(profileSetupRoute, profileSetup);
userRouter.openapi(updateImageRoute, updateImage);
userRouter.openapi(deleteImageRoute, deleteImage);
userRouter.openapi(changePasswordRoute, changePassword);
userRouter.openapi(userInformationRoute, userInformation);

export type ProfileSetupRoute = typeof profileSetupRoute;
export type UpdateImageRoute = typeof updateImageRoute;
export type DeleteImageRoute = typeof deleteImageRoute;
export type PasswordChangeRoute = typeof changePasswordRoute;
export type UserInformationRoute = typeof userInformationRoute;

export default userRouter;

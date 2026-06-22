import { createRoute } from "@hono/zod-openapi";
import { changePassword, deleteImage, profileSetup, updateImage, userInformation } from "#/controllers/user.js";
import { authAccess, limiter } from "#/middlewares/index.js";
import { createRouter, errorSchema, jsonContent, jsonRequired, multipartRequired, successSchema, Tags } from "#/openapi/index.js";
import { HttpStatusCodes, HttpStatusPhrases } from "#/utilities/http/index.js";
import { passwordSchema, profileSchema } from "#/utilities/schema.js";

const profileSetupRoute = createRoute({
  tags: Tags.User,
  method: "patch",
  path: "/profile-setup",
  request: {
    body: jsonRequired(profileSchema, "Profile payload!"),
  },
  responses: {
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(errorSchema({ message: "Unauthorized request!" }), HttpStatusPhrases.UNAUTHORIZED),
    [HttpStatusCodes.CONFLICT]: jsonContent(errorSchema({ message: "Username already exists!" }), HttpStatusPhrases.CONFLICT),
    [HttpStatusCodes.OK]: jsonContent(successSchema({ message: "Profile updated successfully!" }), HttpStatusPhrases.OK),
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
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema({ message: "Invalid image file upload!" }), HttpStatusPhrases.BAD_REQUEST),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(errorSchema({ message: "Unauthorized request!" }), HttpStatusPhrases.UNAUTHORIZED),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema({ message: "Error while uploading image!" }),
      HttpStatusPhrases.INTERNAL_SERVER_ERROR,
    ),
    [HttpStatusCodes.OK]: jsonContent(successSchema({ message: "Image updated successfully!" }), HttpStatusPhrases.OK),
  },
});

const deleteImageRoute = createRoute({
  tags: Tags.User,
  method: "delete",
  path: "/profile-image",
  responses: {
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(errorSchema({ message: "Unauthorized request!" }), HttpStatusPhrases.UNAUTHORIZED),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema({ message: "Image not available!" }), HttpStatusPhrases.NOT_FOUND),
    [HttpStatusCodes.OK]: jsonContent(successSchema({ message: "Image deleted successfully!" }), HttpStatusPhrases.OK),
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
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema({ message: "New password must be different!" }), HttpStatusPhrases.BAD_REQUEST),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(errorSchema({ message: "Unauthorized request!" }), HttpStatusPhrases.UNAUTHORIZED),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(errorSchema({ message: "Incorrect old password!" }), HttpStatusPhrases.FORBIDDEN),
    [HttpStatusCodes.OK]: jsonContent(successSchema({ message: "Password changed successfully!" }), HttpStatusPhrases.OK),
  },
});

const userInformationRoute = createRoute({
  tags: Tags.User,
  method: "get",
  path: "/user-information",
  responses: {
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(errorSchema({ message: "Unauthorized request!" }), HttpStatusPhrases.UNAUTHORIZED),
    [HttpStatusCodes.OK]: jsonContent(successSchema({ message: "User information!" }), HttpStatusPhrases.OK),
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

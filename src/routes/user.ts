import { Hono } from "hono";
import { changePassword, deleteImage, profileSetup, updateImage, userInformation } from "#/controllers/user.js";
import { authAccess, limiter, validate } from "#/middlewares/index.js";
import { passwordSchema, profileSchema } from "#/utils/schema.js";

const user = new Hono()
  .use(limiter(10, 50))
  .patch("/profile-setup", authAccess, validate(profileSchema), profileSetup)
  .patch("/change-password", authAccess, validate(passwordSchema), changePassword)
  .patch("/profile-image", authAccess, updateImage)
  .delete("/profile-image", authAccess, deleteImage)
  .get("/user-information", authAccess, userInformation);

export default user;

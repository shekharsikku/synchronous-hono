import { Hono } from "hono";
import { changePassword, deleteImage, profileSetup, updateImage, userInformation } from "#/controllers/user.js";
import { authAccess, limiter, validate } from "#/middlewares/index.js";
import { PasswordSchema, ProfileSchema } from "#/utils/schema.js";

const user = new Hono()
  .use(limiter(10, 50))
  .patch("/user-profile-setup", authAccess, validate(ProfileSchema), profileSetup)
  .patch("/change-password", authAccess, validate(PasswordSchema), changePassword)
  .patch("/update-profile-image", authAccess, updateImage)
  .delete("/delete-profile-image", authAccess, deleteImage)
  .get("/user-information", authAccess, userInformation);

export default user;

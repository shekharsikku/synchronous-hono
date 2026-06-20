import { Hono } from "hono";
import {
  createGroup,
  deleteAvatar,
  fetchGroups,
  updateAvatar,
  updateDetails,
  updateMembers,
} from "#/controllers/group.js";
import { authAccess, limiter, validate } from "#/middlewares/index.js";
import { createGroupSchema, updateDetailsSchema, updateMembersSchema } from "#/utilities/schema.js";

const group = new Hono()
  .post("/create", limiter(10, 5), validate(createGroupSchema), authAccess, createGroup)
  .patch("/update/:id/details", limiter(10, 10), validate(updateDetailsSchema), authAccess, updateDetails)
  .patch("/update/:id/members", limiter(10, 10), validate(updateMembersSchema), authAccess, updateMembers)
  .patch("/update/:id/avatar", limiter(10, 5), authAccess, updateAvatar)
  .delete("/delete/:id/avatar", limiter(10, 5), authAccess, deleteAvatar)
  .get("/fetch", limiter(10, 50), authAccess, fetchGroups);

export default group;

import { Hono } from "hono";
import { createGroup, fetchGroups, groupMessage, updateDetails, updateMembers } from "#/controllers/group.js";
import { authAccess, limiter, validate } from "#/middlewares/index.js";
import { CreateGroupSchema, MessageSchema, UpdateDetailsSchema, UpdateMembersSchema } from "#/utils/schema.js";

const group = new Hono()
  .post("/create", limiter(10, 5), validate(CreateGroupSchema), authAccess, createGroup)
  .patch("/update/:id/details", limiter(10, 10), validate(UpdateDetailsSchema), authAccess, updateDetails)
  .patch("/update/:id/members", limiter(10, 10), validate(UpdateMembersSchema), authAccess, updateMembers)
  .post("/message/send/:id", limiter(1, 100), validate(MessageSchema), authAccess, groupMessage)
  .get("/fetch", limiter(10, 50), authAccess, fetchGroups);

export default group;

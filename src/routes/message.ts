import { Hono } from "hono";
import {
  deleteMessage,
  deleteMessages,
  editMessage,
  fetchMessages,
  getMessages,
  reactMessage,
  sendMessage,
  translateMessage,
} from "#/controllers/message.js";
import { authAccess, limiter, validate } from "#/middlewares/index.js";
import { messageSchema, translateSchema } from "#/utils/schema.js";

const message = new Hono()
  .get("/:id", limiter(1, 20), authAccess, getMessages)
  .get("/fetch/:id", limiter(1, 60), authAccess, fetchMessages)
  .post("/send/:id", limiter(1, 100), authAccess, validate(messageSchema), sendMessage)
  .patch("/edit/:id", limiter(1, 20), authAccess, editMessage)
  .patch("/react/:id", limiter(1, 100), authAccess, reactMessage)
  .delete("/delete/:id", limiter(1, 20), authAccess, deleteMessage)
  .delete("/delete", limiter(10, 5), authAccess, deleteMessages)
  .post("/translate", limiter(1, 20), validate(translateSchema), translateMessage);

export default message;

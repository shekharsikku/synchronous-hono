import { Hono } from "hono";
import { availableContact, fetchContact, fetchContacts, searchContact } from "#/controllers/contact.js";
import { authAccess, limiter } from "#/middlewares/index.js";

const contact = new Hono()
  .use(limiter(10, 100))
  .get("/search", authAccess, searchContact)
  .get("/fetch", authAccess, fetchContacts)
  .get("/fetch/:id", authAccess, fetchContact)
  .get("/available", authAccess, availableContact);

export default contact;

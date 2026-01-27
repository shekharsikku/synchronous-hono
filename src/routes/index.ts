import { Hono } from "hono";
import { limiter } from "#/middlewares/index.js";
import authRoutes from "./auth.js";
import contactRoute from "./contact.js";
import groupRoutes from "./group.js";
import messageRoutes from "./message.js";
import userRoutes from "./user.js";

const routes = new Hono()
  .use(limiter())
  .route("/auth", authRoutes)
  .route("/user", userRoutes)
  .route("/contact", contactRoute)
  .route("/group", groupRoutes)
  .route("/message", messageRoutes);

export default routes;

import { createRoute, z } from "@hono/zod-openapi";
import limiter from "#/configs/limiter.js";
import {
  deleteMessage,
  deleteMessages,
  editMessage,
  fetchMessages,
  getMessages,
  reactMessage,
  sendMessage,
} from "#/controllers/message.js";
import { authAccess } from "#/middlewares/index.js";
import {
  createRouter,
  errorSchema,
  jsonContent,
  jsonRequired,
  pathParams,
  queryParams,
  successSchema,
  Tags,
} from "#/openapi/index.js";
import { HttpPhrases, HttpStatus } from "#/utilities/http/index.js";
import { messageSchema } from "#/utilities/schema.js";

const sendMessageRoute = createRoute({
  tags: Tags.Message,
  method: "post",
  path: "/send/{id}",
  request: {
    params: pathParams("id"),
    query: z.object({
      type: queryParams.required("type", z.enum(["contact", "group"]), "contact"),
    }),
    body: jsonRequired(messageSchema, "Message payload!"),
  },
  responses: {
    [HttpStatus.UNAUTHORIZED]: jsonContent(
      errorSchema({ message: "Unauthorized request!" }),
      HttpPhrases.UNAUTHORIZED,
    ),
    [HttpStatus.CREATED]: jsonContent(
      successSchema({ message: "Message sent successfully!", data: {} }),
      HttpPhrases.CREATED,
    ),
  },
});

const getMessageRoute = createRoute({
  tags: Tags.Message,
  method: "get",
  path: "/get/{id}",
  request: {
    params: pathParams("id"),
    query: z.object({
      group: queryParams.optional("group", z.coerce.boolean(), true),
    }),
  },
  responses: {
    [HttpStatus.UNAUTHORIZED]: jsonContent(
      errorSchema({ message: "Unauthorized request!" }),
      HttpPhrases.UNAUTHORIZED,
    ),
    [HttpStatus.OK]: jsonContent(
      successSchema({ message: "Message fetched successfully!", data: [] }),
      HttpPhrases.OK,
    ),
  },
});

const fetchMessageRoute = createRoute({
  tags: Tags.Message,
  method: "get",
  path: "/fetch/{id}",
  request: {
    params: pathParams("id"),
    query: z.object({
      before: queryParams.optional("before", z.string(), "2026-02-12T05:56:00.915+00:00"),
      group: queryParams.optional("group", z.coerce.boolean(), true),
      limit: queryParams.required("limit", z.coerce.number().int().min(1).default(10), 10),
    }),
  },
  responses: {
    [HttpStatus.UNAUTHORIZED]: jsonContent(
      errorSchema({ message: "Unauthorized request!" }),
      HttpPhrases.UNAUTHORIZED,
    ),
    [HttpStatus.OK]: jsonContent(
      successSchema({ message: "Message fetched successfully!", data: [] }),
      HttpPhrases.OK,
    ),
  },
});

const editMessageRoute = createRoute({
  tags: Tags.Message,
  method: "patch",
  path: "/edit/{id}",
  request: {
    params: pathParams("id"),
    body: jsonRequired(
      z.object({
        text: z.string().min(1),
      }),
      "Message edit payload!",
    ),
  },
  responses: {
    [HttpStatus.UNAUTHORIZED]: jsonContent(
      errorSchema({ message: "Unauthorized request!" }),
      HttpPhrases.UNAUTHORIZED,
    ),
    [HttpStatus.BAD_REQUEST]: jsonContent(
      errorSchema({ message: "You can't edit this message!" }),
      HttpPhrases.BAD_REQUEST,
    ),
    [HttpStatus.OK]: jsonContent(
      successSchema({ message: "Message edited successfully!" }),
      HttpPhrases.OK,
    ),
  },
});

const deleteMessageRoute = createRoute({
  tags: Tags.Message,
  method: "delete",
  path: "/delete/{id}",
  request: {
    params: pathParams("id"),
  },
  responses: {
    [HttpStatus.UNAUTHORIZED]: jsonContent(
      errorSchema({ message: "Unauthorized request!" }),
      HttpPhrases.UNAUTHORIZED,
    ),
    [HttpStatus.BAD_REQUEST]: jsonContent(
      errorSchema({ message: "You can't delete this message!" }),
      HttpPhrases.BAD_REQUEST,
    ),
    [HttpStatus.OK]: jsonContent(
      successSchema({ message: "Message deleted successfully!" }),
      HttpPhrases.OK,
    ),
  },
});

const reactMessageRoute = createRoute({
  tags: Tags.Message,
  method: "patch",
  path: "/react/{id}",
  request: {
    params: pathParams("id"),
    body: jsonRequired(
      z.object({
        emoji: z.string().min(1),
      }),
      "Message react payload!",
    ),
  },
  responses: {
    [HttpStatus.UNAUTHORIZED]: jsonContent(
      errorSchema({ message: "Unauthorized request!" }),
      HttpPhrases.UNAUTHORIZED,
    ),
    [HttpStatus.BAD_REQUEST]: jsonContent(
      errorSchema({ message: "Unable to react this message!" }),
      HttpPhrases.BAD_REQUEST,
    ),
    [HttpStatus.OK]: jsonContent(
      successSchema({ message: "Message reacted successfully!" }),
      HttpPhrases.OK,
    ),
  },
});

const deleteMessagesRoute = createRoute({
  tags: Tags.Message,
  method: "delete",
  path: "/delete",
  request: {
    query: z.object({
      before: queryParams.required("before", z.coerce.number().int().min(1).default(1), 1),
    }),
  },
  responses: {
    [HttpStatus.UNAUTHORIZED]: jsonContent(
      errorSchema({ message: "Unauthorized request!" }),
      HttpPhrases.UNAUTHORIZED,
    ),
    [HttpStatus.OK]: jsonContent(
      successSchema({ message: "Message reacted successfully!" }),
      HttpPhrases.OK,
    ),
  },
});

const messageRouter = createRouter();

messageRouter.use(limiter(10, 1000), authAccess);

messageRouter.openapi(sendMessageRoute, sendMessage);
messageRouter.openapi(getMessageRoute, getMessages);
messageRouter.openapi(fetchMessageRoute, fetchMessages);
messageRouter.openapi(editMessageRoute, editMessage);
messageRouter.openapi(deleteMessageRoute, deleteMessage);
messageRouter.openapi(reactMessageRoute, reactMessage);
messageRouter.openapi(deleteMessagesRoute, deleteMessages);

export type SendMessageRoute = typeof sendMessageRoute;
export type GetMessageRoute = typeof getMessageRoute;
export type FetchMessageRoute = typeof fetchMessageRoute;
export type EditMessageRoute = typeof editMessageRoute;
export type DeleteMessageRoute = typeof deleteMessageRoute;
export type ReactMessageRoute = typeof reactMessageRoute;
export type DeleteMessagesRoute = typeof deleteMessagesRoute;

export default messageRouter;

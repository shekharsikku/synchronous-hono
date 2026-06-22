import { createRoute, z } from "@hono/zod-openapi";
import { availableContact, fetchContact, fetchContacts, searchContact } from "#/controllers/contact.js";
import { authAccess, limiter } from "#/middlewares/index.js";
import { createRouter, errorSchema, jsonContent, pathParams, queryParams, successSchema, Tags } from "#/openapi/index.js";
import { HttpStatusCodes, HttpStatusPhrases } from "#/utilities/http/index.js";

const searchContactRoute = createRoute({
  tags: Tags.Contact,
  method: "get",
  path: "/search",
  request: {
    query: z.object({
      search: queryParams.required("search", z.string().min(1), "sikku"),
    }),
  },
  responses: {
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema({ message: "Search query can't empty!" }), HttpStatusPhrases.BAD_REQUEST),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(errorSchema({ message: "Unauthorized request!" }), HttpStatusPhrases.UNAUTHORIZED),
    [HttpStatusCodes.OK]: jsonContent(successSchema({ message: "Contacts searched successfully!", data: [] }), HttpStatusPhrases.OK),
  },
});

const availableContactRoute = createRoute({
  tags: Tags.Contact,
  method: "get",
  path: "/available",
  request: {},
  responses: {
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(errorSchema({ message: "Unauthorized request!" }), HttpStatusPhrases.UNAUTHORIZED),
    [HttpStatusCodes.OK]: jsonContent(successSchema({ message: "Contacts fetched successfully!", data: [] }), HttpStatusPhrases.OK),
  },
});

const fetchContactsRoute = createRoute({
  tags: Tags.Contact,
  method: "get",
  path: "/fetch",
  responses: {
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(errorSchema({ message: "Unauthorized request!" }), HttpStatusPhrases.UNAUTHORIZED),
    [HttpStatusCodes.OK]: jsonContent(successSchema({ message: "Contacts fetched successfully!", data: [] }), HttpStatusPhrases.OK),
  },
});

const fetchContactRoute = createRoute({
  tags: Tags.Contact,
  method: "get",
  path: "/fetch/{id}",
  request: {
    params: pathParams("id"),
  },
  responses: {
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(errorSchema({ message: "Unauthorized request!" }), HttpStatusPhrases.UNAUTHORIZED),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema({ message: "Contact not found!" }), HttpStatusPhrases.NOT_FOUND),
    [HttpStatusCodes.OK]: jsonContent(successSchema({ message: "Contact fetched successfully!", data: {} }), HttpStatusPhrases.OK),
  },
});

const contactRouter = createRouter();

contactRouter.use(limiter(10, 100), authAccess);

contactRouter.openapi(searchContactRoute, searchContact);
contactRouter.openapi(availableContactRoute, availableContact);
contactRouter.openapi(fetchContactsRoute, fetchContacts);
contactRouter.openapi(fetchContactRoute, fetchContact);

export type SearchContactRoute = typeof searchContactRoute;
export type AvailableContactRoute = typeof availableContactRoute;
export type FetchContactsRoute = typeof fetchContactsRoute;
export type FetchContactRoute = typeof fetchContactRoute;

export default contactRouter;

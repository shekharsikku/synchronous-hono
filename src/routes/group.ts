import { createRoute } from "@hono/zod-openapi";
import { createGroup, deleteAvatar, fetchGroups, updateAvatar, updateDetails, updateMembers } from "#/controllers/group.js";
import { authAccess, limiter } from "#/middlewares/index.js";
import {
  createRouter,
  errorSchema,
  jsonContent,
  jsonRequired,
  multipartRequired,
  pathParams,
  successSchema,
  Tags,
} from "#/openapi/index.js";
import { HttpStatusCodes, HttpStatusPhrases } from "#/utilities/http/index.js";
import { createGroupSchema, updateDetailsSchema, updateMembersSchema } from "#/utilities/schema.js";

const createGroupRoute = createRoute({
  tags: Tags.Group,
  method: "post",
  path: "/create",
  request: {
    body: jsonRequired(createGroupSchema, "Group create payload!"),
  },
  responses: {
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(errorSchema({ message: "Unauthorized request!" }), HttpStatusPhrases.UNAUTHORIZED),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(errorSchema({ message: "Invalid group admin assignment!" }), HttpStatusPhrases.FORBIDDEN),
    [HttpStatusCodes.CONFLICT]: jsonContent(errorSchema({ message: "Group name already exists!" }), HttpStatusPhrases.CONFLICT),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema({ message: "Some members don't exists!" }), HttpStatusPhrases.BAD_REQUEST),
    [HttpStatusCodes.CREATED]: jsonContent(successSchema({ message: "Group created successfully!" }), HttpStatusPhrases.CREATED),
  },
});

const updateDetailsRoute = createRoute({
  tags: Tags.Group,
  method: "patch",
  path: "/update/{id}/details",
  request: {
    params: pathParams("id"),
    body: jsonRequired(updateDetailsSchema, "Group details payload!"),
  },
  responses: {
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(errorSchema({ message: "Unauthorized request!" }), HttpStatusPhrases.UNAUTHORIZED),
    [HttpStatusCodes.CONFLICT]: jsonContent(errorSchema({ message: "Group name already exists!" }), HttpStatusPhrases.CONFLICT),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema({ message: "Group not found!" }), HttpStatusPhrases.NOT_FOUND),
    [HttpStatusCodes.OK]: jsonContent(successSchema({ message: "Group details updated successfully!" }), HttpStatusPhrases.OK),
  },
});

const updateMembersRoute = createRoute({
  tags: Tags.Group,
  method: "patch",
  path: "/update/{id}/members",
  request: {
    params: pathParams("id"),
    body: jsonRequired(updateMembersSchema, "Group members payload!"),
  },
  responses: {
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema({ message: "Provide at least one member!" }), HttpStatusPhrases.BAD_REQUEST),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(errorSchema({ message: "Unauthorized request!" }), HttpStatusPhrases.UNAUTHORIZED),
    [HttpStatusCodes.FORBIDDEN]: jsonContent(errorSchema({ message: "Admin can't be removed!" }), HttpStatusPhrases.FORBIDDEN),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema({ message: "Group not found!" }), HttpStatusPhrases.NOT_FOUND),
    [HttpStatusCodes.OK]: jsonContent(successSchema({ message: "Group members updated successfully!" }), HttpStatusPhrases.OK),
  },
});

const updateAvatarRoute = createRoute({
  tags: Tags.Group,
  method: "patch",
  path: "/update/{id}/avatar",
  request: {
    params: pathParams("id"),
    body: multipartRequired("group-avatar", "Avatar file for upload!"),
  },
  responses: {
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema({ message: "Invalid avatar file upload!" }), HttpStatusPhrases.BAD_REQUEST),
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(errorSchema({ message: "Unauthorized request!" }), HttpStatusPhrases.UNAUTHORIZED),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema({ message: "Group not found!" }), HttpStatusPhrases.NOT_FOUND),
    [HttpStatusCodes.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema({ message: "Error while uploading avatar!" }),
      HttpStatusPhrases.INTERNAL_SERVER_ERROR,
    ),
    [HttpStatusCodes.OK]: jsonContent(successSchema({ message: "Group avatar updated successfully!" }), HttpStatusPhrases.OK),
  },
});

const deleteAvatarRoute = createRoute({
  tags: Tags.Group,
  method: "delete",
  path: "/delete/{id}/avatar",
  request: {
    params: pathParams("id"),
  },
  responses: {
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(errorSchema({ message: "Unauthorized request!" }), HttpStatusPhrases.UNAUTHORIZED),
    [HttpStatusCodes.NOT_FOUND]: jsonContent(errorSchema({ message: "Group not found!" }), HttpStatusPhrases.NOT_FOUND),
    [HttpStatusCodes.BAD_REQUEST]: jsonContent(errorSchema({ message: "Group avatar not available!" }), HttpStatusPhrases.BAD_REQUEST),
    [HttpStatusCodes.OK]: jsonContent(successSchema({ message: "Group avatar deleted successfully!" }), HttpStatusPhrases.OK),
  },
});

const fetchGroupRoute = createRoute({
  tags: Tags.Group,
  method: "get",
  path: "/fetch",
  responses: {
    [HttpStatusCodes.UNAUTHORIZED]: jsonContent(errorSchema({ message: "Unauthorized request!" }), HttpStatusPhrases.UNAUTHORIZED),
    [HttpStatusCodes.OK]: jsonContent(successSchema({ message: "Group fetched successfully!", data: [] }), HttpStatusPhrases.OK),
  },
});

const groupRouter = createRouter();

groupRouter.use(limiter(10, 100), authAccess);

groupRouter.openapi(createGroupRoute, createGroup);
groupRouter.openapi(updateDetailsRoute, updateDetails);
groupRouter.openapi(updateMembersRoute, updateMembers);
groupRouter.openapi(updateAvatarRoute, updateAvatar);
groupRouter.openapi(deleteAvatarRoute, deleteAvatar);
groupRouter.openapi(fetchGroupRoute, fetchGroups);

export type CreateGroupRoute = typeof createGroupRoute;
export type UpdateDetailsRoute = typeof updateDetailsRoute;
export type UpdateMembersRoute = typeof updateMembersRoute;
export type UpdateAvatarRoute = typeof updateAvatarRoute;
export type DeleteAvatarRoute = typeof deleteAvatarRoute;
export type FetchGroupRoute = typeof fetchGroupRoute;

export default groupRouter;

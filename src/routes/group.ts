import { createRoute } from "@hono/zod-openapi";
import limiter from "#/configs/limiter.js";
import {
  createGroup,
  deleteAvatar,
  fetchGroups,
  updateAvatar,
  updateDetails,
  updateMembers,
} from "#/controllers/group.js";
import { authAccess } from "#/middlewares/index.js";
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
import { HttpPhrases, HttpStatus } from "#/utilities/http/index.js";
import { createGroupSchema, updateDetailsSchema, updateMembersSchema } from "#/utilities/schema.js";

const createGroupRoute = createRoute({
  tags: Tags.Group,
  method: "post",
  path: "/create",
  request: {
    body: jsonRequired(createGroupSchema, "Group create payload!"),
  },
  responses: {
    [HttpStatus.UNAUTHORIZED]: jsonContent(
      errorSchema({ message: "Unauthorized request!" }),
      HttpPhrases.UNAUTHORIZED,
    ),
    [HttpStatus.FORBIDDEN]: jsonContent(
      errorSchema({ message: "Invalid group admin assignment!" }),
      HttpPhrases.FORBIDDEN,
    ),
    [HttpStatus.CONFLICT]: jsonContent(
      errorSchema({ message: "Group name already exists!" }),
      HttpPhrases.CONFLICT,
    ),
    [HttpStatus.BAD_REQUEST]: jsonContent(
      errorSchema({ message: "Some members don't exists!" }),
      HttpPhrases.BAD_REQUEST,
    ),
    [HttpStatus.CREATED]: jsonContent(
      successSchema({ message: "Group created successfully!" }),
      HttpPhrases.CREATED,
    ),
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
    [HttpStatus.UNAUTHORIZED]: jsonContent(
      errorSchema({ message: "Unauthorized request!" }),
      HttpPhrases.UNAUTHORIZED,
    ),
    [HttpStatus.CONFLICT]: jsonContent(
      errorSchema({ message: "Group name already exists!" }),
      HttpPhrases.CONFLICT,
    ),
    [HttpStatus.NOT_FOUND]: jsonContent(
      errorSchema({ message: "Group not found!" }),
      HttpPhrases.NOT_FOUND,
    ),
    [HttpStatus.OK]: jsonContent(
      successSchema({ message: "Group details updated successfully!" }),
      HttpPhrases.OK,
    ),
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
    [HttpStatus.BAD_REQUEST]: jsonContent(
      errorSchema({ message: "Provide at least one member!" }),
      HttpPhrases.BAD_REQUEST,
    ),
    [HttpStatus.UNAUTHORIZED]: jsonContent(
      errorSchema({ message: "Unauthorized request!" }),
      HttpPhrases.UNAUTHORIZED,
    ),
    [HttpStatus.FORBIDDEN]: jsonContent(
      errorSchema({ message: "Admin can't be removed!" }),
      HttpPhrases.FORBIDDEN,
    ),
    [HttpStatus.NOT_FOUND]: jsonContent(
      errorSchema({ message: "Group not found!" }),
      HttpPhrases.NOT_FOUND,
    ),
    [HttpStatus.OK]: jsonContent(
      successSchema({ message: "Group members updated successfully!" }),
      HttpPhrases.OK,
    ),
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
    [HttpStatus.BAD_REQUEST]: jsonContent(
      errorSchema({ message: "Invalid avatar file upload!" }),
      HttpPhrases.BAD_REQUEST,
    ),
    [HttpStatus.UNAUTHORIZED]: jsonContent(
      errorSchema({ message: "Unauthorized request!" }),
      HttpPhrases.UNAUTHORIZED,
    ),
    [HttpStatus.NOT_FOUND]: jsonContent(
      errorSchema({ message: "Group not found!" }),
      HttpPhrases.NOT_FOUND,
    ),
    [HttpStatus.INTERNAL_SERVER_ERROR]: jsonContent(
      errorSchema({ message: "Error while uploading avatar!" }),
      HttpPhrases.INTERNAL_SERVER_ERROR,
    ),
    [HttpStatus.OK]: jsonContent(
      successSchema({ message: "Group avatar updated successfully!" }),
      HttpPhrases.OK,
    ),
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
    [HttpStatus.UNAUTHORIZED]: jsonContent(
      errorSchema({ message: "Unauthorized request!" }),
      HttpPhrases.UNAUTHORIZED,
    ),
    [HttpStatus.NOT_FOUND]: jsonContent(
      errorSchema({ message: "Group not found!" }),
      HttpPhrases.NOT_FOUND,
    ),
    [HttpStatus.BAD_REQUEST]: jsonContent(
      errorSchema({ message: "Group avatar not available!" }),
      HttpPhrases.BAD_REQUEST,
    ),
    [HttpStatus.OK]: jsonContent(
      successSchema({ message: "Group avatar deleted successfully!" }),
      HttpPhrases.OK,
    ),
  },
});

const fetchGroupRoute = createRoute({
  tags: Tags.Group,
  method: "get",
  path: "/fetch",
  responses: {
    [HttpStatus.UNAUTHORIZED]: jsonContent(
      errorSchema({ message: "Unauthorized request!" }),
      HttpPhrases.UNAUTHORIZED,
    ),
    [HttpStatus.OK]: jsonContent(
      successSchema({ message: "Group fetched successfully!", data: [] }),
      HttpPhrases.OK,
    ),
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

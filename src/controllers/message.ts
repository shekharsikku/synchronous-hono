import { translate } from "bing-translate-api";
import { Types } from "mongoose";
import type { ConversationDocument, MessageContent, MessageDocument, MessageType } from "#/models/index.js";
import { Conversation, Message } from "#/models/index.js";
import type { AppRouteHandler } from "#/openapi/types.js";
import type {
  DeleteMessageRoute,
  DeleteMessagesRoute,
  EditMessageRoute,
  FetchMessageRoute,
  GetMessageRoute,
  ReactMessageRoute,
  SendMessageRoute,
  TranslateMessageRoute,
} from "#/routes/message.js";
import { emitEvent, getSockets } from "#/server.js";
import { HttpResponse, HttpStatusCodes } from "#/utilities/http/index.js";
import { sendPushNotification } from "#/utilities/push.js";
import { fetchMembers } from "./group.js";

const buildContent = ({ type, text, file }: MessageContent) => {
  if (type === "text" && text) return { type, text };
  if (type === "file" && file) return { type, file };
  return { type };
};

const emitMessage = (sockets: string[], message: MessageDocument, targetId: string, targetType: "contact" | "group", interaction: Date) => {
  emitEvent(sockets, "message:receive", message);
  emitEvent(sockets, "conversation:updated", {
    _id: targetId,
    type: targetType,
    interaction,
  });
};

const resolveMembers = async (conversation: ConversationDocument | null, groupId: Types.ObjectId): Promise<string[]> => {
  if (conversation) {
    const populated = await conversation.populate("participants");
    const members = (populated.participants?.[0] as { members?: Types.ObjectId[] })?.members ?? [];
    if (members.length) return members.map((id) => id.toString());
  }
  return fetchMembers(groupId);
};

export const sendMessage: AppRouteHandler<SendMessageRoute> = async (ctx) => {
  const senderId = ctx.req.user?._id!;
  const receiverId = new Types.ObjectId(ctx.req.valid("param").id);
  const isGroup = ctx.req.valid("query").type === "group";
  const { type, text, file, reply } = ctx.req.valid("json");
  const interaction = new Date();

  let [message, conversation] = await Promise.all([
    Message.create({
      sender: senderId,
      ...(isGroup ? { group: receiverId } : { recipient: receiverId }),
      content: buildContent({ type, text, file }),
      ...(reply && { reply: new Types.ObjectId(reply) }),
    }),
    Conversation.findOneAndUpdate(
      {
        participants: isGroup ? { $size: 1, $all: [receiverId] } : { $all: [senderId, receiverId] },
        models: isGroup ? "Group" : "User",
      },
      { interaction: interaction },
      { returnDocument: "after" },
    ),
  ]);

  if (!conversation) {
    conversation = await Conversation.create({
      participants: isGroup ? [receiverId] : [senderId, receiverId],
      models: isGroup ? "Group" : "User",
      interaction: interaction,
    });
  }

  if (isGroup) {
    const groupMembers = await resolveMembers(conversation, receiverId);
    const membersSockets = groupMembers.flatMap(getSockets).filter(Boolean);
    emitMessage(membersSockets, message, receiverId.toString(), "group", interaction);
  } else {
    const messageSender = message.sender.toString();
    const messageRecipient = message.recipient!.toString();
    const senderSockets = getSockets(messageSender);
    const recipientSockets = getSockets(messageRecipient);

    if (senderSockets.length) {
      emitMessage(senderSockets, message, messageRecipient, "contact", interaction);
    }

    if (recipientSockets.length) {
      emitMessage(recipientSockets, message, messageSender, "contact", interaction);
    } else {
      sendPushNotification(receiverId, {
        title: ctx.req.user?.name ?? ctx.req.user?.username ?? "Someone",
        body: "Sent you a new message.",
        data: { sid: messageSender },
      }).catch(() => {});
    }
  }

  return HttpResponse.success(ctx, HttpStatusCodes.CREATED, "Message sent successfully!", message);
};

/** Transform null → undefined in response payload only */
const nullToUndefined = (obj: Record<string, any>) => {
  for (const key in obj) {
    if (obj[key] === null) obj[key] = undefined;
    else if (typeof obj[key] === "object" && obj[key] !== null) nullToUndefined(obj[key]);
  }
  return obj;
};

export const getMessages: AppRouteHandler<GetMessageRoute> = async (ctx) => {
  const sender = ctx.req.user?._id!;
  const target = ctx.req.valid("param").id;
  const isGroup = ctx.req.valid("query").group;

  const query = isGroup
    ? { group: target }
    : {
        $or: [
          { sender: sender, recipient: target },
          { sender: target, recipient: sender },
        ],
      };

  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(20)
    .lean({ transform: (doc) => nullToUndefined(doc) });

  return HttpResponse.success(ctx, HttpStatusCodes.OK, "Messages fetched successfully!", messages.reverse());
};

export const fetchMessages: AppRouteHandler<FetchMessageRoute> = async (ctx) => {
  const sender = ctx.req.user?._id!;
  const target = ctx.req.valid("param").id;
  const { before, group: isGroup, limit } = ctx.req.valid("query");

  const query: any = isGroup
    ? { group: target }
    : {
        $or: [
          { sender: sender, recipient: target },
          { sender: target, recipient: sender },
        ],
      };

  if (before) {
    query.createdAt = { $lt: new Date(before) };
  }

  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean({ transform: (doc) => nullToUndefined(doc) });

  /* Reverse to show oldest → newest in UI */
  return HttpResponse.success(ctx, HttpStatusCodes.OK, "Messages fetched successfully!", messages.reverse());
};

const messageActionsEvents = async (message: MessageType, event: string) => {
  if (message.group) {
    const members = await fetchMembers(message.group);
    const sockets = members.flatMap(getSockets).filter(Boolean);
    emitEvent(sockets, event, message);
  } else {
    const sockets = [message.sender, message.recipient!].flatMap((uid) => getSockets(uid.toString())).filter(Boolean);
    emitEvent(sockets, event, message);
  }
};

export const editMessage: AppRouteHandler<EditMessageRoute> = async (ctx) => {
  const uid = ctx.req.user?._id!;
  const mid = ctx.req.valid("param").id;
  const { text } = ctx.req.valid("json");

  if (!text.trim()) {
    return HttpResponse.error(ctx, HttpStatusCodes.BAD_REQUEST, "Text content is required!");
  }

  const message = await Message.findOneAndUpdate(
    { _id: mid, sender: uid, "content.type": "text" },
    {
      type: "edited",
      "content.text": text,
    },
    { returnDocument: "after" },
  ).lean({ transform: (doc) => nullToUndefined(doc) });

  if (!message) {
    return HttpResponse.error(ctx, HttpStatusCodes.BAD_REQUEST, "You can't edit this message!");
  }

  await messageActionsEvents(message, "message:edited");

  return HttpResponse.success(ctx, HttpStatusCodes.OK, "Message edited successfully!");
};

export const deleteMessage: AppRouteHandler<DeleteMessageRoute> = async (ctx) => {
  const uid = ctx.req.user?._id!;
  const mid = ctx.req.valid("param").id;

  const message = await Message.findOneAndUpdate(
    { _id: mid, sender: uid },
    {
      type: "deleted",
      deletedAt: new Date(),
      $unset: { content: 1 },
    },
    { returnDocument: "after" },
  ).lean({ transform: (doc) => nullToUndefined(doc) });

  if (!message) {
    return HttpResponse.error(ctx, HttpStatusCodes.BAD_REQUEST, "You can't delete this message!");
  }

  await messageActionsEvents(message, "message:remove");

  return HttpResponse.success(ctx, HttpStatusCodes.OK, "Message deleted successfully!");
};

export const reactMessage: AppRouteHandler<ReactMessageRoute> = async (ctx) => {
  const by = ctx.req.user?._id!;
  const mid = ctx.req.valid("param").id;
  const { emoji } = ctx.req.valid("json");

  if (!emoji.trim()) {
    return HttpResponse.error(ctx, HttpStatusCodes.BAD_REQUEST, "Emoji is required for reacting!");
  }

  const message = await Message.findOneAndUpdate(
    { _id: mid },
    [
      {
        $set: {
          // Step 1: your existing map/remove/add logic
          "content.reactions": {
            $let: {
              vars: {
                existing: {
                  $filter: {
                    input: { $ifNull: ["$content.reactions", []] },
                    as: "r",
                    cond: { $eq: ["$$r.by", by] },
                  },
                },
              },
              in: {
                $let: {
                  vars: {
                    updated: {
                      $cond: [
                        { $eq: [{ $size: "$$existing" }, 0] },
                        // { $concatArrays: ["$content.reactions", [{ by, emoji }]] }, // add new
                        {
                          $concatArrays: [{ $ifNull: ["$content.reactions", []] }, [{ by, emoji }]],
                        },
                        {
                          $map: {
                            // input: "$content.reactions",
                            input: { $ifNull: ["$content.reactions", []] },
                            as: "r",
                            in: {
                              $cond: [
                                {
                                  $and: [{ $eq: ["$$r.by", by] }, { $eq: ["$$r.emoji", emoji] }],
                                },
                                "$$REMOVE", // remove same emoji
                                {
                                  $cond: [{ $eq: ["$$r.by", by] }, { by, emoji }, "$$r"],
                                }, // update emoji
                              ],
                            },
                          },
                        },
                      ],
                    },
                  },
                  in: { $ifNull: ["$$updated", []] }, // ensure empty array if all reactions removed
                },
              },
            },
          },
        },
      },
      // Step 2: Filter out any nulls left in the array
      {
        $set: {
          "content.reactions": {
            $filter: {
              input: "$content.reactions",
              as: "r",
              cond: { $ne: ["$$r", null] }, // remove nulls
            },
          },
        },
      },
    ],
    { returnDocument: "after", updatePipeline: true },
  ).lean({ transform: (doc) => nullToUndefined(doc) });

  if (!message) {
    return HttpResponse.error(ctx, HttpStatusCodes.BAD_REQUEST, "Unable to react on this message!");
  }

  await messageActionsEvents(message, "message:reacted");

  return HttpResponse.success(ctx, HttpStatusCodes.OK, "Message reacted successfully!", message);
};

export const deleteMessages: AppRouteHandler<DeleteMessagesRoute> = async (ctx) => {
  const userId = ctx.req.user?._id!;
  const before = ctx.req.valid("query").before * 24;

  const hoursAgo = new Date();
  hoursAgo.setHours(hoursAgo.getHours() - before);

  const result = await Message.deleteMany({
    $or: [{ sender: userId }, { recipient: userId }],
    createdAt: { $lt: hoursAgo },
  });

  return HttpResponse.success(ctx, HttpStatusCodes.OK, "Older messages deleted!", result);
};

export const translateMessage: AppRouteHandler<TranslateMessageRoute> = async (ctx) => {
  const { message, language } = ctx.req.valid("json");

  if (!message || !language) {
    return HttpResponse.error(ctx, HttpStatusCodes.BAD_REQUEST, "Required message and language!");
  }

  const result = await translate(message, null, language);

  if (!result) {
    return HttpResponse.error(ctx, HttpStatusCodes.INTERNAL_SERVER_ERROR, "Error while translating message!");
  }

  return HttpResponse.success(ctx, HttpStatusCodes.OK, "Text translated successfully!", result.translation);
};

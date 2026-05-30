import { translate } from "bing-translate-api";
import type { Context } from "hono";
import { Types } from "mongoose";
import { Conversation, Message, type MessageType } from "#/models/index.js";
import { getSocketId, io } from "#/server.js";
import { HttpError, HttpResponse } from "#/utils/response.js";
import type { Message as MessageSchema, Translate } from "#/utils/schema.js";
import { fetchMembers } from "./group.js";

export const sendMessage = async (ctx: Context) => {
  const senderId = ctx.req.user?._id!;
  const receiverId = new Types.ObjectId(ctx.req.param("id"));
  const isGroup = ctx.req.query("type") === "group";
  const { type, text, file, reply } = ctx.get("validated") as MessageSchema;

  const content: {
    type: "text" | "file";
    text?: string;
    file?: string;
  } = { type };

  if (type === "text" && text) content.text = text;
  if (type === "file" && file) content.file = file;

  const interaction = new Date();

  let [message, conversation] = await Promise.all([
    Message.create({
      sender: senderId,
      ...(isGroup ? { group: receiverId } : { recipient: receiverId }),
      content: content,
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

  let members: string[] = [];

  if (!conversation) {
    conversation = await Conversation.create({
      participants: isGroup ? [receiverId] : [senderId, receiverId],
      models: isGroup ? "Group" : "User",
      interaction: interaction,
    });

    if (isGroup) {
      members = await fetchMembers(receiverId);
    }
  }

  if (isGroup) {
    if (!members.length && conversation) {
      const populated = await conversation.populate("participants");
      members = (populated.participants?.[0] as any)?.members ?? [];
    }

    if (!members.length) {
      members = await fetchMembers(receiverId);
    }

    const socketIds = members.flatMap((member) => getSocketId(member)).filter(Boolean);

    /** for update new message */
    io.to(socketIds).emit("message:receive", message);

    /** for update last chat contact */
    io.to(socketIds).emit("conversation:updated", {
      _id: receiverId,
      type: "group",
      interaction,
    });
  } else {
    const socketEventInfo = [
      {
        userId: message.sender.toString(),
        targetId: message.recipient?.toString()!,
      },
      {
        userId: message.recipient?.toString()!,
        targetId: message.sender.toString(),
      },
    ];

    for (const { userId, targetId } of socketEventInfo) {
      const userSocketIds = getSocketId(userId);

      if (userSocketIds.length > 0) {
        /** for update new message */
        io.to(userSocketIds).emit("message:receive", message);

        /** for update last chat contact */
        io.to(userSocketIds).emit("conversation:updated", {
          _id: targetId,
          type: "contact",
          interaction,
        });
      }
    }
  }
  return new HttpResponse(201, "Message sent successfully!").send(ctx);
};

/** Transform null → undefined in response payload only */
const nullToUndefined = (obj: Record<string, any>) => {
  for (const key in obj) {
    if (obj[key] === null) obj[key] = undefined;
    else if (typeof obj[key] === "object" && obj[key] !== null) nullToUndefined(obj[key]);
  }
  return obj;
};

export const getMessages = async (ctx: Context) => {
  const sender = ctx.req.user?._id!;
  const target = ctx.req.param("id")!;
  const isGroup = ctx.req.query("group") === "true" || false;

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
    .lean({ transform: (doc) => nullToUndefined(doc) });

  return new HttpResponse(200, "Messages fetched successfully!", { data: messages.reverse() }).send(ctx);
};

export const fetchMessages = async (ctx: Context) => {
  const sender = ctx.req.user?._id;
  const target = ctx.req.param("id");
  const { before, group, limit = 10 } = ctx.req.query();
  const isGroup = (group as string) === "true" || false;

  const query: any = isGroup
    ? { group: target }
    : {
        $or: [
          { sender: sender, recipient: target },
          { sender: target, recipient: sender },
        ],
      };

  if (before) {
    query.createdAt = { $lt: new Date(before as string) };
  }

  const messages = await Message.find(query)
    .sort({ createdAt: -1 })
    .limit(limit as number)
    .lean({ transform: (doc) => nullToUndefined(doc) });

  /* Reverse to show oldest → newest in UI */
  return new HttpResponse(200, "Messages fetched successfully!", { data: messages.reverse() }).send(ctx);
};

const messageActionsEvents = async (message: MessageType, event: string) => {
  if (message.group) {
    const members = await fetchMembers(message.group);
    const socketIds = members.flatMap((member) => getSocketId(member)).filter(Boolean);
    io.to(socketIds).emit(event, message);
  } else {
    const socketIds = [message.sender, message.recipient!]
      .flatMap((uid) => getSocketId(uid.toString()))
      .filter(Boolean);
    io.to(socketIds).emit(event, message);
  }
};

export const editMessage = async (ctx: Context) => {
  const userId = ctx.req.user?._id!;
  const msgId = ctx.req.param("id");
  const { text } = await ctx.req.json();

  if (!text) {
    throw new HttpError(400, "Text content is required for editing!");
  }

  const message = await Message.findOneAndUpdate(
    { _id: msgId!, sender: userId, "content.type": "text" },
    {
      type: "edited",
      "content.text": text,
    },
    { returnDocument: "after" },
  ).lean({ transform: (doc) => nullToUndefined(doc) });

  if (!message) {
    throw new HttpError(400, "You can't edit this message or message not found!");
  }

  await messageActionsEvents(message, "message:edited");

  return new HttpResponse(200, "Message edited successfully!").send(ctx);
};

export const deleteMessage = async (ctx: Context) => {
  const userId = ctx.req.user?._id!;
  const msgId = ctx.req.param("id");

  const message = await Message.findOneAndUpdate(
    { _id: msgId!, sender: userId },
    {
      type: "deleted",
      deletedAt: new Date(),
      $unset: { content: 1 },
    },
    { returnDocument: "after" },
  ).lean({ transform: (doc) => nullToUndefined(doc) });

  if (!message) {
    throw new HttpError(400, "You can't delete this message or message not found!");
  }

  await messageActionsEvents(message, "message:remove");

  return new HttpResponse(200, "Message deleted successfully!").send(ctx);
};

export const reactMessage = async (ctx: Context) => {
  const by = ctx.req.user?._id!;
  const msgId = ctx.req.param("id");
  const { emoji } = await ctx.req.json();

  if (!by || !emoji) {
    throw new HttpError(400, "Emoji is required for reacting!");
  }

  const message = await Message.findOneAndUpdate(
    { _id: msgId! },
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
    throw new HttpError(400, "Unable to react on this message or message not found!");
  }

  await messageActionsEvents(message, "message:reacted");

  return new HttpResponse(200, "Message reacted successfully!").send(ctx);
};

export const deleteMessages = async (ctx: Context) => {
  const userId = ctx.req.user?._id!;
  const before = Number(ctx.req.query("before") ?? 1) * 24;

  const hoursAgo = new Date();
  hoursAgo.setHours(hoursAgo.getHours() - before);

  const result = await Message.deleteMany({
    $or: [{ sender: userId }, { recipient: userId }],
    createdAt: { $lt: hoursAgo },
  });

  return new HttpResponse(200, "Older messages deleted!", { data: result }).send(ctx);
};

export const translateMessage = async (ctx: Context) => {
  const { message, language } = ctx.get("validated") as Translate;

  if (!message || !language) {
    throw new HttpError(400, "Text message and language is required!");
  }

  const result = await translate(message, null, language);

  if (!result) {
    throw new HttpError(500, "Error while translating message!");
  }

  return new HttpResponse(200, "Text translated successfully!", { data: result.translation }).send(ctx);
};

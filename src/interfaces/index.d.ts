import type { Document, Types } from "mongoose";

export interface UserInterface extends Document {
  name?: string;
  email: string;
  username?: string;
  password?: string;
  gender?: "Male" | "Female" | "Other";
  image?: string | null;
  bio?: string;
  setup: boolean;
  authentication?: {
    _id?: Types.ObjectId;
    token: string;
    expiry: Date;
  }[];
}

export interface ConversationInterface extends Document {
  participants: Types.ObjectId[];
  models: "User" | "Group";
  interaction: Date;
}

export interface MessageInterface extends Document {
  sender: Types.ObjectId;
  recipient?: Types.ObjectId;
  group?: Types.ObjectId;
  type: "default" | "edited" | "deleted";
  content: {
    type: "text" | "file";
    text?: string;
    file?: string;
    reactions?: {
      by: string;
      emoji: string;
    }[];
  };
  reply?: Types.ObjectId;
  deletedAt?: Date;
}

export interface GroupInterface extends Document {
  name: string;
  description: string;
  avatar?: string | null;
  admin: Types.ObjectId;
  members: Types.ObjectId[];
}

declare module "hono" {
  interface ContextVariableMap {
    user?: UserInterface;
  }

  interface HonoRequest {
    user?: UserInterface;
  }
}

declare module "jose" {
  interface JWTPayload {
    uid?: string;
  }
}

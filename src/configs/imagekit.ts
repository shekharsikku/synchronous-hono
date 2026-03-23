import ImageKit from "imagekit";
import { logger } from "#/middlewares/index.js";
import env from "./env.js";

const imagekit = new ImageKit({
  publicKey: env.IMAGEKIT_PUBLIC_KEY,
  privateKey: env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: env.IMAGEKIT_URL_ENDPOINT,
});

export const imagekitUpload = async (imageFile: File) => {
  try {
    const fileBuffer = await imageFile.arrayBuffer();
    const fileBase64 = Buffer.from(fileBuffer).toString("base64");

    const response = await imagekit.upload({
      file: fileBase64,
      fileName: imageFile.name,
      folder: "/uploads",
    });

    logger.info(response, "Image uploaded successfully!");
    return response;
  } catch (err) {
    logger.error({ err }, "Failed to upload image!");
    return null;
  }
};

export const imagekitDelete = async (imageId: string) => {
  try {
    const response = await imagekit.deleteFile(imageId);

    logger.info(response, "Image deleted successfully!");
    return response;
  } catch (err) {
    logger.error({ err }, "Failed to delete image!");
    return null;
  }
};

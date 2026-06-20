import ImageKit from "imagekit";
import { logger } from "#/middlewares/index.js";
import env from "./env.js";

const imagekit = new ImageKit({
  publicKey: env.IMAGEKIT_PUBLIC_KEY,
  privateKey: env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: env.IMAGEKIT_URL_ENDPOINT,
});

export const imagekitUpload = async (file: File, folder = "/uploads") => {
  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    const response = await imagekit.upload({
      file: buffer,
      fileName: file.name,
      folder: folder,
      useUniqueFileName: true,
    });

    logger.debug({ response }, "Image uploaded successfully!");
    return response;
  } catch (err) {
    logger.error({ err }, "Failed to upload image!");
    return null;
  }
};

export const imagekitDelete = async (fid: string) => {
  try {
    const response = await imagekit.deleteFile(fid);

    logger.debug({ response }, "Image deleted successfully!");
    return response;
  } catch (err) {
    logger.error({ err }, "Failed to delete image!");
    return null;
  }
};

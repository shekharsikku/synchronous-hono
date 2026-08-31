import ImageKit from "imagekit";
import { nanoid } from "nanoid";
import env from "./env.js";
import logger from "./logger.js";

const imagekit = new ImageKit({
  publicKey: env.IMAGEKIT_PUBLIC_KEY,
  privateKey: env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: env.IMAGEKIT_URL_ENDPOINT,
});

export const imagekitUpload = async (file: File, folder = "/uploads") => {
  try {
    const buffer = await new Bun.Image(file)
      .resize(256)
      .webp({ quality: 80, lossless: false })
      .toBuffer();

    const response = await imagekit.upload({
      file: buffer,
      fileName: `${nanoid()}.webp`,
      folder: folder,
      useUniqueFileName: false,
    });

    logger.debug({ response }, "Image uploaded successfully!");
    return response;
  } catch (err) {
    logger.error({ err }, "Failed to upload image!");
    return null;
  }
};

export const imagekitDelete = async (url: string) => {
  try {
    const fileId = new URL(url).searchParams.get("fid");

    if (!fileId) return null;

    const response = await imagekit.deleteFile(fileId);

    logger.debug({ response }, "Image deleted successfully!");
    return response;
  } catch (err) {
    logger.error({ err }, "Failed to delete image!");
    return null;
  }
};

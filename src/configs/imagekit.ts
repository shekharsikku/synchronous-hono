import ImageKit from "imagekit";
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

    const uploadResponse = await imagekit.upload({
      file: fileBase64,
      fileName: imageFile.name,
      folder: "/uploads",
    });

    return uploadResponse;
  } catch (error: any) {
    console.error(`Failed to upload image: ${error.message}`);
    return null;
  }
};

export const imagekitDelete = async (imageId: string) => {
  try {
    const deleteResponse = await imagekit.deleteFile(imageId);
    return deleteResponse;
  } catch (error: any) {
    console.error(`Failed to delete image file: ${error.message}`);
    return null;
  }
};

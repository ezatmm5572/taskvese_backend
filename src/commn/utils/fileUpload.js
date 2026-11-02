import cloudinary from "./cloudinary.js";
import { Readable } from "node:stream";

export const fileUpload = (file, folder = "members") => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            { folder, resource_type: "image" },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );

        Readable.from(file).pipe(uploadStream);
    });
};

export const uploadAttachmentToCloudinary = (fileBuffer, originalname = "", folder = "attachments") => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: "auto",
                filename_override: originalname,
                use_filename: true,
            },
            (error, result) => {
                if (error) return reject(error);
                resolve(result);
            }
        );

        Readable.from(fileBuffer).pipe(uploadStream);
    });
};

export const deleteCloudinaryResource = async (public_id) => {
    if (!public_id) return;
    try {
        await cloudinary.uploader.destroy(public_id);
    } catch (e) {
        // Try as raw resource if image fails
        try {
            await cloudinary.uploader.destroy(public_id, { resource_type: "raw" });
        } catch (inner) {
            console.warn("Could not delete Cloudinary asset:", inner.message);
        }
    }
};

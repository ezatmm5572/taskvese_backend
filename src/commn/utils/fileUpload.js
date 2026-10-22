
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

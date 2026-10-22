
import multer from "multer";

export const multer_cloudinary = ({
    types = [],
    maxSize = 5 * 1024 * 1024,
    folder = null,
    fieldName = "file",
}) => {
    const storage = multer.memoryStorage();

    const fileFilter = (req, file, cb) => {
        console.log("Received MIME type:", file.mimetype);

        if (!types.includes(file.mimetype)) {
            return cb(new Error("invalid file type"));
        }

        cb(null, true);
    };

    const upload = multer({
        storage,
        fileFilter,
        limits: {
            fileSize: maxSize,
        },
    });

    return upload.single(fieldName);
};



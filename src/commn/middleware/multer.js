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

export const ALLOWED_ATTACHMENT_TYPES = [
    // Images
    "image/jpeg",
    "image/png",
    "image/gif",
    "image/webp",
    "image/svg+xml",
    "image/bmp",
    // Documents
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    // Plain text / data
    "text/plain",
    "text/csv",
    "text/markdown",
    "application/json",
    // Archives
    "application/zip",
    "application/x-zip-compressed",
    "application/x-rar-compressed",
    "application/x-tar",
    "application/gzip",
];

export const attachmentUpload = (req, res, next) => {
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: {
            fileSize: 15 * 1024 * 1024, // 15MB limit
        },
        fileFilter: (req, file, cb) => {
            if (!ALLOWED_ATTACHMENT_TYPES.includes(file.mimetype)) {
                return cb(new Error("Unsupported file type: " + file.mimetype));
            }
            cb(null, true);
        },
    }).single("file");

    upload(req, res, (err) => {
        if (err) {
            const message = err.code === "LIMIT_FILE_SIZE"
                ? "File exceeds the 15MB limit"
                : (err.message || "File upload failed");
            return res.status(400).json({ message });
        }
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded. Expected 'file' field." });
        }
        next();
    });
};

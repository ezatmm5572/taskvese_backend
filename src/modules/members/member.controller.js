import { Router } from "express";
import { authonticaation } from "../../commn/middleware/authontication.js";
import { validation } from "../../commn/middleware/validation.js";
import { createMemberValidation } from "./member.validtion.js";
import {
    createMember,
    getProfile,
    getAllMembers,
    updateMember,
    deleteMember,
    resetMemberPassword,
    setMemberActive,
    getPreferences,
    updatePreferences,
} from "./members.service.js";
import { multer_cloudinary } from "../../commn/middleware/multer.js";
import { RoleEnum } from "../../commn/enums/member.enums.js";
import { authorization } from "../../commn/middleware/authorization.js";

const memberRouter = new Router();

memberRouter.get("/", authonticaation, getAllMembers);
memberRouter.get("/all", authonticaation, getAllMembers);
memberRouter.get("/profile", authonticaation, getProfile);

memberRouter.get("/preferences", authonticaation, getPreferences);
memberRouter.patch("/preferences", authonticaation, updatePreferences);

memberRouter.post(
    "/createMember",
    authonticaation,
    authorization([RoleEnum.ADMIN]),
    multer_cloudinary({
        types: ["image/png", "image/jpeg", "image/jpg"],
        maxSize: 1024 * 1024 * 5,
        folder: "members",
        fieldName: "profilePicture",
    }),
    validation(createMemberValidation),
    createMember
);

memberRouter.patch(
    "/:id",
    authonticaation,
    multer_cloudinary({
        types: ["image/png", "image/jpeg", "image/jpg"],
        maxSize: 1024 * 1024 * 5,
        folder: "members",
        fieldName: "profilePicture",
    }),
    updateMember
);

memberRouter.delete("/:id", authonticaation, authorization([RoleEnum.ADMIN]), deleteMember);
memberRouter.post("/:id/resetPassword", authonticaation, authorization([RoleEnum.ADMIN]), resetMemberPassword);
memberRouter.patch("/:id/active", authonticaation, authorization([RoleEnum.ADMIN]), setMemberActive);

export default memberRouter;
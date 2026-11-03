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

import { requirePermission, requirePermissionOrSelf } from "../../commn/utils/access-control.js";

const memberRouter = new Router();

memberRouter.get("/", authonticaation, requirePermission("view.members"), getAllMembers);
memberRouter.get("/all", authonticaation, requirePermission("view.members"), getAllMembers);
memberRouter.get("/profile", authonticaation, getProfile);

memberRouter.get("/preferences", authonticaation, getPreferences);
memberRouter.patch("/preferences", authonticaation, updatePreferences);

memberRouter.post(
    "/createMember",
    authonticaation,
    requirePermission("member.invite"),
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
    requirePermissionOrSelf("member.edit"),
    multer_cloudinary({
        types: ["image/png", "image/jpeg", "image/jpg"],
        maxSize: 1024 * 1024 * 5,
        folder: "members",
        fieldName: "profilePicture",
    }),
    updateMember
);

memberRouter.delete("/:id", authonticaation, requirePermission("member.edit"), authorization([RoleEnum.ADMIN]), deleteMember);
memberRouter.post("/:id/resetPassword", authonticaation, requirePermission("member.edit"), authorization([RoleEnum.ADMIN]), resetMemberPassword);
memberRouter.patch("/:id/active", authonticaation, requirePermission("member.edit"), authorization([RoleEnum.ADMIN]), setMemberActive);

export default memberRouter;
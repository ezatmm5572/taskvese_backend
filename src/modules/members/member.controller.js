import { Router } from "express";
import { authonticaation } from "../../commn/middleware/authontication.js";
import { validation } from "../../commn/middleware/validation.js";
import { createMemberValidation } from "./member.validtion.js";
import { createMember, getProfile, getAllMembers } from "./members.service.js";
import { multer_cloudinary } from "../../commn/middleware/multer.js";
import { RoleEnum } from "../../commn/enums/member.enums.js";
import { authorization } from "../../commn/middleware/authorization.js";
const memberRouter = new Router();

memberRouter.get("/", authonticaation, getAllMembers);
memberRouter.get("/all", authonticaation, getAllMembers);
memberRouter.get("/profile", authonticaation, getProfile);

memberRouter.post("/createMember",multer_cloudinary({types:["image/png", "image/jpeg", "image/jpg"],maxSize:1024*1024*5,folder:"members",fieldName:"profilePicture"}), 
    authonticaation,
    authorization([RoleEnum.ADMIN]),
    validation(createMemberValidation),
    createMember);

export default memberRouter
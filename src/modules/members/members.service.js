import { HASH_SALT, JWT_SECRET } from "../../../config/config.env.js";
import * as DB_services from "../../DB/DB.service.js"
import memberModel from "../../DB/models/member.js";
import emailEventEmitter from "../../commn/email/email.events.js";
import * as redis_service from "../../DB/redis/redise.service.js"
import { emailTemplate } from "../../commn/email/email_otp.teamplate.js";
import { compareSync, hashSync } from "bcrypt"
import { sendEmail, generateOtp } from "../../commn/email/send.email.js";
import { ProviderEnum, RoleEnum } from "../../commn/enums/member.enums.js";
import { fileUpload } from "../../commn/utils/fileUpload.js";
import { eventsEnum } from "../../commn/enums/eventsEnum.js";
import { generateToken } from "../../commn/utils/security/token.service.js";
import { v4 as uuidv4 } from 'uuid';
import { successResponse } from "../../commn/utils/successResponse.js";
import { signInInvitationTemplate } from "../../commn/email/signin_invetion_tamplate.js";


export const createMember = async (req, res, next) => {

    const { fname, lname, email, password, confirmPassword, gender, profilePicture } = req.body;
    if (password !== confirmPassword) {
        throw new Error("Password and confirm password do not match")
    }

    const member_exist = await DB_services.findOne({ model: memberModel, filter: { email } });
    if (member_exist) {
        throw new Error("Member already exists")
    }


    const encPassword = hashSync(password, Number(HASH_SALT))

    let uploadedFile = null;

    if (req.file) {
        uploadedFile = await fileUpload(
            req.file.buffer,
            "members"
        );
    }
    const member = await DB_services.createDocument({
        model: memberModel,
        doc: {
            fname,
            lname,
            email,
            password: encPassword,
            gender,
            role: RoleEnum.MEMBER,
            profilePicture: uploadedFile?.secure_url,
            confirmed: true,
            addedBy: req.member._id
        }
    })

    emailEventEmitter.emit(eventsEnum.confirmEmail, async () => {
        await sendEmail({
            to: email,
            subject: "confirm email",
            html: signInInvitationTemplate({
                memberName: fname + " " + lname,
                memberEmail: email,
                memberPassword: password,
                signInUrl: "https://taskverse-frontend-ochre.vercel.app/app",
                invitedBy: req.member?.fname + " " + req.member?.lname,
            })
        })
    })
    successResponse({
        res,
        status: 201,
        message: "Member created successfully",
        data: member
    })
}


export const getProfile = async (req, res, next) => {
    successResponse({
        res,
        status: 200,
        message: "Profile",
        data: req.member
    })
}

export const getAllMembers = async (req, res, next) => {
    const members = await memberModel.find({}).select("-password").sort({ createdAt: -1 })
    successResponse({
        res,
        status: 200,
        message: "All members",
        data: members || []
    })
}

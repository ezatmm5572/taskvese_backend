import { HASH_SALT, JWT_SECRET } from "../../../config/config.env.js";
import * as DB_services from "../../DB/DB.service.js"
import memberModel from "../../DB/models/member.js";
import emailEventEmitter from "../../commn/email/email.events.js";
import * as redis_service from "../../DB/redis/redise.service.js"
import { emailTemplate } from "../../commn/email/email_otp.teamplate.js";
import {compareSync, hashSync} from "bcrypt"
import { sendEmail, generateOtp } from "../../commn/email/send.email.js";
import { ProviderEnum, RoleEnum } from "../../commn/enums/member.enums.js";
import { fileUpload } from "../../commn/utils/fileUpload.js";
import { eventsEnum } from "../../commn/enums/eventsEnum.js";
import { generateToken } from "../../commn/utils/security/token.service.js";
import { v4 as uuidv4 } from 'uuid';
import { model } from "mongoose";
import { successResponse } from "../../commn/utils/successResponse.js";
import { OAuth2Client } from "google-auth-library";

const confirmEmail=async({email,otp})=>{
    const verifyEmail=await DB_services.findOne({
        model:memberModel,filter:{email,provider:ProviderEnum.SYSTEM,confirmed:false},
        select:"-password"
    })
    if (!verifyEmail) {
        throw new Error("User not found")
    }

    const storedOtp = await redis_service.getValuse({key:redis_service.otp_key({email:verifyEmail.email})})

    if (!storedOtp) {
        throw new Error("Otp not found")
    }
    
    const verifyOtp=compareSync(`${otp}`,storedOtp)
    if (!verifyOtp) {
        throw new Error("Invalid Otp")
    }
    await DB_services.updateDocument({
        model:memberModel,filter:{email:verifyEmail.email},update:{confirmed:true}
    })
    redis_service.delValuse([redis_service.otp_key({email:verifyEmail.email})])
}



export const adminSignUp = async (req, res) => {
    const { fname, lname, email, password,confirmPassword, gender,profilePicture} = req.body;
    if(password!==confirmPassword){
        throw new Error("Password and confirm password do not match");
    }

    const user = await DB_services.findOne({model:memberModel,filter:{email}});
    if (user) {
        throw new Error("User already exists");
    }

    const encPassword = hashSync(password,Number(HASH_SALT))

    let uploadedFile = null;

if (req.file) {
    uploadedFile = await fileUpload(
        req.file.buffer,
        "members"
    );
}
    const member = await DB_services.createDocument({
        model:memberModel,
        doc:{
            fname,
            lname,
            email,
            password:encPassword,
            gender,
            role:RoleEnum.ADMIN,
            profilePicture:uploadedFile?.secure_url,
            confirmed:false,
        }
    })
    
    const isBlocked = await redis_service.getValuse({key:redis_service.blocked_key({email:email})})
    if(isBlocked){
        throw new Error("Member is blocked");
    }


    const otp =await generateOtp();
    redis_service.setValuse({
        key:redis_service.otp_key({email:email}),
        value:hashSync(`${otp}`,Number(HASH_SALT)),
        ttl:60*10
    })

    emailEventEmitter.emit(eventsEnum.confirmEmail,async()=>{
        await sendEmail({
            to:email,
            subject:"confirm email",
            html:emailTemplate(otp)
        })
    })


    // otp limit Counter

    redis_service.setValuse({
        key:redis_service.counter_key({email:email}),
        value:0,
        ttl:60*30
    })
    successResponse({
        res,
        status:201,
        message:"Admin user created successfully",
        data:{email:email}
    })
}


export const confirmSignUp = async (req, res) => {
    const {email ,otp} = req.body

    await confirmEmail({email,otp})
    successResponse({
        res,
        status:200,
        message:"Email confirmed successfully"
    })
}


export const resendOtp = async (req, res) => {
    const {email} = req.body

    const blocked= await redis_service.getValuse({key:redis_service.blocked_key({email})})
    if(blocked){
        throw new Error(`You have exceeded the maximum number of attempts ,try again after ${redis_service.ttl({key:redis_service.blocked_key({email})})/60} minutes`)
    }
    const counter = await redis_service.getValuse({key:redis_service.counter_key({email})})
    if (counter>=3) {
        redis_service.setValuse({
            key:redis_service.blocked_key({email}),
            value:true,
            ttl:60*10
        })
        throw new Error(`You have exceeded the maximum number of attempts ,try again after ${redis_service.ttl({key:redis_service.blocked_key({email})})/60} minutes`)
    }
    const verifyEmail=await DB_services.findOne({
        model:memberModel,filter:{email,provider:ProviderEnum.SYSTEM,confirmed:false},
        select:"-password"
    })
    if (!verifyEmail) {
        throw new Error("User not found")
    }
    const otp =await generateOtp();
    redis_service.setValuse({
        key:redis_service.otp_key({email:verifyEmail.email}),
        value:hashSync(`${otp}`,Number(HASH_SALT)),
        ttl:60*15
    })

    emailEventEmitter.emit(eventsEnum.confirmEmail,async()=>{
        await sendEmail({
            to:verifyEmail.email,
            subject:"confirm email",
            html:emailTemplate(otp)
        })
    })
    redis_service.incrementValuse({key:redis_service.counter_key({email:verifyEmail.email})})
    successResponse({
        res,
        status:200,
        message:"Otp sent successfully"
    })
}



export const signUpWithG = async (req, res, next) => {
    const { idToken } = req.body;

    if (!idToken) {
        throw new Error("Google ID token is required");
    }

    const client = new OAuth2Client(
        "882940930891-civns95juvot511h26l0bv894o5ra5h9.apps.googleusercontent.com"
    );

    const ticket = await client.verifyIdToken({
        idToken,
        audience:
            "882940930891-civns95juvot511h26l0bv894o5ra5h9.apps.googleusercontent.com",
    });

    const payload = ticket.getPayload();

    if (!payload) {
        throw new Error("Invalid Google token");
    }

    const {
        email,
        email_verified,
        name,
        picture,
    } = payload;

    if (!email || !email_verified) {
        throw new Error("Google email is not verified");
    }

    // Split Google's full name into first and last name.
    const nameParts = (name || "Google User")
        .trim()
        .split(/\s+/);

    const fname = nameParts.shift() || "Google";
    const lname = nameParts.join(" ") || "User";

    let member = await DB_services.findOne({
        model: memberModel,
        filter: { email },
    });

    if (member && member.provider === ProviderEnum.SYSTEM) {
        throw new Error("Email already exists. Please sign in using your password.");
    }

    if (!member) {
        member = await DB_services.createDocument({
            model: memberModel,
            doc: {
                fname,
                lname,
                email,
                confirmed: true,
                profilePicture: picture || "default.png",
                provider: ProviderEnum.GOOGLE,
            },
        });
    }

    const token = await generateToken({
        payload: {
            id: member._id,
            email: member.email,
        },
        secret_key: JWT_SECRET,
        options: {
            expiresIn: 60 * 20,
            jwtid: uuidv4(),
        },
    });

    const refreshToken = await generateToken({
        payload: {
            id: member._id,
            email: member.email,
        },
        secret_key: JWT_SECRET,
        options: {
            expiresIn: 60 * 60 * 24 * 7,
            jwtid: uuidv4(),
        },
    });

    return successResponse({
        res,
        status: 200,
        message: "Login successfully",
        data: {
            accessToken: token,
            refreshToken,
        },
    });
};



export const signIn = async (req, res, next) => {
    const { email, password } = req.body
    const member = await DB_services.findOne({ model: memberModel, filter: { email,provider:ProviderEnum.SYSTEM,confirmed:true } })
    if (!member) {
        throw new Error("User not found")
    }
    const verifyPassword = compareSync(password, member.password)
    if (!verifyPassword) {
        throw new Error("Invalid password")
    }
    const token = await generateToken({
        payload: { id: member._id, email: member.email }, secret_key: JWT_SECRET , options: {
            expiresIn: 60*20,
            jwtid: uuidv4()
        }
    })

    const refreshToken=await generateToken({
        payload: { id: member._id, email: member.email }, secret_key: JWT_SECRET , options: {
            expiresIn: 60*60*24*7,
            jwtid: uuidv4()
        }
    })
    successResponse({
        res,
        status:200,
        message:"login successfully",
        data:{accessToken:token,refreshToken}
    })
}



export const refreshToken = async (req, res, next) => {
        const { jti, exp } = req.decoded;
        const member = req.member;

        if (!member) {
            throw new Error("User not found")
        }

        if (!jti || !exp) {
            throw new Error("Invalid refresh token")
        }

        const isRevoked = await redis_service.getValuse({
            key: redis_service.revoke_key({
                userId: member._id,
                jti,
            }),
        });

        if (isRevoked) {
            throw new Error("Invalid refresh token")
        }

        const token = generateToken({
            payload: {
                id: member._id,
                email: member.email,
            },
            secret_key: JWT_SECRET,
            options: {
                expiresIn: "20m",
                jwtid: uuidv4(),
            },
        });

        const newRefreshToken = generateToken({
            payload: {
                id: member._id,
                email: member.email,
            },
            secret_key: JWT_SECRET,
            options: {
                expiresIn: "7d",
                jwtid: uuidv4(),
            },
        });

        // Revoke the old refresh token after issuing new tokens.
        const ttl = exp - Math.floor(Date.now() / 1000);

        if (ttl > 0) {
            await redis_service.setValuse({
                key: redis_service.revoke_key({
                    userId: member._id,
                    jti,
                }),
                value: jti,
                ttl,
            });
        }

        successResponse({
            res,
            status:200,
            message:"Tokens refreshed successfully",
            data:{
                accessToken:token,
                refreshToken:newRefreshToken,
            },
        });
};



export const logout = async (req, res) => {
    const member = req.member
    const {flag}=req.query
    if (!member){
        throw new Error("User not found")
    }
    if (flag==="all"){
        req.member.changeCredentials=new Date();
        await req.member.save()
        await redis_service.delValuse(await redis_service.keys(redis_service.get_revoke_key({memberId:member._id})))
        successResponse({
            res,
            status:200,
            message:"Logout successfully"
        })
    }else{
        await redis_service.setValuse({
            key: redis_service.revoke_key({memberId:member._id,jti:req.decoded.jti}),
            value: `${req.decoded.jti}`,
            ttl: req.decoded.exp - Math.floor(Date.now() / 1000) 
        })
        successResponse({
            res,
            status:200,
            message:"Logout successfully"
        })
    }

}


export const getProfile = async (req, res, next) => {
    const member = req.member
    if (!member){
        throw new Error("User not found")
    }
    const profile = await DB_services.findOne({
        model: memberModel,
        filter: { _id: member._id },
        select: "-password"
    })
    successResponse({
        res,
        status:200,
        message:"Profile",
        data:profile
    })
}


export const forgetPassword=async(req,res,next)=>{
    const {email}=req.body
    const member=await DB_services.findOne({model:memberModel,filter:{email,confirmed:true}})
    if (!member){
        throw new Error("User not found")
    }
    const otp=await generateOtp()
    await redis_service.setValuse({
        key:redis_service.otp_key({email:member.email}),
        value:hashSync(`${otp}`,Number(HASH_SALT)),
        ttl:60*15
    })
    emailEventEmitter.emit(eventsEnum.confirmEmail,async()=>{
        await sendEmail({
            to:member.email,
            subject:"confirm email",
            html:emailTemplate(otp)
        })
    })
    await redis_service.incrementValuse({key:redis_service.counter_key({email:member.email})})

    await redis_service.setValuse({
        key:redis_service.forgot_password_key({email}),
        value:hashSync(`${otp}`,Number(HASH_SALT)),
        ttl:60*15
    })
    successResponse({
        res,
        status:200,
        message:"Otp sent successfully"
    })
}

export const resetPassword=async(req,res,next)=>{
    
    const {email,otp,password,confirmPassword}=req.body
    
    const forgot_password_otp = await redis_service.getValuse({key:redis_service.forgot_password_key({email})})
    if (!forgot_password_otp){
        throw new Error("Otp not found")
    }
    const verifyOtp = compareSync(otp,forgot_password_otp)
    if (!verifyOtp){
        throw new Error("Invalid otp")
    }
    const member=await DB_services.findOne({model:memberModel,filter:{email,confirmed:true}})
    if (!member){
        throw new Error("User not found")
    }
    const hashPassword = hashSync(password,Number(HASH_SALT))
    await DB_services.updateDocument({model:memberModel,filter:{email,confirmed:true},update:{password:hashPassword,changeCredentials:new Date()}})
    await redis_service.delValuse([redis_service.forgot_password_key({email})])
    await redis_service.delValuse([redis_service.counter_key({email})])
    await redis_service.delValuse([redis_service.otp_key({email})])
    successResponse({
        res,
        status:200,
        message:"Password changed successfully"
    })
}

export const changePassword = async (req,res,next)=>{
    const member = req.member
    const {oldPassword,newPassword,confirmPassword}=req.body
    if (!member){
        throw new Error("User not found")
    }
    const member1=await DB_services.findOne({
        model:memberModel,
        filter:{_id:member._id}
    })
    const verifyPassword = compareSync(oldPassword,member1.password)
    if (!verifyPassword){
        throw new Error("Invalid old password")
    }
    const hashPassword = hashSync(newPassword,Number(HASH_SALT))
    await DB_services.updateDocument({model:memberModel,filter:{_id:member._id},update:{password:hashPassword,changeCredentials:new Date()}})

    await redis_service.delValuse(await redis_service.keys(redis_service.get_revoke_key({memberId:member._id})))
    successResponse({
        res,
        status:200,
        message:"Password changed successfully"
    })
}
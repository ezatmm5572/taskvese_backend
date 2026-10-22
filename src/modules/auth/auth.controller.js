import { Router } from "express"
import { adminSignUp,changePassword,confirmSignUp, forgetPassword, getProfile, logout, refreshToken, resendOtp, resetPassword, signIn, signUpWithG } from "./auth.service.js";
import { multer_cloudinary } from "../../commn/middleware/multer.js";
import { validation } from "../../commn/middleware/validation.js";
import { adminSignUpValidation,changePasswordValidation,confirmSignUpValidation, resetPasswordValidation, sendResetPasswordOtpValidation, signInValidation } from "./auth.validation.js";
import { authonticaation } from "../../commn/middleware/authontication.js";
const authRouter = new Router();

authRouter.post("/signUp", multer_cloudinary({types:["image/png", "image/jpeg", "image/jpg"],maxSize:1024*1024*5,folder:"members",fieldName:"profilePicture"}), validation(adminSignUpValidation),adminSignUp)

authRouter.post("/confirmSignUp", validation(confirmSignUpValidation),confirmSignUp)

authRouter.post("/resendOtp",resendOtp)

authRouter.post("/sign&signin/gmail",signUpWithG)

authRouter.post("/signIn", validation(signInValidation),signIn)

authRouter.post("/logout",authonticaation,logout)

authRouter.post("/profile",authonticaation,getProfile)

authRouter.post("/refreshToken",authonticaation,refreshToken)

authRouter.post("/forgotPassword", validation(sendResetPasswordOtpValidation), forgetPassword)

authRouter.post("/resetPassword", validation(resetPasswordValidation), resetPassword)

authRouter.post("/changePassword",authonticaation,validation(changePasswordValidation),changePassword)

export default authRouter
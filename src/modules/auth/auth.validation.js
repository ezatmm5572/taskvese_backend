
import Joi from "joi";

export const adminSignUpValidation = {
    body: Joi.object({
        fname: Joi.string().required().min(2).max(50),
        lname: Joi.string().required().min(2).max(50),
        email: Joi.string().required().email().lowercase().trim(),
        password: Joi.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/).required(),
        confirmPassword: Joi.string()
            .required()
            .valid(Joi.ref("password")),
        gender: Joi.string().required(),
    }),
    file: Joi.object({
        fieldname: Joi.string().valid("profilePicture").required(),
        mimetype: Joi.string()
            .valid("image/png", "image/jpeg")
            .required(),
        size: Joi.number().max(5 * 1024 * 1024).required(),
    }).unknown(true).optional(),
};

export const confirmSignUpValidation = {
    body: Joi.object({
        email: Joi.string().required().email().lowercase().trim(),
        otp: Joi.string().required().length(6),
    }),
};

export const signInValidation = {
    body: Joi.object({
        email: Joi.string().required().email().lowercase().trim(),
        password: Joi.string().required().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/), 
    }),
};

export const sendResetPasswordOtpValidation = {
    body: Joi.object({
        email: Joi.string().required().email().lowercase().trim(),
    }),
};

export const resetPasswordValidation = {
    body: Joi.object({
        email: Joi.string().required().email().lowercase().trim(),
        otp: Joi.string().required().length(6),
        password: Joi.string().required().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/), 
        confirmPassword: Joi.string().required().valid(Joi.ref("password")),  
    }),
};

export const changePasswordValidation = {
    body: Joi.object({
        oldPassword: Joi.string().required().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/), 
        newPassword: Joi.string().required().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/), 
        confirmPassword: Joi.string().required().valid(Joi.ref("newPassword")),  
    }),
};
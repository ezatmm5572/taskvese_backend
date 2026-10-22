import joi from "joi";

export const createMemberValidation = {
    body: joi.object({
        fname: joi.string().required(),
        lname: joi.string().required(),
        email: joi.string().email().required(),
        password: joi.string().required(),
        confirmPassword: joi.string().required(),
        gender: joi.string().valid("male", "female").required(),
    }),
    file: joi.object({
        fieldname: joi.string().valid("profilePicture").required(),
        mimetype: joi.string()
            .valid("image/png", "image/jpeg")
            .required(),
        size: joi.number().max(5 * 1024 * 1024).required(),
    }).unknown(true),
}


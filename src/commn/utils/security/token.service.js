import jwt from "jsonwebtoken"
import { JWT_SECRET } from "../../../../config/config.env.js"

export const generateToken = ({ payload, secret_key=JWT_SECRET, options={} }) => {
    return jwt.sign(payload,secret_key,options)
}

export const verifyToken = ({ token, secret_key=JWT_SECRET, options={} }) => {
    return jwt.verify(token,secret_key,options)
}
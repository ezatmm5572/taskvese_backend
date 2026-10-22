import { findOne } from "../../DB/DB.service.js";
import memberModel from "../../DB/models/member.js";
import { verifyToken } from "../utils/security/token.service.js";
import { getValuse, revoke_key } from "../../DB/redis/redise.service.js";
import { JWT_SECRET } from "../../../config/config.env.js";
export const authonticaation = async (req,res,next) => {
 try {
  const header=req.headers.authorization;
  if (!header?.startsWith("Bearer ")) return res.status(401).json({message:"Bearer access token required"});
  const token=header.slice(7).trim(); const decoded=verifyToken({token,secret_key:JWT_SECRET});
  if (decoded.type !== "access" || !decoded.id || !decoded.jti) return res.status(401).json({message:"Invalid access token"});
  const member=await findOne({model:memberModel,filter:{_id:decoded.id},select:"-password"});
  if (!member) return res.status(401).json({message:"Account not found"});
  if (member.changeCredentials && decoded.iat*1000 < member.changeCredentials.getTime()) return res.status(401).json({message:"Credentials changed; sign in again"});
  if (await getValuse({key:revoke_key({userId:String(member._id),jti:decoded.jti})})) return res.status(401).json({message:"Token revoked"});
  req.decoded=decoded; req.member=member; return next();
 } catch(e) { return res.status(401).json({message:e.name === "TokenExpiredError" ? "Token expired" : (e.message || "Authentication failed")}); }
};


import { redis_clint } from "./redise.connection.js";


export const revoke_key=({userId,jti})=>{
    return `revoked_token::${userId}::${jti}`
}
export const get_revoke_key = ({ userId }) => {
    return `revoked_token::${userId}::`
}
export const recent_refresh_key = ({ userId, jti }) => {
    return `recent_refresh::${userId}::${jti}`
}
export const otp_key=({email})=>{
    return `otp::${email}`
}
export const blocked_key=({email})=>{
    return `blocked::${email}`
}

export const counter_key=({email})=>{
    return `counter::${email}`
}

export const forgot_password_key=({email})=>{
    return `forgot_password::${email}`
}
export const chnage_password_key=({email})=>{
    return `chnage_password::${email}`
}

export const reset_password_key=({email})=>{
    return `reset_password::${email}`
}
export const setValuse = async ({ key, value, ttl }) => {
  try {
    const data =
      typeof value === "string" ? value : JSON.stringify(value);

    if (ttl !== undefined) {
      return await redis_clint.set(key, data, { ex: ttl });
    }

    return await redis_clint.set(key, data);
  } catch (error) {
    console.error("Redis set error:", error);
    throw error;
  }
};

export const getValuse = async ({ key }) => {
  try {
    const data = await redis_clint.get(key);

    if (data === null) return null;

    if (typeof data !== "string") return data;

    try {
      return JSON.parse(data);
    } catch {
      return data;
    }
  } catch (error) {
    console.error("Redis get error:", error);
    throw error;
  }
};

export const delValuse = async (keys) => {
    try {
        if (!Array.isArray(keys) || keys.length === 0) {
            return 0;
        }

        return await redis_clint.del(...keys);
    } catch (error) {
        console.error("Redis del error:", error);
        throw error;
    }
};

export const updateValuse = async ({ key, value, ttl }) => {
  try {
    const exists = await existValue({ key });

    if (!exists) {
      throw new Error("Key not found");
    }

    return await setValuse({ key, value, ttl });
  } catch (error) {
    console.error("Redis update error:", error);
    throw error;
  }
};

export const existValue = async ({ key }) => {
  try {
    const data = await redis_clint.exists(key);
    return data > 0;
  } catch (error) {
    console.error("Redis exists error:", error);
    throw error;
  }
};

export const ttl = async ({ key }) => {
  try {
    return await redis_clint.ttl(key);
  } catch (error) {
    console.error("Redis TTL error:", error);
    throw error;
  }
};

export const expValuse = async ({ key, ttl }) => {
  try {
    return await redis_clint.expire(key, ttl);
  } catch (error) {
    console.error("Redis expire error:", error);
    throw error;
  }
};

export const keys = async (pattern) => {
    try {
        return await redis_clint.keys(`${pattern}*`);
    } catch (error) {
        console.error("Redis keys error:", error);
        throw error;
    }
};
export const incrementValuse=async({key})=>{
    try {
        return await redis_clint.incr(key);
    } catch (error) {
        console.error("Redis increment error:", error);
        throw error;
    }
}
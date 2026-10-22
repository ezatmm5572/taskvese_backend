
import { Redis } from "@upstash/redis";

import {
    UPSTASH_REDIS_REST_TOKEN,
    UPSTASH_REDIS_REST_URL,
} from "../../../config/config.env.js";

export const redis_clint = new Redis({
    url: UPSTASH_REDIS_REST_URL,
    token: UPSTASH_REDIS_REST_TOKEN,
});

export const redis_connect = async () => {
    try {
        await redis_clint.ping();
        console.log("Redis connected successfully");
    } catch (error) {
        console.error("Redis connection failed:", error);
        throw error;
    }
};



import { Redis } from "@upstash/redis";
import {
    UPSTASH_REDIS_REST_TOKEN,
    UPSTASH_REDIS_REST_URL,
} from "../../../config/config.env.js";

let client;

const getClient = () => {
    if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
        throw new Error("Upstash Redis is not configured. Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN.");
    }
    if (!client) {
        client = new Redis({
            url: UPSTASH_REDIS_REST_URL,
            token: UPSTASH_REDIS_REST_TOKEN,
        });
    }
    return client;
};

// Lazy proxy prevents module-import warnings/crashes when Redis is intentionally
// unavailable in local tests. Calls still fail with a clear configuration error.
export const redis_clint = new Proxy({}, {
    get(_target, property) {
        const activeClient = getClient();
        const value = activeClient[property];
        return typeof value === "function" ? value.bind(activeClient) : value;
    },
});

export const redis_connect = async () => {
    try {
        await redis_clint.ping();
        console.log("Redis connected successfully");
    } catch (error) {
        console.error("Redis connection failed:", error.message || error);
        throw error;
    }
};

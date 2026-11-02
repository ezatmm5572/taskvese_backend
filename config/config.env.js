
import dotenv from "dotenv";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

const env = process.env.NODE_ENV || "development";
const envPath = env === "production" ? ".production" : ".development";

// Look for env files in priority order
const candidateEnvFiles = [
    resolve(`config/.env.${env}`),
    resolve(`config/.env${envPath}`),
    resolve(`.env.${env}`),
    resolve(".env"),
    resolve("config/.env.development"),
];

for (const envFile of candidateEnvFiles) {
    if (existsSync(envFile)) {
        dotenv.config({ path: envFile });
        break;
    }
}
dotenv.config();

export const DBURI = process.env.DB_URI;
export const PORT = process.env.PORT || 3000;
export const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
export const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
export const SMTP_USER = process.env.SMTP_USER;
export const SMTP_PASS = process.env.SMTP_PASS;
export const CLOUDENARY_CLOUD_NAME = process.env.CLOUD_NAME;
export const CLOUDENARY_API_KEY = process.env.API_KEY_CLOUDENARY;
export const CLOUDENARY_API_SECRET = process.env.API_SECRET_CLOUDENARY;
export const JWT_SECRET = process.env.JWT_SECRET;
export const HASH_SALT = process.env.HASH_SALT;
export const ENCRYPTION_KEY_ENV = process.env.ENCRYPTION_KEY_ENV;


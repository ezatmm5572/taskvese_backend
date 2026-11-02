import crypto from "node:crypto";
import { ENCRYPTION_KEY_ENV } from "../../../../config/config.env.js";

const IV_LENGTH = 16;

const getEncryptionKey = () => {
    if (!ENCRYPTION_KEY_ENV) {
        throw new Error("ENCRYPTION_KEY_ENV is missing. Set a 64-character hexadecimal AES-256 key.");
    }
    if (!/^[a-f0-9]{64}$/i.test(ENCRYPTION_KEY_ENV)) {
        throw new Error("ENCRYPTION_KEY_ENV must be exactly 64 hexadecimal characters (32 bytes).");
    }
    return Buffer.from(ENCRYPTION_KEY_ENV, "hex");
};

export function encrypt(text) {
    if (typeof text !== "string") throw new TypeError("Value to encrypt must be a string.");
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv("aes-256-cbc", getEncryptionKey(), iv);
    const encrypted = cipher.update(text, "utf8", "hex") + cipher.final("hex");
    return `${iv.toString("hex")}:${encrypted}`;
}

export function decrypt(text) {
    if (typeof text !== "string" || !text.includes(":")) {
        throw new TypeError("Encrypted value must use the format <iv>:<ciphertext>.");
    }
    const [ivHex, encryptedText, ...extra] = text.split(":");
    if (extra.length || !/^[a-f0-9]{32}$/i.test(ivHex) || !encryptedText || !/^(?:[a-f0-9]{2})+$/i.test(encryptedText)) {
        throw new Error("Invalid encrypted value format.");
    }
    const decipher = crypto.createDecipheriv("aes-256-cbc", getEncryptionKey(), Buffer.from(ivHex, "hex"));
    return decipher.update(encryptedText, "hex", "utf8") + decipher.final("utf8");
}

import { EventEmitter } from "events";
import { eventsEnum } from "../enums/eventsEnum.js";

const emailEventEmitter = new EventEmitter();
emailEventEmitter.setMaxListeners(50);

// In-flight email jobs. On serverless hosts (like Vercel), background promises
// get frozen when the response is sent. We ensure flushEmails() is awaited before
// the HTTP response finishes.
const pending = new Set();

export const queueEmailJob = (fn) => {
    // Never let a failed email become an unhandled rejection
    const job = Promise.resolve()
        .then(fn)
        .catch((error) => console.error("Email job failed:", error?.message || error))
        .finally(() => pending.delete(job));
    pending.add(job);
    return job;
};

// Allows callers to emit and await an email event simultaneously
export const emitEmail = (event, fn) => {
    const job = queueEmailJob(fn);
    emailEventEmitter.emit(event, () => job);
    return job;
};

emailEventEmitter.on(eventsEnum.confirmEmail, queueEmailJob);
emailEventEmitter.on(eventsEnum.forgetPassword, queueEmailJob);
emailEventEmitter.on("sendEmail", queueEmailJob);

export const getPendingEmailCount = () => pending.size;

// Safely flush all pending emails with a timeout race (prevents freezing or hanging on serverless)
export const flushEmails = async (timeoutMs = 15000) => {
    if (pending.size === 0) return [];

    let timer;
    const timeoutPromise = new Promise((resolve) => {
        timer = setTimeout(() => {
            console.warn(`flushEmails timed out after ${timeoutMs}ms with ${pending.size} pending job(s)`);
            resolve([]);
        }, timeoutMs);
    });

    try {
        const results = await Promise.race([
            Promise.allSettled([...pending]),
            timeoutPromise,
        ]);
        return results;
    } finally {
        clearTimeout(timer);
    }
};

export default emailEventEmitter;


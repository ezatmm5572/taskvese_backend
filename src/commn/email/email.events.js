import { EventEmitter } from "events";
import { eventsEnum } from "../enums/eventsEnum.js";

const emailEventEmitter = new EventEmitter();
emailEventEmitter.setMaxListeners(50);

// Emails still being sent. On serverless hosts the function can be frozen as soon as the
// response is sent, so the entrypoint awaits flushEmails() before finishing.
const pending = new Set();

export const queueEmailJob = (fn) => {
    // Never let a failed email become an unhandled rejection (which would crash the process).
    const job = Promise.resolve()
        .then(fn)
        .catch((error) => console.error("Email job failed:", error?.message || error))
        .finally(() => pending.delete(job));
    pending.add(job);
    return job;
};

emailEventEmitter.on(eventsEnum.confirmEmail, queueEmailJob);
emailEventEmitter.on(eventsEnum.forgetPassword, queueEmailJob);
emailEventEmitter.on("sendEmail", queueEmailJob);

export const flushEmails = () => Promise.allSettled([...pending]);

export default emailEventEmitter;


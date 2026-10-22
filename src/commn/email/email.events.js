import { EventEmitter } from "events";
import { eventsEnum } from "../enums/eventsEnum.js";

const emailEventEmitter = new EventEmitter()

// Emails still being sent. On serverless hosts the function can be frozen as soon as the
// response is sent, so the entrypoint awaits flushEmails() before finishing.
const pending = new Set()

emailEventEmitter.on(eventsEnum.confirmEmail, (fn) => {
    // Never let a failed email become an unhandled rejection (which would crash the process).
    const job = Promise.resolve()
        .then(fn)
        .catch((error) => console.error("Email job failed:", error?.message || error))
        .finally(() => pending.delete(job))
    pending.add(job)
})

export const flushEmails = () => Promise.allSettled([...pending])

export default emailEventEmitter

import { EventEmitter } from "events";

const eventBus = new EventEmitter();
eventBus.setMaxListeners(500);

// Ring buffer for last 200 events to support Last-Event-ID replay
const EVENT_HISTORY_MAX = 200;
const eventHistory = [];
let eventCounter = 1;

export const broadcastEvent = ({
    type,
    actorId = null,
    taskId = null,
    teamId = null,
    targetUserId = null,
    message = null,
}) => {
    const event = {
        id: String(eventCounter++),
        type,
        actorId,
        taskId,
        teamId,
        targetUserId,
        message,
        at: new Date().toISOString(),
    };

    eventHistory.push(event);
    if (eventHistory.length > EVENT_HISTORY_MAX) {
        eventHistory.shift();
    }

    eventBus.emit("sse_event", event);
    return event;
};

export const handleSseConnection = (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const currentUserId = String(req.member?._id || "");
    const lastEventId = req.headers["last-event-id"] || req.query?.last_event_id;

    // Replay missed events if Last-Event-ID header is present
    if (lastEventId) {
        const lastIdNum = parseInt(lastEventId, 10);
        if (!isNaN(lastIdNum)) {
            const missed = eventHistory.filter((e) => parseInt(e.id, 10) > lastIdNum);
            for (const ev of missed) {
                // Filter events caller is allowed to see
                if (!ev.targetUserId || ev.targetUserId === currentUserId) {
                    res.write(`id: ${ev.id}\n`);
                    res.write(`data: ${JSON.stringify(ev)}\n\n`);
                }
            }
        }
    }

    // Event listener
    const onEvent = (ev) => {
        if (!ev.targetUserId || ev.targetUserId === currentUserId) {
            res.write(`id: ${ev.id}\n`);
            res.write(`data: ${JSON.stringify(ev)}\n\n`);
        }
    };

    eventBus.on("sse_event", onEvent);

    // 25s heartbeat comment to prevent timeouts
    const heartbeatTimer = setInterval(() => {
        res.write(": heartbeat\n\n");
    }, 25000);

    req.on("close", () => {
        clearInterval(heartbeatTimer);
        eventBus.off("sse_event", onEvent);
    });
};

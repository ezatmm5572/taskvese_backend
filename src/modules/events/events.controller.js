import { Router } from "express";
import { authonticaation } from "../../commn/middleware/authontication.js";
import { handleSseConnection } from "./events.service.js";

const eventsRouter = Router();

// GET /events supports both Authorization: Bearer and ?access_token=
eventsRouter.get("/", authonticaation, handleSseConnection);

export default eventsRouter;

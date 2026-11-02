import { Router } from "express";
import { authonticaation } from "../../commn/middleware/authontication.js";
import { validation } from "../../commn/middleware/validation.js";
import { getActivity } from "./activity.service.js";
import { getActivityValidation } from "./activity.validation.js";

const activityRouter = Router();

activityRouter.get(
    "/",
    authonticaation,
    validation(getActivityValidation),
    getActivity
);

export default activityRouter;

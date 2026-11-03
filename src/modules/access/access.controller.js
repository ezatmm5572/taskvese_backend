import { Router } from "express";
import { authonticaation } from "../../commn/middleware/authontication.js";
import { requireSystemAdmin } from "../../commn/utils/access-control.js";
import {
    getMyAccess, getAccessConfiguration, updateAccessConfiguration,
    getAccessUsers, updateAccessUser, getAccessAudit,
} from "./access.service.js";

const router = Router();
router.use(authonticaation);
router.get("/me", getMyAccess);
router.get("/config", requireSystemAdmin, getAccessConfiguration);
router.put("/config", requireSystemAdmin, updateAccessConfiguration);
router.get("/users", requireSystemAdmin, getAccessUsers);
router.put("/users/:memberId", requireSystemAdmin, updateAccessUser);
router.get("/audit", requireSystemAdmin, getAccessAudit);

export default router;

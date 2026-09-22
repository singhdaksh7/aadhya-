import { Router } from "express";
import { login, logout, me, refresh } from "./auth.controller.js";
import { requireAdmin } from "../../middleware/adminAuth.js";
import { loginLimiter } from "../../middleware/rateLimiters.js";

const router = Router();

router.post("/login", loginLimiter, login);
router.post("/refresh", refresh);
router.post("/logout", logout);
router.get("/me", requireAdmin, me);

export default router;

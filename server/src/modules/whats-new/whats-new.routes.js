import { Router } from "express";
import { requireAdmin } from "../../middleware/adminAuth.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { created, noContent, ok } from "../../utils/apiResponse.js";
import * as service from "./whats-new.service.js";
import { createWhatsNewSchema, updateWhatsNewSchema } from "./whats-new.validators.js";

export const publicWhatsNewRouter = Router();
publicWhatsNewRouter.get(
  "/",
  asyncHandler(async (req, res) => ok(res, await service.listPublicWhatsNew()))
);

export const adminWhatsNewRouter = Router();
adminWhatsNewRouter.use(requireAdmin);
adminWhatsNewRouter.get("/", asyncHandler(async (req, res) => ok(res, await service.listAdminWhatsNew())));
adminWhatsNewRouter.get("/:id", asyncHandler(async (req, res) => ok(res, await service.getWhatsNew(req.params.id))));
adminWhatsNewRouter.post(
  "/",
  asyncHandler(async (req, res) => created(res, await service.createWhatsNew(createWhatsNewSchema.parse(req.body))))
);
const update = asyncHandler(async (req, res) =>
  ok(res, await service.updateWhatsNew(req.params.id, updateWhatsNewSchema.parse(req.body)))
);
adminWhatsNewRouter.patch("/:id", update);
adminWhatsNewRouter.put("/:id", update);
adminWhatsNewRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    await service.deleteWhatsNew(req.params.id);
    noContent(res);
  })
);

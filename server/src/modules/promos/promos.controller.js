import * as promosService from "./promos.service.js";

export async function handleListPublicPromos(req, res, next) {
  try {
    const promos = await promosService.listPublicPromos();
    res.json({ success: true, data: promos });
  } catch (err) {
    next(err);
  }
}

export async function handleListAdminPromos(req, res, next) {
  try {
    const promos = await promosService.listAdminPromos();
    res.json({ success: true, data: promos });
  } catch (err) {
    next(err);
  }
}

export async function handleCreatePromo(req, res, next) {
  try {
    const promo = await promosService.createPromo(req.body);
    res.status(201).json({ success: true, data: promo });
  } catch (err) {
    next(err);
  }
}

export async function handleUpdatePromo(req, res, next) {
  try {
    const promo = await promosService.updatePromo(req.params.id, req.body);
    res.json({ success: true, data: promo });
  } catch (err) {
    next(err);
  }
}

export async function handleDeletePromo(req, res, next) {
  try {
    await promosService.deletePromo(req.params.id);
    res.json({ success: true, message: "Promo deleted" });
  } catch (err) {
    next(err);
  }
}

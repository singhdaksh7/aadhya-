import * as bannersService from "./banners.service.js";

export async function handleListPublicBanners(req, res, next) {
  try {
    const placement = req.query.placement || "HOME_HERO";
    const banners = await bannersService.listPublicBanners(placement);
    res.json({ success: true, data: banners });
  } catch (err) {
    next(err);
  }
}

export async function handleListAdminBanners(req, res, next) {
  try {
    const banners = await bannersService.listAdminBanners();
    res.json({ success: true, data: banners });
  } catch (err) {
    next(err);
  }
}

export async function handleCreateBanner(req, res, next) {
  try {
    const banner = await bannersService.createBanner(req.body);
    res.status(201).json({ success: true, data: banner });
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateBanner(req, res, next) {
  try {
    const banner = await bannersService.updateBanner(req.params.id, req.body);
    res.json({ success: true, data: banner });
  } catch (err) {
    next(err);
  }
}

export async function handleDeleteBanner(req, res, next) {
  try {
    await bannersService.deleteBanner(req.params.id);
    res.json({ success: true, message: "Banner deleted" });
  } catch (err) {
    next(err);
  }
}

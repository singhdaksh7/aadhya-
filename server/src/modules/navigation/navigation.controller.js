import * as navigationService from "./navigation.service.js";

export async function handleGetPublicMenu(req, res, next) {
  try {
    const { code } = req.params;
    const menu = await navigationService.getNavigationByCode(code);
    res.json({ success: true, data: menu });
  } catch (err) {
    next(err);
  }
}

export async function handleListAdminMenus(req, res, next) {
  try {
    const menus = await navigationService.listMenus();
    res.json({ success: true, data: menus });
  } catch (err) {
    next(err);
  }
}

export async function handleCreateMenu(req, res, next) {
  try {
    const menu = await navigationService.createMenu(req.body);
    res.status(201).json({ success: true, data: menu });
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateMenu(req, res, next) {
  try {
    const menu = await navigationService.updateMenu(req.params.id, req.body);
    res.json({ success: true, data: menu });
  } catch (err) {
    next(err);
  }
}

export async function handleAddMenuItem(req, res, next) {
  try {
    const item = await navigationService.addMenuItem(req.params.menuId, req.body);
    res.status(201).json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

export async function handleUpdateMenuItem(req, res, next) {
  try {
    const item = await navigationService.updateMenuItem(req.params.itemId, req.body);
    res.json({ success: true, data: item });
  } catch (err) {
    next(err);
  }
}

export async function handleDeleteMenuItem(req, res, next) {
  try {
    await navigationService.deleteMenuItem(req.params.itemId);
    res.json({ success: true, message: "Menu item deleted" });
  } catch (err) {
    next(err);
  }
}

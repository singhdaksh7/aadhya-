import { describe, expect, it } from "vitest";
import { decorationsSchema, DEFAULT_DECORATIONS } from "../src/modules/settings/decorations.js";

const item = (over = {}) => ({ id: "d1", image: "/uploads/tree.png", scope: "HOME", ...over });
const parse = (items) => decorationsSchema.safeParse({ items });

describe("decorations settings schema", () => {
  it("defaults to no decorations", () => {
    expect(DEFAULT_DECORATIONS).toEqual({ items: [] });
    expect(parse([]).success).toBe(true);
  });

  it("fills safe defaults: mobile hidden, non-fixed, mirrored pairs, full opacity", () => {
    const out = parse([item()]);
    expect(out.success).toBe(true);
    expect(out.data.items[0]).toMatchObject({ enabled: true, side: "LEFT", vertical: "CENTER", opacity: 1, rotation: 0, layer: "MIDDLE", positionMode: "ABSOLUTE", showMobile: false, showDesktop: true, mirrorBoth: true, zoom: 1 });
  });

  it("accepts every scope and both-sides placement", () => {
    for (const scope of ["SITE", "HOME", "CATEGORIES", "PRODUCTS", "BOOKS", "BLOG"]) expect(parse([item({ scope })]).success).toBe(true);
    for (const [scope, targetId] of [["HOME_SECTION", "sec-1"], ["CATEGORY", "home-decor"], ["PAGE", "about"]]) expect(parse([item({ scope, targetId })]).success).toBe(true);
    expect(parse([item({ side: "BOTH" })]).success).toBe(true);
  });

  it("requires a target for specific-category, page and homepage-section scopes", () => {
    for (const scope of ["HOME_SECTION", "CATEGORY", "PAGE"]) expect(parse([item({ scope })]).success).toBe(false);
  });

  it("allows negative offsets but bounds them", () => {
    expect(parse([item({ offsetX: -120, offsetY: -40 })]).success).toBe(true);
    expect(parse([item({ offsetX: -5000 })]).success).toBe(false);
    expect(parse([item({ offsetY: 99999 })]).success).toBe(false);
  });

  it("bounds width, opacity, rotation, zoom and crop", () => {
    expect(parse([item({ width: 5 })]).success).toBe(false);
    expect(parse([item({ width: 5000 })]).success).toBe(false);
    expect(parse([item({ opacity: 0.05 })]).success).toBe(false);
    expect(parse([item({ opacity: 1.5 })]).success).toBe(false);
    expect(parse([item({ rotation: 200 })]).success).toBe(false);
    expect(parse([item({ rotation: -180 })]).success).toBe(true);
    expect(parse([item({ zoom: 9 })]).success).toBe(false);
    expect(parse([item({ focalX: 120 })]).success).toBe(false);
  });

  it("rejects unsafe or missing image URLs and unknown enums", () => {
    expect(parse([item({ image: "javascript:alert(1)" })]).success).toBe(false);
    expect(parse([item({ image: "data:image/png;base64,AAA" })]).success).toBe(false);
    expect(parse([item({ image: "" })]).success).toBe(false);
    expect(parse([item({ scope: "EVERYWHERE" })]).success).toBe(false);
    expect(parse([item({ side: "TOP" })]).success).toBe(false);
    expect(parse([item({ layer: "FRONT" })]).success).toBe(false);
    expect(parse([item({ image: "https://cdn.example.com/a.webp" })]).success).toBe(true);
  });

  it("requires unique ids and caps the number of decorations", () => {
    expect(parse([item({ id: "a" }), item({ id: "a" })]).success).toBe(false);
    expect(parse(Array.from({ length: 40 }, (_, i) => item({ id: `i${i}` }))).success).toBe(true);
    expect(parse(Array.from({ length: 41 }, (_, i) => item({ id: `i${i}` }))).success).toBe(false);
  });
});

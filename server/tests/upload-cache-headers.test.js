import { describe, it, expect, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import request from "supertest";
import { createApp } from "../src/app.js";
import { uploadRootDir } from "../src/modules/uploads/storage.js";

const name = `cache-header-test-${Date.now()}.txt`;
const file = path.join(uploadRootDir, name);

afterAll(() => fs.rmSync(file, { force: true }));

describe("uploaded media caching", () => {
  it("serves uploads with a long-lived immutable Cache-Control", async () => {
    fs.mkdirSync(uploadRootDir, { recursive: true });
    fs.writeFileSync(file, "x");
    const res = await request(createApp()).get(`/uploads/products/${name}`);
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("public, max-age=2592000, immutable");
  });
});

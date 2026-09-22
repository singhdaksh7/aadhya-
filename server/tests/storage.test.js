import { describe, expect, it } from "vitest";
import { createStorage } from "../src/modules/uploads/storage.js";
describe("storage adapters",()=>{
 it("stores local uploads with random image keys",async()=>{const s=createStorage({driver:"local"});const url=await s.save(Buffer.from("x"),"image/png");expect(url).toMatch(/^\/uploads\/products\/[\w-]+\.png$/);await s.remove(url);});
 it("uses an injected S3 client for put/delete and public URLs",async()=>{const calls=[];const s=createStorage({driver:"s3",region:"test",bucket:"bucket",accessKeyId:"key",secretAccessKey:"secret",endpoint:"http://s3.local",publicBaseUrl:"https://cdn.example"},{send:async c=>calls.push(c.input)});const url=await s.save(Buffer.from("x"),"image/jpeg");expect(url).toMatch(/^https:\/\/cdn\.example\/products\/.+\.jpg$/);await s.remove(url);expect(calls).toHaveLength(2);expect(calls[0]).toMatchObject({Bucket:"bucket",Key:expect.stringMatching(/^products\//)});expect(calls[1].Key).toBe(calls[0].Key);});
 it("rejects invalid storage configuration",()=>{expect(()=>createStorage({driver:"unknown"})).toThrow("Unsupported");expect(()=>createStorage({driver:"s3"})).toThrow("Missing S3");});
});

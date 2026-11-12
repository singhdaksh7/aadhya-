// Converts the canonical policy source (docs/policies/final-tushaqsa-policies.md) into the HTML stored in
// the CMS Page records for /returns, /shipping, /privacy and /terms. Formatting only: wording is untouched.
//
//   node scripts/policies/build-policy-pages.mjs [--address "<verified address>"]   -> prints JSON {slug: page}
//
// The unresolved "[Insert complete registered/business address]" line in the source is never published:
// it is replaced by the verified address when one is supplied, otherwise the whole line is omitted.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const SOURCE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../docs/policies/final-tushaqsa-policies.md");
export const ADDRESS_PLACEHOLDER = "[Insert complete registered/business address]";

export const PAGE_MAP = [
  { heading: "REFUND, RETURN, REPLACEMENT & CANCELLATION POLICY", slug: "returns",
    seoTitle: "Refund, Return & Cancellation Policy | Tushaqsa Homedecor",
    seoDescription: "Tushaqsa Homedecor refund, return, replacement and cancellation policy: eligibility, how to raise a claim, pickup and refund timelines." },
  { heading: "SHIPPING & DELIVERY POLICY", slug: "shipping",
    seoTitle: "Shipping & Delivery Policy | Tushaqsa Homedecor",
    seoDescription: "How Tushaqsa Homedecor processes, dispatches and delivers orders across India, including timelines, charges and tracking." },
  { heading: "PRIVACY POLICY", slug: "privacy",
    seoTitle: "Privacy Policy | Tushaqsa Homedecor",
    seoDescription: "How Tushaqsa Homedecor collects, uses, stores and protects your personal information." },
  { heading: "TERMS & CONDITIONS", slug: "terms",
    seoTitle: "Terms & Conditions | Tushaqsa Homedecor",
    seoDescription: "Terms and conditions for using the Tushaqsa Homedecor website and purchasing our products." },
];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Internal policy cross-references (only these exact bold/plain mentions are linked).
const POLICY_LINKS = [
  ["Refund, Return & Cancellation Policy", "/returns"],
  ["Shipping & Delivery Policy", "/shipping"],
];

let SELF = "";
function inline(raw) {
  let s = esc(raw);
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>");
  for (const [text, href] of POLICY_LINKS) {
    if (href === SELF) continue; // never link a policy to itself
    const t = esc(text);
    s = s.split(`<strong>${t}</strong>`).join(`<strong><a href="${href}">${t}</a></strong>`);
    s = s.replace(new RegExp(`(?<![>"])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "g"), `<a href="${href}">${t}</a>`);
  }
  s = s.replace(/(^|[\s>])([\w.+-]+@[\w-]+\.[\w.-]+[\w])/g, '$1<a href="mailto:$2">$2</a>');
  s = s.replace(/(\+91[- ]?\d{10})/g, (m) => `<a href="tel:+91${m.replace(/\D/g, "").slice(2)}">${m}</a>`);
  s = s.replace(/(^|[\s>])(https:\/\/[^\s<]+?)(\/?)(?=$|\s|<)/g, (m, a, url, slash) => `${a}<a href="${url}${slash}">${url}${slash}</a>`);
  return s;
}

function render(lines) {
  const out = [];
  let list = null; // {tag, items}
  let para = [];
  const flushPara = () => { if (para.length) { out.push(`<p>${para.map(inline).join("<br>")}</p>`); para = []; } };
  const flushList = () => { if (list) { out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`); list = null; } };
  for (const line of lines) {
    const hard = / {2}$/.test(line);
    const t = line.trim();
    let m;
    if (!t) { flushPara(); flushList(); continue; }
    if ((m = t.match(/^(#{2,3}) (.+)$/))) { flushPara(); flushList(); out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); continue; }
    if ((m = t.match(/^- (.+)$/))) { flushPara(); if (list?.tag !== "ul") { flushList(); list = { tag: "ul", items: [] }; } list.items.push(m[1]); continue; }
    if ((m = t.match(/^\d+\. (.+)$/))) { flushPara(); if (list?.tag !== "ol") { flushList(); list = { tag: "ol", items: [] }; } list.items.push(m[1]); continue; }
    flushList();
    para.push(t);
    void hard;
  }
  flushPara(); flushList();
  return out.join("\n");
}

export function buildPages({ source = readFileSync(SOURCE, "utf8"), address = "" } = {}) {
  const parts = source.split(/^# (.+)$/m); // ["", heading, body, heading, body...]
  const bodies = {};
  for (let i = 1; i < parts.length; i += 2) bodies[parts[i].trim()] = parts[i + 1];
  const result = {};
  for (const p of PAGE_MAP) {
    SELF = `/${p.slug}`;
    let body = bodies[p.heading];
    if (!body) throw new Error(`Policy not found in source: ${p.heading}`);
    const lines = body.replace(/\s+$/, "").split("\n").map((l) => {
      if (l.includes(ADDRESS_PLACEHOLDER)) return address ? l.replace(ADDRESS_PLACEHOLDER, address) : null;
      return l;
    }).filter((l) => l !== null);
    result[p.slug] = { name: p.heading, seoTitle: p.seoTitle, seoDescription: p.seoDescription, excerpt: "", content: render(lines) };
  }
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const i = process.argv.indexOf("--address");
  console.log(JSON.stringify(buildPages({ address: i > -1 ? process.argv[i + 1] : "" }), null, 2));
}

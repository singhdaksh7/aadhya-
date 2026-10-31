import React from "react";
import { footerUrlError } from "../../lib/footerUrls";
import { fInputCls, fLabelCls, newId, renumber, moveItem, FieldError, RowControls, SectionCard, AddButton } from "./FooterEditorBits";

export const MAX_FOOTER_COLUMNS = 8;
const MAX_LINKS_PER_COLUMN = 30;

const TYPE_LABELS = {
  CUSTOM_URL: "Custom URL",
  CMS_PAGE: "CMS page",
  CATEGORY: "Category (slug)",
  COLLECTION: "Collection (slug)",
  GIFTING: "Gifting page",
};

/** Add / remove / reorder / enable footer link columns and the links inside each one. */
export default function FooterColumnsEditor({ columns, onChange, pages = [] }) {
  const list = Array.isArray(columns) ? columns : [];
  const setCol = (i, patch) => onChange(list.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const setLinks = (i, links) => setCol(i, { links });

  return (
    <SectionCard
      title="Link Columns"
      hint={`Up to ${MAX_FOOTER_COLUMNS} columns (e.g. Policies, Help, Top Categories). If none are saved the storefront shows its built-in Shop / Help / Company columns.`}
      action={
        <AddButton
          disabled={list.length >= MAX_FOOTER_COLUMNS}
          onClick={() => onChange(renumber([...list, { id: newId("fc"), title: "New column", enabled: true, links: [] }]))}
        >
          + Add column
        </AddButton>
      }
    >
      {list.length === 0 && <p className="text-xs text-charcoal-soft">No custom columns.</p>}
      {list.map((col, i) => {
        const links = Array.isArray(col.links) ? col.links : [];
        return (
          <div key={col.id || i} className="space-y-2 rounded-lg border border-charcoal/10 bg-white p-3" data-testid="footer-column-editor">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[10rem] flex-1">
                <label className={fLabelCls}>Column title</label>
                <input
                  aria-label={`Column ${i + 1} title`}
                  className={fInputCls}
                  maxLength={100}
                  value={col.title || ""}
                  onChange={(e) => setCol(i, { title: e.target.value })}
                />
              </div>
              <RowControls
                name={`column ${i + 1}`}
                index={i}
                total={list.length}
                enabled={col.enabled}
                onMove={(d) => onChange(renumber(moveItem(list, i, d)))}
                onToggle={(v) => setCol(i, { enabled: v })}
                onDelete={() => onChange(renumber(list.filter((_, idx) => idx !== i)))}
              />
            </div>

            <div className="space-y-2 pl-2 sm:pl-4">
              {links.map((link, j) => {
                const type = link.type || "CUSTOM_URL";
                const setLink = (patch) => setLinks(i, links.map((l, k) => (k === j ? { ...l, ...patch } : l)));
                const err = type === "CUSTOM_URL" ? footerUrlError(link.url) : "";
                return (
                  <div key={j} className="flex flex-wrap items-start gap-2" data-testid="footer-column-link">
                    <input
                      aria-label={`Column ${i + 1} link ${j + 1} label`}
                      placeholder="Label"
                      maxLength={100}
                      className={`${fInputCls} sm:w-40 sm:flex-none`}
                      value={link.label || ""}
                      onChange={(e) => setLink({ label: e.target.value })}
                    />
                    <select
                      aria-label={`Column ${i + 1} link ${j + 1} type`}
                      className={`${fInputCls} sm:w-36 sm:flex-none`}
                      value={type}
                      onChange={(e) => setLink({ type: e.target.value, url: "", targetId: "" })}
                    >
                      {Object.entries(TYPE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>
                          {l}
                        </option>
                      ))}
                    </select>
                    <div className="min-w-[10rem] flex-1">
                      {type === "CUSTOM_URL" && (
                        <input
                          aria-label={`Column ${i + 1} link ${j + 1} url`}
                          placeholder="/page or https://..."
                          maxLength={500}
                          className={fInputCls}
                          value={link.url || ""}
                          onChange={(e) => setLink({ url: e.target.value })}
                        />
                      )}
                      {type === "CMS_PAGE" && (
                        <select
                          aria-label={`Column ${i + 1} link ${j + 1} page`}
                          className={fInputCls}
                          value={link.targetId || ""}
                          onChange={(e) => setLink({ targetId: e.target.value })}
                        >
                          <option value="">-- Select CMS page --</option>
                          {pages.map((p) => (
                            <option key={p.id} value={p.slug}>
                              {p.name} ({p.slug})
                            </option>
                          ))}
                        </select>
                      )}
                      {type === "GIFTING" && (
                        <p className="py-2 text-xs text-charcoal-soft">Links to the Gifting page (/gifting).</p>
                      )}
                      {(type === "CATEGORY" || type === "COLLECTION") && (
                        <input
                          aria-label={`Column ${i + 1} link ${j + 1} slug`}
                          placeholder="slug"
                          className={fInputCls}
                          value={link.targetId || ""}
                          onChange={(e) => setLink({ targetId: e.target.value })}
                        />
                      )}
                      <FieldError message={err} />
                    </div>
                    <RowControls
                      name={`column ${i + 1} link ${j + 1}`}
                      index={j}
                      total={links.length}
                      onMove={(d) => setLinks(i, moveItem(links, j, d))}
                      onDelete={() => setLinks(i, links.filter((_, k) => k !== j))}
                    />
                  </div>
                );
              })}
              <AddButton
                disabled={links.length >= MAX_LINKS_PER_COLUMN}
                onClick={() => setLinks(i, [...links, { label: "", type: "CUSTOM_URL", url: "" }])}
              >
                + Add link
              </AddButton>
            </div>
          </div>
        );
      })}
    </SectionCard>
  );
}

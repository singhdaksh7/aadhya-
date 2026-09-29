import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  adminListCategories,
  adminGetProduct,
  adminCreateProduct,
  adminUpdateProduct,
  adminUploadProductImage,
  adminDeleteProductImage,
  adminSetPrimaryImage,
  adminReorderImages,
  resolveProductImageUrl,
  adminGetInvoiceSettings,
} from "../../lib/api";
import BookFormatsTab from "./BookFormatsTab";
import { Button } from "../../components/ui";
import { LoadingNotice } from "../../components/StateNotice";
import ImagePickerInput from "../../components/admin/ImagePickerInput";

const BOOK_FIELDS = [
  ["author", "Author", "text"],
  ["isbn", "ISBN", "text"],
  ["publisher", "Publisher", "text"],
  ["language", "Language", "text"],
  ["pageCount", "Pages", "number"],
  ["edition", "Edition", "text"],
  ["publicationYear", "Publication Year", "number"],
];

const TABS = [
  { id: "BASIC", label: "Basic" },
  { id: "PRICING", label: "Pricing" },
  { id: "INVENTORY", label: "Inventory" },
  { id: "MEDIA", label: "Media" },
  { id: "CONTENT", label: "Content" },
  { id: "FLAGS", label: "Flags" },
  { id: "SEO", label: "SEO" },
];

const emptyForm = {
  name: "",
  slug: "",
  productType: "PHYSICAL",
  categoryId: "",
  sku: "",
  brand: "",
  tags: "",
  price: "",
  salePrice: "",
  mrp: "",
  costPrice: "",
  stockQuantity: "0",
  lowStockThreshold: "",
  trackInventory: true,
  isFeatured: false,
  isBestSeller: false,
  isNewArrival: false,
  isTrending: false,
  isActive: true,
  shortDescription: "",
  description: "",
  materials: "",
  dimensions: "",
  careInstructions: "",
  whatsIncluded: "",
  shippingInformation: "",
  seoTitle: "",
  seoDescription: "",
  ogImage: "",
  hsnCode: "",
  gstRate: "",
  unit: "PCS",
  taxPricingMode: "",
  invoiceName: "",
  bookDetail: { author: "", isbn: "", publisher: "", language: "", pageCount: "", edition: "", publicationYear: "" },
};

const HSN_PATTERN = /^[0-9]{4,8}$/;
const GST_RATE_OPTIONS = [0, 5, 12, 18, 28];
const UNIT_OPTIONS = ["PCS", "SET", "PAIR", "KG", "GM", "MTR", "BOX"];

export default function AdminProductForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState("BASIC");
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [images, setImages] = useState([]);
  const [status, setStatus] = useState(isEdit ? "loading" : "ready");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [gstEnabled, setGstEnabled] = useState(false);

  useEffect(() => {
    adminListCategories().then((res) => setCategories(res.data.filter((c) => c.isActive)));
    adminGetInvoiceSettings()
      .then((res) => setGstEnabled(Boolean(res.data.gstEnabled)))
      .catch(() => {});
  }, []);

  const taxIncomplete = gstEnabled && form.productType === "PHYSICAL" && (!form.hsnCode.trim() || form.gstRate === "");

  useEffect(() => {
    if (!isEdit) return;
    adminGetProduct(id)
      .then((res) => {
        const p = res.data;
        setForm({
          name: p.name,
          slug: p.slug,
          productType: p.productType,
          categoryId: p.categoryId,
          sku: p.sku || "",
          brand: p.brand || "",
          tags: Array.isArray(p.tags) ? p.tags.join(", ") : "",
          price: String(p.price),
          salePrice: p.salePrice != null ? String(p.salePrice) : "",
          mrp: p.mrp != null ? String(p.mrp) : "",
          costPrice: p.costPrice != null ? String(p.costPrice) : "",
          stockQuantity: String(p.stockQuantity),
          lowStockThreshold: p.lowStockThreshold != null ? String(p.lowStockThreshold) : "",
          trackInventory: p.trackInventory,
          isFeatured: p.isFeatured,
          isBestSeller: p.isBestSeller,
          isNewArrival: p.isNewArrival,
          isTrending: p.isTrending || false,
          isActive: p.isActive,
          shortDescription: p.shortDescription || "",
          description: p.description || "",
          materials: p.materials || "",
          dimensions: p.dimensions || "",
          careInstructions: p.careInstructions || "",
          whatsIncluded: p.whatsIncluded || "",
          shippingInformation: p.shippingInformation || "",
          seoTitle: p.seoTitle || "",
          seoDescription: p.seoDescription || "",
          ogImage: p.ogImage || "",
          hsnCode: p.hsnCode || "",
          gstRate: p.gstRate != null ? String(p.gstRate) : "",
          unit: p.unit || "PCS",
          taxPricingMode: p.taxPricingMode || "",
          invoiceName: p.invoiceName || "",
          bookDetail: {
            author: p.bookDetail?.author || "",
            isbn: p.bookDetail?.isbn || "",
            publisher: p.bookDetail?.publisher || "",
            language: p.bookDetail?.language || "",
            pageCount: p.bookDetail?.pageCount ?? "",
            edition: p.bookDetail?.edition || "",
            publicationYear: p.bookDetail?.publicationYear ?? "",
          },
        });
        setImages(p.images || []);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, [id, isEdit]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const setBook = (key, value) => setForm((f) => ({ ...f, bookDetail: { ...f.bookDetail, [key]: value } }));

  const buildPayload = () => {
    const payload = {
      name: form.name,
      slug: form.slug || undefined,
      productType: form.productType,
      categoryId: form.categoryId,
      sku: form.sku || null,
      brand: form.brand || null,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
      price: Number(form.price),
      salePrice: form.salePrice === "" ? null : Number(form.salePrice),
      mrp: form.mrp === "" ? null : Number(form.mrp),
      costPrice: form.costPrice === "" ? null : Number(form.costPrice),
      stockQuantity: Number(form.stockQuantity),
      lowStockThreshold: form.lowStockThreshold === "" ? null : Number(form.lowStockThreshold),
      trackInventory: form.trackInventory,
      isFeatured: form.isFeatured,
      isBestSeller: form.isBestSeller,
      isNewArrival: form.isNewArrival,
      isTrending: form.isTrending,
      isActive: form.isActive,
      shortDescription: form.shortDescription || null,
      description: form.description || null,
      materials: form.materials || null,
      dimensions: form.dimensions || null,
      careInstructions: form.careInstructions || null,
      whatsIncluded: form.whatsIncluded || null,
      shippingInformation: form.shippingInformation || null,
      seoTitle: form.seoTitle || null,
      seoDescription: form.seoDescription || null,
      ogImage: form.ogImage || null,
      hsnCode: form.hsnCode ? form.hsnCode.trim() : null,
      gstRate: form.gstRate === "" ? null : Number(form.gstRate),
      unit: form.unit || "PCS",
      ...(form.taxPricingMode ? { taxPricingMode: form.taxPricingMode } : {}),
      invoiceName: form.invoiceName ? form.invoiceName.trim() : null,
    };
    if (form.productType === "BOOK") {
      payload.bookDetail = {
        author: form.bookDetail.author || null,
        isbn: form.bookDetail.isbn || null,
        publisher: form.bookDetail.publisher || null,
        language: form.bookDetail.language || null,
        pageCount: form.bookDetail.pageCount === "" ? null : Number(form.bookDetail.pageCount),
        edition: form.bookDetail.edition || null,
        publicationYear: form.bookDetail.publicationYear === "" ? null : Number(form.bookDetail.publicationYear),
      };
    }
    return payload;
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await adminUpdateProduct(id, buildPayload());
      } else {
        const res = await adminCreateProduct(buildPayload());
        navigate(`/admin/products/${res.data.id}`, { replace: true });
        return;
      }
      navigate("/admin/products");
    } catch (err) {
      setError(err.message || "Could not save this product.");
    } finally {
      setSaving(false);
    }
  };

  const onUploadImage = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !isEdit) return;
    const res = await adminUploadProductImage(id, file, { altText: form.name });
    setImages((prev) => [...prev, res.data]);
  };

  const onDeleteImage = async (imageId) => {
    await adminDeleteProductImage(id, imageId);
    setImages((prev) => prev.filter((i) => i.id !== imageId));
  };

  const onSetPrimary = async (imageId) => {
    await adminSetPrimaryImage(id, imageId);
    setImages((prev) => prev.map((i) => ({ ...i, isPrimary: i.id === imageId })));
  };

  const moveImage = async (index, direction) => {
    const next = [...images];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setImages(next);
    await adminReorderImages(id, next.map((i) => i.id));
  };

  if (status === "loading") return <LoadingNotice />;

  return (
    <div>
      <div className="admin-page-header">
        <div>
          <p className="admin-page-header__eyebrow">Catalog</p>
          <h1 className="admin-page-header__title">{isEdit ? "Edit Product" : "Add Product"}</h1>
        </div>
      </div>

      <div className="mt-2 flex gap-1.5 overflow-x-auto border-b border-charcoal/10 pb-2">
        {[...TABS, ...(isEdit && form.productType === "BOOK" ? [{ id: "BOOK_FORMATS", label: "Book Formats" }] : [])].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`admin-btn whitespace-nowrap ${
              activeTab === tab.id ? "admin-btn--accent" : "admin-btn--ghost"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-5 max-w-3xl space-y-4">
        {/* BASIC SECTION */}
        <section id="sec-basic" className="admin-card space-y-4 p-5">
          <h2 className="admin-card__title border-b border-charcoal/10 pb-2">Basic Details</h2>
          <Field label="Name">
            <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Slug (optional — auto-generated from name)">
            <input value={form.slug} onChange={(e) => set("slug", e.target.value)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Type">
              <select value={form.productType} onChange={(e) => set("productType", e.target.value)} className={inputCls}>
                <option value="PHYSICAL">Physical</option>
                <option value="BOOK">Book</option>
              </select>
            </Field>
            <Field label="Category">
              <select required value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)} className={inputCls}>
                <option value="" disabled>
                  Select…
                </option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="SKU">
              <input value={form.sku} onChange={(e) => set("sku", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Brand">
              <input value={form.brand} onChange={(e) => set("brand", e.target.value)} className={inputCls} />
            </Field>
          </div>
          <Field label="Tags (comma-separated)">
            <input value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="handcrafted, decor, brass" className={inputCls} />
          </Field>
        </section>

        {/* PRICING SECTION */}
        <section id="sec-pricing" className="admin-card space-y-4 p-5">
          <h2 className="admin-card__title border-b border-charcoal/10 pb-2">Pricing</h2>
          <div className="grid grid-cols-3 gap-4">
            <Field label="Price">
              <input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Sale Price">
              <input type="number" min="0" step="0.01" value={form.salePrice} onChange={(e) => set("salePrice", e.target.value)} className={inputCls} />
            </Field>
            <Field label="MRP / Compare At Price">
              <input type="number" min="0" step="0.01" value={form.mrp} onChange={(e) => set("mrp", e.target.value)} className={inputCls} />
            </Field>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <Field label="Cost Price (Admin Confidential)">
              <input type="number" min="0" step="0.01" value={form.costPrice} onChange={(e) => set("costPrice", e.target.value)} className={inputCls} />
            </Field>
            <p className="mt-1 text-xs text-amber-700">Cost price is strictly hidden from public API responses.</p>
          </div>
        </section>

        {/* INVENTORY SECTION */}
        <section id="sec-inventory" className="admin-card space-y-4 p-5">
          <h2 className="admin-card__title border-b border-charcoal/10 pb-2">Inventory Management</h2>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Stock Quantity">
              <input type="number" min="0" value={form.stockQuantity} onChange={(e) => set("stockQuantity", e.target.value)} className={inputCls} />
            </Field>
            <Field label="Low Stock Threshold">
              <input type="number" min="0" value={form.lowStockThreshold} onChange={(e) => set("lowStockThreshold", e.target.value)} placeholder="e.g. 5" className={inputCls} />
            </Field>
          </div>
          <div className="flex items-center gap-4 pt-2">
            <Checkbox label="Track Inventory" checked={form.trackInventory} onChange={(v) => set("trackInventory", v)} />
          </div>
        </section>

        {/* MEDIA SECTION */}
        <section id="sec-media" className="admin-card space-y-4 p-5">
          <h2 className="admin-card__title border-b border-charcoal/10 pb-2">Media & Gallery</h2>
          {isEdit ? (
            <fieldset className="rounded-2xl border border-charcoal/10 p-4">
              <legend className="px-2 text-xs font-medium uppercase tracking-wide text-charcoal-soft">Product Images</legend>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onUploadImage} className="text-sm" />
              {images.length > 0 && (
                <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {images.map((img, idx) => (
                    <li key={img.id} className="relative rounded-xl border border-charcoal/10 p-2">
                      <img src={resolveProductImageUrl(img.url)} alt={img.altText || ""} className="aspect-square w-full rounded-lg object-cover" />
                      {img.isPrimary && (
                        <span className="absolute left-3 top-3 rounded-full bg-terracotta px-2 py-0.5 text-[10px] text-ivory font-medium">
                          Primary
                        </span>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                        {!img.isPrimary && (
                          <button type="button" onClick={() => onSetPrimary(img.id)} className="underline">
                            Make Primary
                          </button>
                        )}
                        <button type="button" onClick={() => moveImage(idx, -1)} className="underline">
                          ↑
                        </button>
                        <button type="button" onClick={() => moveImage(idx, 1)} className="underline">
                          ↓
                        </button>
                        <button type="button" onClick={() => onDeleteImage(img.id)} className="text-terracotta underline">
                          Delete
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </fieldset>
          ) : (
            <p className="text-sm text-charcoal-soft">Save this product first to upload and manage gallery images.</p>
          )}
        </section>

        {/* CONTENT SECTION */}
        <section id="sec-content" className="admin-card space-y-4 p-5">
          <h2 className="admin-card__title border-b border-charcoal/10 pb-2">Product Content & Specs</h2>
          <Field label="Short Description">
            <input value={form.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Description">
            <textarea rows={4} value={form.description} onChange={(e) => set("description", e.target.value)} className={inputCls} />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Materials">
              <input value={form.materials} onChange={(e) => set("materials", e.target.value)} placeholder="e.g. 100% Solid Brass" className={inputCls} />
            </Field>
            <Field label="Dimensions">
              <input value={form.dimensions} onChange={(e) => set("dimensions", e.target.value)} placeholder="e.g. 12 x 8 x 4 inches" className={inputCls} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Care Instructions">
              <input value={form.careInstructions} onChange={(e) => set("careInstructions", e.target.value)} placeholder="Wipe clean with a damp cloth" className={inputCls} />
            </Field>
            <Field label="What's Included">
              <input value={form.whatsIncluded} onChange={(e) => set("whatsIncluded", e.target.value)} placeholder="1x Vase, 1x Care Guide" className={inputCls} />
            </Field>
          </div>
          <Field label="Shipping Information">
            <input value={form.shippingInformation} onChange={(e) => set("shippingInformation", e.target.value)} placeholder="Dispatched in 2-3 business days" className={inputCls} />
          </Field>

          <fieldset className="rounded-2xl border border-charcoal/10 p-4">
            <legend className="px-2 text-xs font-medium uppercase tracking-wide text-charcoal-soft">Tax / GST Details</legend>
            {taxIncomplete && (
              <p className="mb-3 inline-block rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
                Tax details incomplete
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <Field label="HSN Code">
                <input
                  value={form.hsnCode}
                  onChange={(e) => set("hsnCode", e.target.value)}
                  placeholder="e.g. 6802"
                  className={inputCls}
                />
                {form.hsnCode && !HSN_PATTERN.test(form.hsnCode.trim()) && (
                  <p className="mt-1 text-xs text-terracotta">HSN code must be 4-8 digits.</p>
                )}
              </Field>
              <Field label="GST Rate">
                <select value={form.gstRate} onChange={(e) => set("gstRate", e.target.value)} className={inputCls}>
                  <option value="">Not set</option>
                  {GST_RATE_OPTIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}%
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <Field label="Unit">
                <select value={form.unit} onChange={(e) => set("unit", e.target.value)} className={inputCls}>
                  {UNIT_OPTIONS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tax Pricing Mode (blank = use global default)">
                <select value={form.taxPricingMode} onChange={(e) => set("taxPricingMode", e.target.value)} className={inputCls}>
                  <option value="">Inherit global default</option>
                  <option value="TAX_EXCLUSIVE">Tax Exclusive</option>
                  <option value="TAX_INCLUSIVE">Tax Inclusive</option>
                </select>
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Invoice Product Name (optional override)">
                <input
                  value={form.invoiceName}
                  onChange={(e) => set("invoiceName", e.target.value)}
                  placeholder="Name printed on invoice, defaults to product name"
                  className={inputCls}
                />
              </Field>
            </div>
          </fieldset>

          {form.productType === "BOOK" && (
            <fieldset className="rounded-2xl border border-charcoal/10 p-4">
              <legend className="px-2 text-xs font-medium uppercase tracking-wide text-charcoal-soft">Book Specifications</legend>
              <div className="grid grid-cols-2 gap-4">
                {BOOK_FIELDS.map(([key, label, type]) => (
                  <Field key={key} label={label}>
                    <input
                      type={type}
                      value={form.bookDetail[key]}
                      onChange={(e) => setBook(key, e.target.value)}
                      className={inputCls}
                    />
                  </Field>
                ))}
              </div>
            </fieldset>
          )}
        </section>

        {/* BOOK FORMATS SECTION */}
        {isEdit && form.productType === "BOOK" && (
          <section id="sec-book-formats" className="admin-card space-y-4 p-5">
            <h2 className="admin-card__title border-b border-charcoal/10 pb-2">Book Formats</h2>
            <BookFormatsTab productId={id} />
          </section>
        )}

        {/* FLAGS SECTION */}
        <section id="sec-flags" className="admin-card space-y-4 p-5">
          <h2 className="admin-card__title border-b border-charcoal/10 pb-2">Merchandising Flags</h2>
          <div className="flex flex-col gap-3 rounded-2xl border border-charcoal/10 p-4">
            <Checkbox label="Active (Visible in Storefront)" checked={form.isActive} onChange={(v) => set("isActive", v)} />
            <Checkbox label="Featured Product" checked={form.isFeatured} onChange={(v) => set("isFeatured", v)} />
            <Checkbox label="Best Seller" checked={form.isBestSeller} onChange={(v) => set("isBestSeller", v)} />
            <Checkbox label="New Arrival" checked={form.isNewArrival} onChange={(v) => set("isNewArrival", v)} />
            <Checkbox label="Trending Now" checked={form.isTrending} onChange={(v) => set("isTrending", v)} />
          </div>
        </section>

        {/* SEO SECTION */}
        <section id="sec-seo" className="admin-card space-y-4 p-5">
          <h2 className="admin-card__title border-b border-charcoal/10 pb-2">SEO & Social Meta</h2>
          <Field label="SEO Title">
            <input value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} className={inputCls} />
          </Field>
          <Field label="SEO Description">
            <textarea rows={2} value={form.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} className={inputCls} />
          </Field>
          <ImagePickerInput
            label="OG Image"
            value={form.ogImage}
            onChange={(url) => set("ogImage", url)}
            pickerTitle="Select OG image"
            inputClassName={inputCls}
            enableCrop
            aspectOptions={["wide", "square", "free"]}
          />
        </section>

        {error && <p className="text-sm text-terracotta">{error}</p>}

        <div className="admin-sticky-actions">
          <Button type="button" variant="secondary" onClick={() => navigate("/admin/products")}>
            Cancel
          </Button>
          <Button disabled={saving}>{saving ? "Saving…" : isEdit ? "Save Changes" : "Create Product"}</Button>
        </div>
      </form>
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-charcoal/15 px-4 py-2.5 text-sm focus:border-charcoal/40 focus:outline-none";

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-charcoal-soft">{label}</span>
      {children}
    </label>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2 text-sm text-charcoal">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

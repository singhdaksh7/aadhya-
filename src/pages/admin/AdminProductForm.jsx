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
} from "../../lib/api";
import { Button } from "../../components/ui";
import { LoadingNotice } from "../../components/StateNotice";

const BOOK_FIELDS = [
  ["author", "Author", "text"],
  ["isbn", "ISBN", "text"],
  ["publisher", "Publisher", "text"],
  ["language", "Language", "text"],
  ["pageCount", "Pages", "number"],
  ["edition", "Edition", "text"],
  ["publicationYear", "Publication Year", "number"],
];

const emptyForm = {
  name: "",
  slug: "",
  productType: "PHYSICAL",
  categoryId: "",
  sku: "",
  price: "",
  salePrice: "",
  stockQuantity: "0",
  trackInventory: true,
  isFeatured: false,
  isBestSeller: false,
  isNewArrival: false,
  isActive: true,
  shortDescription: "",
  description: "",
  bookDetail: { author: "", isbn: "", publisher: "", language: "", pageCount: "", edition: "", publicationYear: "" },
};

export default function AdminProductForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [images, setImages] = useState([]);
  const [status, setStatus] = useState(isEdit ? "loading" : "ready");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    adminListCategories().then((res) => setCategories(res.data.filter((c) => c.isActive)));
  }, []);

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
          price: String(p.price),
          salePrice: p.salePrice != null ? String(p.salePrice) : "",
          stockQuantity: String(p.stockQuantity),
          trackInventory: p.trackInventory,
          isFeatured: p.isFeatured,
          isBestSeller: p.isBestSeller,
          isNewArrival: p.isNewArrival,
          isActive: p.isActive,
          shortDescription: p.shortDescription || "",
          description: p.description || "",
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
      price: Number(form.price),
      salePrice: form.salePrice === "" ? null : Number(form.salePrice),
      stockQuantity: Number(form.stockQuantity),
      trackInventory: form.trackInventory,
      isFeatured: form.isFeatured,
      isBestSeller: form.isBestSeller,
      isNewArrival: form.isNewArrival,
      isActive: form.isActive,
      shortDescription: form.shortDescription || null,
      description: form.description || null,
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
      <h1 className="font-serif-display text-2xl text-charcoal">{isEdit ? "Edit Product" : "Add Product"}</h1>

      <form onSubmit={onSubmit} className="mt-6 max-w-2xl space-y-5">
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

        <div className="grid grid-cols-3 gap-4">
          <Field label="SKU">
            <input value={form.sku} onChange={(e) => set("sku", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Price">
            <input required type="number" min="0" step="0.01" value={form.price} onChange={(e) => set("price", e.target.value)} className={inputCls} />
          </Field>
          <Field label="Sale Price">
            <input type="number" min="0" step="0.01" value={form.salePrice} onChange={(e) => set("salePrice", e.target.value)} className={inputCls} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Stock Quantity">
            <input type="number" min="0" value={form.stockQuantity} onChange={(e) => set("stockQuantity", e.target.value)} className={inputCls} />
          </Field>
          <div className="flex items-end gap-4 pb-2">
            <Checkbox label="Track Inventory" checked={form.trackInventory} onChange={(v) => set("trackInventory", v)} />
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          <Checkbox label="Featured" checked={form.isFeatured} onChange={(v) => set("isFeatured", v)} />
          <Checkbox label="Best Seller" checked={form.isBestSeller} onChange={(v) => set("isBestSeller", v)} />
          <Checkbox label="New Arrival" checked={form.isNewArrival} onChange={(v) => set("isNewArrival", v)} />
          <Checkbox label="Active" checked={form.isActive} onChange={(v) => set("isActive", v)} />
        </div>

        <Field label="Short Description">
          <input value={form.shortDescription} onChange={(e) => set("shortDescription", e.target.value)} className={inputCls} />
        </Field>
        <Field label="Description">
          <textarea rows={5} value={form.description} onChange={(e) => set("description", e.target.value)} className={inputCls} />
        </Field>

        {form.productType === "BOOK" && (
          <fieldset className="rounded-2xl border border-charcoal/10 p-4">
            <legend className="px-2 text-xs font-medium uppercase tracking-wide text-charcoal-soft">Book Details</legend>
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

        {isEdit && (
          <fieldset className="rounded-2xl border border-charcoal/10 p-4">
            <legend className="px-2 text-xs font-medium uppercase tracking-wide text-charcoal-soft">Images</legend>
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onUploadImage} className="text-sm" />
            {images.length > 0 && (
              <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {images.map((img, idx) => (
                  <li key={img.id} className="relative rounded-xl border border-charcoal/10 p-2">
                    <img src={resolveProductImageUrl(img.url)} alt={img.altText || ""} className="aspect-square w-full rounded-lg object-cover" />
                    {img.isPrimary && (
                      <span className="absolute left-3 top-3 rounded-full bg-terracotta px-2 py-0.5 text-[10px] text-ivory">
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
        )}

        {error && <p className="text-sm text-terracotta">{error}</p>}

        <div className="flex gap-3">
          <Button disabled={saving}>{saving ? "Saving…" : isEdit ? "Save Changes" : "Create Product"}</Button>
          <Button type="button" variant="secondary" onClick={() => navigate("/admin/products")}>
            Cancel
          </Button>
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

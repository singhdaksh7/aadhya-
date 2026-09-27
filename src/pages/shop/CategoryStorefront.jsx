import { useParams } from "react-router-dom";
import ProductCatalog from "./ProductCatalog";
import { canonicalUrl, jsonLdProps } from "../../lib/seo";

export default function CategoryStorefront() {
  const { slug } = useParams();
  const title = slug
    .split("-")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: canonicalUrl("/") },
      { "@type": "ListItem", position: 2, name: "Shop", item: canonicalUrl("/shop") },
      { "@type": "ListItem", position: 3, name: title, item: canonicalUrl(`/shop/category/${slug}`) },
    ],
  };

  return (
    <>
      <title>{`${title} — Aadya Society Shop`}</title>
      <meta name="description" content={`Shop ${title} from Aadya Society's Tushaqsa Handcrafted collection.`} />
      <link rel="canonical" href={canonicalUrl(`/shop/category/${slug}`)} />
      <script type="application/ld+json" {...jsonLdProps(breadcrumbJsonLd)} />
      <ProductCatalog
        key={slug}
        eyebrow="Tushaqsa Handcrafted"
        title={title}
        description={`Browse the ${title} collection.`}
        lockedCategory={slug}
      />
    </>
  );
}

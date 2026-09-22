import { useParams } from "react-router-dom";
import ProductCatalog from "./ProductCatalog";

export default function CategoryStorefront() {
  const { slug } = useParams();
  const title = slug
    .split("-")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");

  return (
    <>
      <title>{`${title} — Aadya Society Shop`}</title>
      <meta name="description" content={`Shop ${title} from Aadya Society's Tushaqsa Handcrafted collection.`} />
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

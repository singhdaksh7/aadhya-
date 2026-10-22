import ProductCatalog from "./shop/ProductCatalog";

export default function Shop() {
  return (
    <>
      <title>Shop — Aadya</title>
      <meta
        name="description"
        content="Handcrafted home decor and accessories, thoughtfully made — shop the full Aadya catalog."
      />
      <ProductCatalog
        eyebrow="Shop"
        title="Thoughtfully Handcrafted for Everyday Spaces"
        description="Home decor and handcrafted accessories — browse the full Aadya catalog."
        showCategoryFilter
      />
    </>
  );
}

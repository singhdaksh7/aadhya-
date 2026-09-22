import ProductCatalog from "./shop/ProductCatalog";

export default function Shop() {
  return (
    <>
      <title>Shop — Aadya Society</title>
      <meta
        name="description"
        content="Tushaqsa Handcrafted home decor and accessories, thoughtfully made — shop the full Aadya Society catalog."
      />
      <ProductCatalog
        eyebrow="Tushaqsa Handcrafted"
        title="Thoughtfully Handcrafted for Everyday Spaces"
        description="Home decor, handcrafted accessories and books — browse the full Aadya Society catalog."
        showCategoryFilter
      />
    </>
  );
}

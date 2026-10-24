import ProductCatalog from "./shop/ProductCatalog";

export default function Shop() {
  return (
    <>
      <title>Shop | Tushaqsa</title>
      <meta
        name="description"
        content="Handcrafted home decor and accessories, thoughtfully made — shop the full Tushaqsa catalog."
      />
      <ProductCatalog
        eyebrow="Shop"
        title="Thoughtfully Handcrafted for Everyday Spaces"
        description="Home decor and handcrafted accessories — browse the full Tushaqsa catalog."
        showCategoryFilter
      />
    </>
  );
}

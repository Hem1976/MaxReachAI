import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { ProductsBrowser } from "@/components/products/products-browser";
import { products } from "@/lib/products";

export const metadata: Metadata = { title: "Products" };

export default function ProductsPage() {
  return (
    <div className="flex flex-col gap-8 px-6 py-8 lg:px-10 lg:py-10">
      <PageHeader
        title="Products"
        description="What Maxpro sells. The AI only uses facts from this list."
      />
      <ProductsBrowser products={products} />
    </div>
  );
}

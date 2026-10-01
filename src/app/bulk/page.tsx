import type { Metadata } from "next";

import { BulkWorkspace } from "@/components/bulk/bulk-workspace";
import { listContactLists } from "@/lib/crm/lists";

export const metadata: Metadata = { title: "Bulk" };
export const dynamic = "force-dynamic";

export default function BulkPage() {
  const lists = listContactLists(12);

  return <BulkWorkspace initialLists={lists} />;
}

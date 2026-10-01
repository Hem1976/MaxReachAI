import type { Metadata } from "next";

import { HistoryBrowser } from "@/components/history/history-browser";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { countHistory, listHistory } from "@/lib/db/history";

export const metadata: Metadata = { title: "History" };
export const dynamic = "force-dynamic";

export default function HistoryPage() {
  const records = listHistory({ limit: 200 });
  const total = countHistory();

  return (
    <div className="flex flex-col gap-8 px-6 py-8 lg:px-10 lg:py-10">
      <PageHeader
        title="History"
        description="Emails you already generated. Search, copy, or open one again in Generate."
        actions={
          total > 0 ? (
            <Badge variant="outline">{total} saved</Badge>
          ) : null
        }
      />
      <HistoryBrowser initial={records} />
    </div>
  );
}

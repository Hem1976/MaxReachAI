import type { Metadata } from "next";

import { CompaniesWorkspace } from "@/components/companies/companies-workspace";
import { listCompanies } from "@/lib/crm/companies";

export const metadata: Metadata = { title: "Companies" };
export const dynamic = "force-dynamic";

export default function CompaniesPage() {
  const companies = listCompanies();
  return <CompaniesWorkspace initialCompanies={companies} />;
}

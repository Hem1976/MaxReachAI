import type { Metadata } from "next";

import { PageHeader } from "@/components/page-header";
import { TemplatesBrowser } from "@/components/templates/templates-browser";
import { readSettings } from "@/lib/db/settings";
import { emailTemplates, templatesGroupedForPicker } from "@/lib/templates/catalog.server";

export const metadata: Metadata = { title: "Templates" };

export default function TemplatesPage() {
  const settings = readSettings();

  return (
    <div className="flex flex-col gap-8 px-6 py-8 lg:px-10 lg:py-10">
      <PageHeader
        title="Templates"
        description={`How the email looks. Introduction templates first, then Problem to solution. ${emailTemplates.length} available.`}
      />
      <TemplatesBrowser
        themeId={settings.themeId ?? "graphite"}
        templates={emailTemplates}
        templatesByCategory={templatesGroupedForPicker()}
      />
    </div>
  );
}

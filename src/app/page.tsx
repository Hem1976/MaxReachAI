import { GeneratorWorkspace } from "@/components/generator/generator-workspace";
import { getStatus } from "@/lib/ai/ollama";
import { getHistory } from "@/lib/db/history";
import { readSettings } from "@/lib/db/settings";
import { getProduct } from "@/lib/products";
import { getTemplateOrDefault } from "@/lib/templates/catalog.server";
import type { AppSettings, HistoryRecord, LeadBrief, ProductSelection } from "@/lib/types";

export const dynamic = "force-dynamic";

function emptyBrief(settings: AppSettings): LeadBrief {
  return {
    company: "",
    website: "",
    contactName: "",
    jobTitle: "",
    industry: "",
    notes: "",
    product: "auto",
    objective: "book-demo",
    tone: settings.defaultTone,
    length: settings.defaultLength,
    templateId: getTemplateOrDefault(settings.defaultTemplateId).id,
  };
}

/** Powers "Regenerate" from History: /?from=<historyId> reloads that brief. */
function briefFromHistory(record: HistoryRecord, settings: AppSettings): LeadBrief {
  const product: ProductSelection = getProduct(record.productId)
    ? (record.productId as ProductSelection)
    : "auto";

  return {
    ...emptyBrief(settings),
    company: record.company,
    website: record.website,
    contactName: record.contactName,
    jobTitle: record.jobTitle,
    industry: record.industry,
    notes: record.notes,
    product,
    objective: record.objective,
    tone: record.tone,
    length: record.length,
    templateId: getTemplateOrDefault(record.templateId).id,
  };
}

export default async function GeneratorPage(props: PageProps<"/">) {
  const { from, template } = await props.searchParams;
  const settings = readSettings();

  const status = await getStatus({
    baseUrl: settings.ollamaBaseUrl,
    model: settings.model,
  });

  const source = typeof from === "string" ? getHistory(from) : undefined;
  const base = source ? briefFromHistory(source, settings) : emptyBrief(settings);

  // "Use template" from the library arrives as /?template=<id>.
  const initialBrief =
    typeof template === "string"
      ? { ...base, templateId: getTemplateOrDefault(template).id }
      : base;

  return (
    <GeneratorWorkspace
      initialBrief={initialBrief}
      initialStatus={status}
      themeId={settings.themeId}
    />
  );
}

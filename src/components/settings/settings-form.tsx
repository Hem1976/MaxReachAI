"use client";

import { useCallback, useState } from "react";
import { Flame, LoaderCircle, Mail, Plug, Save } from "lucide-react";
import { toast } from "sonner";

import { Field, FieldGroup } from "@/components/generator/field";
import { LocalShareCard } from "@/components/settings/local-share-card";
import { LocalModelsPicker } from "@/components/settings/local-models-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AppSettings, OllamaStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export interface PostmarkPreview {
  apiKeyConfigured: boolean;
  effectiveFromName: string;
  effectiveFromEmail: string;
  effectiveMessageStream: string;
  envFromName: string;
  envFromEmail: string;
  envMessageStream: string;
}

export function SettingsForm({
  initialSettings,
  initialStatus,
  postmarkPreview,
}: {
  initialSettings: AppSettings;
  initialStatus: OllamaStatus;
  postmarkPreview: PostmarkPreview;
}) {
  const [settings, setSettings] = useState(initialSettings);
  const [status, setStatus] = useState(initialStatus);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [warming, setWarming] = useState(false);
  const [dirty, setDirty] = useState(false);

  const update = useCallback((patch: Partial<AppSettings>) => {
    setSettings((current) => ({ ...current, ...patch }));
    setDirty(true);
  }, []);

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(settings),
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.issues?.join(" ") ?? payload.error ?? "Save failed.");
      }
      setSettings(payload.settings as AppSettings);
      setDirty(false);
      toast.success("Settings saved");
      await test(false);
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Save failed.");
    } finally {
      setSaving(false);
    }
  }

  async function test(announce = true) {
    setTesting(true);
    try {
      const params = new URLSearchParams({
        baseUrl: settings.ollamaBaseUrl,
        model: settings.model,
      });
      const response = await fetch(`/api/ollama/status?${params}`, {
        cache: "no-store",
      });
      const payload = await response.json();
      const next = payload.status as OllamaStatus;
      setStatus(next);
      if (announce) {
        if (next.connected && !next.message) toast.success("Ollama connected");
        else if (next.connected) toast.warning(next.message ?? "Model not installed");
        else toast.error("Ollama is not reachable");
      }
    } catch {
      if (announce) toast.error("Connection test failed");
    } finally {
      setTesting(false);
    }
  }

  async function warm() {
    setWarming(true);
    try {
      const response = await fetch("/api/ollama/warm", { method: "POST" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.hint ?? payload.error ?? "Warm-up failed.");
      toast.success(
        `Model loaded in ${(payload.elapsedMs / 1000).toFixed(1)}s — the next generation will be faster`,
      );
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Warm-up failed.");
    } finally {
      setWarming(false);
    }
  }

  const healthy = status.connected && !status.message;

  return (
    <div className="flex flex-col gap-6">
      <LocalShareCard />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "size-2 rounded-full",
                  healthy ? "bg-success" : status.connected ? "bg-warning" : "bg-danger",
                )}
              />
              <CardTitle>Ollama</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => void test()} disabled={testing}>
                {testing ? <LoaderCircle className="animate-spin" /> : <Plug />}
                Test connection
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void warm()}
                disabled={warming || !healthy}
              >
                {warming ? <LoaderCircle className="animate-spin" /> : <Flame />}
                Warm up model
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <dl className="grid gap-5 sm:grid-cols-3">
            <div>
              <dt className="eyebrow">Endpoint</dt>
              <dd className="mt-1.5 font-mono text-xs break-all text-foreground">
                {status.baseUrl || settings.ollamaBaseUrl}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Ollama version</dt>
              <dd className="mt-1.5 font-mono text-xs text-foreground">
                {status.version ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="eyebrow">Installed models</dt>
              <dd className="mt-1.5 font-mono text-xs text-foreground">
                {status.models.length || "—"}
              </dd>
            </div>
          </dl>

          {status.message ? (
            <p className="mt-5 rounded-lg border border-border bg-surface-raised px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              {status.message}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Tabs defaultValue="general" className="flex flex-col gap-6">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="postmark">Send email through Postmark</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-0">
          <div className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Model</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <FieldGroup title="Connection">
                  <Field
                    label="Ollama address"
                    htmlFor="baseUrl"
                    hint="Usually leave this"
                  >
                    <Input
                      id="baseUrl"
                      value={settings.ollamaBaseUrl}
                      onChange={(event) => update({ ollamaBaseUrl: event.target.value })}
                      placeholder="http://localhost:11434"
                      spellCheck={false}
                    />
                  </Field>

                  <Field label="Model" htmlFor="model">
                    <Input
                      id="model"
                      value={settings.model}
                      onChange={(event) => update({ model: event.target.value })}
                      placeholder="llama3.2:latest"
                      spellCheck={false}
                    />
                  </Field>

                  {status.models.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {status.models.map((model) => (
                        <button
                          key={model}
                          type="button"
                          onClick={() => update({ model })}
                          className={cn(
                            "rounded-full border px-2.5 py-1 font-mono text-[0.6875rem] transition-colors duration-150 outline-none",
                            "focus-visible:ring-2 focus-visible:ring-[var(--accent-ring)]",
                            settings.model === model
                              ? "border-[rgba(32,164,184,0.35)] bg-accent-soft text-accent"
                              : "border-border bg-surface-raised text-muted-foreground hover:border-border-strong hover:text-foreground",
                          )}
                        >
                          {model}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      No models detected yet. Pick a recommended model below and run its{" "}
                      <span className="font-mono text-foreground">ollama pull</span> command,
                      or start with{" "}
                      <span className="font-mono text-foreground">ollama pull llama3.2</span>.
                    </p>
                  )}

                  <LocalModelsPicker
                    activeModel={settings.model}
                    status={status}
                    baseUrl={settings.ollamaBaseUrl}
                    onSelect={(tag) => update({ model: tag })}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Temperature" htmlFor="temperature" hint="0 – 1.5">
                      <Input
                        id="temperature"
                        type="number"
                        min={0}
                        max={1.5}
                        step={0.1}
                        value={settings.temperature}
                        onChange={(event) =>
                          update({ temperature: Number(event.target.value) })
                        }
                      />
                    </Field>

                    <Field label="Request timeout" htmlFor="timeout" hint="Seconds">
                      <Input
                        id="timeout"
                        type="number"
                        min={10}
                        max={900}
                        step={10}
                        value={Math.round(settings.requestTimeoutMs / 1000)}
                        onChange={(event) =>
                          update({ requestTimeoutMs: Number(event.target.value) * 1000 })
                        }
                      />
                    </Field>
                  </div>

                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Lower temperature keeps copy conservative and closer to the
                    product knowledge. Around 0.5 is a good balance for outreach.
                  </p>
                </FieldGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Your name on emails</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Your name" htmlFor="senderName">
                    <Input
                      id="senderName"
                      value={settings.senderName}
                      onChange={(event) => update({ senderName: event.target.value })}
                      placeholder="Zamba"
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Your role" htmlFor="senderTitle">
                    <Input
                      id="senderTitle"
                      value={settings.senderTitle}
                      onChange={(event) => update({ senderTitle: event.target.value })}
                      placeholder="Business Development"
                      autoComplete="off"
                    />
                  </Field>
                  <Field label="Email" htmlFor="senderEmail">
                    <Input
                      id="senderEmail"
                      value={settings.senderEmail}
                      onChange={(event) => update({ senderEmail: event.target.value })}
                      placeholder="rahul@maxpro.example"
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </Field>
                  <Field label="Phone" htmlFor="senderPhone">
                    <Input
                      id="senderPhone"
                      value={settings.senderPhone}
                      onChange={(event) => update({ senderPhone: event.target.value })}
                      placeholder="+91 00000 00000"
                      autoComplete="off"
                    />
                  </Field>
                </div>

                <Field label="Company name" htmlFor="companyName">
                  <Input
                    id="companyName"
                    value={settings.companyName}
                    onChange={(event) => update({ companyName: event.target.value })}
                    placeholder="Maxpro Infotech"
                    autoComplete="off"
                  />
                </Field>

                <p className="text-xs leading-relaxed text-muted-foreground">
                  Used inside email templates. Outbound sending uses the Postmark tab.
                </p>
              </CardContent>
              <SettingsSaveFooter dirty={dirty} saving={saving} onSave={() => void save()} />
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="postmark" className="mt-0">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Mail className="size-4 text-accent" />
                  <CardTitle>Send email through Postmark</CardTitle>
                </div>
                <Badge variant={postmarkPreview.apiKeyConfigured ? "success" : "warning"}>
                  {postmarkPreview.apiKeyConfigured ? "API key in .env" : "API key missing"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-5 pt-2">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Set who campaign emails are sent from. The Postmark API key stays in your{" "}
                <span className="font-mono text-foreground">.env</span> file only.
              </p>

              <div className="rounded-lg border border-border bg-surface-raised px-4 py-3">
                <p className="eyebrow">Currently sends as</p>
                <p className="mt-1.5 text-sm text-foreground">
                  {postmarkPreview.effectiveFromName || "—"}
                  {postmarkPreview.effectiveFromEmail ? (
                    <span className="text-muted-foreground">
                      {" "}
                      &lt;{postmarkPreview.effectiveFromEmail}&gt;
                    </span>
                  ) : null}
                </p>
                <p className="mt-1 font-mono text-xs text-subtle-foreground">
                  Stream: {postmarkPreview.effectiveMessageStream}
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="From name" htmlFor="postmarkSenderName">
                  <Input
                    id="postmarkSenderName"
                    value={settings.postmarkSenderName}
                    onChange={(event) => update({ postmarkSenderName: event.target.value })}
                    placeholder={postmarkPreview.envFromName || "Maxpro Infotech"}
                    autoComplete="off"
                  />
                </Field>
                <Field label="From email" htmlFor="postmarkSenderEmail">
                  <Input
                    id="postmarkSenderEmail"
                    value={settings.postmarkSenderEmail}
                    onChange={(event) => update({ postmarkSenderEmail: event.target.value })}
                    placeholder={postmarkPreview.envFromEmail || "you@company.com"}
                    autoComplete="off"
                    spellCheck={false}
                  />
                </Field>
                <Field
                  label="Message stream"
                  htmlFor="postmarkMessageStream"
                  hint="Postmark stream id"
                >
                  <Input
                    id="postmarkMessageStream"
                    value={settings.postmarkMessageStream}
                    onChange={(event) => update({ postmarkMessageStream: event.target.value })}
                    placeholder={postmarkPreview.envMessageStream || "outbound"}
                    spellCheck={false}
                  />
                </Field>
              </div>

              {!postmarkPreview.apiKeyConfigured ? (
                <p className="rounded-lg border border-border bg-surface-raised px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                  Add{" "}
                  <span className="font-mono text-foreground">POSTMARK_API_KEY</span> to{" "}
                  <span className="font-mono text-foreground">.env</span>, restart the dev server,
                  then send campaigns.
                </p>
              ) : null}
            </CardContent>
            <SettingsSaveFooter dirty={dirty} saving={saving} onSave={() => void save()} />
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SettingsSaveFooter({
  dirty,
  saving,
  onSave,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
}) {
  return (
    <CardFooter className="justify-between">
      {dirty ? (
        <Badge variant="warning">Unsaved changes</Badge>
      ) : (
        <span className="text-xs text-subtle-foreground">All changes saved</span>
      )}
      <Button variant="primary" onClick={onSave} disabled={saving || !dirty}>
        {saving ? <LoaderCircle className="animate-spin" /> : <Save />}
        Save changes
      </Button>
    </CardFooter>
  );
}

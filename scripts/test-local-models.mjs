/**
 * Smoke-test local Ollama models with MaxReach's structured outreach JSON contract.
 *
 * Usage:
 *   node scripts/test-local-models.mjs
 *   node scripts/test-local-models.mjs llama3.2:latest qwen2.5:7b
 *   MAXREACH_BASE=http://localhost:4002 node scripts/test-local-models.mjs
 */

const BASE = process.env.MAXREACH_BASE ?? "http://localhost:4002";
const OLLAMA = process.env.OLLAMA_BASE ?? "http://localhost:11434";

const RECOMMENDED = [
  "llama3.2:latest",
  "qwen2.5:1.5b",
  "qwen2.5:7b",
  "llama3.1:8b",
  "mistral:latest",
  "gemma3:4b",
  "phi4-mini",
  "deepseek-r1:7b",
];

async function listInstalled() {
  const response = await fetch(`${OLLAMA}/api/tags`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Ollama tags failed: ${response.status}`);
  const payload = await response.json();
  return (payload.models ?? [])
    .map((model) => model.name)
    .filter(Boolean);
}

async function testViaApp(model) {
  const response = await fetch(`${BASE}/api/ollama/test-model`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model, baseUrl: OLLAMA }),
  });
  const payload = await response.json();
  if (!response.ok) {
    return {
      model,
      ok: false,
      error: payload.error ?? payload.hint ?? `HTTP ${response.status}`,
    };
  }
  return { model, ...payload.result };
}

function normalize(name) {
  return name.trim().toLowerCase().replace(/:latest$/, "");
}

function matchesInstalled(installed, tag) {
  const target = normalize(tag);
  return installed.some((name) => {
    const value = normalize(name);
    return value === target || value.startsWith(`${target}:`) || target.startsWith(`${value}:`);
  });
}

async function main() {
  console.log("MaxReach local model test");
  console.log("App:", BASE);
  console.log("Ollama:", OLLAMA);

  let installed = [];
  try {
    installed = await listInstalled();
    console.log("Installed:", installed.join(", ") || "(none)");
  } catch (error) {
    console.error("Could not reach Ollama:", error.message);
    console.error("Start Ollama, then re-run this script.");
    process.exit(1);
  }

  const cliModels = process.argv.slice(2);
  const targets =
    cliModels.length > 0
      ? cliModels
      : RECOMMENDED.filter((tag) => matchesInstalled(installed, tag));

  if (targets.length === 0) {
    console.log("\nNo recommended models installed.");
    console.log("Try: ollama pull llama3.2 && ollama pull qwen2.5:7b");
    process.exit(1);
  }

  console.log("\nTesting:", targets.join(", "));
  console.log("---");

  const results = [];
  for (const model of targets) {
    if (!matchesInstalled(installed, model)) {
      console.log(`${model} … SKIP (not installed — run: ollama pull ${model})`);
      results.push({ model, ok: false, skipped: true });
      continue;
    }

    process.stdout.write(`${model} … `);
    const result = await testViaApp(model);
    results.push(result);

    if (result.ok) {
      const seconds = (result.durationMs / 1000).toFixed(1);
      const subject = result.subjectPreview ? ` · "${result.subjectPreview}"` : "";
      console.log(`OK ${seconds}s${subject}`);
    } else {
      console.log(`FAIL ${result.error ?? "unknown error"}`);
      if (result.hint) console.log(`  hint: ${result.hint}`);
    }
  }

  const passed = results.filter((row) => row.ok).length;
  const failed = results.filter((row) => !row.ok && !row.skipped).length;
  console.log("---");
  console.log(`Passed: ${passed}/${results.length}`);

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

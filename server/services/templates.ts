import fs from "node:fs/promises";
import path from "node:path";
import { db } from "../database.ts";
import { nowIso } from "../lib/time.ts";
import { run } from "../lib/process.ts";
import { homeDir, workspaceDir } from "./compose.ts";
import { recordEvent, parseJson } from "./records.ts";

const SUPPORTED_PROJECT_CONTEXT_FILES = new Set(["AGENTS.md", ".hermes.md", "HERMES.md", "CLAUDE.md", ".cursorrules"]);

type InstanceContextFiles = {
  soul?: string;
  project?: {
    filename?: string;
    content?: string;
  };
};

function rowToTemplate(row: any) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    soul: row.soul,
    config: parseJson(row.config_json, {}),
    builtIn: Boolean(row.built_in),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getTemplate(id: string) {
  const row = db.prepare("SELECT * FROM templates WHERE id = ?").get(id);
  return row ? rowToTemplate(row) : null;
}

function upsertInstanceTemplate(instance: string, templateId: string) {
  const now = nowIso();
  db.prepare(`
    INSERT INTO instance_meta (instance, template_id, template_version, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(instance) DO UPDATE SET template_id = excluded.template_id, updated_at = excluded.updated_at
  `).run(instance, templateId, "1", now, now);
}

export async function applyProviderConfigToFile(configFile: string, providerConfig: any = {}) {
  await fs.mkdir(path.dirname(configFile), { recursive: true });
  const script = `
path = ARGV.fetch(0)
config = JSON.parse(ARGV.fetch(1))
data = File.exist?(path) ? (YAML.load_file(path) || {}) : {}
data = {} unless data.is_a?(Hash)
data["model"] ||= {}
config["provider"].to_s.empty? ? data["model"].delete("provider") : data["model"]["provider"] = config["provider"]
config["model"].to_s.empty? ? data["model"].delete("default") : data["model"]["default"] = config["model"]
config["baseUrl"].to_s.empty? ? data["model"].delete("base_url") : data["model"]["base_url"] = config["baseUrl"]
File.write(path, YAML.dump(data))
`;
  await run("ruby", ["-ryaml", "-rjson", "-e", script, configFile, JSON.stringify(providerConfig)], {
    timeout: 15000,
    maxBuffer: 1024 * 1024,
  });
}

function markdownFileBody(value: unknown) {
  const text = String(value ?? "").replace(/\r\n/g, "\n").trimEnd();
  return text ? `${text}\n` : "";
}

function defaultSoul(template: any) {
  return `# ${template.name}\n\n${template.soul}\n\nWhen asked to create, host, publish, preview, or update a webpage, publish static files to /opt/data/workspace/web and use /opt/data/workspace/web/index.html as the default page. Use HERMES_WEB.md in the workspace for the current local and LAN URLs.\n`;
}

function projectContextFile(contextFiles: InstanceContextFiles) {
  const filename = String(contextFiles.project?.filename || "").trim();
  const content = markdownFileBody(contextFiles.project?.content);
  if (!filename || !content) return null;
  if (!SUPPORTED_PROJECT_CONTEXT_FILES.has(filename)) throw new Error("Unsupported project context file");
  return { filename, content };
}

export async function applyTemplateToInstance(name: string, template: any, contextFiles: InstanceContextFiles = {}) {
  const home = homeDir(name);
  const workspace = workspaceDir(name);
  await fs.mkdir(home, { recursive: true });
  await fs.mkdir(workspace, { recursive: true });
  const customSoul = markdownFileBody(contextFiles.soul);
  await fs.writeFile(path.join(home, "SOUL.md"), customSoul || defaultSoul(template));
  const projectFile = projectContextFile(contextFiles);
  if (projectFile) await fs.writeFile(path.join(workspace, projectFile.filename), projectFile.content);
  await applyProviderConfigToFile(path.join(home, "config.yaml"), template.config || {});
  upsertInstanceTemplate(name, template.id);
  recordEvent(name, "template_applied", `${template.name} template applied`, {
    templateId: template.id,
    customSoul: Boolean(customSoul),
    projectContextFile: projectFile?.filename || "",
  });
}

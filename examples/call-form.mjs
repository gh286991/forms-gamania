import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const STANDARD_PAYLOAD_KEYS = new Set([
  "action", "form", "config", "template", "name", "path", "folderId"
]);

const contentArg = process.argv[2];
if (!contentArg) {
  console.error("用法：node call-form.mjs <content.json>");
  console.error("  必須指定 JSON 內容檔案路徑，例如：");
  console.error("  node examples/call-form.mjs examples/a01-content.sample.json");
  process.exit(1);
}

const webappUrl = process.env.WEBAPP_URL || "https://script.google.com/macros/s/AKfycbx7Wv8uLqdJnkEID4o_Yd3qqnVnlugeDfSV9LiCm2JWV7AmX2NtF_eyERogYozF1QmI/exec";
const payloadPath = path.resolve(process.cwd(), contentArg);
const accessToken = process.env.GOOGLE_ACCESS_TOKEN || await loadClaspAccessToken();

let rawPayload;
try {
  rawPayload = await fs.readFile(payloadPath, "utf8");
} catch {
  console.error(`找不到內容檔案：${payloadPath}`);
  process.exit(1);
}

const payloadDir = path.dirname(payloadPath);
console.log(`載入內容檔案：${payloadPath}`);

const parsed = JSON.parse(rawPayload);
const formCode = detectFormCode(parsed);
if (!formCode) {
  console.error("JSON 中找不到表單資料（例如 a01、b01 等 key），請檢查內容格式。");
  process.exit(1);
}

const resolved = await resolveMarkdownFiles(parsed, formCode, payloadDir);
const payload = applyDefaults(resolved, formCode);

console.log(`送出 action=${payload.action}, form=${payload.form}`);
console.log(`${formCode} 欄位：${Object.keys(payload[formCode]).join(", ")}`);

const headers = { "Content-Type": "application/json" };
if (accessToken) {
  headers.Authorization = `Bearer ${accessToken}`;
}

let response;
try {
  response = await fetch(webappUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
} catch (error) {
  console.error(`連線失敗：${error.message}`);
  console.error("請確認網路連線與 WEBAPP_URL 是否正確。");
  process.exit(1);
}

const body = await response.text();
const contentType = response.headers.get("content-type") || "";

if (!contentType.startsWith("application/json")) {
  console.error(`回應格式錯誤：預期 JSON 但收到 ${contentType || "未知格式"} (HTTP ${response.status})。`);
  console.error("通常是 Web App 部署尚未對此 API 呼叫者開放存取。");
  console.error("請將 Web App 存取設為 Anyone，或設定 GOOGLE_ACCESS_TOKEN 環境變數。");
  process.exit(1);
}

console.log(body);

try {
  const result = JSON.parse(body);
  if (result.newFileUrl) {
    console.log(`\n✅ 建立成功：${result.newFileUrl}`);
  }
} catch { /* not JSON */ }

if (!response.ok) {
  process.exitCode = 1;
}

// ---------------------------------------------------------------------------

function detectFormCode(payload) {
  if (payload.form) return payload.form;
  for (const key of Object.keys(payload)) {
    if (!STANDARD_PAYLOAD_KEYS.has(key) && typeof payload[key] === "object" && payload[key] !== null) {
      return key;
    }
  }
  return null;
}

function applyDefaults(payload, formCode) {
  const result = { ...payload };
  if (!result.action) result.action = "copy_form";
  if (!result.form) result.form = formCode;
  return result;
}

async function resolveMarkdownFiles(payload, formCode, baseDir) {
  if (!payload || typeof payload !== "object") return payload;
  const result = { ...payload };

  if (result.config && typeof result.config === "object" && result.config.markdownFiles && typeof result.config.markdownFiles === "object") {
    const config = { ...result.config };
    config.markdownReplace = config.markdownReplace || {};
    for (const [placeholder, files] of Object.entries(config.markdownFiles)) {
      const fileArray = Array.isArray(files) ? files : [files];
      const contents = await loadMarkdownContents(fileArray, baseDir, `config.markdownFiles.${placeholder}`);
      if (contents.length > 0) config.markdownReplace[placeholder] = contents;
    }
    delete config.markdownFiles;
    result.config = config;
  }

  const formData = result[formCode];
  if (formData && typeof formData === "object" && formData.specMarkdownFiles) {
    const updated = { ...formData };
    const fileArray = Array.isArray(updated.specMarkdownFiles) ? updated.specMarkdownFiles : [updated.specMarkdownFiles];
    const contents = await loadMarkdownContents(fileArray, baseDir, `${formCode}.specMarkdownFiles`);
    const existing = Array.isArray(updated.specMarkdown)
      ? updated.specMarkdown
      : updated.specMarkdown
        ? [updated.specMarkdown]
        : [];
    updated.specMarkdown = [...existing, ...contents];
    delete updated.specMarkdownFiles;
    result[formCode] = updated;
  }

  return result;
}

async function loadMarkdownContents(files, baseDir, sourceLabel) {
  const contents = [];
  for (const file of files) {
    const resolved = path.resolve(baseDir, String(file));
    try {
      const content = await fs.readFile(resolved, "utf8");
      contents.push(content);
      console.log(`${sourceLabel}: 載入 ${resolved}`);
    } catch {
      console.error(`${sourceLabel}: 找不到或無法讀取 -> ${resolved}`);
    }
  }
  return contents;
}

async function loadClaspAccessToken() {
  try {
    spawnSync("npx", ["clasp", "list-deployments", "--json"], {
      stdio: "ignore"
    });
    const claspPath = path.join(os.homedir(), ".clasprc.json");
    const raw = await fs.readFile(claspPath, "utf8");
    const config = JSON.parse(raw);
    return config?.tokens?.default?.access_token || "";
  } catch {
    return "";
  }
}

#!/usr/bin/env node
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

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

const webappUrl = process.env.WEBAPP_URL || "https://script.google.com/a/macros/gamania.com/s/AKfycbwI20puawTw2AtyOOp65PudFrqfvHB2GVCeUuFW81LhVz4SMkWVd56RZYRi-EuyRFk/exec";
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
  console.error("JSON 中找不到表單資料（例如 a01、a02 等 key），請檢查內容格式。");
  process.exit(1);
}

const resolved = await resolveMarkdownFiles(parsed, formCode, payloadDir);
const payload = applyDefaults(resolved, formCode);
const hasMarkdown = hasMarkdownContent(payload, formCode);

console.log(`建立 ${payload.form.toUpperCase()} 表單...`);

const headers = { "Content-Type": "application/json" };
if (accessToken) {
  headers.Authorization = `Bearer ${accessToken}`;
}

// ---------------------------------------------------------------------------
// 三步驟真進度條執行
// Step 1: 複製範本 (0→25%)
// Step 2: 填入文字與表格 (25→65%)
// Step 3: 渲染規格 Markdown (65→100%)，若無 markdown 則跳過
// ---------------------------------------------------------------------------

const BAR_WIDTH = 30;
const bar = createProgressBar(BAR_WIDTH);

// Step 1
bar.start(0, 25, "複製範本");
const step1 = await postStep({ ...payload, step: "1" });
if (!step1.ok || !step1.newFileId) {
  bar.fail();
  console.error(`\n錯誤：${step1.error || "Step 1 失敗，未取得 fileId"}`);
  process.exit(1);
}
bar.advance(25);

const fileId = step1.newFileId;

// Step 2
bar.setLabel("填入內容");
bar.setTarget(hasMarkdown ? 65 : 100);
const step2 = await postStep({ ...payload, step: "2", fileId });
if (!step2.ok) {
  bar.fail();
  console.error(`\n錯誤：${step2.error || "Step 2 失敗"}`);
  process.exit(1);
}
bar.advance(hasMarkdown ? 65 : 100);

// Step 3（有 markdown 才跑）
let finalUrl = step1.newFileUrl;
if (hasMarkdown) {
  bar.setLabel("渲染規格");
  bar.setTarget(100);
  const step3 = await postStep({ ...payload, step: "3", fileId });
  if (!step3.ok) {
    bar.fail();
    console.error(`\n錯誤：${step3.error || "Step 3 失敗"}`);
    process.exit(1);
  }
  if (step3.newFileUrl) finalUrl = step3.newFileUrl;
  bar.advance(100);
}

bar.done();
console.log(`建立成功：${finalUrl}`);

// ---------------------------------------------------------------------------

async function postStep(body) {
  let response;
  try {
    response = await fetch(webappUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
  } catch (error) {
    return { ok: false, error: `連線失敗：${error.message}` };
  }

  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("application/json")) {
    return { ok: false, error: `回應非 JSON (HTTP ${response.status})。請確認 Web App 存取設定或 GOOGLE_ACCESS_TOKEN。` };
  }
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: "回應 JSON 解析失敗" };
  }
}

function hasMarkdownContent(p, fc) {
  const fd = p[fc];
  if (!fd) return false;
  if (Array.isArray(fd.specMarkdown)) return fd.specMarkdown.length > 0;
  return Boolean(fd.specMarkdown);
}

function detectFormCode(p) {
  if (p.form) return p.form;
  for (const key of Object.keys(p)) {
    if (!STANDARD_PAYLOAD_KEYS.has(key) && typeof p[key] === "object" && p[key] !== null) {
      return key;
    }
  }
  return null;
}

function applyDefaults(p, fc) {
  const result = { ...p };
  if (!result.action) result.action = "copy_form";
  if (!result.form) result.form = fc;
  return result;
}

async function resolveMarkdownFiles(p, fc, baseDir) {
  if (!p || typeof p !== "object") return p;
  const result = { ...p };

  if (result.config && typeof result.config === "object" && result.config.markdownFiles && typeof result.config.markdownFiles === "object") {
    const config = { ...result.config };
    config.markdownReplace = config.markdownReplace || {};
    for (const [placeholder, files] of Object.entries(config.markdownFiles)) {
      const fileArray = Array.isArray(files) ? files : [files];
      console.log(`[執行] 讀取替換文件（${placeholder}，${fileArray.length} 個檔案）`);
      const contents = await loadMarkdownContents(fileArray, baseDir);
      if (contents.length > 0) config.markdownReplace[placeholder] = contents;
    }
    delete config.markdownFiles;
    result.config = config;
  }

  const formData = result[fc];
  if (formData && typeof formData === "object" && formData.specMarkdownFiles) {
    const updated = { ...formData };
    const fileArray = Array.isArray(updated.specMarkdownFiles) ? updated.specMarkdownFiles : [updated.specMarkdownFiles];
    console.log(`[執行] 讀取規格文件（${fileArray.length} 個檔案）`);
    const contents = await loadMarkdownContents(fileArray, baseDir);
    const existing = Array.isArray(updated.specMarkdown)
      ? updated.specMarkdown
      : updated.specMarkdown ? [updated.specMarkdown] : [];
    updated.specMarkdown = [...existing, ...contents];
    delete updated.specMarkdownFiles;
    result[fc] = updated;
  }

  return result;
}

async function loadMarkdownContents(files, baseDir) {
  const contents = [];
  for (const file of files) {
    const resolved = path.resolve(baseDir, String(file));
    try {
      const content = await fs.readFile(resolved, "utf8");
      contents.push(content);
      console.log(`  - 讀取：${path.relative(process.cwd(), resolved)}`);
    } catch {
      console.error(`  - 找不到或無法讀取：${resolved}`);
    }
  }
  return contents;
}

// ---------------------------------------------------------------------------
// 進度條
// ---------------------------------------------------------------------------

function createProgressBar(width) {
  let current = 0;   // 目前格數（浮點）
  let target = 0;    // 本段目標格數
  let label = "";
  let timer = null;
  const start = Date.now();

  function render() {
    const filled = Math.round(current);
    const bar = "█".repeat(filled) + "░".repeat(width - filled);
    const pct = String(Math.round((current / width) * 100)).padStart(3);
    const sec = ((Date.now() - start) / 1000).toFixed(1);
    process.stdout.write(`\r${label.padEnd(6)} [${bar}] ${pct}%  ${sec}s`);
  }

  function tick() {
    // 緩慢靠近目標格數，留 0.8 格的距離不超過（等真實完成才跳到目標）
    const softTarget = target - 0.8;
    if (current < softTarget) {
      current = Math.min(softTarget, current + (softTarget - current) * 0.04 + 0.02);
      render();
    }
  }

  return {
    start(from, to, lbl) {
      current = (from / 100) * width;
      target = (to / 100) * width;
      label = lbl;
      render();
      timer = setInterval(tick, 80);
    },
    setLabel(lbl) { label = lbl; },
    setTarget(pct) { target = (pct / 100) * width; },
    advance(pct) {
      current = (pct / 100) * width;
      render();
    },
    done() {
      clearInterval(timer);
      current = width;
      const sec = ((Date.now() - start) / 1000).toFixed(1);
      process.stdout.write(`\r${"完成".padEnd(6)} [${"█".repeat(width)}] 100%  ${sec}s  ✅\n`);
    },
    fail() {
      clearInterval(timer);
      const filled = Math.round(current);
      const sec = ((Date.now() - start) / 1000).toFixed(1);
      process.stdout.write(`\r${"失敗".padEnd(6)} [${"█".repeat(filled)}${"░".repeat(width - filled)}] ---  ${sec}s  ❌\n`);
    }
  };
}

async function loadClaspAccessToken() {
  try {
    const claspPath = path.join(os.homedir(), ".clasprc.json");
    const raw = await fs.readFile(claspPath, "utf8");
    const config = JSON.parse(raw);
    const tokenData = config?.tokens?.default;
    if (!tokenData?.access_token) return "";
    const expiryDate = tokenData.expiry_date;
    if (expiryDate && expiryDate - Date.now() < 60_000) {
      console.error("Google access token 已過期或即將過期，請重新執行 `npx clasp login`。");
      return "";
    }
    return tokenData.access_token;
  } catch {
    return "";
  }
}

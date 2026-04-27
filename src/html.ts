import type { DriveItemRow } from "./types";
import { MAX_FILES } from "./config";

export function renderDrivePage(input: {
  inputPath: string;
  normalizedPath: string;
  folderId: string;
  rows: DriveItemRow[];
  ambiguousCount: number;
  truncated: boolean;
  message: string;
}): string {
  const escapedPath = escapeHtml(input.inputPath);
  const escapedFolderId = escapeHtml(input.folderId);
  const escapedNormalizedPath = escapeHtml(input.normalizedPath || "(未解析)");

  const rowHtml = input.rows.length > 0
    ? input.rows.map(renderRow).join("")
    : `<tr><td colspan="5" class="empty">沒有找到項目</td></tr>`;

  const infoParts = [
    `資料夾路徑：${escapedNormalizedPath}`,
    input.folderId ? `Folder ID：${escapedFolderId}` : "",
    `項目數：${input.rows.length}`
  ].filter(Boolean);

  const warnings: string[] = [];
  if (input.ambiguousCount > 0) {
    warnings.push(`有 ${input.ambiguousCount + 1} 個同名路徑，已自動使用其中一個。建議在查詢欄位填入 folderId 來精準指定。`);
  }
  if (input.truncated) {
    warnings.push(`檔案數超過 ${MAX_FILES} 筆，結果已截斷。`);
  }

  const noticeBlocks = [
    input.message ? `<div class="notice error">${escapeHtml(input.message)}</div>` : "",
    warnings.map((text) => `<div class="notice warn">${escapeHtml(text)}</div>`).join("")
  ].join("");

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Drive File Browser</title>
  <style>
    :root {
      --bg: #f5f7fb; --panel: #ffffff; --line: #d7dce8;
      --text: #1a1d29; --muted: #5a6175; --accent: #0a66c2;
      --accent-soft: #e9f3ff; --warn-bg: #fff8e1; --warn-line: #f5d66f;
      --error-bg: #fdebec; --error-line: #ef9a9a;
    }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif; background: var(--bg); color: var(--text); }
    .wrap { max-width: 1200px; margin: 0 auto; padding: 24px; }
    h1 { margin: 0 0 8px; font-size: 24px; }
    .sub { margin: 0 0 16px; color: var(--muted); }
    .panel { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 14px; }
    .form { display: grid; grid-template-columns: 1fr 320px auto; gap: 10px; align-items: center; }
    input[type="text"] { width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: 6px; font-size: 14px; }
    button { border: 1px solid var(--accent); background: var(--accent); color: #fff; border-radius: 6px; padding: 10px 14px; font-size: 14px; cursor: pointer; }
    button:hover { opacity: 0.92; }
    .meta { margin: 12px 0 0; padding: 10px; background: var(--accent-soft); color: #154273; border: 1px solid #bfdcff; border-radius: 6px; font-size: 13px; word-break: break-all; }
    .notice { margin-top: 12px; padding: 10px 12px; border-radius: 6px; font-size: 14px; }
    .notice.warn { background: var(--warn-bg); border: 1px solid var(--warn-line); }
    .notice.error { background: var(--error-bg); border: 1px solid var(--error-line); }
    .tableWrap { margin-top: 14px; overflow-x: auto; }
    table { width: 100%; border-collapse: collapse; background: var(--panel); border: 1px solid var(--line); border-radius: 8px; overflow: hidden; min-width: 880px; }
    th, td { border-bottom: 1px solid var(--line); text-align: left; vertical-align: top; padding: 10px 12px; font-size: 13px; }
    th { background: #eef2fa; color: #283148; white-space: nowrap; }
    td a { color: var(--accent); text-decoration: none; }
    td a:hover { text-decoration: underline; }
    .empty { color: var(--muted); text-align: center; padding: 22px; }
    @media (max-width: 900px) { .form { grid-template-columns: 1fr; } .wrap { padding: 16px; } }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Google Drive 檔案列表</h1>
    <p class="sub">支援以路徑搜尋資料夾，僅列出當層檔案與資料夾（不往下展開）。</p>
    <div class="panel">
      <form class="form" method="get">
        <input type="text" name="path" value="${escapedPath}" placeholder="例：與我共用/P_行動技術研究專案/15.專案資料夾/Galaxy/014_ISO27001/紀錄" />
        <input type="text" name="folderId" value="${escapedFolderId}" placeholder="可選：folderId（優先於 path）" />
        <button type="submit">查詢</button>
      </form>
      <div class="meta">${infoParts.join(" | ")}</div>
      ${noticeBlocks}
    </div>
    <div class="tableWrap">
      <table>
        <thead>
          <tr><th>檔名</th><th>項目類型</th><th>類型(MIME)</th><th>大小</th><th>最後更新</th></tr>
        </thead>
        <tbody>${rowHtml}</tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}

function renderRow(row: DriveItemRow): string {
  return `<tr>
    <td><a href="${escapeHtml(row.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.name)}</a></td>
    <td>${escapeHtml(row.itemType)}</td>
    <td>${escapeHtml(row.mimeType)}</td>
    <td>${escapeHtml(row.sizeLabel)}</td>
    <td>${escapeHtml(row.updatedAt)}</td>
  </tr>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

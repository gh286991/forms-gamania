# Google Apps Script TypeScript + clasp Sample

這是一個可以本機跑 TypeScript，也可以編譯後用 clasp 上傳到 Google Apps Script 的範例。

## Setup

```bash
npm install
npm run local
npm run typecheck
npm run build
```

## 第一次建立 Apps Script 專案

```bash
npm run login
npm run create
npm run push
npm run open
```

如果你已經有 Apps Script 專案，也可以手動建立 `.clasp.json`：

```json
{
  "scriptId": "你的_SCRIPT_ID",
  "rootDir": "dist"
}
```

然後執行：

```bash
npm run push
```

## 線上可執行的函式

- `doGet`: 顯示 Google Drive 檔案列表頁（只列出指定資料夾當層的檔案與資料夾）。
- `runExample`: 回傳 JSON greeting。
- `createSampleSheet`: 建立一份 Google Sheet，寫入範例資料，並回傳試算表網址。
- `copyA01TemplateDocToFolder`: 複製 A01 範本文件到指定資料夾並改名（固定參數）。
- `copyTemplateDocToFolder`: 可傳入自訂範本/路徑/檔名的複製函式。

### doGet 查詢參數

- `path`：資料夾路徑，支援 `A/B/C` 或 `A > B > C` 格式。
- `path`：可包含 `與我共用`（系統會自動忽略這個 UI 層級）。
- `folderId`：可選。若提供會優先使用此 ID（可避免同名資料夾歧義）。

範例：

```text
.../exec?path=P_行動技術研究專案/014_ISO27001/紀錄
.../exec?folderId=1AbCdEfGhI...
```

## 常用指令

```bash
npm run local      # 在本機跑純 TS 邏輯
npm run typecheck  # TypeScript 型別檢查
npm run build      # 產生 dist/Code.js + dist/appsscript.json
npm run push       # build 後上傳到 Apps Script
npm run deploy     # build 後建立部署
npm run open       # 開啟 Apps Script 編輯器
npm run list:drive # 在本機 terminal 透過 Web App JSON 端點列出當層項目
npm run list:drive:exec # 透過 Execution API 呼叫（某些企業環境可能受限）
npm run inspect:a01 # 掃描 A01 範本可填欄位（placeholder / label）
```

本機列出指定路徑：

```bash
npm run list:drive -- --path "與我共用/P_行動技術研究專案/15.專案資料夾/Galaxy/014_ISO27001/紀錄"
```

本機列出指定 folderId（建議，最穩）：

```bash
npm run list:drive -- --folderId "你的FolderId"
```

## A01 文件複製（Apps Script 執行）

在 Apps Script 編輯器執行 `copyA01TemplateDocToFolder`，會做以下動作：

1. 複製範本：
   `https://docs.google.com/document/d/1vvS6Sv6sxBOmAMmuZSV4bq7fErdpVRSPYXOes0hFQUA/edit?usp=sharing`
2. 目標路徑：
   `與我共用/P_行動技術研究專案/15.專案資料夾/Galaxy/014_ISO27001/紀錄/GXY-A01-開發需求`
3. 新檔名：
   `GXY-A01-開發需求單_Tom 測試`

回傳 JSON 包含新檔案 `id` 與 `url`。

本機直接執行 A01 複製：

```bash
npm run copy:a01
```
（預設會套用 `examples/a01-content.sample.json`，用於本機測試）

本機帶 JSON 設定檔執行（建檔＋內容套版）：

```bash
npm run copy:a01 -- --config examples/a01-content.sample.json
```

本機掃描範本可填欄位（預設 A01）：

```bash
npm run inspect:a01
```

掃描自訂範本：

```bash
npm run inspect:a01 -- --template "https://docs.google.com/document/d/你的文件ID/edit"
```

`examples/a01-content.sample.json` 支援欄位：

- `clearTemplate`: `true` 時先清空 `keyValues` 對應欄位的舊值（保留原版面格式），再套用 JSON（A01 預設建議開啟）。
- `replaceText`: 文字取代（key 為原字串，value 為新字串）。
- `keyValues`: 優先填入原位置（`{{欄位}}`、`【欄位】`、`欄位：____`），找不到才補到文件尾端。
- `sections`: 章節內容（`title` + `content`）。
- `appendParagraphs`: 逐行附加段落。
- `bullets`: 逐行附加項目符號。
- `removeMarkers`: 移除特定標記字串。

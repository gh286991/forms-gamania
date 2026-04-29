# A01 表單 API

透過 HTTP POST 建立 A01 開發需求單文件，伺服器自動複製 Google Docs 範本並填入內容。

---

## Endpoint

```
POST https://script.google.com/macros/s/AKfycbx7Wv8uLqdJnkEID4o_Yd3qqnVnlugeDfSV9LiCm2JWV7AmX2NtF_eyERogYozF1QmI/exec
```

### Headers

| Header | 值 | 說明 |
|---|---|---|
| `Content-Type` | `application/json` | 必填 |
| `Authorization` | `Bearer <access_token>` | Web App 未公開時必填 |

### Request Body

```json
{
  "action": "copy_form",
  "form": "a01",
  "a01": { ... }
}
```

| 欄位 | 型別 | 說明 |
|---|---|---|
| `action` | `string` | 固定填 `"copy_form"` |
| `form` | `string` | 表單代碼，目前支援 `"a01"` |
| `a01` | `object` | 表單內容，見下方欄位說明 |

### Response

**成功**

```json
{
  "ok": true,
  "newFileUrl": "https://docs.google.com/document/d/xxx/edit"
}
```

**失敗**

```json
{
  "ok": false,
  "error": "錯誤說明"
}
```

---

## a01 欄位說明

伺服器會將這些欄位自動轉換成文件佔位符，不需要直接維護 `{{...}}` 格式。

### 基本資訊

| 欄位 | 型別 | 必填 | 說明 |
|---|---|:---:|---|
| `date` | `string` | ✓ | 日期，格式 `YYYY-MM-DD` |
| `product` | `string` | ✓ | 需求產品名稱 |
| `productContact` | `string` | ✓ | 產品窗口姓名 |
| `devLead` | `string` | ✓ | 開發負責人姓名 |
| `signDevLead` | `string[]` | ✓ | 負責人簽核欄，通常與 `devLead` 相同，可多人 |
| `item` | `string` | ✓ | 上版項目說明，同時作為文件檔名的一部分 |
| `jira` | `string` | | JIRA 票號，例如 `GXY-1234` |
| `description` | `string` | ✓ | 變更說明 |

### 簽核人員

| 欄位 | 型別 | 必填 | 說明 |
|---|---|:---:|---|
| `signer` | `string[]` | ✓ | 經辦人員，可多人 |
| `tester` | `string[]` | ✓ | 測試人員，可多人 |
| `productOwner` | `string[]` | ✓ | 產品負責人，可多人 |
| `manager` | `string[]` | ✓ | 部門主管，可多人 |

### 變更類型

| 欄位 | 型別 | 說明 |
|---|---|---|
| `type.newFeature` | `boolean` | 新增功能 |
| `type.modifyFeature` | `boolean` | 修改既有功能 |

兩者皆可同時為 `true`。`true` → ⬛，`false` → ⬚。

### 影響範圍

| 欄位 | 型別 | 說明 |
|---|---|---|
| `changeArea.api` | `boolean` | API |
| `changeArea.sdk` | `boolean` | SDK |
| `changeArea.backend` | `boolean` | 後台 |
| `changeArea.dataCenter` | `boolean` | 數據中心 |
| `changeArea.database` | `boolean` | 資料庫 |
| `changeArea.other` | `boolean` | 其他 |

### 機敏資訊

| 欄位 | 型別 | 說明 |
|---|---|---|
| `sensitive.mode` | `"none"` \| `"partial"` | `none`：無涉及；`partial`：涉及部分資訊 |
| `sensitive.detail` | `string` | `mode` 為 `partial` 時填寫說明 |

### 資安架構

| 欄位 | 型別 | 說明 |
|---|---|---|
| `security.mode` | `"existing"` \| `"extra"` | `existing`：按照既有架構；`extra`：額外套用條件 |
| `security.detail` | `string` | `mode` 為 `extra` 時填寫說明 |

### 版本紀錄

| 欄位 | 型別 | 必填 | 說明 |
|---|---|:---:|---|
| `versionRows` | `object[]` | ✓ | 版本紀錄，至少一筆，自動展開成表格多列 |
| `versionRows[].date` | `string` | ✓ | 日期，格式 `YYYY-MM-DD` |
| `versionRows[].code` | `string` | ✓ | 版本號，例如 `V1.0` |
| `versionRows[].person` | `string` | ✓ | 修改人員 |
| `versionRows[].desc` | `string` | ✓ | 修改說明 |

### 系統規格書

| 欄位 | 型別 | 說明 |
|---|---|---|
| `specMarkdown` | `string` \| `string[]` | Markdown 內容；傳陣列時多份以分隔線串接 |

支援標題、段落、清單、表格、程式碼區塊等標準 Markdown，伺服器以 rich 模式渲染成 Google Docs 格式。

---

## 完整 Request 範例

```json
{
  "action": "copy_form",
  "form": "a01",
  "a01": {
    "date": "2026-04-24",
    "product": "寶可夢",
    "productContact": "王小明",
    "devLead": "Tom",
    "signDevLead": ["Tom"],
    "item": "API 測試建立 A01",
    "jira": "GXY-1234",
    "description": "這是透過 Web App API 建立的測試表單",
    "signer": ["王小明", "陳小華"],
    "tester": ["王小明", "陳小華"],
    "productOwner": ["王小明", "陳小華"],
    "manager": ["王小明", "陳小華"],
    "type": {
      "newFeature": true,
      "modifyFeature": false
    },
    "changeArea": {
      "api": true,
      "sdk": false,
      "backend": true,
      "dataCenter": false,
      "database": false,
      "other": false
    },
    "sensitive": {
      "mode": "none",
      "detail": ""
    },
    "security": {
      "mode": "existing",
      "detail": ""
    },
    "versionRows": [
      { "date": "2026-04-24", "code": "V1.0", "person": "Tom", "desc": "初版" }
    ],
    "specMarkdown": "# 系統規格書\n\n這裡放 Markdown 內容。"
  }
}
```

### curl 範例

```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $(cat ~/.clasprc.json | jq -r '.tokens.default.access_token')" \
  -d @examples/a01-content.sample.json \
  "https://script.google.com/macros/s/AKfycbx7Wv8uLqdJnkEID4o_Yd3qqnVnlugeDfSV9LiCm2JWV7AmX2NtF_eyERogYozF1QmI/exec"
```

---

## 使用 call-form.mjs 腳本

這個 repo 提供 `examples/call-form.mjs`，封裝了上述 API 呼叫，並提供進度條顯示與 Markdown 檔案讀取功能。

### 事前準備

**安裝 clasp 並登入 Google 帳號：**

```bash
npm install -g @google/clasp
npx clasp login
```

登入後憑證存在 `~/.clasprc.json`，之後自動讀取，不需重新登入。也可以改用環境變數 `GOOGLE_ACCESS_TOKEN=ya29...` 帶入。

### 使用方式

**步驟一：複製範例內容檔**

```bash
cp examples/a01-content.sample.json examples/my-a01.json
```

**步驟二：編輯內容**

填入你的資料。規格書可改用 `specMarkdownFiles` 指定檔案路徑，腳本會自動讀取並轉成 `specMarkdown` 送出：

```json
{
  "a01": {
    "specMarkdownFiles": [
      "./templates/spec-overview.md",
      "./templates/spec-api.md"
    ]
  }
}
```

`examples/templates/` 目錄下有範例 Markdown 供參考。

**步驟三：執行**

```bash
node examples/call-form.mjs examples/my-a01.json
```

腳本分三步驟執行並顯示進度條：

```
建立 A01 表單...
複製範本 [████░░░░░░░░░░░░░░░░░░░░░░░░░░]  13%  1.2s
填入內容 [████████████████████░░░░░░░░░░]  65%  8.4s
渲染規格 [██████████████████████████████] 100%  12.1s  ✅
建立成功：https://docs.google.com/document/d/xxx/edit
```

### 自訂 Web App URL

```bash
WEBAPP_URL="https://script.google.com/macros/s/你的部署ID/exec" \
  node examples/call-form.mjs examples/my-a01.json
```

---

## 注意事項

- 若 Web App 部署設為非公開，需提供有效的 `Authorization` header，否則回傳非 JSON 錯誤。
- 若 Web App 設為 `Execute as: Me`，建立的文件會在部署者的 Drive 下。
- Node.js 18 以上。

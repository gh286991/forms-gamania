# A01 API Test Pack

這包給 API 使用者測試建立 A01 表單。

## Endpoint

```text
https://script.google.com/macros/s/AKfycbx7Wv8uLqdJnkEID4o_Yd3qqnVnlugeDfSV9LiCm2JWV7AmX2NtF_eyERogYozF1QmI/exec
```

## Request

Method: `POST`

Header:

```text
Content-Type: application/json
```

Body:

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
      {
        "date": "2026-04-24",
        "code": "V1.0",
        "person": "Tom",
        "desc": "初版"
      }
    ],
    "specMarkdown": "# 系統規格書\n\n這裡可放 Markdown 內容。"
  }
}
```

伺服器會自動把 `a01` 欄位轉成內部 `config`（placeholder）格式，因此 API 使用者不需要直接維護 `{{...}}` 佔位符。

主要欄位對應：
- `versionRows`：可一次傳多筆版本紀錄
- `type` / `changeArea`：布林值會自動轉成文件中的勾選符號
- `signer` / `tester` / `productOwner` / `manager`：陣列會自動轉成多行文字
- `specMarkdown`：有值時會附加在「系統規格書」段落

若你已經有舊的 `config.replaceText` payload，也仍可繼續使用。

### 多個 MD 範本

如果你是用 `scripts/copy-form-webapp.mjs --config` 載入本機 JSON 檔，`a01` payload 可直接指定多個 md 檔案：

```json
{
  "a01": {
    "specMarkdownFiles": [
      "./templates/spec-overview.md",
      "./templates/spec-api.md",
      "./templates/spec-test.md"
    ]
  }
}
```

腳本會依順序讀取這些檔案並轉成 `a01.specMarkdown` 陣列，後端會用分隔線 (`---`) 合併後寫入「系統規格書」。

## Run With curl

```bash
cd examples/api
./call-a01.sh
```

使用自訂 Web App URL：

```bash
WEBAPP_URL="https://script.google.com/macros/s/你的部署ID/exec" ./call-a01.sh
```

如果 Web App 沒有開放匿名 API 呼叫，可以帶 Google OAuth access token 測試：

```bash
GOOGLE_ACCESS_TOKEN="ya29..." ./call-a01.sh
```

使用自訂 payload：

```bash
./call-a01.sh ./a01-request.json
```

## Run With Node.js

需要 Node.js 18 以上。

```bash
cd examples/api
node call-a01.mjs
```

`call-a01.mjs` 會自動嘗試讀取本機 `~/.clasprc.json` 的 Google access token。若尚未登入 clasp，先執行：

```bash
npx clasp login
```

使用自訂 Web App URL：

```bash
WEBAPP_URL="https://script.google.com/macros/s/你的部署ID/exec" node call-a01.mjs
```

如果 Web App 沒有開放匿名 API 呼叫，可以帶 Google OAuth access token 測試：

```bash
GOOGLE_ACCESS_TOKEN="ya29..." node call-a01.mjs
```

## Success Response

成功時會回傳：

```json
{
  "ok": true,
  "newFileUrl": "https://docs.google.com/document/d/xxx/edit"
}
```

`newFileUrl` 就是新建立的 A01 文件。

## Notes

- 表單種類由 body 裡的 `"form": "a01"` 決定。
- 之後若新增 A02，可用同一個 URL，body 改成 `"form": "a02"`。
- 如果 Web App 部署為 `Execute as: Me`，建立文件會使用部署者的 Drive 權限。
- 如果要讓沒有 Google OAuth 的外部 API 直接呼叫，Web App access 必須開成可公開呼叫，例如 `Anyone`。
- 如果部署為公司內部或需要登入，命令列 API 不會自動帶瀏覽器登入狀態，必須改帶 `GOOGLE_ACCESS_TOKEN`。
- Node.js 範例會自動嘗試讀取 `~/.clasprc.json`；curl 範例不會，curl 需要手動帶 `GOOGLE_ACCESS_TOKEN`。

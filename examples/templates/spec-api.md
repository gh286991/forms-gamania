# API 設計

### Endpoint

- `POST /exec`，`action=copy_form`

### Request

- `form`: `"a01"`
- `a01`: 語意化欄位物件

### Response

- 成功回傳 `newFileUrl`
- 失敗回傳 `error`

# 測試計畫

### 驗證項目

1. 使用語意化 `a01` payload 可成功建立文件
2. `versionRows` 多筆資料能正確展開為表格列
3. 多個 Markdown 範本可依順序合併

### 驗證方式

- 執行 `node scripts/copy-form-webapp.mjs --form a01 --config examples/a01-content.sample.json`
- 開啟回傳文件，確認內容與段落順序

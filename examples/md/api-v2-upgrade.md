# API Endpoint v2 升級

## 概述

將 REST API 從 v1 升級到 v2，主要變更：

1. 統一使用 **JSON** 回應格式
2. 新增 `pagination` 分頁參數
3. 移除已棄用的 `/legacy/*` 路由

### 影響範圍

- **前端**：更新所有 API 呼叫路徑
- **後端**：新增 v2 controller
- **文件**：更新 Swagger 規格

### 程式範例

```typescript
router.get('/api/v2/users', UserController.list);
router.post('/api/v2/users', UserController.create);
router.put('/api/v2/users/:id', UserController.update);
```

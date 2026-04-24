# 資料庫 audit_logs 表

## 目標

新增 `audit_logs` 表追蹤使用者操作記錄。

### Schema

```sql
CREATE TABLE audit_logs (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id INT NOT NULL,
  action VARCHAR(50) NOT NULL,
  target_type VARCHAR(50),
  target_id INT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 注意事項

- 預估資料量：每日 **10 萬筆**
- 需設定 `created_at` 索引
- 超過 90 天的記錄定期歸檔

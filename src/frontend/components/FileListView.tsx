import React, { useEffect, useState } from "react";
import type { DriveItem, DriveResponse, MessageState } from "../types";
import { callGas } from "../utils/callGas";
import { parseJsonMaybe } from "../utils/helpers";

export function FileListView({
  onBack,
  onOpenEdit
}: {
  onBack: () => void;
  onOpenEdit: (fileId: string, fileName: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MessageState>({ kind: "none", text: "" });
  const [rows, setRows] = useState<DriveItem[]>([]);
  const [pathLabel, setPathLabel] = useState("");

  async function loadFiles() {
    setLoading(true);
    setResult({ kind: "none", text: "" });
    try {
      const raw = await callGas<string>((runner) => {
        (runner as any).listA01Files();
      });
      const parsed = parseJsonMaybe<DriveResponse>(raw);
      if (!parsed || parsed.ok === false || !Array.isArray(parsed.items)) {
        setRows([]);
        setResult({ kind: "error", text: parsed?.error || parsed?.message || "讀取檔案列表失敗" });
        return;
      }

      const docsOnly = parsed.items.filter((item) => item.mimeType === "application/vnd.google-apps.document");
      setRows(docsOnly);
      setPathLabel(parsed.normalizedPath || "");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRows([]);
      setResult({ kind: "error", text: message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFiles();
  }, []);

  return (
    <section className="page">
      <button className="back-btn" type="button" onClick={onBack}>
        ← 返回選單
      </button>
      <div className="panel">
        <div className="file-list-head">
          <h2>A01 已建立文件</h2>
          <button type="button" className="submit-btn sm" onClick={loadFiles} disabled={loading}>
            {loading ? "載入中..." : "重新整理"}
          </button>
        </div>
        {pathLabel ? <div className="meta-line">資料夾：{pathLabel}</div> : null}
        {result.kind === "error" ? <div className="result-box warn">{result.text}</div> : null}
      </div>

      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>檔名</th>
              <th>最後更新</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr key={row.id || `${row.name}-${row.url}`}>
                  <td>{row.name}</td>
                  <td>{row.updatedAt}</td>
                  <td>
                    <button
                      type="button"
                      className="ghost-btn"
                      disabled={!row.id}
                      onClick={() => onOpenEdit(row.id, row.name)}
                    >
                      編輯
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="empty" colSpan={3}>
                  {loading ? "載入中..." : "沒有可編輯的 A01 文件"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

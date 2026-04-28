import React, { useEffect, useState } from "react";
import type { DriveItem, DriveResponse, MessageState } from "../types";
import { callGas } from "../utils/callGas";
import { parseJsonMaybe } from "../utils/helpers";

export function DriveView({
  initialPath,
  initialFolderId,
  onBack
}: {
  initialPath: string;
  initialFolderId: string;
  onBack: () => void;
}) {
  const [path, setPath] = useState(initialPath);
  const [folderId, setFolderId] = useState(initialFolderId);
  const [loading, setLoading] = useState(false);
  const [info, setInfo] = useState("");
  const [result, setResult] = useState<MessageState>({ kind: "none", text: "" });
  const [rows, setRows] = useState<DriveItem[]>([]);

  async function loadDriveItems() {
    setLoading(true);
    setResult({ kind: "none", text: "" });
    try {
      const raw = await callGas<string>((runner) => {
        (runner as any).listFolderItemsCli(path, folderId);
      });
      const parsed = parseJsonMaybe<DriveResponse>(raw);
      if (!parsed) {
        setRows([]);
        setResult({ kind: "error", text: "Drive 回應格式錯誤，請稍後重試" });
        return;
      }
      if (parsed.ok === false || !Array.isArray(parsed.items)) {
        setRows([]);
        setResult({ kind: "error", text: parsed.error || parsed.message || "查詢失敗" });
        return;
      }
      setRows(parsed.items || []);
      const normalized = parsed.normalizedPath || path || initialPath;
      const countText = `${parsed.itemCount || parsed.items.length || 0} 筆`;
      const extra = parsed.truncated ? "（超過上限，結果已截斷）" : "";
      setInfo(`路徑：${normalized} / ${countText}${extra}`);
      if (parsed.folderId) setFolderId(parsed.folderId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRows([]);
      setResult({ kind: "error", text: message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (path || folderId) loadDriveItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section className="page">
      <button className="back-btn" type="button" onClick={onBack}>
        ← 返回選單
      </button>
      <div className="panel">
        <div className="form-line">
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="資料夾路徑，例如：與我共用/P_行動技術研究專案/..."
            spellCheck={false}
          />
          <input
            type="text"
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            placeholder="可選：folderId（優先於 path）"
            spellCheck={false}
          />
          <button
            type="button"
            className="submit-btn sm"
            onClick={loadDriveItems}
            disabled={loading}
          >
            {loading ? "查詢中..." : "查詢"}
          </button>
        </div>
        {info ? <div className="meta-line">{info}</div> : null}
        {result.kind === "error" ? (
          <div className="result-box warn">{result.text}</div>
        ) : null}
      </div>

      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>檔名</th>
              <th>項目類型</th>
              <th>類型(MIME)</th>
              <th>大小</th>
              <th>最後更新</th>
            </tr>
          </thead>
          <tbody>
            {rows.length > 0 ? (
              rows.map((row) => (
                <tr key={`${row.name}-${row.url}`}>
                  <td>
                    <a href={row.url} target="_blank" rel="noopener noreferrer">
                      {row.name}
                    </a>
                  </td>
                  <td>{row.itemType}</td>
                  <td>{row.mimeType}</td>
                  <td>{row.sizeLabel}</td>
                  <td>{row.updatedAt}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="empty" colSpan={5}>
                  {loading ? "載入中..." : "沒有資料"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

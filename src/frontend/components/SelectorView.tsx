import React from "react";
import type { FormOption } from "../types";

const FORM_OPTIONS: FormOption[] = [
  { code: "a01", label: "A01", enabled: true,  desc: "開發需求單" },
  { code: "a02", label: "A02", enabled: false, desc: "（待定）" },
  { code: "a03", label: "A03", enabled: false, desc: "（待定）" },
  { code: "a04", label: "A04", enabled: false, desc: "（待定）" },
  { code: "a05", label: "A05", enabled: false, desc: "（待定）" },
  { code: "a06", label: "A06", enabled: false, desc: "（待定）" },
  { code: "a07", label: "A07", enabled: false, desc: "（待定）" }
];

export function SelectorView({
  selectorError,
  onOpenForm,
  onOpenDrive,
  onOpenApiDoc
}: {
  selectorError: string;
  onOpenForm: (code: string) => void;
  onOpenDrive: () => void;
  onOpenApiDoc: () => void;
}) {
  return (
    <section className="selector-view">
      <h1>建立表單文件</h1>
      <p className="sub">選擇要建立的表單類型</p>
      {selectorError ? <div className="selector-error">{selectorError}</div> : null}
      <div className="grid">
        {FORM_OPTIONS.map((option) => (
          <button
            key={option.code}
            className={`card ${option.enabled ? "" : "disabled"}`}
            type="button"
            disabled={!option.enabled}
            onClick={() => onOpenForm(option.code)}
          >
            <div className="code">{option.label}</div>
            <div className="label">{option.desc}</div>
            {!option.enabled ? <div className="badge">即將推出</div> : null}
          </button>
        ))}
      </div>
      <div className="drive-quick">
        <button type="button" className="ghost-btn" onClick={onOpenDrive}>
          開啟 Drive 清單
        </button>
        <button type="button" className="ghost-btn" onClick={onOpenApiDoc}>
          API 使用說明
        </button>
      </div>
    </section>
  );
}

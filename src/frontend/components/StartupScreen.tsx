import React, { useEffect, useState } from "react";
import type { DriveAuthState } from "../types";
import { callGas } from "../utils/callGas";
import { parseAuthMessage, toPlainText } from "../utils/helpers";

type CheckStatus = "idle" | "checking" | "ok" | "error";

type CheckItem = {
  id: string;
  label: string;
  desc: string;
  status: CheckStatus;
  message?: string;
  authUrl?: string;
};

const INITIAL: CheckItem[] = [
  { id: "env",   label: "Apps Script 環境", desc: "確認頁面在 GAS 執行環境中開啟", status: "idle" },
  { id: "drive", label: "Google Drive 授權", desc: "確認可存取 Drive 以建立表單文件",  status: "idle" }
];

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function patch(
  prev: CheckItem[],
  id: string,
  update: Partial<CheckItem>
): CheckItem[] {
  return prev.map((c) => (c.id === id ? { ...c, ...update } : c));
}

export function StartupScreen({ onReady }: { onReady: (auth: DriveAuthState) => void }) {
  const [checks, setChecks] = useState<CheckItem[]>(INITIAL);
  const [phase, setPhase] = useState<"running" | "success" | "failed">("running");

  const set = (id: string, update: Partial<CheckItem>) =>
    setChecks((prev) => patch(prev, id, update));

  async function run() {
    setChecks(INITIAL.map((c) => ({ ...c, status: "idle" as CheckStatus })));
    setPhase("running");

    await delay(200);

    // Check 1: GAS environment
    set("env", { status: "checking" });
    await delay(500);
    const google = (window as any).google;
    const hasGas = !!google?.script?.run?.withSuccessHandler;
    if (!hasGas) {
      set("env", { status: "error", message: "請從 Google Apps Script Web App 開啟此頁面，無法在本地環境執行。" });
      setPhase("failed");
      return;
    }
    set("env", { status: "ok" });
    await delay(350);

    // Check 2: Drive auth
    set("drive", { status: "checking" });
    try {
      const raw = await callGas<string>((runner) => (runner as any).authorizeDriveAccess());
      const auth = parseAuthMessage(toPlainText(raw));
      if (auth.status === "ok") {
        set("drive", { status: "ok" });
        setPhase("success");
        await delay(700);
        onReady(auth);
      } else {
        set("drive", {
          status: "error",
          message: auth.message,
          authUrl: auth.authUrl
        });
        setPhase("failed");
      }
    } catch (e) {
      set("drive", {
        status: "error",
        message: e instanceof Error ? e.message : String(e)
      });
      setPhase("failed");
    }
  }

  useEffect(() => { run(); }, []);

  const hasFailed = checks.some((c) => c.status === "error");

  return (
    <div className="min-h-screen bg-[#f0f2f7] flex items-center justify-center p-4">
      <div className="bg-white border border-[#d7dce8] rounded-2xl shadow-sm w-full max-w-sm p-8">

        <div className="mb-7">
          <h1 className="text-[18px] font-bold text-[#1a1d29] mb-1">系統初始化</h1>
          <p className="text-[13px] text-[#5a6175]">
            {phase === "running" && "正在檢查執行環境…"}
            {phase === "success" && "所有項目通過，正在進入系統…"}
            {phase === "failed" && "部分項目需要處理，請依提示操作後重新檢查。"}
          </p>
        </div>

        <ul className="space-y-5">
          {checks.map((check) => (
            <li key={check.id} className="flex items-start gap-3">
              <StatusDot status={check.status} />
              <div className="flex-1 min-w-0 pt-px">
                <div className={`text-[14px] font-semibold leading-snug ${
                  check.status === "ok"       ? "text-[#2e7d32]" :
                  check.status === "error"    ? "text-[#c62828]" :
                  check.status === "checking" ? "text-[#0a66c2]" :
                  "text-[#9aa0b0]"
                }`}>
                  {check.label}
                </div>
                <div className="text-[12px] text-[#8892a6] mt-0.5">{check.desc}</div>
                {check.message && (
                  <div className="text-[12px] text-[#c62828] mt-1 break-words leading-relaxed">
                    {check.message}
                  </div>
                )}
                {check.authUrl && (
                  <a
                    href={check.authUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block mt-2 text-[12px] font-medium text-white bg-[#0a66c2] px-3 py-1.5 rounded-lg hover:bg-[#084e99] transition-colors"
                  >
                    前往授權 →
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>

        {hasFailed && (
          <button
            type="button"
            onClick={run}
            className="mt-8 w-full bg-[#0a66c2] text-white text-[14px] font-medium rounded-lg py-2.5 hover:bg-[#084e99] transition-colors"
          >
            重新檢查
          </button>
        )}

        {phase === "success" && (
          <div className="mt-6 flex items-center justify-center gap-2 text-[13px] text-[#2e7d32] font-medium">
            <span>✓</span>
            <span>檢查完成，載入中…</span>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: CheckStatus }) {
  const base = "mt-[3px] w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center";

  if (status === "idle") {
    return <span className={`${base} border-2 border-[#d0d5e0]`} />;
  }

  if (status === "checking") {
    return (
      <span className={`${base} border-2 border-[#0a66c2] border-t-transparent animate-spin`} />
    );
  }

  if (status === "ok") {
    return (
      <span className={`${base} bg-[#4caf50]`}>
        <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
          <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }

  return (
    <span className={`${base} bg-[#ef5350]`}>
      <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
        <path d="M1 1L7 7M7 1L1 7" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    </span>
  );
}

import React, { useEffect, useMemo, useState } from "react";
import type { DriveAuthState, FormValues, MessageState, SharedUser, VersionRow } from "../types";
import type { CopyResponse } from "../types";
import { callGas } from "../utils/callGas";
import { parseJsonMaybe, toSlashDate, toPlainText, toChineseName } from "../utils/helpers";
import { inlineMarkdown } from "../utils/markdown";
import { SearchableSelect, MultiSearchableSelect } from "./SearchableSelect";

const MARKDOWN_DEFAULT = "# 系統規格書\n\n請在此輸入規格內容。";

const TD =
  "border border-[#888] py-[7px] px-[10px] align-middle";
const SECTION_TH =
  "border border-[#888] bg-[#3a3a3a] text-white text-center font-semibold text-[14px] tracking-[2px] py-[9px] px-[9px]";
const COL_HEADER = `${TD} font-bold text-center bg-[#f0f0f0]`;
const FIELD_LABEL =
  `${TD} font-bold text-center bg-[#f0f0f0] w-[100px] whitespace-nowrap`;
const TEXT_INPUT =
  "w-full border-0 border-b border-b-[#aaa] bg-transparent font-[inherit] text-[13px] py-[2px] px-1 outline-none transition-colors focus:border-b-[#0a66c2] focus:bg-[#f0f6ff]";
const DATE_INPUT =
  "w-auto border-0 border-b border-b-[#aaa] bg-transparent font-[inherit] text-[13px] py-[2px] px-1 outline-none";
const TEXTAREA_CLS =
  "w-full resize-y min-h-[80px] border border-[#ccc] rounded-[3px] py-1.5 px-2 bg-transparent font-[inherit] text-[13px] outline-none transition-colors focus:border-[#0a66c2]";
const CHECK_LABEL =
  "flex items-center gap-[5px] cursor-pointer whitespace-nowrap";
const CHECK_INPUT = "!w-auto border-none accent-[#0a66c2] cursor-pointer";

export function A01FormPage({
  authState,
  onRefreshAuth,
  onBack
}: {
  authState: DriveAuthState;
  onRefreshAuth: () => void;
  onBack: () => void;
}) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [activeTab, setActiveTab] = useState<"form" | "spec">("form");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<MessageState>({ kind: "none", text: "" });
  const [specFileName, setSpecFileName] = useState("");
  const [specMarkdown, setSpecMarkdown] = useState(MARKDOWN_DEFAULT);
  const [form, setForm] = useState<FormValues>({
    date: today,
    product: "",
    productContact: "",
    devLead: "",
    versionRows: [{ date: today, code: "V1.0", person: "", desc: "初版" }],
    item: "",
    jira: "",
    sensitive: "none",
    sensitiveDetail: "",
    security: "existing",
    securityDetail: "",
    description: "",
    signer: [],
    tester: [],
    productOwner: [],
    manager: [],
    newFeature: false,
    modifyFeature: false,
    api: false,
    sdk: false,
    backend: false,
    dataCenter: false,
    database: false,
    other: false,
    signDevLead: []
  });

  const [sharedUsers, setSharedUsers] = useState<SharedUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function warmUp() {
      for (let i = 0; i < 5; i++) {
        if (cancelled) return;
        try {
          await callGas((runner) => { (runner as any).warmUpDrive(); });
          return;
        } catch {}
        await new Promise<void>((r) => setTimeout(r, 2000 * (i + 1)));
      }
    }
    warmUp();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      setUsersLoading(true);
      for (let attempt = 0; attempt <= 2; attempt++) {
        if (cancelled) return;
        try {
          const raw = await callGas<string>((runner) => {
            (runner as any).getSharedUsers("a01");
          });
          if (cancelled) return;
          const parsed = parseJsonMaybe<{ ok?: boolean; users?: SharedUser[] }>(raw);
          if (parsed?.ok && Array.isArray(parsed.users) && parsed.users.length > 0) {
            setSharedUsers(parsed.users);
            break;
          }
        } catch {}
        if (attempt < 2) {
          await new Promise<void>((r) => setTimeout(r, 1500 * (attempt + 1)));
        }
      }
      if (!cancelled) setUsersLoading(false);
    }

    loadUsers();
    return () => { cancelled = true; };
  }, []);

const previewHtml = useMemo(() => inlineMarkdown(specMarkdown), [specMarkdown]);

  function setValue<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function updateVersionRow(idx: number, key: keyof VersionRow, value: string) {
    setForm((prev) => ({
      ...prev,
      versionRows: prev.versionRows.map((row, i) => i === idx ? { ...row, [key]: value } : row)
    }));
  }

  function addVersionRow() {
    setForm((prev) => ({
      ...prev,
      versionRows: [...prev.versionRows, { date: today, code: "", person: "", desc: "" }]
    }));
  }

  function removeVersionRow(idx: number) {
    setForm((prev) => ({
      ...prev,
      versionRows: prev.versionRows.filter((_, i) => i !== idx)
    }));
  }

  async function submitForm() {
    if (!authState.checked || authState.status !== "ok") {
      setResult({ kind: "error", text: "請先完成 Drive 授權後再建立文件。" });
      onRefreshAuth();
      return;
    }

    const config: Record<string, unknown> = {
      replaceText: {
        "{{日期}}": toSlashDate(form.date),
        "{{需求產品}}": toPlainText(form.product),
        "{{產品窗口}}": toChineseName(form.productContact),
        "{{開發負責人}}": toChineseName(form.devLead),
        "{{開發負責人S}}": form.signDevLead.map(toChineseName).join("\n"),
        "{{項目}}": toPlainText(form.item),
        "{{JIRA}}": toPlainText(form.jira),
        "{{說明}}": toPlainText(form.description),
        "{{經辦}}": form.signer.map(toChineseName).join("\n"),
        "{{測試人員確認}}": form.tester.map(toChineseName).join("\n"),
        "{{產品負責人}}": form.productOwner.map(toChineseName).join("\n"),
        "{{部門主管}}": form.manager.map(toChineseName).join("\n"),
        "{{新增功能}}": form.newFeature ? "⬛" : "⬚",
        "{{修改功能}}": form.modifyFeature ? "⬛" : "⬚",
        "{{API}}": form.api ? "⬛" : "⬚",
        "{{SDK}}": form.sdk ? "⬛" : "⬚",
        "{{後台}}": form.backend ? "⬛" : "⬚",
        "{{數據中心}}": form.dataCenter ? "⬛" : "⬚",
        "{{資料庫}}": form.database ? "⬛" : "⬚",
        "{{其他}}": form.other ? "⬛" : "⬚",
        "{{無涉及機敏資訊}}": form.sensitive === "none" ? "⬛" : "⬚",
        "{{涉及部分資訊}}": form.sensitive === "partial" ? "⬛" : "⬚",
        "{{涉及部分資訊說明}}": toPlainText(form.sensitiveDetail),
        "{{按照既有資安架構}}": form.security === "existing" ? "⬛" : "⬚",
        "{{額外套用條件}}": form.security === "extra" ? "⬛" : "⬚",
        "{{額外套用條件說明}}": toPlainText(form.securityDetail)
      }
    };

    config.tableRows = [{
      marker: "{{版本編號}}",
      rows: form.versionRows.map((r) => [
        toSlashDate(r.date),
        r.code || "V1.0",
        toChineseName(r.person),
        r.desc || ""
      ])
    }];

    if ((specMarkdown || "").trim()) {
      config.markdownRenderMode = "rich";
      config.markdownSections = [{ title: "系統規格書", content: String(specMarkdown) }];
    }

    setSubmitting(true);
    setResult({ kind: "none", text: "" });
    try {
      const raw = await callGas<string>((runner) => {
        (runner as any).copyFormTemplate("a01", config);
      });
      const parsed = parseJsonMaybe<CopyResponse>(raw);
      const success =
        (typeof parsed === "object" && parsed !== null && (parsed as CopyResponse).newFileUrl) ||
        (typeof raw === "string" && raw.indexOf("newFileUrl") >= 0);

      if (success && parsed && "newFileUrl" in parsed && parsed.newFileUrl) {
        setResult({
          kind: "success",
          text: `建立成功：${parsed.newName || "文件已建立"}`,
          url: parsed.newFileUrl
        });
      } else {
        const errorMessage =
          typeof raw === "string"
            ? toPlainText(parseJsonMaybe<CopyResponse>(raw)?.error || raw)
            : "建立失敗";
        setResult({ kind: "error", text: errorMessage });
      }
    } catch (error) {
      setResult({ kind: "error", text: error instanceof Error ? error.message : String(error) });
    } finally {
      setSubmitting(false);
    }
  }

  function updateSpecFromFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSpecFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setSpecMarkdown(String(reader.result || ""));
    reader.onerror = () => setResult({ kind: "error", text: "檔案讀取失敗，請確認編碼後重試" });
    reader.readAsText(file, "utf-8");
  }

  const tabBase =
    "border rounded-lg py-2 px-3.5 text-[13px] cursor-pointer font-[inherit]";
  const tabActive = "border-[#0a66c2] text-[#0a66c2] bg-[#eef6ff] font-semibold";
  const tabInactive = "border-[#c8d0df] bg-white text-[#445]";

  return (
    <section className="max-w-[900px] mx-auto mt-8 px-4 pb-[60px]">
      <button className="back-btn" type="button" onClick={onBack}>
        ← 返回選單
      </button>

      <div className="flex gap-2 mb-3.5">
        <button
          type="button"
          className={`${tabBase} ${activeTab === "form" ? tabActive : tabInactive}`}
          onClick={() => setActiveTab("form")}
        >
          需求資料
        </button>
        <button
          type="button"
          className={`${tabBase} ${activeTab === "spec" ? tabActive : tabInactive}`}
          onClick={() => setActiveTab("spec")}
        >
          系統規格書
        </button>
      </div>

      <div className="bg-white border border-[#c0c6d4] py-8 px-10">
        {activeTab === "form" ? (
          <div>
            {/* ── Header ── */}
            <div className="flex items-start mb-5 gap-3">
              <div className="text-[12px] leading-[1.7] min-w-[220px]">
                <strong className="text-[14px] block">遊戲橘子數位科技股份有限公司</strong>
                Gamania Digital Entertainment Co., Ltd.
              </div>
              <div className="flex-1 text-center text-[20px] font-bold tracking-[4px] pt-[6px]">
                開發需求單
              </div>
              <div className="text-[13px] whitespace-nowrap pt-[6px]">
                機密等級：內部限閱
              </div>
            </div>

            <div className="flex justify-between items-center mb-5 text-[13px]">
              <span>編號：（自動產生）</span>
              <span>
                日期：
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setValue("date", e.target.value)}
                  className={DATE_INPUT}
                />
              </span>
            </div>

            {/* ── 需求紀錄 ── */}
            <table className="w-full border-collapse mb-3.5">
              <tbody>
                <tr>
                  <th className={SECTION_TH} colSpan={3}>需求紀錄</th>
                </tr>
                <tr>
                  <td className={TD}>
                    需求產品：
                    <input
                      type="text"
                      value={form.product}
                      onChange={(e) => setValue("product", e.target.value)}
                      placeholder="產品名稱"
                      className={TEXT_INPUT}
                    />
                  </td>
                  <td className={TD}>
                    產品窗口：
                    <SearchableSelect
                      value={form.productContact}
                      onChange={(v) => setValue("productContact", v)}
                      options={sharedUsers}
                      loading={usersLoading}
                      placeholder="搜尋姓名"
                    />
                  </td>
                  <td className={TD}>
                    開發負責人：
                    <SearchableSelect
                      value={form.devLead}
                      onChange={(v) => setValue("devLead", v)}
                      options={sharedUsers}
                      loading={usersLoading}
                      placeholder="搜尋姓名"
                    />
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── 版本歷程 ── */}
            <table className="w-full border-collapse mb-3.5">
              <tbody>
                <tr>
                  <th className={SECTION_TH} colSpan={5}>版本歷程</th>
                </tr>
                <tr>
                  <th className={COL_HEADER}>日期</th>
                  <th className={COL_HEADER}>版本編號</th>
                  <th className={COL_HEADER}>開發人員</th>
                  <th className={COL_HEADER}>版本描述</th>
                  <th className={`${COL_HEADER} w-[36px]`}></th>
                </tr>
                {form.versionRows.map((row, idx) => (
                  <tr key={idx}>
                    <td className={TD}>
                      <input
                        type="date"
                        value={row.date}
                        onChange={(e) => updateVersionRow(idx, "date", e.target.value)}
                        className={TEXT_INPUT}
                      />
                    </td>
                    <td className={TD}>
                      <input
                        type="text"
                        value={row.code}
                        onChange={(e) => updateVersionRow(idx, "code", e.target.value)}
                        placeholder="V1.0"
                        className={TEXT_INPUT}
                      />
                    </td>
                    <td className={TD}>
                      <SearchableSelect
                        value={row.person}
                        onChange={(v) => updateVersionRow(idx, "person", v)}
                        options={sharedUsers}
                        loading={usersLoading}
                        placeholder="搜尋姓名"
                      />
                    </td>
                    <td className={TD}>
                      <input
                        type="text"
                        value={row.desc}
                        onChange={(e) => updateVersionRow(idx, "desc", e.target.value)}
                        placeholder="初版"
                        className={TEXT_INPUT}
                      />
                    </td>
                    <td className={`${TD} text-center`}>
                      {form.versionRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeVersionRow(idx)}
                          className="text-[#aaa] hover:text-[#c62828] text-[16px] leading-none"
                          title="刪除此列"
                        >✕</button>
                      )}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td colSpan={5} className={TD}>
                    <button
                      type="button"
                      onClick={addVersionRow}
                      className="text-[#0a66c2] text-[13px] hover:underline"
                    >＋ 新增版本</button>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── 需求說明 ── */}
            <table className="w-full border-collapse mb-3.5">
              <tbody>
                <tr>
                  <th className={SECTION_TH} colSpan={2}>需求說明</th>
                </tr>
                <tr>
                  <td className={FIELD_LABEL}>項目</td>
                  <td className={TD}>
                    <input
                      type="text"
                      value={form.item}
                      onChange={(e) => setValue("item", e.target.value)}
                      placeholder="需求項目名稱（也用於檔案命名）"
                      className={TEXT_INPUT}
                    />
                  </td>
                </tr>
                <tr>
                  <td className={FIELD_LABEL}>JIRA</td>
                  <td className={TD}>
                    <input
                      type="text"
                      value={form.jira}
                      onChange={(e) => setValue("jira", e.target.value)}
                      placeholder="GXY-XXXX"
                      className={TEXT_INPUT}
                    />
                  </td>
                </tr>
                <tr>
                  <td className={FIELD_LABEL}>類型</td>
                  <td className={TD}>
                    <div className="flex flex-wrap gap-[18px] items-center py-[3px]">
                      <label className={CHECK_LABEL}>
                        <input
                          type="checkbox"
                          checked={form.newFeature}
                          onChange={(e) => setValue("newFeature", e.target.checked)}
                          className={CHECK_INPUT}
                        />
                        新增功能
                      </label>
                      <label className={CHECK_LABEL}>
                        <input
                          type="checkbox"
                          checked={form.modifyFeature}
                          onChange={(e) => setValue("modifyFeature", e.target.checked)}
                          className={CHECK_INPUT}
                        />
                        修改功能
                      </label>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className={FIELD_LABEL}>異動處</td>
                  <td className={TD}>
                    <div className="flex flex-wrap gap-[18px] items-center py-[3px]">
                      <label className={CHECK_LABEL}>
                        <input
                          type="checkbox"
                          checked={form.api}
                          onChange={(e) => setValue("api", e.target.checked)}
                          className={CHECK_INPUT}
                        />
                        API
                      </label>
                      <label className={CHECK_LABEL}>
                        <input
                          type="checkbox"
                          checked={form.sdk}
                          onChange={(e) => setValue("sdk", e.target.checked)}
                          className={CHECK_INPUT}
                        />
                        SDK
                      </label>
                      <label className={CHECK_LABEL}>
                        <input
                          type="checkbox"
                          checked={form.backend}
                          onChange={(e) => setValue("backend", e.target.checked)}
                          className={CHECK_INPUT}
                        />
                        後台
                      </label>
                      <label className={CHECK_LABEL}>
                        <input
                          type="checkbox"
                          checked={form.dataCenter}
                          onChange={(e) => setValue("dataCenter", e.target.checked)}
                          className={CHECK_INPUT}
                        />
                        數據中心
                      </label>
                      <label className={CHECK_LABEL}>
                        <input
                          type="checkbox"
                          checked={form.database}
                          onChange={(e) => setValue("database", e.target.checked)}
                          className={CHECK_INPUT}
                        />
                        資料庫
                      </label>
                      <label className={CHECK_LABEL}>
                        <input
                          type="checkbox"
                          checked={form.other}
                          onChange={(e) => setValue("other", e.target.checked)}
                          className={CHECK_INPUT}
                        />
                        其他
                      </label>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className={FIELD_LABEL}>機敏性評估</td>
                  <td className={TD}>
                    <div className="flex flex-wrap gap-[18px] items-center py-[3px]">
                      <label className={CHECK_LABEL}>
                        <input
                          type="radio"
                          name="a01-sensitive"
                          value="none"
                          checked={form.sensitive === "none"}
                          onChange={() => setValue("sensitive", "none")}
                          className={CHECK_INPUT}
                        />
                        無涉及機敏資訊
                      </label>
                      <div className="flex items-center gap-1.5">
                        <label className={CHECK_LABEL}>
                          <input
                            type="radio"
                            name="a01-sensitive"
                            value="partial"
                            checked={form.sensitive === "partial"}
                            onChange={() => setValue("sensitive", "partial")}
                            className={CHECK_INPUT}
                          />
                          涉及部分資訊，如：
                        </label>
                        <input
                          type="text"
                          value={form.sensitiveDetail}
                          onChange={(e) => setValue("sensitiveDetail", e.target.value)}
                          placeholder="說明"
                          className={`${TEXT_INPUT} !w-[140px]`}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className={FIELD_LABEL}>資訊安全評估</td>
                  <td className={TD}>
                    <div className="flex flex-wrap gap-[18px] items-center py-[3px]">
                      <label className={CHECK_LABEL}>
                        <input
                          type="radio"
                          name="a01-security"
                          value="existing"
                          checked={form.security === "existing"}
                          onChange={() => setValue("security", "existing")}
                          className={CHECK_INPUT}
                        />
                        按照既有資安架構
                      </label>
                      <div className="flex items-center gap-1.5">
                        <label className={CHECK_LABEL}>
                          <input
                            type="radio"
                            name="a01-security"
                            value="extra"
                            checked={form.security === "extra"}
                            onChange={() => setValue("security", "extra")}
                            className={CHECK_INPUT}
                          />
                          額外套用條件，如：
                        </label>
                        <input
                          type="text"
                          value={form.securityDetail}
                          onChange={(e) => setValue("securityDetail", e.target.value)}
                          placeholder="說明"
                          className={`${TEXT_INPUT} !w-[140px]`}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td className={FIELD_LABEL}>說明</td>
                  <td className={TD}>
                    <textarea
                      value={form.description}
                      onChange={(e) => setValue("description", e.target.value)}
                      placeholder="需求說明內容"
                      className={TEXTAREA_CLS}
                    />
                  </td>
                </tr>
              </tbody>
            </table>

            {/* ── 電子簽核 ── */}
            <table className="w-full border-collapse mb-3.5">
              <tbody>
                <tr>
                  <th className={SECTION_TH} colSpan={5}>電子簽核</th>
                </tr>
                <tr>
                  <th className={COL_HEADER}>開發負責人</th>
                  <th className={COL_HEADER}>經辦</th>
                  <th className={COL_HEADER}>測試人員確認</th>
                  <th className={COL_HEADER}>產品負責人</th>
                  <th className={COL_HEADER}>部門主管</th>
                </tr>
                <tr>
                  <td className={`${TD} text-center`}>
                    <MultiSearchableSelect
                      value={form.signDevLead}
                      onChange={(v) => setValue("signDevLead", v)}
                      options={sharedUsers}
                      loading={usersLoading}
                      placeholder="搜尋姓名"
                    />
                  </td>
                  <td className={`${TD} text-center`}>
                    <MultiSearchableSelect
                      value={form.signer}
                      onChange={(v) => setValue("signer", v)}
                      options={sharedUsers}
                      loading={usersLoading}
                      placeholder="搜尋姓名"
                    />
                  </td>
                  <td className={`${TD} text-center`}>
                    <MultiSearchableSelect
                      value={form.tester}
                      onChange={(v) => setValue("tester", v)}
                      options={sharedUsers}
                      loading={usersLoading}
                      placeholder="搜尋姓名"
                    />
                  </td>
                  <td className={`${TD} text-center`}>
                    <MultiSearchableSelect
                      value={form.productOwner}
                      onChange={(v) => setValue("productOwner", v)}
                      options={sharedUsers}
                      loading={usersLoading}
                      placeholder="搜尋姓名"
                    />
                  </td>
                  <td className={`${TD} text-center`}>
                    <MultiSearchableSelect
                      value={form.manager}
                      onChange={(v) => setValue("manager", v)}
                      options={sharedUsers}
                      loading={usersLoading}
                      placeholder="搜尋姓名"
                    />
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="mt-6 text-center">
              <button
                type="button"
                className="bg-[#0a66c2] text-white border-none rounded-md py-[13px] px-12 text-[15px] cursor-pointer font-[inherit] tracking-[1px] transition-colors hover:bg-[#084e99] disabled:bg-[#aaa] disabled:cursor-not-allowed"
                onClick={submitForm}
                disabled={submitting}
              >
                {submitting ? "建立中…" : "建立文件"}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-left text-[20px] font-bold tracking-[4px]">
              系統規格書（Markdown）
            </div>
            <p className="mt-0 mb-3 text-[#5b6277] text-[13px] leading-[1.6]">
              可直接編輯 Markdown，或上傳 `.md` 檔案。
            </p>

            <div className="flex flex-wrap gap-2.5 items-center mb-3">
              <label className="relative overflow-hidden inline-block border border-[#0a66c2] bg-white text-[#0a66c2] rounded-md py-2.5 px-3.5 text-sm cursor-pointer font-[inherit] hover:opacity-90">
                上傳 MD 檔案
                <input
                  type="file"
                  accept=".md,.markdown,text/markdown,text/plain"
                  onChange={updateSpecFromFile}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
              </label>
              <button
                type="button"
                className="border border-[#0a66c2] bg-white text-[#0a66c2] rounded-md py-2.5 px-3.5 text-sm cursor-pointer font-[inherit] hover:opacity-90"
                onClick={() => setSpecMarkdown("")}
              >
                清空內容
              </button>
              <span className="text-xs text-[#666]">
                {specFileName || "尚未上傳檔案"}
              </span>
            </div>

            <textarea
              value={specMarkdown}
              onChange={(e) => setSpecMarkdown(e.target.value)}
              className="w-full min-h-[220px] border border-[#c8d0df] rounded-lg py-2.5 px-3 bg-white font-mono text-xs leading-[1.6] resize-y mb-3.5"
              placeholder="# 系統規格書"
            />

            <div className="border border-[#d7dce8] rounded-lg bg-white overflow-hidden">
              <div className="py-2 px-3 bg-[#f4f7fc] text-xs text-[#556] border-b border-[#e2e7f1]">
                預覽
              </div>
              <div
                className={`spec-preview${previewHtml ? "" : " empty"}`}
                dangerouslySetInnerHTML={{ __html: previewHtml || "尚未輸入內容" }}
              />
            </div>

            <div className="mt-6 text-center">
              <button
                type="button"
                className="bg-[#0a66c2] text-white border-none rounded-md py-[13px] px-12 text-[15px] cursor-pointer font-[inherit] tracking-[1px] transition-colors hover:bg-[#084e99] disabled:bg-[#aaa] disabled:cursor-not-allowed"
                onClick={submitForm}
                disabled={submitting}
              >
                {submitting ? "建立中…" : "建立文件"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Result ── */}
      <div id="result" className="mt-6">
        {result.kind === "error" ? (
          <div className="bg-[#fdecea] border border-[#ef9a9a] rounded-lg py-4 px-5 text-[#c62828] text-[14px]">
            ❌ 建立失敗：{result.text}
          </div>
        ) : null}
        {result.kind === "success" ? (
          <div className="bg-[#e8f5e9] border border-[#66bb6a] rounded-lg py-6 px-7">
            <h3 className="m-0 mb-2.5 text-[#2e7d32] text-[16px]">✅ 文件建立成功</h3>
            <div className="text-[13px] text-[#555] mb-4">{result.text}</div>
            {result.url ? (
              <a
                className="inline-block bg-[#0a66c2] text-white no-underline rounded-md py-2.5 px-7 text-sm hover:bg-[#084e99]"
                href={result.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                開啟文件 →
              </a>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

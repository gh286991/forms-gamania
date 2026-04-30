import React, { useState } from "react";

const ENDPOINT_URL =
  "https://script.google.com/macros/s/AKfycbx7Wv8uLqdJnkEID4o_Yd3qqnVnlugeDfSV9LiCm2JWV7AmX2NtF_eyERogYozF1QmI/exec";

const DRIVE_EXAMPLES_URL =
  "https://drive.google.com/drive/folders/1H3-jbJnZV6uBCv2M_guuy5paP0BlRhOT?usp=drive_link";

const SAMPLE_REQUEST = `{
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
    "type": { "newFeature": true, "modifyFeature": false },
    "changeArea": {
      "api": true, "sdk": false, "backend": true,
      "dataCenter": false, "database": false, "other": false
    },
    "sensitive": { "mode": "none", "detail": "" },
    "security": { "mode": "existing", "detail": "" },
    "versionRows": [
      { "date": "2026-04-24", "code": "V1.0", "person": "Tom", "desc": "初版" }
    ],
    "specMarkdown": "# 系統規格書\\n\\n這裡放 Markdown 內容。"
  }
}`;

const CURL_EXAMPLE = `curl -X POST \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $(cat ~/.clasprc.json | jq -r '.tokens.default.access_token')" \\
  -d @examples/a01-content.sample.json \\
  "${ENDPOINT_URL}"`;

const SCRIPT_EXAMPLE = `# 步驟一：複製範例
cp examples/a01-content.sample.json examples/my-a01.json

# 步驟二：編輯 my-a01.json 填入資料

# 步驟三：執行
node examples/call-form.mjs examples/my-a01.json`;

const PROGRESS_EXAMPLE = `建立 A01 表單...
複製範本 [████░░░░░░░░░░░░░░░░░░░░░░░░░░]  13%  1.2s
填入內容 [████████████████████░░░░░░░░░░]  65%  8.4s
渲染規格 [██████████████████████████████] 100%  12.1s  ✅
建立成功：https://docs.google.com/document/d/xxx/edit`;

const SPEC_FILES_EXAMPLE = `{
  "a01": {
    "specMarkdownFiles": [
      "./templates/spec-overview.md",
      "./templates/spec-api.md"
    ]
  }
}`;

type FieldRow = {
  field: string;
  type: string;
  required?: boolean;
  desc: React.ReactNode;
};

const BASIC_FIELDS: FieldRow[] = [
  { field: "date", type: "string", required: true, desc: "日期，格式 YYYY-MM-DD" },
  { field: "product", type: "string", required: true, desc: "需求產品名稱" },
  { field: "productContact", type: "string", required: true, desc: "產品窗口姓名" },
  { field: "devLead", type: "string", required: true, desc: "開發負責人姓名" },
  { field: "signDevLead", type: "string[]", required: true, desc: "負責人簽核欄，通常與 devLead 相同，可多人" },
  { field: "item", type: "string", required: true, desc: "上版項目說明，同時作為文件檔名的一部分" },
  { field: "jira", type: "string", desc: "JIRA 票號，例如 GXY-1234" },
  { field: "description", type: "string", required: true, desc: "變更說明" },
];

const SIGNER_FIELDS: FieldRow[] = [
  { field: "signer", type: "string[]", required: true, desc: "經辦人員，可多人" },
  { field: "tester", type: "string[]", required: true, desc: "測試人員，可多人" },
  { field: "productOwner", type: "string[]", required: true, desc: "產品負責人，可多人" },
  { field: "manager", type: "string[]", required: true, desc: "部門主管，可多人" },
];

const CHANGE_TYPE_FIELDS: FieldRow[] = [
  { field: "type.newFeature", type: "boolean", desc: "新增功能" },
  { field: "type.modifyFeature", type: "boolean", desc: "修改既有功能" },
];

const CHANGE_AREA_FIELDS: FieldRow[] = [
  { field: "changeArea.api", type: "boolean", desc: "API" },
  { field: "changeArea.sdk", type: "boolean", desc: "SDK" },
  { field: "changeArea.backend", type: "boolean", desc: "後台" },
  { field: "changeArea.dataCenter", type: "boolean", desc: "數據中心" },
  { field: "changeArea.database", type: "boolean", desc: "資料庫" },
  { field: "changeArea.other", type: "boolean", desc: "其他" },
];

const SENSITIVE_FIELDS: FieldRow[] = [
  { field: "sensitive.mode", type: '"none" | "partial"', desc: 'none：無涉及；partial：涉及部分資訊' },
  { field: "sensitive.detail", type: "string", desc: 'mode 為 partial 時填寫說明' },
];

const SECURITY_FIELDS: FieldRow[] = [
  { field: "security.mode", type: '"existing" | "extra"', desc: 'existing：按照既有架構；extra：額外套用條件' },
  { field: "security.detail", type: "string", desc: 'mode 為 extra 時填寫說明' },
];

const VERSION_FIELDS: FieldRow[] = [
  { field: "versionRows", type: "object[]", required: true, desc: "版本紀錄，至少一筆" },
  { field: "versionRows[].date", type: "string", required: true, desc: "日期，格式 YYYY-MM-DD" },
  { field: "versionRows[].code", type: "string", required: true, desc: "版本號，例如 V1.0" },
  { field: "versionRows[].person", type: "string", required: true, desc: "修改人員" },
  { field: "versionRows[].desc", type: "string", required: true, desc: "修改說明" },
];

const SPEC_FIELDS: FieldRow[] = [
  { field: "specMarkdown", type: "string | string[]", desc: "Markdown 內容；傳陣列時多份以分隔線串接" },
  { field: "specMarkdownFiles", type: "string[]", desc: "Markdown 檔案路徑（腳本用），自動讀取並轉成 specMarkdown" },
];

const CODE_CLS = "bg-[#f1f3f8] rounded px-[5px] py-px text-[12px] font-mono text-gray-800";
const TH_CLS = "text-left px-3 py-2 text-[#283148] font-semibold bg-[#eef2fa] border-b border-gray-200 whitespace-nowrap text-[13px]";
const TD_CLS = "px-3 py-2 align-top border-b border-gray-100 text-[13px]";

function InlineCode({ children }: { children: React.ReactNode }) {
  return <code className={CODE_CLS}>{children}</code>;
}

function FieldTable({ title, fields }: { title: string; fields: FieldRow[] }) {
  return (
    <div className="mt-4">
      <p className="text-[13px] font-semibold text-gray-600 mb-1">{title}</p>
      <div className="overflow-x-auto rounded border border-gray-200">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className={TH_CLS}>欄位</th>
              <th className={TH_CLS}>型別</th>
              <th className={TH_CLS + " text-center"}>必填</th>
              <th className={TH_CLS}>說明</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((f) => (
              <tr key={f.field} className="even:bg-gray-50">
                <td className={TD_CLS}><InlineCode>{f.field}</InlineCode></td>
                <td className={TD_CLS}><InlineCode>{f.type}</InlineCode></td>
                <td className={TD_CLS + " text-center"}>{f.required ? "✓" : ""}</td>
                <td className={TD_CLS}>{f.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// JSON syntax highlighting
function renderJsonHighlight(json: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|(true|false|null)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}\[\],])|(\s+|[^\S\n]*\n[^\S\n]*)/g;
  let last = 0;
  let idx = 0;
  let m: RegExpExecArray | null;

  while ((m = re.exec(json)) !== null) {
    if (m.index > last) {
      parts.push(<React.Fragment key={idx++}>{json.slice(last, m.index)}</React.Fragment>);
    }
    if (m[1] !== undefined) {
      if (m[2]) {
        parts.push(<span key={idx++} style={{ color: "#79b8ff" }}>{m[1]}</span>);
        parts.push(<span key={idx++} style={{ color: "#e1e4e8" }}>{m[2]}</span>);
      } else {
        parts.push(<span key={idx++} style={{ color: "#9ecbff" }}>{m[1]}</span>);
      }
    } else if (m[3]) {
      parts.push(<span key={idx++} style={{ color: "#f97583" }}>{m[3]}</span>);
    } else if (m[4]) {
      parts.push(<span key={idx++} style={{ color: "#ffab70" }}>{m[4]}</span>);
    } else if (m[5]) {
      parts.push(<span key={idx++} style={{ color: "#e1e4e8" }}>{m[5]}</span>);
    } else {
      parts.push(<React.Fragment key={idx++}>{m[0]}</React.Fragment>);
    }
    last = re.lastIndex;
  }

  if (last < json.length) {
    parts.push(<React.Fragment key={idx++}>{json.slice(last)}</React.Fragment>);
  }
  return parts;
}

function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  const content = lang === "json" ? renderJsonHighlight(code) : code;

  return (
    <div className="relative my-2">
      {lang && (
        <span className="absolute top-2 left-3 text-[11px] text-[#7b8db6] uppercase tracking-wide pointer-events-none">
          {lang}
        </span>
      )}
      <button
        type="button"
        onClick={handleCopy}
        className="absolute top-2 right-2 text-[11px] px-2 py-0.5 border border-[#4a5580] rounded text-[#a0b0d0] bg-transparent hover:bg-[#2e3a50] hover:text-[#f4f7ff] cursor-pointer font-sans"
      >
        {copied ? "已複製" : "複製"}
      </button>
      <pre
        className="m-0 rounded-lg bg-[#1e2433] text-[#f4f7ff] overflow-x-auto text-[12.5px] leading-relaxed"
        style={{ padding: lang ? "30px 14px 14px" : "14px" }}
      >
        <code className="font-mono">{content}</code>
      </pre>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="bg-white border border-gray-200 rounded-lg px-6 py-5 mb-4">
      <h3 className="text-[18px] font-semibold text-gray-900 mb-4 pb-2 border-b border-gray-200">{title}</h3>
      {children}
    </section>
  );
}

function SubSection({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="mt-6">
      <h4 className="text-[14px] font-semibold text-[#374063] mb-2">{title}</h4>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] text-gray-500 leading-relaxed mt-1 mb-2">{children}</p>
  );
}

export function ApiDocView({ onBack }: { onBack: () => void }) {
  return (
    <div className="relative">
      <div className="max-w-5xl mx-auto px-6 py-2">

        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 mb-4 text-[#0a66c2] text-[13px] bg-transparent border-none p-0 cursor-pointer font-sans hover:underline"
        >
          ← 回到選單
        </button>

        <h1 className="text-2xl font-semibold text-gray-900 mb-1">表單 API 說明</h1>
        <p className="text-[14px] text-gray-500 mb-5">
          透過 HTTP POST 建立表單文件，伺服器自動複製 Google Docs 範本並填入內容。
        </p>

        {/* 範例下載 banner */}
        <div className="flex items-center gap-4 px-5 py-4 bg-[#e9f3ff] border border-[#bfdcff] rounded-xl mb-5 flex-wrap">
          <div className="flex flex-col gap-1 flex-1 min-w-[220px]">
            <strong className="text-[15px]">範例檔案下載</strong>
            <span className="text-[13px] text-[#3b6ea5]">包含範例 JSON 與 Markdown 範本，可直接使用或修改。</span>
          </div>
          <a
            href={DRIVE_EXAMPLES_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 px-4 py-2 bg-[#0a66c2] text-white rounded text-[14px] no-underline hover:opacity-90"
          >
            前往 Google Drive 下載
          </a>
        </div>

        {/* ── 0. 快速開始 ── */}
        <Section id="quickstart" title="快速開始">
          <ol className="m-0 pl-5 text-[14px] leading-[2] text-gray-700 list-decimal">
            <li>
              <strong>開啟網頁</strong>　開啟此 Web App 網址，確認頁面正常載入。
            </li>
            <li>
              <strong>授權 Google 帳號</strong>　點選頁面上方的授權提示，同意存取 Google Drive / Docs 權限。
            </li>
            <li>
              <strong>登入 clasp</strong>　在終端機執行以下指令，完成一次性登入；之後 API 呼叫會自動帶入憑證：
              <CodeBlock lang="bash" code={`npm install -g @google/clasp\nnpx clasp login`} />
            </li>
            <li>
              <strong>開始使用</strong>　參考下方 <a href="#examples" className="text-[#0a66c2] hover:underline">使用範例</a> 呼叫 API，或直接使用網頁介面建立表單。
            </li>
          </ol>
        </Section>

        {/* ── 1. API 概覽 ── */}
        <Section id="overview" title="API 概覽">
          <CodeBlock code={`POST ${ENDPOINT_URL}`} />

          <h4 className="text-[14px] font-semibold text-[#374063] mt-4 mb-2">Headers</h4>
          <div className="overflow-x-auto rounded border border-gray-200">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={TH_CLS}>Header</th>
                  <th className={TH_CLS}>值</th>
                  <th className={TH_CLS}>說明</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={TD_CLS}><InlineCode>Content-Type</InlineCode></td>
                  <td className={TD_CLS}><InlineCode>application/json</InlineCode></td>
                  <td className={TD_CLS}>必填</td>
                </tr>
                <tr className="bg-gray-50">
                  <td className={TD_CLS}><InlineCode>Authorization</InlineCode></td>
                  <td className={TD_CLS}><InlineCode>{"Bearer <access_token>"}</InlineCode></td>
                  <td className={TD_CLS}>Web App 非公開時必填</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── 2. Request 格式 ── */}
        <Section id="request" title="Request 格式">
          <CodeBlock
            lang="json"
            code={`{
  "action": "copy_form",
  "form": "a01",
  "a01": { ... }
}`}
          />
          <div className="overflow-x-auto rounded border border-gray-200 mt-2">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  <th className={TH_CLS}>欄位</th>
                  <th className={TH_CLS}>型別</th>
                  <th className={TH_CLS}>說明</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className={TD_CLS}><InlineCode>action</InlineCode></td>
                  <td className={TD_CLS}><InlineCode>string</InlineCode></td>
                  <td className={TD_CLS}>固定填 <InlineCode>"copy_form"</InlineCode></td>
                </tr>
                <tr className="bg-gray-50">
                  <td className={TD_CLS}><InlineCode>form</InlineCode></td>
                  <td className={TD_CLS}><InlineCode>string</InlineCode></td>
                  <td className={TD_CLS}>表單代碼，例如 <InlineCode>"a01"</InlineCode></td>
                </tr>
                <tr>
                  <td className={TD_CLS}><InlineCode>a01</InlineCode></td>
                  <td className={TD_CLS}><InlineCode>object</InlineCode></td>
                  <td className={TD_CLS}>
                    表單內容，見{" "}
                    <a href="#fields-a01" className="text-[#0a66c2] hover:underline">欄位說明 → A01</a>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Section>

        {/* ── 3. Response ── */}
        <Section id="response" title="Response">
          <h4 className="text-[14px] font-semibold text-[#374063] mb-2">成功</h4>
          <CodeBlock
            lang="json"
            code={`{
  "ok": true,
  "newFileUrl": "https://docs.google.com/document/d/xxx/edit"
}`}
          />
          <h4 className="text-[14px] font-semibold text-[#374063] mt-4 mb-2">失敗</h4>
          <CodeBlock
            lang="json"
            code={`{
  "ok": false,
  "error": "錯誤說明"
}`}
          />
        </Section>

        {/* ── 4. 欄位說明 ── */}
        <Section id="fields" title="欄位說明">
          <div id="fields-a01" className="pl-3 border-l-[3px] border-[#0a66c2] mb-2">
            <span className="text-[15px] font-semibold text-[#154273]">A01 — 開發需求單</span>
          </div>

          <FieldTable title="基本資訊" fields={BASIC_FIELDS} />
          <FieldTable title="簽核人員" fields={SIGNER_FIELDS} />
          <FieldTable title="變更類型" fields={CHANGE_TYPE_FIELDS} />
          <Hint>
            <InlineCode>true</InlineCode> → ⬛，<InlineCode>false</InlineCode> → ⬚。兩者可同時為 <InlineCode>true</InlineCode>。
          </Hint>
          <FieldTable title="影響範圍" fields={CHANGE_AREA_FIELDS} />
          <FieldTable title="機敏資訊" fields={SENSITIVE_FIELDS} />
          <FieldTable title="資安架構" fields={SECURITY_FIELDS} />
          <FieldTable title="版本紀錄" fields={VERSION_FIELDS} />
          <FieldTable title="系統規格書" fields={SPEC_FIELDS} />
        </Section>

        {/* ── 5. 使用範例 ── */}
        <Section id="examples" title="使用範例">

          <SubSection id="example-json" title="完整 Request JSON">
            <CodeBlock lang="json" code={SAMPLE_REQUEST} />
          </SubSection>

          <SubSection id="example-curl" title="curl">
            <CodeBlock lang="bash" code={CURL_EXAMPLE} />
          </SubSection>

          <SubSection id="example-script" title="使用 call-form.mjs 腳本">
            <p className="text-[14px] text-gray-700 leading-relaxed mb-2">
              此 repo 提供 <InlineCode>examples/call-form.mjs</InlineCode>，封裝 API 呼叫並提供進度條顯示與 Markdown 檔案讀取。
            </p>

            <CodeBlock lang="bash" code={SCRIPT_EXAMPLE} />
            <CodeBlock code={PROGRESS_EXAMPLE} />

            <p className="text-[13px] font-semibold text-gray-600 mt-4 mb-1">specMarkdownFiles</p>
            <p className="text-[14px] text-gray-700 mb-1">
              規格書可用 <InlineCode>specMarkdownFiles</InlineCode> 指定檔案路徑，腳本自動讀取並轉成 <InlineCode>specMarkdown</InlineCode>：
            </p>
            <CodeBlock lang="json" code={SPEC_FILES_EXAMPLE} />

            <p className="text-[13px] font-semibold text-gray-600 mt-4 mb-1">自訂 Web App URL</p>
            <CodeBlock
              lang="bash"
              code={`WEBAPP_URL="https://script.google.com/macros/s/你的部署ID/exec" \\\n  node examples/call-form.mjs examples/my-a01.json`}
            />
          </SubSection>
        </Section>

        {/* ── 6. 注意事項 ── */}
        <Section id="notes" title="注意事項">
          <ul className="m-0 pl-5 text-[14px] leading-[1.8] text-gray-700">
            <li className="mb-1.5">Web App 非公開時，需提供有效的 <InlineCode>Authorization</InlineCode> header，否則回傳非 JSON 錯誤。</li>
            <li className="mb-1.5">部署設為 <InlineCode>Execute as: Me</InlineCode> 時，建立的文件會在部署者的 Drive 下。</li>
            <li>需要 Node.js 18 以上。</li>
          </ul>
        </Section>

      </div>

      {/* ── 懸浮目錄 ── */}
      <nav
        aria-label="頁面導覽"
        className="fixed right-6 top-6 w-48 bg-white border border-gray-200 rounded-lg px-4 py-3.5 max-h-[calc(100vh-48px)] overflow-auto z-10 shadow-sm"
      >
        <p className="text-[13px] font-semibold text-gray-500 mb-2 mt-0">目錄</p>
        <ul className="m-0 pl-3.5 list-disc marker:text-gray-300">
          <li className="my-1 text-[12px]"><a href="#quickstart" className="text-[#0a66c2] no-underline hover:underline leading-snug">快速開始</a></li>
          <li className="my-1 text-[12px]"><a href="#overview" className="text-[#0a66c2] no-underline hover:underline leading-snug">API 概覽</a></li>
          <li className="my-1 text-[12px]"><a href="#request" className="text-[#0a66c2] no-underline hover:underline leading-snug">Request 格式</a></li>
          <li className="my-1 text-[12px]"><a href="#response" className="text-[#0a66c2] no-underline hover:underline leading-snug">Response</a></li>
          <li className="my-1 text-[12px]">
            <a href="#fields" className="text-[#0a66c2] no-underline hover:underline leading-snug">欄位說明</a>
            <ul className="mt-0.5 pl-3 list-none">
              <li className="my-0.5 text-[12px]"><a href="#fields-a01" className="text-[#0a66c2] no-underline hover:underline">A01</a></li>
            </ul>
          </li>
          <li className="my-1 text-[12px]">
            <a href="#examples" className="text-[#0a66c2] no-underline hover:underline leading-snug">使用範例</a>
            <ul className="mt-0.5 pl-3 list-none">
              <li className="my-0.5 text-[12px]"><a href="#example-json" className="text-[#0a66c2] no-underline hover:underline">完整 JSON</a></li>
              <li className="my-0.5 text-[12px]"><a href="#example-curl" className="text-[#0a66c2] no-underline hover:underline">curl</a></li>
              <li className="my-0.5 text-[12px]"><a href="#example-script" className="text-[#0a66c2] no-underline hover:underline">call-form.mjs</a></li>
            </ul>
          </li>
          <li className="my-1 text-[12px]"><a href="#notes" className="text-[#0a66c2] no-underline hover:underline leading-snug">注意事項</a></li>
        </ul>
      </nav>
    </div>
  );
}

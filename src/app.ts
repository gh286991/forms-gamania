import { buildGreeting, buildSheetRows } from "./lib";

type DriveItemRow = {
  name: string;
  mimeType: string;
  updatedAt: string;
  sizeLabel: string;
  url: string;
  itemType: "資料夾" | "檔案";
};

type DriveListResult = {
  rows: DriveItemRow[];
  truncated: boolean;
};

type FolderResolveResult = {
  folderId: string;
  folderName: string;
  normalizedPath: string;
  ambiguousCount: number;
};

type DriveApiFile = {
  id?: string;
  title?: string;
  mimeType?: string;
  modifiedDate?: string;
  fileSize?: string;
  alternateLink?: string;
  webViewLink?: string;
};

const DEFAULT_DRIVE_PATH = "與我共用/P_行動技術研究專案/15.專案資料夾/Galaxy/014_ISO27001/紀錄";
const A01_TEMPLATE_DOC = "https://docs.google.com/document/d/1pND-UIIClViPTwCYDNI32K6bvHilQLsOGpHIn3f4VpI/edit?usp=sharing";
const A01_TARGET_FOLDER_PATH = "與我共用/P_行動技術研究專案/15.專案資料夾/Galaxy/014_ISO27001/紀錄/GXY-A01-開發需求";

const MAX_FILES = 1500;
const SHARED_WITH_ME_SEGMENTS = new Set(["與我共用", "shared with me", "Shared with me"]);

type TemplateCopyOptions = {
  templateDocIdOrUrl: string;
  targetFolderPath?: string;
  targetFolderId?: string;
  newFileName?: string;
  contentConfig?: StructuredDocConfig;
};

type TemplateCopyResult = {
  ok: true;
  templateDocId: string;
  sourceName: string;
  targetFolderId: string;
  targetPath: string;
  newName: string;
  newFileId: string;
  newFileUrl: string;
  configApplied: boolean;
  applyReport?: ApplyConfigReport;
};

type StructuredDocConfig = {
  clearTemplate?: boolean;
  markdownRenderMode?: "raw" | "rich";
  replaceText?: Record<string, string>;
  keyValues?: Record<string, string>;
  appendUnknownKeyValues?: boolean;
  sections?: Array<{
    title: string;
    content: string | string[];
  }>;
  appendParagraphs?: string[];
  bullets?: string[];
  removeMarkers?: string[];
  markdownReplace?: Record<string, string | string[]>;
};

type ApplyConfigReport = {
  replacedTexts: string[];
  replacedKeyValues: string[];
  appendedKeyValues: string[];
  replacedMarkdown: string[];
};

type TemplateInspectionResult = {
  ok: true;
  templateDocId: string;
  templateTitle: string;
  placeholders: string[];
  labelCandidates: string[];
  lineSamples: string[];
  sampleConfig: StructuredDocConfig;
};

type CopyRequestPayload = {
  action?: string;
  template?: string;
  name?: string;
  path?: string;
  folderId?: string;
  config?: StructuredDocConfig;
};

export function runExample(): GoogleAppsScript.Content.TextOutput {
  const result = buildGreeting({ name: "Online Apps Script" });
  console.log(result);

  return ContentService
    .createTextOutput(JSON.stringify(result, null, 2))
    .setMimeType(ContentService.MimeType.JSON);
}

export function copyA01TemplateDocToFolder(config?: StructuredDocConfig): string {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const monthPrefix = `GXY-A01-${yy}${mm}`;

  const resolvedFolder = resolveTargetFolder(A01_TARGET_FOLDER_PATH, "");
  const existing = listCurrentLevelEntries(resolvedFolder.folderId, MAX_FILES);
  const monthCount = existing.rows.filter((f) => f.name.startsWith(monthPrefix)).length;
  const serialCode = `${yy}${mm}${monthCount + 1}`;

  const itemName = config?.replaceText?.["{{項目}}"] || "";
  const newFileName = itemName ? `GXY-A01-${serialCode}_${itemName}` : `GXY-A01-${serialCode}`;

  const contentConfig: StructuredDocConfig = {
    ...config,
    replaceText: {
      "{{編號}}": serialCode,
      ...config?.replaceText
    }
  };

  return JSON.stringify(copyTemplateDocToFolder({
    templateDocIdOrUrl: A01_TEMPLATE_DOC,
    targetFolderPath: A01_TARGET_FOLDER_PATH,
    newFileName,
    contentConfig
  }), null, 2);
}

export function inspectA01TemplateFields(): string {
  return JSON.stringify(inspectTemplateFields(A01_TEMPLATE_DOC), null, 2);
}

export function inspectTemplateFields(templateDocIdOrUrl: string): TemplateInspectionResult {
  const templateInput = (templateDocIdOrUrl || "").trim();
  if (!templateInput) {
    throw new Error("templateDocIdOrUrl 不能為空");
  }
  const templateDocId = extractDriveFileId(templateInput);
  const doc = DocumentApp.openById(templateDocId);
  const body = doc.getBody();
  const lines = collectBodyLines(body).map((line) => line.trim()).filter((line) => line.length > 0);

  const placeholders = new Set<string>();
  const labelCandidates = new Set<string>();

  for (const line of lines) {
    for (const marker of extractPlaceholdersFromLine(line)) {
      placeholders.add(marker);
    }

    const label = extractLabelCandidate(line);
    if (label) {
      labelCandidates.add(label);
    }
  }
  for (const key of collectTableKeyCandidates(body)) {
    labelCandidates.add(key);
  }

  const replaceText: Record<string, string> = {};
  for (const marker of placeholders) {
    replaceText[marker] = "";
  }

  const keyValues: Record<string, string> = {};
  for (const key of labelCandidates) {
    keyValues[key] = "";
  }

  const title = doc.getName();
  doc.saveAndClose();

  return {
    ok: true,
    templateDocId,
    templateTitle: title,
    placeholders: [...placeholders].sort((a, b) => a.localeCompare(b)),
    labelCandidates: [...labelCandidates].sort((a, b) => a.localeCompare(b)),
    lineSamples: lines.slice(0, 80),
    sampleConfig: {
      replaceText,
      keyValues
    }
  };
}

export function copyTemplateDocToFolder(options: TemplateCopyOptions): TemplateCopyResult {
  const templateInput = (options.templateDocIdOrUrl || "").trim();
  if (!templateInput) {
    throw new Error("templateDocIdOrUrl 不能為空");
  }
  const templateDocId = extractDriveFileId(templateInput);

  const newFileName = (options.newFileName || "").trim();
  const targetFolderPath = (options.targetFolderPath || "").trim();
  const targetFolderId = (options.targetFolderId || "").trim();

  const resolvedFolder = resolveTargetFolder(targetFolderPath, targetFolderId);
  const drive = getDriveApi();
  const source = drive.Files.get(templateDocId, {
    fields: "id,title,mimeType",
    supportsAllDrives: true,
    supportsTeamDrives: true
  }) as DriveApiFile;

  if (source.mimeType !== "application/vnd.google-apps.document") {
    throw new Error("templateDocIdOrUrl 不是 Google 文件（Docs）類型。");
  }

  const targetName = newFileName || source.title || "A01 文件";
  const copied = drive.Files.copy({
    title: targetName,
    parents: [{ id: resolvedFolder.folderId }]
  }, templateDocId, {
    fields: "id,title,alternateLink,webViewLink,mimeType",
    supportsAllDrives: true,
    supportsTeamDrives: true
  }) as DriveApiFile;

  if (!copied.id) {
    throw new Error("複製完成但沒有取得新檔案 ID。");
  }

  const contentConfig = options.contentConfig || {};
  const hasConfig = hasStructuredDocConfig(contentConfig);
  let applyReport: ApplyConfigReport | undefined;
  if (hasConfig) {
    applyReport = applyStructuredConfigToDoc(copied.id, contentConfig);
  }

  return {
    ok: true,
    templateDocId,
    sourceName: source.title || templateDocId,
    targetFolderId: resolvedFolder.folderId,
    targetPath: resolvedFolder.normalizedPath,
    newName: targetName,
    newFileId: copied.id,
    newFileUrl: buildDriveFileUrl(copied),
    configApplied: hasConfig,
    applyReport
  };
}

export function doGet(e?: GoogleAppsScript.Events.DoGet): GoogleAppsScript.Content.TextOutput | GoogleAppsScript.HTML.HtmlOutput {
  const pathInput = (e?.parameter?.path || DEFAULT_DRIVE_PATH).trim();
  const folderIdInput = (e?.parameter?.folderId || "").trim();
  const jsonMode = (e?.parameter?.format || "").toLowerCase() === "json";
  const action = (e?.parameter?.action || "").toLowerCase();

  try {
    if (jsonMode && action === "copy_a01") {
      return ContentService
        .createTextOutput(copyA01TemplateDocToFolder())
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (jsonMode && action === "copy_template") {
      const template = (e?.parameter?.template || "").trim();
      const name = (e?.parameter?.name || "").trim();
      const path = (e?.parameter?.path || "").trim();
      const folderId = (e?.parameter?.folderId || "").trim();

      const result = copyTemplateDocToFolder({
        templateDocIdOrUrl: template,
        newFileName: name,
        targetFolderPath: path,
        targetFolderId: folderId
      });

      return ContentService
        .createTextOutput(JSON.stringify(result, null, 2))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (jsonMode && action === "inspect_a01") {
      return ContentService
        .createTextOutput(inspectA01TemplateFields())
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (jsonMode && action === "inspect_template") {
      const template = (e?.parameter?.template || "").trim();
      const result = inspectTemplateFields(template);
      return ContentService
        .createTextOutput(JSON.stringify(result, null, 2))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const targetFolder = resolveTargetFolder(pathInput, folderIdInput);
    const list = listCurrentLevelEntries(targetFolder.folderId, MAX_FILES);

    if (jsonMode) {
      return ContentService
        .createTextOutput(JSON.stringify({
          ok: true,
          inputPath: pathInput,
          normalizedPath: targetFolder.normalizedPath,
          folderId: targetFolder.folderId,
          ambiguousCount: targetFolder.ambiguousCount,
          truncated: list.truncated,
          itemCount: list.rows.length,
          items: list.rows
        }, null, 2))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const html = renderDrivePage({
      inputPath: pathInput,
      normalizedPath: targetFolder.normalizedPath,
      folderId: targetFolder.folderId,
      rows: list.rows,
      ambiguousCount: targetFolder.ambiguousCount,
      truncated: list.truncated,
      message: ""
    });

    return HtmlService.createHtmlOutput(html).setTitle("Drive File Browser");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (jsonMode) {
      return ContentService
        .createTextOutput(JSON.stringify({
          ok: false,
          inputPath: pathInput,
          folderId: folderIdInput,
          error: message
        }, null, 2))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const html = renderDrivePage({
      inputPath: pathInput,
      normalizedPath: "",
      folderId: folderIdInput,
      rows: [],
      ambiguousCount: 0,
      truncated: false,
      message
    });

    return HtmlService.createHtmlOutput(html).setTitle("Drive File Browser");
  }
}

export function doPost(e?: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  try {
    const payload = parseCopyPayload(e?.postData?.contents || "");
    const action = (payload.action || "").toLowerCase();

    if (action === "copy_a01") {
      return ContentService
        .createTextOutput(copyA01TemplateDocToFolder(payload.config))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "copy_template") {
      const result = copyTemplateDocToFolder({
        templateDocIdOrUrl: payload.template || "",
        newFileName: payload.name || "",
        targetFolderPath: payload.path || "",
        targetFolderId: payload.folderId || "",
        contentConfig: payload.config
      });
      return ContentService
        .createTextOutput(JSON.stringify(result, null, 2))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "inspect_a01") {
      return ContentService
        .createTextOutput(inspectA01TemplateFields())
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "inspect_template") {
      const result = inspectTemplateFields(payload.template || "");
      return ContentService
        .createTextOutput(JSON.stringify(result, null, 2))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({
        ok: false,
        error: "不支援的 action，請使用 copy_a01、copy_template、inspect_a01 或 inspect_template"
      }, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return ContentService
      .createTextOutput(JSON.stringify({
        ok: false,
        error: message
      }, null, 2))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

export function createSampleSheet(): string {
  const spreadsheet = SpreadsheetApp.create("TS Clasp Sample Output");
  const sheet = spreadsheet.getActiveSheet();
  const rows = [
    ["Name", "Message", "Generated At"],
    ...buildSheetRows(["Ada", "Linus", "Grace"])
  ];

  sheet.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sheet.autoResizeColumns(1, rows[0].length);

  const url = spreadsheet.getUrl();
  console.log(`Created sample spreadsheet: ${url}`);
  return url;
}

export function authorizeDriveAccess(): string {
  try {
    const authInfo = ScriptApp.getAuthorizationInfo(ScriptApp.AuthMode.FULL);
    if (authInfo.getAuthorizationStatus() === ScriptApp.AuthorizationStatus.REQUIRED) {
      const authUrl = authInfo.getAuthorizationUrl();
      return authUrl
        ? `需要先完成授權，請開啟：${authUrl}`
        : "需要先完成授權，請在編輯器重新執行並同意權限。";
    }

    // Minimal Advanced Drive API probe.
    const drive = getDriveApi();
    drive.Files.list({
      maxResults: 1,
      fields: "items(id)",
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      includeTeamDriveItems: true,
      supportsTeamDrives: true
    } as Record<string, unknown>);
    return "Drive 權限可用，已可在本機呼叫清單指令。";
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `授權檢查未完成：${message}`;
  }
}

export function listFolderItemsCli(pathInput?: string, folderIdInput?: string): string {
  const path = (pathInput || DEFAULT_DRIVE_PATH).trim();
  const folderId = (folderIdInput || "").trim();
  const target = resolveTargetFolder(path, folderId);
  const list = listCurrentLevelEntries(target.folderId, MAX_FILES);

  return JSON.stringify({
    ok: true,
    inputPath: path,
    normalizedPath: target.normalizedPath,
    folderId: target.folderId,
    ambiguousCount: target.ambiguousCount,
    truncated: list.truncated,
    itemCount: list.rows.length,
    items: list.rows
  }, null, 2);
}

function resolveTargetFolder(pathInput: string, folderIdInput: string): FolderResolveResult {
  if (folderIdInput) {
    const folder = getFolderMetadataById(folderIdInput);
    return {
      folderId: folder.id || folderIdInput,
      folderName: folder.title || folderIdInput,
      normalizedPath: folder.title || folderIdInput,
      ambiguousCount: 0
    };
  }

  return findFolderByPath(pathInput);
}

function findFolderByPath(pathInput: string): FolderResolveResult {
  const segments = normalizePath(pathInput);

  if (segments.length === 0) {
    throw new Error("請提供資料夾路徑，例如：P_行動技術研究專案/014_ISO27001/紀錄");
  }

  let candidates = findFoldersByNameGlobal(segments[0]);
  if (candidates.length === 0) {
    throw new Error(`找不到第一層資料夾：${segments[0]}`);
  }

  for (let i = 1; i < segments.length; i += 1) {
    const segment = segments[i];
    const nextCandidates: DriveApiFile[] = [];

    for (const parent of candidates) {
      if (!parent.id) {
        continue;
      }
      nextCandidates.push(...findChildFoldersByName(parent.id, segment));
    }

    candidates = dedupeApiFiles(nextCandidates);
    if (candidates.length === 0) {
      throw new Error(`路徑中找不到子資料夾：${segment}`);
    }
  }

  candidates.sort((a, b) => (a.id || "").localeCompare(b.id || ""));
  const picked = candidates[0];

  return {
    folderId: picked.id || "",
    folderName: picked.title || segments[segments.length - 1],
    normalizedPath: segments.join("/"),
    ambiguousCount: Math.max(0, candidates.length - 1)
  };
}

function findFoldersByNameGlobal(name: string): DriveApiFile[] {
  const query = `mimeType = 'application/vnd.google-apps.folder' and trashed = false and title = '${escapeQuery(name)}'`;
  return listDriveFiles(query, MAX_FILES);
}

function findChildFoldersByName(parentId: string, name: string): DriveApiFile[] {
  const query = `'${escapeQuery(parentId)}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false and title = '${escapeQuery(name)}'`;
  return listDriveFiles(query, MAX_FILES);
}

function dedupeApiFiles(files: DriveApiFile[]): DriveApiFile[] {
  const idMap = new Map<string, DriveApiFile>();
  for (const file of files) {
    if (!file.id) {
      continue;
    }
    idMap.set(file.id, file);
  }
  return [...idMap.values()];
}

function normalizePath(pathInput: string): string[] {
  return pathInput
    .split(/[/>]/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
    .filter((segment) => !SHARED_WITH_ME_SEGMENTS.has(segment));
}

function extractDriveFileId(input: string): string {
  const value = input.trim();

  const fromUrl = value.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (fromUrl?.[1]) {
    return fromUrl[1];
  }

  const rawId = value.match(/^[a-zA-Z0-9_-]{20,}$/);
  if (rawId?.[0]) {
    return rawId[0];
  }

  throw new Error("無法解析 templateDocIdOrUrl，請提供文件 URL 或文件 ID。");
}

function parseCopyPayload(raw: string): CopyRequestPayload {
  if (!raw.trim()) {
    return {};
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error("POST 內容不是合法 JSON。");
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("POST JSON 格式錯誤。");
  }

  return parsed as CopyRequestPayload;
}

function hasStructuredDocConfig(config?: StructuredDocConfig): boolean {
  if (!config) {
    return false;
  }

  return Boolean(
    config.clearTemplate === true ||
    (config.replaceText && Object.keys(config.replaceText).length > 0) ||
    (config.keyValues && Object.keys(config.keyValues).length > 0) ||
    (config.sections && config.sections.length > 0) ||
    (config.appendParagraphs && config.appendParagraphs.length > 0) ||
    (config.bullets && config.bullets.length > 0) ||
    (config.removeMarkers && config.removeMarkers.length > 0) ||
    (config.markdownReplace && Object.keys(config.markdownReplace).length > 0)
  );
}

function applyStructuredConfigToDoc(docId: string, config: StructuredDocConfig): ApplyConfigReport {
  const doc = DocumentApp.openById(docId);
  const allBodies = getAllDocBodies(doc);
  const body = allBodies[0];
  const report: ApplyConfigReport = {
    replacedTexts: [],
    replacedKeyValues: [],
    appendedKeyValues: [],
    replacedMarkdown: []
  };

  const sortedKeyEntries = config.keyValues
    ? Object.entries(config.keyValues).sort(([a], [b]) => b.length - a.length)
    : [];
  const sortedKeys = sortedKeyEntries.map(([key]) => key);
  console.log(`[A01-DIAG] applyStructuredConfigToDoc sortedKeys=${JSON.stringify(sortedKeys)}`);
  const appendUnknownKeyValues = config.appendUnknownKeyValues === true;

  if (config.clearTemplate) {
    clearMappedKeyValuesInPlace(body, sortedKeys);
    // #region agent log
    (globalThis as { fetch?: (input: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<unknown> }).fetch?.(
      'http://127.0.0.1:7556/ingest/3831f648-771d-4f83-a98e-0bd58bf55d52',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6c3fb4' },
        body: JSON.stringify({
          sessionId: '6c3fb4',
          runId: 'run1',
          hypothesisId: 'H1',
          location: 'src/app.ts:598',
          message: 'applyStructuredConfigToDoc clearTemplate executed',
          data: { docId },
          timestamp: Date.now()
        })
      }
    ).catch(() => {});
    // #endregion
  }

  if (config.replaceText) {
    for (const [key, value] of Object.entries(config.replaceText)) {
      if (!key) {
        continue;
      }
      const pattern = escapeRegexForReplace(key);
      for (const b of allBodies) {
        if (b.findText(pattern)) {
          b.replaceText(pattern, value || "");
          if (!report.replacedTexts.includes(key)) {
            report.replacedTexts.push(key);
          }
        }
      }
    }
  }

  if (config.removeMarkers) {
    for (const marker of config.removeMarkers) {
      if (!marker) {
        continue;
      }
      for (const b of allBodies) {
        b.replaceText(escapeRegexForReplace(marker), "");
      }
    }
  }

  if (sortedKeyEntries.length > 0) {
    const appendRows: string[][] = [];
    for (const [key, rawValue] of sortedKeyEntries) {
      const value = rawValue ?? "";
      const replaced = applyKeyValueInPlace(body, key, value);
      if (replaced) {
        report.replacedKeyValues.push(key);
        continue;
      }
      if (!appendUnknownKeyValues) {
        report.appendedKeyValues.push(`${key}（未對位）`);
        continue;
      }
      appendRows.push([key, value]);
      report.appendedKeyValues.push(key);
    }

    if (appendRows.length > 0) {
      body.appendParagraph("");
      body.appendParagraph("欄位資料").setHeading(DocumentApp.ParagraphHeading.HEADING2);
      const table = body.appendTable(appendRows);
      for (let r = 0; r < appendRows.length; r += 1) {
        table.getCell(r, 0).editAsText().setBold(true);
      }
    }
  }

  if (config.sections) {
    for (const section of config.sections) {
      const title = (section.title || "").trim();
      if (!title) {
        continue;
      }
      body.appendParagraph("");
      body.appendParagraph(title).setHeading(DocumentApp.ParagraphHeading.HEADING2);
      const lines = Array.isArray(section.content) ? section.content : [section.content];
      for (const line of lines) {
        if (line === undefined || line === null) {
          continue;
        }
        body.appendParagraph(String(line));
      }
    }
  }

  if (config.appendParagraphs) {
    for (const line of config.appendParagraphs) {
      if (!line) {
        continue;
      }
      body.appendParagraph(line);
    }
  }

  if (config.bullets) {
    for (const item of config.bullets) {
      if (!item) {
        continue;
      }
      body.appendListItem(item);
    }
  }

  if (config.markdownReplace) {
    const markdownRenderMode: "raw" | "rich" = config.markdownRenderMode === "rich" ? "rich" : "raw";
    for (const [placeholder, rawValue] of Object.entries(config.markdownReplace)) {
      if (!placeholder || !rawValue) {
        continue;
      }
      const combined = Array.isArray(rawValue)
        ? rawValue.filter((v) => v).join("\n---\n")
        : rawValue;
      if (!combined) {
        continue;
      }
      for (const b of allBodies) {
        if (insertMarkdownAtPlaceholder(b, placeholder, combined, markdownRenderMode)) {
          report.replacedMarkdown.push(placeholder);
          break;
        }
      }
    }
  }

  doc.saveAndClose();
  return report;
}

function clearMappedKeyValuesInPlace(body: GoogleAppsScript.Document.Body, keys: string[]): void {
  // #region agent log
  (globalThis as { fetch?: (input: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<unknown> }).fetch?.(
    'http://127.0.0.1:7556/ingest/3831f648-771d-4f83-a98e-0bd58bf55d52',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6c3fb4' },
      body: JSON.stringify({
        sessionId: '6c3fb4',
        runId: 'run1',
        hypothesisId: 'H1',
        location: 'src/app.ts:685',
        message: 'clearMappedKeyValuesInPlace start',
        data: { keyCount: keys.length },
        timestamp: Date.now()
      })
    }
  ).catch(() => {});
  // #endregion

  const sortedKeys = [...keys].sort((a, b) => b.length - a.length);
  console.log(`[A01-DIAG] clearMappedKeyValuesInPlace keys=${JSON.stringify(sortedKeys)}`);
  for (const key of sortedKeys) {
    if (!key.trim()) {
      continue;
    }
    applyKeyValueInPlace(body, key, "");
  }
}

function applyKeyValueInPlace(body: GoogleAppsScript.Document.Body, key: string, value: string): boolean {
  const trimmedKey = key.trim();
  if (!trimmedKey) {
    return false;
  }

  console.log(`[A01-DIAG] applyKeyValueInPlace entry key="${trimmedKey}" value="${value}"`);

  // #region agent log
  (globalThis as { fetch?: (input: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<unknown> }).fetch?.(
    'http://127.0.0.1:7556/ingest/3831f648-771d-4f83-a98e-0bd58bf55d52',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6c3fb4' },
      body: JSON.stringify({
        sessionId: '6c3fb4',
        runId: 'run1',
        hypothesisId: 'H2',
        location: 'src/app.ts:731',
        message: 'applyKeyValueInPlace entry',
        data: { trimmedKey: key.trim(), value },
        timestamp: Date.now()
      })
    }
  ).catch(() => {});
  // #endregion
  const markerCandidates = [
    `{{${trimmedKey}}}`,
    `【${trimmedKey}】`,
    `[${trimmedKey}]`,
    `＜${trimmedKey}＞`,
    `<${trimmedKey}>`
  ];
  for (const marker of markerCandidates) {
    if (replaceIfExists(body, escapeRegexForReplace(marker), value)) {
      console.log(`[A01-DIAG] marker matched key="${trimmedKey}" marker="${marker}"`);
      // #region agent log
      (globalThis as { fetch?: (input: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<unknown> }).fetch?.(
        'http://127.0.0.1:7556/ingest/3831f648-771d-4f83-a98e-0bd58bf55d52',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6c3fb4' },
          body: JSON.stringify({
            sessionId: '6c3fb4',
            runId: 'run1',
            hypothesisId: 'H3',
            location: 'src/app.ts:745',
            message: 'applyKeyValueInPlace marker matched',
            data: { trimmedKey: key.trim(), marker },
            timestamp: Date.now()
          })
        }
      ).catch(() => {});
      // #endregion
      return true;
    }
  }

  if (fillKeyValueInTables(body, trimmedKey, value)) {
      console.log(`[A01-DIAG] table matched key="${trimmedKey}"`);
    // #region agent log
    (globalThis as { fetch?: (input: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<unknown> }).fetch?.(
      'http://127.0.0.1:7556/ingest/3831f648-771d-4f83-a98e-0bd58bf55d52',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6c3fb4' },
        body: JSON.stringify({
          sessionId: '6c3fb4',
          runId: 'run1',
          hypothesisId: 'H4',
          location: 'src/app.ts:750',
          message: 'applyKeyValueInPlace table filled',
          data: { trimmedKey: key.trim(), value },
          timestamp: Date.now()
        })
      }
    ).catch(() => {});
    // #endregion
    return true;
  }

  const lineAnyPattern = `^${escapeRegexForReplace(trimmedKey)}\\s*[：:]\\s*[^\\r\\n]*`;
  if (replaceIfExists(body, lineAnyPattern, `${trimmedKey}：${value}`)) {
    console.log(`[A01-DIAG] line-with-value matched key="${trimmedKey}" pattern=${lineAnyPattern}`);
    // #region agent log
    (globalThis as { fetch?: (input: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<unknown> }).fetch?.(
      'http://127.0.0.1:7556/ingest/3831f648-771d-4f83-a98e-0bd58bf55d52',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6c3fb4' },
        body: JSON.stringify({
          sessionId: '6c3fb4',
          runId: 'run1',
          hypothesisId: 'H4',
          location: 'src/app.ts:760',
          message: 'applyKeyValueInPlace lineAnyPattern matched',
          data: { trimmedKey: key.trim(), lineAnyPattern, value },
          timestamp: Date.now()
        })
      }
    ).catch(() => {});
    // #endregion
    return true;
  }

  const blankPattern = `^${escapeRegexForReplace(trimmedKey)}\\s*[-_＿.。\\s　]*$`;
  if (replaceIfExists(body, blankPattern, `${trimmedKey} ${value}`)) {
    console.log(`[A01-DIAG] blank-line matched key="${trimmedKey}" pattern=${blankPattern}`);
    // #region agent log
    (globalThis as { fetch?: (input: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<unknown> }).fetch?.(
      'http://127.0.0.1:7556/ingest/3831f648-771d-4f83-a98e-0bd58bf55d52',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6c3fb4' },
        body: JSON.stringify({
          sessionId: '6c3fb4',
          runId: 'run1',
          hypothesisId: 'H5',
          location: 'src/app.ts:765',
          message: 'applyKeyValueInPlace blankPattern matched',
          data: { trimmedKey: key.trim(), blankPattern, value },
          timestamp: Date.now()
        })
      }
    ).catch(() => {});
    // #endregion
    return true;
  }

  // #region agent log
  (globalThis as { fetch?: (input: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<unknown> }).fetch?.(
    'http://127.0.0.1:7556/ingest/3831f648-771d-4f83-a98e-0bd58bf55d52',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '6c3fb4' },
      body: JSON.stringify({
        sessionId: '6c3fb4',
        runId: 'run1',
        hypothesisId: 'H4',
        location: 'src/app.ts:877',
        message: 'applyKeyValueInPlace no match',
        data: { trimmedKey: key.trim(), value },
        timestamp: Date.now()
      })
    }
  ).catch(() => {});
  // #endregion
  return false;
}

function replaceIfExists(body: GoogleAppsScript.Document.Body, pattern: string, replacement: string): boolean {
  const found = body.findText(pattern);
  if (!found) {
    return false;
  }
  const matchStart = found.getStartOffset();
  if (matchStart !== 0) {
    console.log(`[A01-DIAG] replaceIfExists skipped substring match pattern="${pattern}" offset=${matchStart}`);
    return false;
  }
  const matchEnd = found.getEndOffsetInclusive();
  const elementText = found.getElement().asText().getText();
  const matchedText = elementText.substring(matchStart, Math.min(matchEnd + 1, elementText.length));
  console.log(`[A01-DIAG] replaceIfExists matched pattern="${pattern}" replacement="${replacement}" matched="${matchedText}"`);
  body.replaceText(pattern, replacement);
  return true;
}

function fillKeyValueInTables(body: GoogleAppsScript.Document.Body, key: string, value: string): boolean {
  const targetKey = normalizeFieldKey(key);
  if (!targetKey) {
    return false;
  }

  const childCount = body.getNumChildren();
  for (let i = 0; i < childCount; i += 1) {
    const child = body.getChild(i);
    if (child.getType() !== DocumentApp.ElementType.TABLE) {
      continue;
    }
    const table = child.asTable();
    for (let row = 0; row < table.getNumRows(); row += 1) {
      const tableRow = table.getRow(row);
      for (let col = 0; col < tableRow.getNumCells(); col += 1) {
        const cell = tableRow.getCell(col);
        const cellText = cell.getText();
        const cellKey = normalizeFieldKey(cellText);
        if (cellKey !== targetKey) {
          continue;
        }

        const colonIndex = cellText.search(/[：:]/);
        if (colonIndex >= 0) {
          const prefix = cellText.substring(0, colonIndex + 1);
          cell.editAsText().setText(prefix + value);
          console.log(`[A01-DIAG] table inline key:value matched key="${targetKey}" col=${col} prefix="${prefix}"`);
          return true;
        }

        if (tableRow.getNumCells() === 2 && col + 1 < tableRow.getNumCells()) {
          const valueCell = tableRow.getCell(col + 1);
          const valueCellText = valueCell.getText();
          if (hasCheckboxPattern(valueCellText)) {
            applyCheckboxValue(valueCell, valueCellText, value);
            console.log(`[A01-DIAG] table checkbox matched key="${targetKey}" value="${value}"`);
          } else {
            valueCell.editAsText().setText(value);
            console.log(`[A01-DIAG] table key|value matched key="${targetKey}" col=${col}`);
          }
          return true;
        }
      }
    }
  }

  return false;
}

function hasCheckboxPattern(text: string): boolean {
  return /[☐■□☑]/.test(text);
}

function applyCheckboxValue(cell: GoogleAppsScript.Document.TableCell, cellText: string, value: string): void {
  const selected = value.split(/[,、，]\s*/).map((s) => s.trim()).filter((s) => s.length > 0);
  if (selected.length === 0) {
    return;
  }

  const result = cellText.replace(/([☐■□☑])\s*([^☐■□☑]+)/g, (_match, _checkbox: string, optionRaw: string) => {
    const optionClean = optionRaw.replace(/[，,、：:].*/g, "").trim();
    const isSelected = selected.some((s) => optionClean === s || optionClean.startsWith(s) || s.startsWith(optionClean));
    return (isSelected ? "■" : "☐") + " " + optionRaw;
  });

  cell.editAsText().setText(result);
}

function collectTableKeyCandidates(body: GoogleAppsScript.Document.Body): string[] {
  const keys = new Set<string>();
  const childCount = body.getNumChildren();
  for (let i = 0; i < childCount; i += 1) {
    const child = body.getChild(i);
    if (child.getType() !== DocumentApp.ElementType.TABLE) {
      continue;
    }
    const table = child.asTable();
    for (let row = 0; row < table.getNumRows(); row += 1) {
      const tableRow = table.getRow(row);
      for (let col = 0; col < tableRow.getNumCells(); col += 1) {
        const cellText = tableRow.getCell(col).getText();
        const key = normalizeFieldKey(cellText);
        if (!key) {
          continue;
        }
        const hasColon = /[：:]/.test(cellText);
        if (hasColon) {
          keys.add(key);
          continue;
        }
        if (col + 1 < tableRow.getNumCells()) {
          const valueCell = tableRow.getCell(col + 1).getText().trim();
          if (!valueCell || /^[-_＿.。 \t　]{2,}$/.test(valueCell)) {
            keys.add(key);
          }
        }
      }
    }
  }
  return [...keys];
}

function normalizeFieldKey(raw: string): string {
  const withoutInlineValue = raw.split(/[:：]/)[0];
  const cleaned = withoutInlineValue
    .replace(/[()（）]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "";
  }
  if (cleaned.length > 40) {
    return "";
  }
  return cleaned;
}

function collectBodyLines(body: GoogleAppsScript.Document.Body): string[] {
  const lines: string[] = [];
  const childCount = body.getNumChildren();

  for (let i = 0; i < childCount; i += 1) {
    const child = body.getChild(i);
    lines.push(...collectElementLines(child));
  }

  return lines;
}

function collectElementLines(element: GoogleAppsScript.Document.Element): string[] {
  const type = element.getType();

  if (type === DocumentApp.ElementType.PARAGRAPH) {
    const text = element.asParagraph().getText();
    return text ? [text] : [];
  }

  if (type === DocumentApp.ElementType.LIST_ITEM) {
    const text = element.asListItem().getText();
    return text ? [text] : [];
  }

  if (type === DocumentApp.ElementType.TABLE) {
    const table = element.asTable();
    const lines: string[] = [];
    for (let row = 0; row < table.getNumRows(); row += 1) {
      const tableRow = table.getRow(row);
      for (let col = 0; col < tableRow.getNumCells(); col += 1) {
        const cellText = tableRow.getCell(col).getText();
        if (cellText) {
          lines.push(cellText);
        }
      }
    }
    return lines;
  }

  if (type === DocumentApp.ElementType.TABLE_OF_CONTENTS) {
    return [];
  }

  return [];
}

function extractPlaceholdersFromLine(line: string): string[] {
  const tokens: string[] = [];
  const curly = line.match(/\{\{[^{}]+\}\}/g) || [];
  const bracket = line.match(/【[^【】]+】/g) || [];
  for (const token of [...curly, ...bracket]) {
    tokens.push(token.trim());
  }
  return tokens;
}

function extractLabelCandidate(line: string): string {
  const normalized = line.replace(/\s+/g, " ").trim();
  if (!normalized) {
    return "";
  }

  const colonIndex = normalized.search(/[：:]/);
  if (colonIndex > 0 && colonIndex <= 30) {
    const key = normalizeFieldKey(normalized.slice(0, colonIndex));
    if (key) {
      return key;
    }
  }

  const blankMatch = normalized.match(/^(.{1,30}?)[-_＿.。]{3,}\s*$/);
  if (blankMatch?.[1]) {
    const key = normalizeFieldKey(blankMatch[1]);
    if (key) {
      return key;
    }
  }

  return "";
}

function escapeRegexForReplace(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getAllDocBodies(doc: GoogleAppsScript.Document.Document): GoogleAppsScript.Document.Body[] {
  try {
    const docAny = doc as unknown as {
      getTabs(): Array<{ asDocumentTab(): { getBody(): GoogleAppsScript.Document.Body } }>;
    };
    const tabs = docAny.getTabs();
    if (Array.isArray(tabs) && tabs.length > 0) {
      return tabs.map((tab) => tab.asDocumentTab().getBody());
    }
  } catch (_e) {
    // getTabs not available, fall back to main body
  }
  return [doc.getBody()];
}

function insertMarkdownAtPlaceholder(
  body: GoogleAppsScript.Document.Body,
  placeholder: string,
  markdown: string,
  renderMode: "raw" | "rich"
): boolean {
  const found = body.findText(escapeRegexForReplace(placeholder));
  if (!found) {
    return false;
  }
  const parentElement = found.getElement().getParent();
  const insertIndex = body.getChildIndex(parentElement);
  renderMarkdownToBody(body, markdown, insertIndex, renderMode);
  try {
    parentElement.removeFromParent();
  } catch (_e) {
    try {
      parentElement.asParagraph().setText(" ");
    } catch (_e2) { /* last resort: leave a space */ }
  }
  return true;
}

function splitMarkdownIntoCards(markdown: string): string[] {
  const lines = markdown.split("\n");
  const cards: string[] = [];
  let current: string[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.startsWith("```")) {
      inCodeBlock = !inCodeBlock;
    }
    if (!inCodeBlock && line.trim() === "---") {
      cards.push(current.join("\n"));
      current = [];
      continue;
    }
    current.push(line);
  }
  if (current.length > 0) {
    cards.push(current.join("\n"));
  }
  return cards.filter((c) => c.trim());
}

function extractFirstHeadingTitle(markdown: string): string {
  const lines = markdown.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
      return trimmed.slice(2).trim();
    }
    return "";
  }
  return "";
}

function renderRawMarkdownToCell(cell: GoogleAppsScript.Document.TableCell, markdown: string): void {
  const lines = markdown.split("\n");
  let wrote = false;

  for (const line of lines) {
    const text = line.length > 0 ? line : " ";
    const para = cell.appendParagraph(text);
    const textEl = para.editAsText();
    textEl.setFontSize(11);
    textEl.setFontFamily("Arial");
    wrote = true;
  }

  if (wrote) {
    try {
      const first = cell.getChild(0);
      const firstText = first.asParagraph().getText();
      if (firstText === " " || firstText === "") {
        first.removeFromParent();
      }
    } catch (_e) {
      // keep default paragraph when removal fails
    }
  }
}

function renderRawMarkdownLines(
  body: GoogleAppsScript.Document.Body,
  markdown: string,
  startIndex: number
): void {
  const lines = markdown.split("\n");
  let idx = startIndex;

  for (const line of lines) {
    const text = line.length > 0 ? line : " ";
    const para = body.insertParagraph(idx, text);
    const textEl = para.editAsText();
    textEl.setFontSize(11);
    textEl.setFontFamily("Arial");
    idx += 1;
  }
}

function renderRawMarkdownCards(
  body: GoogleAppsScript.Document.Body,
  cards: string[],
  startIndex: number
): void {
  let idx = startIndex;
  for (let i = 0; i < cards.length; i += 1) {
    const cardMarkdown = cards[i].trim();
    const title = extractFirstHeadingTitle(cardMarkdown);

    if (title) {
      const table = body.insertTable(idx, [[title], [" "]]);
      table.setBorderColor("#000000");
      table.setBorderWidth(1);

      const titleCell = table.getRow(0).getCell(0);
      titleCell.setBackgroundColor("#000000");
      titleCell.setPaddingTop(6);
      titleCell.setPaddingBottom(6);
      titleCell.setPaddingLeft(10);
      titleCell.setPaddingRight(10);
      const titleText = titleCell.editAsText();
      titleText.setForegroundColor("#ffffff");
      titleText.setBold(true);
      titleText.setFontSize(13);
      titleCell.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);

      const contentCell = table.getRow(1).getCell(0);
      contentCell.setPaddingTop(8);
      contentCell.setPaddingBottom(8);
      contentCell.setPaddingLeft(10);
      contentCell.setPaddingRight(10);
      renderRawMarkdownToCell(contentCell, cardMarkdown);
    } else {
      const table = body.insertTable(idx, [[" "]]);
      table.setBorderColor("#000000");
      table.setBorderWidth(1);
      const cell = table.getRow(0).getCell(0);
      cell.setPaddingTop(8);
      cell.setPaddingBottom(8);
      cell.setPaddingLeft(10);
      cell.setPaddingRight(10);
      renderRawMarkdownToCell(cell, cardMarkdown);
    }

    idx += 1;
    if (i < cards.length - 1) {
      const spacer = body.insertParagraph(idx, " ");
      spacer.editAsText().setFontSize(4);
      idx += 1;
    }
  }
}

function renderMarkdownToBody(
  body: GoogleAppsScript.Document.Body,
  markdown: string,
  startIndex: number,
  renderMode: "raw" | "rich"
): void {
  const cards = splitMarkdownIntoCards(markdown);

  if (renderMode === "raw") {
    if (cards.length > 1) {
      renderRawMarkdownCards(body, cards, startIndex);
      return;
    }
    renderRawMarkdownLines(body, markdown, startIndex);
    return;
  }

  if (cards.length > 1) {
    renderMarkdownCards(body, cards, startIndex);
    return;
  }

  renderMarkdownLines(body, markdown, startIndex);
}

function extractCardTitle(markdown: string): { title: string; content: string } {
  const lines = markdown.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("# ") && !trimmed.startsWith("## ")) {
      return { title: trimmed.slice(2).trim(), content: lines.slice(i + 1).join("\n") };
    }
    break;
  }
  return { title: "", content: markdown };
}

function renderMarkdownCards(
  body: GoogleAppsScript.Document.Body,
  cards: string[],
  startIndex: number
): void {
  let idx = startIndex;
  for (let i = 0; i < cards.length; i++) {
    const { title, content } = extractCardTitle(cards[i].trim());

    if (title) {
      const table = body.insertTable(idx, [[title], [" "]]);
      table.setBorderColor("#000000");
      table.setBorderWidth(1);

      const titleCell = table.getRow(0).getCell(0);
      titleCell.setBackgroundColor("#000000");
      titleCell.setPaddingTop(6);
      titleCell.setPaddingBottom(6);
      titleCell.setPaddingLeft(10);
      titleCell.setPaddingRight(10);
      const titleText = titleCell.editAsText();
      titleText.setForegroundColor("#ffffff");
      titleText.setBold(true);
      titleText.setFontSize(13);
      titleCell.getChild(0).asParagraph().setAlignment(DocumentApp.HorizontalAlignment.CENTER);

      const contentCell = table.getRow(1).getCell(0);
      contentCell.setPaddingTop(8);
      contentCell.setPaddingBottom(8);
      contentCell.setPaddingLeft(10);
      contentCell.setPaddingRight(10);
      renderMarkdownToCell(contentCell, content);
    } else {
      const table = body.insertTable(idx, [[" "]]);
      table.setBorderColor("#000000");
      table.setBorderWidth(1);
      const cell = table.getRow(0).getCell(0);
      cell.setPaddingTop(8);
      cell.setPaddingBottom(8);
      cell.setPaddingLeft(10);
      cell.setPaddingRight(10);
      renderMarkdownToCell(cell, cards[i].trim());
    }

    idx++;
    if (i < cards.length - 1) {
      const spacer = body.insertParagraph(idx, " ");
      spacer.editAsText().setFontSize(4);
      idx++;
    }
  }
}

function renderMarkdownToCell(
  cell: GoogleAppsScript.Document.TableCell,
  markdown: string
): void {
  const lines = markdown.split("\n");
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let elementCount = 0;

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        for (const codeLine of codeLines) {
          const para = cell.appendParagraph(codeLine || " ");
          para.editAsText().setFontFamily("Courier New");
          para.editAsText().setFontSize(10);
          para.editAsText().setBackgroundColor("#f5f5f5");
          elementCount++;
        }
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      continue;
    }

    if (line.startsWith("#### ")) {
      const text = line.slice(5) || " ";
      const para = cell.appendParagraph(text);
      applyInlineMarkdown(para.editAsText(), text);
      applyCellHeading(para, 11);
    } else if (line.startsWith("### ")) {
      const text = line.slice(4) || " ";
      const para = cell.appendParagraph(text);
      applyInlineMarkdown(para.editAsText(), text);
      applyCellHeading(para, 13);
    } else if (line.startsWith("## ")) {
      const text = line.slice(3) || " ";
      const para = cell.appendParagraph(text);
      applyInlineMarkdown(para.editAsText(), text);
      applyCellHeading(para, 16);
    } else if (line.startsWith("# ")) {
      const text = line.slice(2) || " ";
      const para = cell.appendParagraph(text);
      applyInlineMarkdown(para.editAsText(), text);
      applyCellHeading(para, 20);
    } else if (/^[-*] /.test(line)) {
      const content = line.slice(2);
      const item = (cell as unknown as { appendListItem(t: string): GoogleAppsScript.Document.ListItem }).appendListItem(content || " ");
      item.setGlyphType(DocumentApp.GlyphType.BULLET);
      applyInlineMarkdown(item.editAsText(), content);
    } else if (/^\d+\. /.test(line)) {
      const content = line.replace(/^\d+\. /, "");
      const item = (cell as unknown as { appendListItem(t: string): GoogleAppsScript.Document.ListItem }).appendListItem(content || " ");
      item.setGlyphType(DocumentApp.GlyphType.NUMBER);
      applyInlineMarkdown(item.editAsText(), content);
    } else {
      const text = line || " ";
      const para = cell.appendParagraph(text);
      applyInlineMarkdown(para.editAsText(), text);
    }
    elementCount++;
  }

  if (elementCount > 0) {
    try {
      const first = cell.getChild(0);
      const firstText = first.asParagraph().getText();
      if (firstText === " " || firstText === "") {
        first.removeFromParent();
      }
    } catch (_e) { /* keep default paragraph if removal fails */ }
  }
}

function applyCellHeading(para: GoogleAppsScript.Document.Paragraph, fontSize: number): void {
  const et = para.editAsText();
  const len = et.getText().length;
  if (len > 0) {
    et.setBold(0, len - 1, true);
    et.setFontSize(0, len - 1, fontSize);
  }
}

function renderMarkdownLines(
  body: GoogleAppsScript.Document.Body,
  markdown: string,
  startIndex: number
): void {
  const lines = markdown.split("\n");
  let idx = startIndex;
  let inCodeBlock = false;
  let codeLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        for (const codeLine of codeLines) {
          const para = body.insertParagraph(idx, codeLine || " ");
          para.editAsText().setFontFamily("Courier New");
          idx++;
        }
        codeLines = [];
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      continue;
    }

    if (line.startsWith("#### ")) {
      body.insertParagraph(idx, line.slice(5) || " ").setHeading(DocumentApp.ParagraphHeading.HEADING4);
    } else if (line.startsWith("### ")) {
      body.insertParagraph(idx, line.slice(4) || " ").setHeading(DocumentApp.ParagraphHeading.HEADING3);
    } else if (line.startsWith("## ")) {
      body.insertParagraph(idx, line.slice(3) || " ").setHeading(DocumentApp.ParagraphHeading.HEADING2);
    } else if (line.startsWith("# ")) {
      body.insertParagraph(idx, line.slice(2) || " ").setHeading(DocumentApp.ParagraphHeading.HEADING1);
    } else if (/^[-*] /.test(line)) {
      const content = line.slice(2);
      const item = body.insertListItem(idx, content || " ");
      item.setGlyphType(DocumentApp.GlyphType.BULLET);
      applyInlineMarkdown(item.editAsText(), content);
    } else if (/^\d+\. /.test(line)) {
      const content = line.replace(/^\d+\. /, "");
      const item = body.insertListItem(idx, content || " ");
      item.setGlyphType(DocumentApp.GlyphType.NUMBER);
      applyInlineMarkdown(item.editAsText(), content);
    } else {
      const text = line || " ";
      const para = body.insertParagraph(idx, text);
      applyInlineMarkdown(para.editAsText(), text);
    }

    idx++;
  }
}

function applyInlineMarkdown(textEl: GoogleAppsScript.Document.Text, line: string): void {
  if (!line) return;
  type Segment = { text: string; bold: boolean; italic: boolean; code: boolean };
  const segments: Segment[] = [];
  let remaining = line;

  while (remaining.length > 0) {
    const codeMatch = remaining.match(/^`([^`]+)`/);
    if (codeMatch) {
      segments.push({ text: codeMatch[1], bold: false, italic: false, code: true });
      remaining = remaining.slice(codeMatch[0].length);
      continue;
    }
    const boldItalicMatch = remaining.match(/^\*\*\*([^*]+)\*\*\*/);
    if (boldItalicMatch) {
      segments.push({ text: boldItalicMatch[1], bold: true, italic: true, code: false });
      remaining = remaining.slice(boldItalicMatch[0].length);
      continue;
    }
    const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
    if (boldMatch) {
      segments.push({ text: boldMatch[1], bold: true, italic: false, code: false });
      remaining = remaining.slice(boldMatch[0].length);
      continue;
    }
    const italicMatch = remaining.match(/^\*([^*]+)\*/);
    if (italicMatch) {
      segments.push({ text: italicMatch[1], bold: false, italic: true, code: false });
      remaining = remaining.slice(italicMatch[0].length);
      continue;
    }
    const nextSpecial = remaining.search(/[*`]/);
    if (nextSpecial <= 0) {
      segments.push({ text: remaining, bold: false, italic: false, code: false });
      remaining = "";
    } else {
      segments.push({ text: remaining.slice(0, nextSpecial), bold: false, italic: false, code: false });
      remaining = remaining.slice(nextSpecial);
    }
  }

  const plainText = segments.map((s) => s.text).join("");
  if (!plainText) {
    return;
  }
  textEl.setText(plainText);
  textEl.setFontSize(11);
  textEl.setFontFamily("Arial");

  let pos = 0;
  for (const seg of segments) {
    const end = pos + seg.text.length - 1;
    if (seg.text.length > 0) {
      if (seg.bold) textEl.setBold(pos, end, true);
      if (seg.italic) textEl.setItalic(pos, end, true);
      if (seg.code) {
        textEl.setFontFamily(pos, end, "Courier New");
        textEl.setFontSize(pos, end, 10);
      }
    }
    pos += seg.text.length;
  }
}

function escapeQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function listCurrentLevelEntries(rootFolderId: string, maxFiles: number): DriveListResult {
  if (!rootFolderId) {
    throw new Error("找不到可用的資料夾 ID。");
  }

  const query = `'${escapeQuery(rootFolderId)}' in parents and trashed = false`;
  const files = listDriveFiles(query, maxFiles);
  const rows: DriveItemRow[] = [];
  for (const file of files) {
    rows.push(toDriveItemRow(file));
  }

  rows.sort((a, b) => {
    if (a.itemType !== b.itemType) {
      return a.itemType === "資料夾" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return { rows, truncated: rows.length >= maxFiles };
}

function listDriveFiles(query: string, maxFiles: number): DriveApiFile[] {
  const files: DriveApiFile[] = [];
  let pageToken: string | undefined;
  const drive = getDriveApi();

  while (files.length < maxFiles) {
    const response = drive.Files.list({
      q: query,
      maxResults: Math.min(1000, maxFiles - files.length),
      pageToken,
      fields: "items(id,title,mimeType,modifiedDate,fileSize,alternateLink,webViewLink),nextPageToken",
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      includeTeamDriveItems: true,
      supportsTeamDrives: true
    } as Record<string, unknown>) as Record<string, unknown>;

    const items = (response.items as DriveApiFile[] | undefined) || [];
    files.push(...items);

    pageToken = typeof response.nextPageToken === "string" ? response.nextPageToken : undefined;
    if (!pageToken || items.length === 0) {
      break;
    }
  }

  return dedupeApiFiles(files).slice(0, maxFiles);
}

function getFolderMetadataById(folderId: string): DriveApiFile {
  const drive = getDriveApi();
  const file = drive.Files.get(folderId, {
    fields: "id,title,mimeType",
    supportsAllDrives: true,
    supportsTeamDrives: true
  } as Record<string, unknown>) as DriveApiFile;

  if (file.mimeType !== "application/vnd.google-apps.folder") {
    throw new Error("folderId 指向的不是資料夾。");
  }

  return file;
}

function getDriveApi(): {
  Files: {
    list: (args: Record<string, unknown>) => Record<string, unknown>;
    get: (id: string, args: Record<string, unknown>) => Record<string, unknown>;
    copy: (resource: Record<string, unknown>, id: string, args?: Record<string, unknown>) => Record<string, unknown>;
  };
} {
  const api = (globalThis as Record<string, unknown>).Drive as {
    Files?: {
      list: (args: Record<string, unknown>) => Record<string, unknown>;
      get: (id: string, args: Record<string, unknown>) => Record<string, unknown>;
      copy: (resource: Record<string, unknown>, id: string, args?: Record<string, unknown>) => Record<string, unknown>;
    };
  } | undefined;

  if (!api?.Files) {
    throw new Error("Drive 進階服務未啟用。請在 Apps Script 專案啟用 Drive API v2。");
  }

  return {
    Files: {
      list: api.Files.list,
      get: api.Files.get,
      copy: api.Files.copy
    }
  };
}

function toDriveItemRow(file: DriveApiFile): DriveItemRow {
  const mimeType = file.mimeType || "application/octet-stream";
  const size = file.fileSize ? Number(file.fileSize) : 0;
  const date = safeDate(file.modifiedDate);

  return {
    name: file.title || "(未命名)",
    mimeType,
    updatedAt: formatTimestamp(date),
    sizeLabel: formatFileSize(size, mimeType),
    url: buildDriveFileUrl(file),
    itemType: mimeType === "application/vnd.google-apps.folder" ? "資料夾" : "檔案"
  };
}

function formatFileSize(sizeBytes: number, mimeType: string): string {
  if (mimeType.startsWith("application/vnd.google-apps")) {
    return "--";
  }

  if (sizeBytes <= 0) {
    return "--";
  }

  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = sizeBytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  const formatted = size >= 10 || unitIndex === 0 ? size.toFixed(0) : size.toFixed(1);
  return `${formatted} ${units[unitIndex]}`;
}

function formatTimestamp(date: Date): string {
  return Utilities.formatDate(date, Session.getScriptTimeZone(), "yyyy-MM-dd HH:mm:ss");
}

function safeDate(dateString?: string): Date {
  if (!dateString) {
    return new Date(0);
  }

  const parsed = new Date(dateString);
  if (Number.isNaN(parsed.getTime())) {
    return new Date(0);
  }

  return parsed;
}

function buildDriveFileUrl(file: DriveApiFile): string {
  if (file.alternateLink) {
    return file.alternateLink;
  }
  if (file.webViewLink) {
    return file.webViewLink;
  }
  return file.id ? `https://drive.google.com/open?id=${encodeURIComponent(file.id)}` : "#";
}

function renderDrivePage(input: {
  inputPath: string;
  normalizedPath: string;
  folderId: string;
  rows: DriveItemRow[];
  ambiguousCount: number;
  truncated: boolean;
  message: string;
}): string {
  const escapedPath = escapeHtml(input.inputPath);
  const escapedFolderId = escapeHtml(input.folderId);
  const escapedNormalizedPath = escapeHtml(input.normalizedPath || "(未解析)");
  const rowHtml = input.rows.length > 0
    ? input.rows.map(renderRow).join("")
    : `<tr><td colspan="5" class="empty">沒有找到項目</td></tr>`;

  const infoParts = [
    `資料夾路徑：${escapedNormalizedPath}`,
    input.folderId ? `Folder ID：${escapedFolderId}` : "",
    `項目數：${input.rows.length}`
  ].filter(Boolean);

  const warnings: string[] = [];
  if (input.ambiguousCount > 0) {
    warnings.push(`有 ${input.ambiguousCount + 1} 個同名路徑，已自動使用其中一個。建議在查詢欄位填入 folderId 來精準指定。`);
  }
  if (input.truncated) {
    warnings.push(`檔案數超過 ${MAX_FILES} 筆，結果已截斷。`);
  }

  const noticeBlocks = [
    input.message ? `<div class="notice error">${escapeHtml(input.message)}</div>` : "",
    warnings.map((text) => `<div class="notice warn">${escapeHtml(text)}</div>`).join("")
  ].join("");

  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Drive File Browser</title>
  <style>
    :root {
      --bg: #f5f7fb;
      --panel: #ffffff;
      --line: #d7dce8;
      --text: #1a1d29;
      --muted: #5a6175;
      --accent: #0a66c2;
      --accent-soft: #e9f3ff;
      --warn-bg: #fff8e1;
      --warn-line: #f5d66f;
      --error-bg: #fdebec;
      --error-line: #ef9a9a;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif;
      background: var(--bg);
      color: var(--text);
    }
    .wrap {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px;
    }
    h1 {
      margin: 0 0 8px;
      font-size: 24px;
      letter-spacing: 0;
    }
    .sub {
      margin: 0 0 16px;
      color: var(--muted);
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 14px;
    }
    .form {
      display: grid;
      grid-template-columns: 1fr 320px auto;
      gap: 10px;
      align-items: center;
    }
    input[type="text"] {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--line);
      border-radius: 6px;
      font-size: 14px;
    }
    button {
      border: 1px solid var(--accent);
      background: var(--accent);
      color: #fff;
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 14px;
      cursor: pointer;
    }
    button:hover { opacity: 0.92; }
    .meta {
      margin: 12px 0 0;
      padding: 10px;
      background: var(--accent-soft);
      color: #154273;
      border: 1px solid #bfdcff;
      border-radius: 6px;
      font-size: 13px;
      word-break: break-all;
    }
    .notice {
      margin-top: 12px;
      padding: 10px 12px;
      border-radius: 6px;
      font-size: 14px;
    }
    .notice.warn {
      background: var(--warn-bg);
      border: 1px solid var(--warn-line);
    }
    .notice.error {
      background: var(--error-bg);
      border: 1px solid var(--error-line);
    }
    .tableWrap {
      margin-top: 14px;
      overflow-x: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
      min-width: 880px;
    }
    th, td {
      border-bottom: 1px solid var(--line);
      text-align: left;
      vertical-align: top;
      padding: 10px 12px;
      font-size: 13px;
    }
    th {
      background: #eef2fa;
      color: #283148;
      white-space: nowrap;
    }
    td a {
      color: var(--accent);
      text-decoration: none;
    }
    td a:hover {
      text-decoration: underline;
    }
    .empty {
      color: var(--muted);
      text-align: center;
      padding: 22px;
    }
    @media (max-width: 900px) {
      .form { grid-template-columns: 1fr; }
      .wrap { padding: 16px; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Google Drive 檔案列表</h1>
    <p class="sub">支援以路徑搜尋資料夾，僅列出當層檔案與資料夾（不往下展開）。</p>
    <div class="panel">
      <form class="form" method="get">
        <input type="text" name="path" value="${escapedPath}" placeholder="例：與我共用/P_行動技術研究專案/15.專案資料夾/Galaxy/014_ISO27001/紀錄" />
        <input type="text" name="folderId" value="${escapedFolderId}" placeholder="可選：folderId（優先於 path）" />
        <button type="submit">查詢</button>
      </form>
      <div class="meta">${infoParts.join(" | ")}</div>
      ${noticeBlocks}
    </div>
    <div class="tableWrap">
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
        <tbody>${rowHtml}</tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
}

function renderRow(row: DriveItemRow): string {
  return `<tr>
    <td><a href="${escapeHtml(row.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(row.name)}</a></td>
    <td>${escapeHtml(row.itemType)}</td>
    <td>${escapeHtml(row.mimeType)}</td>
    <td>${escapeHtml(row.sizeLabel)}</td>
    <td>${escapeHtml(row.updatedAt)}</td>
  </tr>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

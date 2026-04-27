import type {
  CopyRequestPayload,
  StructuredDocConfig,
  TemplateCopyOptions,
  TemplateCopyResult,
  TemplateInspectionResult
} from "./types";
import { FORM_REGISTRY, DEFAULT_DRIVE_PATH, MAX_FILES } from "./config";
import { resolveTargetFolder, listCurrentLevelEntries, extractDriveFileId, getDriveApi, buildDriveFileUrl } from "./drive";
import { hasStructuredDocConfig, applyStructuredConfigToDoc, collectBodyLines, extractPlaceholdersFromLine, extractLabelCandidate, collectTableKeyCandidates } from "./doc";
import { renderDrivePage } from "./html";

export function copyFormTemplate(formCode: string, config?: StructuredDocConfig): string {
  const entry = FORM_REGISTRY[formCode.toLowerCase()];
  if (!entry) {
    throw new Error(`未知表單代碼：${formCode}，可用代碼：${Object.keys(FORM_REGISTRY).join(", ")}`);
  }

  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const monthPrefix = `${entry.prefix}-${yy}${mm}`;

  const resolvedFolder = resolveTargetFolder(entry.targetFolderPath, "");
  const existing = listCurrentLevelEntries(resolvedFolder.folderId, MAX_FILES);
  const monthCount = existing.rows.filter((f) => f.name.startsWith(monthPrefix)).length;
  const serialCode = `${yy}${mm}${monthCount + 1}`;

  const itemName = config?.replaceText?.["{{項目}}"] || "";
  const newFileName = itemName
    ? `${entry.prefix}-${serialCode}_${itemName}`
    : `${entry.prefix}-${serialCode}`;

  return JSON.stringify(copyTemplateDocToFolder({
    templateDocIdOrUrl: entry.templateDocUrl,
    targetFolderPath: entry.targetFolderPath,
    newFileName,
    contentConfig: {
      ...config,
      replaceText: { "{{編號}}": serialCode, ...config?.replaceText }
    }
  }), null, 2);
}

export function inspectFormTemplate(formCode: string): string {
  const entry = FORM_REGISTRY[formCode.toLowerCase()];
  if (!entry) {
    throw new Error(`未知表單代碼：${formCode}，可用代碼：${Object.keys(FORM_REGISTRY).join(", ")}`);
  }
  return JSON.stringify(inspectTemplateFields(entry.templateDocUrl), null, 2);
}

export function copyTemplateDocToFolder(options: TemplateCopyOptions): TemplateCopyResult {
  const templateInput = (options.templateDocIdOrUrl || "").trim();
  if (!templateInput) throw new Error("templateDocIdOrUrl 不能為空");

  const templateDocId = extractDriveFileId(templateInput);
  const newFileName = (options.newFileName || "").trim();
  const resolvedFolder = resolveTargetFolder(
    (options.targetFolderPath || "").trim(),
    (options.targetFolderId || "").trim()
  );

  const drive = getDriveApi();
  const source = drive.Files.get(templateDocId, {
    fields: "id,title,mimeType",
    supportsAllDrives: true,
    supportsTeamDrives: true
  }) as { id?: string; title?: string; mimeType?: string; alternateLink?: string; webViewLink?: string };

  if (source.mimeType !== "application/vnd.google-apps.document") {
    throw new Error("templateDocIdOrUrl 不是 Google 文件（Docs）類型。");
  }

  const targetName = newFileName || source.title || "文件";
  const copied = drive.Files.copy(
    { title: targetName, parents: [{ id: resolvedFolder.folderId }] },
    templateDocId,
    { fields: "id,title,alternateLink,webViewLink,mimeType", supportsAllDrives: true, supportsTeamDrives: true }
  ) as { id?: string; title?: string; alternateLink?: string; webViewLink?: string };

  if (!copied.id) throw new Error("複製完成但沒有取得新檔案 ID。");

  const contentConfig = options.contentConfig || {};
  const hasConfig = hasStructuredDocConfig(contentConfig);
  const applyReport = hasConfig ? applyStructuredConfigToDoc(copied.id, contentConfig) : undefined;

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

export function inspectTemplateFields(templateDocIdOrUrl: string): TemplateInspectionResult {
  const templateInput = (templateDocIdOrUrl || "").trim();
  if (!templateInput) throw new Error("templateDocIdOrUrl 不能為空");

  const templateDocId = extractDriveFileId(templateInput);
  const doc = DocumentApp.openById(templateDocId);
  const body = doc.getBody();
  const lines = collectBodyLines(body).map((l) => l.trim()).filter((l) => l.length > 0);

  const placeholders = new Set<string>();
  const labelCandidates = new Set<string>();

  for (const line of lines) {
    for (const marker of extractPlaceholdersFromLine(line)) placeholders.add(marker);
    const label = extractLabelCandidate(line);
    if (label) labelCandidates.add(label);
  }
  for (const key of collectTableKeyCandidates(body)) labelCandidates.add(key);

  const title = doc.getName();
  doc.saveAndClose();

  const replaceText: Record<string, string> = {};
  for (const marker of placeholders) replaceText[marker] = "";

  const keyValues: Record<string, string> = {};
  for (const key of labelCandidates) keyValues[key] = "";

  return {
    ok: true,
    templateDocId,
    templateTitle: title,
    placeholders: [...placeholders].sort((a, b) => a.localeCompare(b)),
    labelCandidates: [...labelCandidates].sort((a, b) => a.localeCompare(b)),
    lineSamples: lines.slice(0, 80),
    sampleConfig: { replaceText, keyValues }
  };
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
    const drive = getDriveApi();
    drive.Files.list({
      maxResults: 1,
      fields: "items(id)",
      includeItemsFromAllDrives: true,
      supportsAllDrives: true,
      includeTeamDriveItems: true,
      supportsTeamDrives: true
    } as Record<string, unknown>);
    return "Drive 權限可用，已可建立表單文件。";
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

export function doGet(e?: GoogleAppsScript.Events.DoGet): GoogleAppsScript.Content.TextOutput | GoogleAppsScript.HTML.HtmlOutput {
  const pathInput = (e?.parameter?.path || DEFAULT_DRIVE_PATH).trim();
  const folderIdInput = (e?.parameter?.folderId || "").trim();
  const jsonMode = (e?.parameter?.format || "").toLowerCase() === "json";
  const action = (e?.parameter?.action || "").toLowerCase();

  try {
    if (jsonMode && action === "copy_form") {
      const formCode = (e?.parameter?.form || "a01").toLowerCase();
      return ContentService.createTextOutput(copyFormTemplate(formCode)).setMimeType(ContentService.MimeType.JSON);
    }

    if (jsonMode && action === "copy_template") {
      const result = copyTemplateDocToFolder({
        templateDocIdOrUrl: (e?.parameter?.template || "").trim(),
        newFileName: (e?.parameter?.name || "").trim(),
        targetFolderPath: (e?.parameter?.path || "").trim(),
        targetFolderId: (e?.parameter?.folderId || "").trim()
      });
      return ContentService.createTextOutput(JSON.stringify(result, null, 2)).setMimeType(ContentService.MimeType.JSON);
    }

    if (jsonMode && action === "inspect_form") {
      const formCode = (e?.parameter?.form || "a01").toLowerCase();
      return ContentService.createTextOutput(inspectFormTemplate(formCode)).setMimeType(ContentService.MimeType.JSON);
    }

    if (jsonMode && action === "inspect_template") {
      const result = inspectTemplateFields((e?.parameter?.template || "").trim());
      return ContentService.createTextOutput(JSON.stringify(result, null, 2)).setMimeType(ContentService.MimeType.JSON);
    }

    // Form selector (default) and form pages
    if (!action || action === "form") {
      const formCode = (e?.parameter?.form || "").toLowerCase();
      const pageTitle = formCode && FORM_REGISTRY[formCode]
        ? formCode.toUpperCase() + " 表單"
        : "建立表單文件";
      return HtmlService.createHtmlOutputFromFile("form-selector").setTitle(pageTitle);
    }

    // Drive browser (explicit)
    if (action === "drive" || e?.parameter?.path || folderIdInput) {
      const targetFolder = resolveTargetFolder(pathInput, folderIdInput);
      const list = listCurrentLevelEntries(targetFolder.folderId, MAX_FILES);

      if (jsonMode) {
        return ContentService.createTextOutput(JSON.stringify({
          ok: true,
          inputPath: pathInput,
          normalizedPath: targetFolder.normalizedPath,
          folderId: targetFolder.folderId,
          ambiguousCount: targetFolder.ambiguousCount,
          truncated: list.truncated,
          itemCount: list.rows.length,
          items: list.rows
        }, null, 2)).setMimeType(ContentService.MimeType.JSON);
      }

      return HtmlService
        .createHtmlOutput(renderDrivePage({ inputPath: pathInput, normalizedPath: targetFolder.normalizedPath, folderId: targetFolder.folderId, rows: list.rows, ambiguousCount: targetFolder.ambiguousCount, truncated: list.truncated, message: "" }))
        .setTitle("Drive File Browser");
    }

    // JSON-only drive query with no explicit action
    if (jsonMode) {
      const targetFolder = resolveTargetFolder(pathInput, folderIdInput);
      const list = listCurrentLevelEntries(targetFolder.folderId, MAX_FILES);
      return ContentService.createTextOutput(JSON.stringify({
        ok: true, inputPath: pathInput, normalizedPath: targetFolder.normalizedPath,
        folderId: targetFolder.folderId, ambiguousCount: targetFolder.ambiguousCount,
        truncated: list.truncated, itemCount: list.rows.length, items: list.rows
      }, null, 2)).setMimeType(ContentService.MimeType.JSON);
    }

    return HtmlService.createHtmlOutputFromFile("form-selector").setTitle("建立表單文件");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (jsonMode) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, inputPath: pathInput, folderId: folderIdInput, error: message }, null, 2)).setMimeType(ContentService.MimeType.JSON);
    }
    return HtmlService
      .createHtmlOutput(renderDrivePage({ inputPath: pathInput, normalizedPath: "", folderId: folderIdInput, rows: [], ambiguousCount: 0, truncated: false, message }))
      .setTitle("Drive File Browser");
  }
}

export function doPost(e?: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  try {
    const payload = parseCopyPayload(e?.postData?.contents || "");
    const action = (payload.action || "").toLowerCase();

    if (action === "copy_form") {
      const formCode = (payload.form || "a01").toLowerCase();
      return ContentService.createTextOutput(copyFormTemplate(formCode, payload.config)).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "copy_template") {
      const result = copyTemplateDocToFolder({
        templateDocIdOrUrl: payload.template || "",
        newFileName: payload.name || "",
        targetFolderPath: payload.path || "",
        targetFolderId: payload.folderId || "",
        contentConfig: payload.config
      });
      return ContentService.createTextOutput(JSON.stringify(result, null, 2)).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "inspect_form") {
      const formCode = (payload.form || "a01").toLowerCase();
      return ContentService.createTextOutput(inspectFormTemplate(formCode)).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "inspect_template") {
      const result = inspectTemplateFields(payload.template || "");
      return ContentService.createTextOutput(JSON.stringify(result, null, 2)).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      ok: false,
      error: "不支援的 action，請使用 copy_form、copy_template、inspect_form 或 inspect_template"
    }, null, 2)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: message }, null, 2)).setMimeType(ContentService.MimeType.JSON);
  }
}

function parseCopyPayload(raw: string): CopyRequestPayload {
  if (!raw.trim()) return {};
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { throw new Error("POST 內容不是合法 JSON。"); }
  if (!parsed || typeof parsed !== "object") throw new Error("POST JSON 格式錯誤。");
  return parsed as CopyRequestPayload;
}

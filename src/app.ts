import type {
  A01ApiPayload,
  CopyRequestPayload,
  StructuredDocConfig,
  TemplateCopyOptions,
  TemplateCopyResult,
  TemplateInspectionResult
} from "./types";
import { FORM_REGISTRY, DEFAULT_DRIVE_PATH, MAX_FILES } from "./config";
import { resolveTargetFolder, listCurrentLevelEntries, extractDriveFileId, getDriveApi, buildDriveFileUrl } from "./drive";
import { hasStructuredDocConfig, applyStructuredConfigToDoc, applyContentOnlyToDoc, applyMarkdownOnlyToDoc, collectBodyLines, extractPlaceholdersFromLine, extractLabelCandidate, collectTableKeyCandidates, readElementsAsMarkdown, readCellAsMarkdown } from "./doc";

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
  const serialCode = `${yy}${mm}${String(monthCount + 1).padStart(3, "0")}`;

  const itemName = config?.replaceText?.["{{項目}}"] || "";
  const newFileName = itemName
    ? `${entry.prefix}-${serialCode}-${itemName}`
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

export function copyFormTemplateInit(formCode: string, config?: StructuredDocConfig): TemplateCopyResult {
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
  const serialCode = `${yy}${mm}${String(monthCount + 1).padStart(3, "0")}`;

  const itemName = config?.replaceText?.["{{項目}}"] || "";
  const newFileName = itemName
    ? `${entry.prefix}-${serialCode}-${itemName}`
    : `${entry.prefix}-${serialCode}`;

  const drive = getDriveApi();
  const templateDocId = extractDriveFileId(entry.templateDocUrl);
  const copied = drive.Files.copy(
    { title: newFileName, parents: [{ id: resolvedFolder.folderId }] },
    templateDocId,
    { fields: "id,title,alternateLink,webViewLink,mimeType", supportsAllDrives: true, supportsTeamDrives: true }
  ) as { id?: string; title?: string; alternateLink?: string; webViewLink?: string };

  if (!copied.id) throw new Error("複製完成但沒有取得新檔案 ID。");

  return {
    ok: true,
    templateDocId,
    sourceName: entry.templateDocUrl,
    targetFolderId: resolvedFolder.folderId,
    targetPath: resolvedFolder.normalizedPath,
    newName: newFileName,
    newFileId: copied.id,
    newFileUrl: buildDriveFileUrl(copied),
    configApplied: false,
    _serialCode: serialCode
  } as TemplateCopyResult & { _serialCode: string };
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
  if (hasConfig) {
    applyStructuredConfigToDoc(copied.id, contentConfig);
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
    configApplied: hasConfig
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

export function getSharedUsers(formCode?: string): string {
  try {
    const code = (formCode || "a01").toLowerCase();
    const entry = FORM_REGISTRY[code];
    if (!entry) {
      return JSON.stringify({ ok: false, error: `未知表單代碼：${code}` });
    }

    const folder = resolveTargetFolder(entry.targetFolderPath, "");
    const drive = getDriveApi();
    const response = drive.Permissions.list(folder.folderId, {
      fields: "items(emailAddress,name,role,type)",
      supportsAllDrives: true,
      supportsTeamDrives: true
    });

    type PermissionItem = { emailAddress?: string; name?: string; role?: string; type?: string };
    const items = (response.items as PermissionItem[] | undefined) || [];
    const users = items
      .filter((p) => p.type === "user" && p.emailAddress)
      .map((p) => ({ name: p.name || p.emailAddress || "", email: p.emailAddress || "" }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return JSON.stringify({ ok: true, users });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return JSON.stringify({ ok: false, error: message });
  }
}

export function warmUpDrive(): string {
  try {
    getDriveApi().Files.list({
      maxResults: 1,
      fields: "items(id)",
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    } as Record<string, unknown>);
    return "ok";
  } catch {
    return "error";
  }
}

export function authorizeDriveAccess(): string {
  try {
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

export function listA01Files(): string {
  const entry = FORM_REGISTRY.a01;
  if (!entry) {
    return JSON.stringify({ ok: false, error: "找不到 A01 設定" });
  }
  try {
    const target = resolveTargetFolder(entry.targetFolderPath, "");
    const list = listCurrentLevelEntries(target.folderId, MAX_FILES, true);
    return JSON.stringify({
      ok: true,
      normalizedPath: target.normalizedPath,
      folderId: target.folderId,
      itemCount: list.rows.length,
      items: list.rows
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return JSON.stringify({ ok: false, error: message });
  }
}

export function updateA01Doc(fileId: string, config?: StructuredDocConfig): string {
  const normalizedFileId = String(fileId || "").trim();
  if (!normalizedFileId) {
    return JSON.stringify({ ok: false, error: "fileId 不能為空" });
  }
  try {
    const report = applyStructuredConfigToDoc(normalizedFileId, {
      ...(config || {}),
      clearTemplate: true
    });
    return JSON.stringify({
      ok: true,
      fileId: normalizedFileId,
      fileUrl: `https://docs.google.com/document/d/${normalizedFileId}/edit`,
      applyReport: report
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return JSON.stringify({ ok: false, error: message });
  }
}

export function readA01DocFields(fileId: string): string {
  const normalizedFileId = String(fileId || "").trim();
  if (!normalizedFileId) {
    return JSON.stringify({ ok: false, error: "fileId 不能為空" });
  }
  try {
    const doc = DocumentApp.openById(normalizedFileId);
    const fileName = doc.getName();
    const bodies = getDocBodies(doc);
    const mainBody = bodies[0];
    const allText = (mainBody ? collectBodyLines(mainBody) : [])
      .map((line) => String(line || ""))
      .join("\n");
    const tables = mainBody ? collectBodyTables(mainBody) : [];
    const signoffValues = readSignoffValues(tables);
    const descriptionMarkdown = mainBody ? readFieldMarkdownFromBody(mainBody, "說明") : "";

    const form = {
      date: normalizeDateText(readFieldValue("日期", allText, tables)),
      product: readFieldValue("需求產品", allText, tables),
      productContact: readFieldValue("產品窗口", allText, tables),
      devLead: readFieldValue("開發負責人", allText, tables),
      versionRows: readVersionRows(tables),
      item: readFieldValue("項目", allText, tables),
      jira: readFieldValue("JIRA", allText, tables),
      sensitive: readCheckValue(allText, "無涉及機敏資訊", "涉及部分資訊") ? "none" : "partial",
      sensitiveDetail: readFieldValue("涉及部分資訊說明", allText, tables),
      security: readCheckValue(allText, "按照既有資安架構", "額外套用條件") ? "existing" : "extra",
      securityDetail: readFieldValue("額外套用條件說明", allText, tables),
      description: descriptionMarkdown || readFieldValue("說明", allText, tables),
      signer: splitPeople(signoffValues["經辦"] || ""),
      tester: splitPeople(signoffValues["測試人員確認"] || ""),
      productOwner: splitPeople(signoffValues["產品負責人"] || ""),
      manager: splitPeople(signoffValues["部門主管"] || ""),
      newFeature: readCheckedMark(allText, "新增功能"),
      modifyFeature: readCheckedMark(allText, "修改功能"),
      api: readCheckedMark(allText, "API"),
      sdk: readCheckedMark(allText, "SDK"),
      backend: readCheckedMark(allText, "後台"),
      dataCenter: readCheckedMark(allText, "數據中心"),
      database: readCheckedMark(allText, "資料庫"),
      other: readCheckedMark(allText, "其他"),
      signDevLead: splitPeople(signoffValues["開發負責人"] || "")
    };

    const specMarkdown = bodies.length > 1 ? readElementsAsMarkdown(bodies[1]) : "";

    doc.saveAndClose();
    return JSON.stringify({
      ok: true,
      fileId: normalizedFileId,
      fileName,
      form,
      specMarkdown
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return JSON.stringify({ ok: false, error: message });
  }
}

type ReactPageContext = {
  defaultView: "selector" | "form" | "drive" | "file-list";
  defaultForm?: string;
  defaultPath?: string;
  defaultFolderId?: string;
};

function renderReactHtmlPage(
  fileName: "form-selector" | "form-a01",
  title: string,
  context: ReactPageContext
): GoogleAppsScript.HTML.HtmlOutput {
  const template = HtmlService.createTemplateFromFile(fileName) as unknown as {
    appContext: string;
  } & GoogleAppsScript.HTML.HtmlTemplate;
  template.appContext = JSON.stringify({
    ...context,
    defaultForm: context.defaultForm || ""
  }).replace(/<\//g, "<\\/");
  return template.evaluate().setTitle(title);
}

export function doGet(e?: GoogleAppsScript.Events.DoGet): GoogleAppsScript.Content.TextOutput | GoogleAppsScript.HTML.HtmlOutput {
  const pathInput = (e?.parameter?.path || DEFAULT_DRIVE_PATH).trim();
  const folderIdInput = (e?.parameter?.folderId || "").trim();
  const jsonMode = (e?.parameter?.format || "").toLowerCase() === "json";
  const action = (e?.parameter?.action || "").toLowerCase();
  const formCodeParam = (e?.parameter?.form || "").toLowerCase();

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

    if (jsonMode && action === "read_doc") {
      const fileId = (e?.parameter?.fileId || "").trim();
      return ContentService.createTextOutput(readA01DocFields(fileId)).setMimeType(ContentService.MimeType.JSON);
    }

    // JSON-only drive query with no explicit action (including path/folderId shortcut)
    if (jsonMode) {
      const targetFolder = resolveTargetFolder(pathInput, folderIdInput);
      const list = listCurrentLevelEntries(targetFolder.folderId, MAX_FILES);
      return ContentService.createTextOutput(JSON.stringify({
        ok: true, inputPath: pathInput, normalizedPath: targetFolder.normalizedPath,
        folderId: targetFolder.folderId, ambiguousCount: targetFolder.ambiguousCount,
        truncated: list.truncated, itemCount: list.rows.length, items: list.rows
      }, null, 2)).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "api-doc") {
      return renderReactHtmlPage("form-selector", "API 使用說明", {
        defaultView: "selector",
        defaultPath: pathInput,
        defaultFolderId: folderIdInput
      });
    }
    if (action === "file-list") {
      return renderReactHtmlPage("form-selector", "A01 文件列表", {
        defaultView: "file-list",
        defaultPath: pathInput,
        defaultFolderId: folderIdInput
      });
    }

    const shouldRenderDrive = action === "drive" || !!e?.parameter?.path || !!folderIdInput;
    if (action === "form" || (!action && FORM_REGISTRY[formCodeParam])) {
      if (formCodeParam === "a01") {
        return renderReactHtmlPage("form-a01", "A01 開發需求單", {
          defaultView: "form",
          defaultForm: "a01",
          defaultPath: pathInput,
          defaultFolderId: folderIdInput
        });
      }
      return renderReactHtmlPage("form-selector", "建立表單文件", {
        defaultView: "selector",
        defaultForm: formCodeParam,
        defaultPath: pathInput,
        defaultFolderId: folderIdInput
      });
    }

    if (shouldRenderDrive) {
      return renderReactHtmlPage("form-selector", "Drive File Browser", {
        defaultView: "drive",
        defaultPath: pathInput,
        defaultFolderId: folderIdInput
      });
    }

    return renderReactHtmlPage("form-selector", "建立表單文件", {
      defaultView: "selector",
      defaultPath: pathInput,
      defaultFolderId: folderIdInput
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (jsonMode) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, inputPath: pathInput, folderId: folderIdInput, error: message }, null, 2)).setMimeType(ContentService.MimeType.JSON);
    }
    return renderReactHtmlPage("form-selector", "建立表單文件", {
      defaultView: "selector",
      defaultPath: pathInput,
      defaultFolderId: folderIdInput
    });
  }
}

export function doPost(e?: GoogleAppsScript.Events.DoPost): GoogleAppsScript.Content.TextOutput {
  try {
    const payload = parseCopyPayload(e?.postData?.contents || "");
    const action = (payload.action || "").toLowerCase();

    if (action === "copy_form") {
      const step = String(payload.step || "").trim();
      const formCode = (payload.form || "a01").toLowerCase();
      const normalizedConfig = normalizeCopyFormConfig(formCode, payload);

      if (step === "1") {
        const result = copyFormTemplateInit(formCode, normalizedConfig) as TemplateCopyResult & { _serialCode?: string };
        return ContentService.createTextOutput(JSON.stringify(result, null, 2)).setMimeType(ContentService.MimeType.JSON);
      }

      if (step === "2") {
        const fileId = String(payload.fileId || "").trim();
        if (!fileId) throw new Error("step=2 需要提供 fileId");
        if (normalizedConfig) applyContentOnlyToDoc(fileId, normalizedConfig);
        return ContentService.createTextOutput(JSON.stringify({ ok: true }, null, 2)).setMimeType(ContentService.MimeType.JSON);
      }

      if (step === "3") {
        const fileId = String(payload.fileId || "").trim();
        if (!fileId) throw new Error("step=3 需要提供 fileId");
        if (normalizedConfig) applyMarkdownOnlyToDoc(fileId, normalizedConfig);
        const fileUrl = `https://docs.google.com/document/d/${fileId}/edit`;
        return ContentService.createTextOutput(JSON.stringify({ ok: true, newFileUrl: fileUrl }, null, 2)).setMimeType(ContentService.MimeType.JSON);
      }

      // 無 step：單次完成（backward compatible）
      return ContentService.createTextOutput(copyFormTemplate(formCode, normalizedConfig)).setMimeType(ContentService.MimeType.JSON);
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

function normalizeCopyFormConfig(formCode: string, payload: CopyRequestPayload): StructuredDocConfig | undefined {
  if (payload.config) return payload.config;
  if (formCode === "a01" && payload.a01) return buildA01StructuredConfig(payload.a01);
  return undefined;
}

function buildA01StructuredConfig(input: A01ApiPayload): StructuredDocConfig {
  const sensitiveMode = input.sensitive?.mode === "partial" ? "partial" : "none";
  const securityMode = input.security?.mode === "extra" ? "extra" : "existing";
  const versionRows = input.versionRows && input.versionRows.length > 0
    ? input.versionRows
    : [{ date: input.date || "", code: "V1.0", person: input.devLead || "", desc: "初版" }];

  const config: StructuredDocConfig = {
    replaceText: {
      "{{日期}}": toSlashDate(input.date),
      "{{需求產品}}": toText(input.product),
      "{{產品窗口}}": toText(input.productContact),
      "{{開發負責人}}": toText(input.devLead),
      "{{開發負責人S}}": joinLines(input.signDevLead),
      "{{項目}}": toText(input.item),
      "{{JIRA}}": toText(input.jira),
      "{{經辦}}": joinLines(input.signer),
      "{{測試人員確認}}": joinLines(input.tester),
      "{{產品負責人}}": joinLines(input.productOwner),
      "{{部門主管}}": joinLines(input.manager),
      "{{新增功能}}": boolMark(Boolean(input.type?.newFeature)),
      "{{修改功能}}": boolMark(Boolean(input.type?.modifyFeature)),
      "{{API}}": boolMark(Boolean(input.changeArea?.api)),
      "{{SDK}}": boolMark(Boolean(input.changeArea?.sdk)),
      "{{後台}}": boolMark(Boolean(input.changeArea?.backend)),
      "{{數據中心}}": boolMark(Boolean(input.changeArea?.dataCenter)),
      "{{資料庫}}": boolMark(Boolean(input.changeArea?.database)),
      "{{其他}}": boolMark(Boolean(input.changeArea?.other)),
      "{{無涉及機敏資訊}}": boolMark(sensitiveMode === "none"),
      "{{涉及部分資訊}}": boolMark(sensitiveMode === "partial"),
      "{{涉及部分資訊說明}}": toText(input.sensitive?.detail),
      "{{按照既有資安架構}}": boolMark(securityMode === "existing"),
      "{{額外套用條件}}": boolMark(securityMode === "extra"),
      "{{額外套用條件說明}}": toText(input.security?.detail)
    },
    tableRows: [{
      marker: "{{版本編號}}",
      rows: versionRows.map((row) => [
        toSlashDate(row.date),
        toText(row.code) || "V1.0",
        toText(row.person),
        toText(row.desc) || ""
      ])
    }]
  };

  const descriptionMarkdown = toMarkdown(input.description).trim();
  if (descriptionMarkdown) {
    config.markdownRenderMode = "rich";
    config.markdownReplace = {
      ...(config.markdownReplace || {}),
      "{{說明}}": descriptionMarkdown
    };
  }

  const specMarkdown = toMarkdown(input.specMarkdown).trim();
  if (specMarkdown) {
    config.markdownRenderMode = "rich";
    config.markdownReplace = {
      ...(config.markdownReplace || {}),
      "{{系統規格書}}": specMarkdown
    };
  }

  return config;
}

function toText(value: unknown): string {
  return value == null ? "" : String(value);
}

function toSlashDate(value: unknown): string {
  return toText(value).trim().replace(/-/g, "/");
}

function joinLines(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((entry) => toText(entry).trim())
    .filter((entry) => entry.length > 0)
    .join("\n");
}

function boolMark(enabled: boolean): string {
  return enabled ? "⬛" : "⬚";
}

function toMarkdown(value: unknown): string {
  if (Array.isArray(value)) {
    return value
      .map((entry) => toText(entry).trim())
      .filter((entry) => entry.length > 0)
      .join("\n\n---\n\n");
  }
  return toText(value);
}

function normalizeDateText(value: string): string {
  const text = value.trim().replace(/\//g, "-");
  const hit = text.match(/(\d{4}-\d{1,2}-\d{1,2})/);
  if (!hit) return "";
  const parts = hit[1].split("-");
  const y = parts[0];
  const m = parts[1].padStart(2, "0");
  const d = parts[2].padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function splitPeople(value: string): string[] {
  return value
    .split(/\r?\n|[,，、]/)
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
}

function readCheckedMark(fullText: string, label: string): boolean {
  const escaped = escapeRegex(label);
  return (
    new RegExp(`⬛\\s*${escaped}`).test(fullText) ||
    new RegExp(`${escaped}\\s*[：:]?\\s*⬛`).test(fullText)
  );
}

function readCheckValue(fullText: string, trueLabel: string, falseLabel: string): boolean {
  const trueChecked = readCheckedMark(fullText, trueLabel);
  const falseChecked = readCheckedMark(fullText, falseLabel);
  if (trueChecked || falseChecked) return trueChecked;
  return true;
}

function readFieldValue(label: string, fullText: string, tables: string[][][]): string {
  const byInline = readValueFromInlineText(label, fullText);
  if (byInline) return byInline;

  const byTable = readValueFromTables(label, tables);
  if (byTable) return byTable;

  return "";
}

function readValueFromInlineText(label: string, fullText: string): string {
  const escaped = escapeRegex(label);
  const match = fullText.match(new RegExp(`${escaped}\\s*[：:]\\s*([^\\n\\r]+)`));
  return match?.[1]?.trim() || "";
}

function readValueFromTables(label: string, tables: string[][][]): string {
  const normalizedLabel = label.replace(/\s+/g, "");
  for (const table of tables) {
    for (const row of table) {
      for (let i = 0; i < row.length; i += 1) {
        const cell = (row[i] || "").trim();
        const compact = cell.replace(/\s+/g, "");
        if (compact === normalizedLabel || compact === `${normalizedLabel}：` || compact === `${normalizedLabel}:`) {
          const next = (row[i + 1] || "").trim();
          if (next && looksLikeHeaderText(next)) continue;
          if (next) return next;
        }
        const match = cell.match(new RegExp(`^${escapeRegex(label)}\\s*[：:]\\s*(.+)$`));
        if (match?.[1]) return match[1].trim();
      }
    }
  }
  return "";
}

function looksLikeHeaderText(value: string): boolean {
  const compact = value.replace(/\s+/g, "");
  return ["開發負責人", "經辦", "測試人員確認", "產品負責人", "部門主管"].includes(compact);
}

function readSignoffValues(tables: string[][][]): Record<string, string> {
  const keys = ["開發負責人", "經辦", "測試人員確認", "產品負責人", "部門主管"];
  const emptyResult: Record<string, string> = {
    開發負責人: "",
    經辦: "",
    測試人員確認: "",
    產品負責人: "",
    部門主管: ""
  };

  for (const table of tables) {
    for (let rowIndex = 0; rowIndex < table.length; rowIndex += 1) {
      const header = table[rowIndex];
      if (!header || header.length === 0) continue;
      const compactHeader = header.map((cell) => (cell || "").replace(/\s+/g, ""));
      const hitCount = keys.filter((key) => compactHeader.includes(key)).length;
      if (hitCount < 3) continue;

      const valueRow = table[rowIndex + 1] || [];
      const result = { ...emptyResult };
      for (const key of keys) {
        const col = compactHeader.findIndex((cell) => cell === key);
        if (col < 0) continue;
        result[key] = String(valueRow[col] || "").trim();
      }
      return result;
    }
  }

  return emptyResult;
}

function readFieldMarkdownFromBody(body: GoogleAppsScript.Document.Body, label: string): string {
  const normalizedLabel = label.replace(/\s+/g, "");
  for (let i = 0; i < body.getNumChildren(); i += 1) {
    const child = body.getChild(i);
    if (child.getType() !== DocumentApp.ElementType.TABLE) continue;
    const table = child.asTable();
    for (let rowIndex = 0; rowIndex < table.getNumRows(); rowIndex += 1) {
      const row = table.getRow(rowIndex);
      for (let colIndex = 0; colIndex < row.getNumCells(); colIndex += 1) {
        const keyCell = row.getCell(colIndex);
        const keyText = keyCell.getText().replace(/\s+/g, "").replace(/[：:]+$/, "");
        if (keyText !== normalizedLabel) continue;
        if (colIndex + 1 >= row.getNumCells()) continue;
        return readCellAsMarkdown(row.getCell(colIndex + 1));
      }
    }
  }
  return "";
}

function readVersionRows(tables: string[][][]): Array<{ date: string; code: string; person: string; desc: string }> {
  for (const table of tables) {
    const headerIndex = table.findIndex((row) => row.some((cell) => cell.includes("版本編號")));
    if (headerIndex < 0) continue;
    const rows: Array<{ date: string; code: string; person: string; desc: string }> = [];
    for (let i = headerIndex + 1; i < table.length; i += 1) {
      const row = table[i];
      const date = normalizeDateText((row[0] || "").trim());
      const code = (row[1] || "").trim();
      const person = (row[2] || "").trim();
      const desc = (row[3] || "").trim();
      if (!date && !code && !person && !desc) continue;
      rows.push({
        date: date || "",
        code: code || "V1.0",
        person,
        desc
      });
    }
    if (rows.length > 0) return rows;
  }
  return [{ date: "", code: "V1.0", person: "", desc: "初版" }];
}

function collectBodyTables(body: GoogleAppsScript.Document.Body): string[][][] {
  const tables: string[][][] = [];
  for (let i = 0; i < body.getNumChildren(); i += 1) {
    const child = body.getChild(i);
    if (child.getType() !== DocumentApp.ElementType.TABLE) continue;
    const table = child.asTable();
    const rows: string[][] = [];
    for (let row = 0; row < table.getNumRows(); row += 1) {
      const tableRow = table.getRow(row);
      const cells: string[] = [];
      for (let col = 0; col < tableRow.getNumCells(); col += 1) {
        cells.push(tableRow.getCell(col).getText().trim());
      }
      rows.push(cells);
    }
    tables.push(rows);
  }
  return tables;
}

function getDocBodies(doc: GoogleAppsScript.Document.Document): GoogleAppsScript.Document.Body[] {
  try {
    const docWithTabs = doc as unknown as {
      getTabs(): Array<{ asDocumentTab(): { getBody(): GoogleAppsScript.Document.Body } }>;
    };
    const tabs = docWithTabs.getTabs();
    if (Array.isArray(tabs) && tabs.length > 0) {
      return tabs.map((tab) => tab.asDocumentTab().getBody());
    }
  } catch {
    // Ignore tab API errors and fallback to getBody.
  }
  return [doc.getBody()];
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

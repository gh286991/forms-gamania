import type { DriveApiFile, DriveItemRow, DriveListResult, FolderResolveResult } from "./types";
import { MAX_FILES, SHARED_WITH_ME_SEGMENTS } from "./config";

export function resolveTargetFolder(pathInput: string, folderIdInput: string): FolderResolveResult {
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

export function listCurrentLevelEntries(rootFolderId: string, maxFiles: number): DriveListResult {
  if (!rootFolderId) {
    throw new Error("找不到可用的資料夾 ID。");
  }

  const query = `'${escapeQuery(rootFolderId)}' in parents and trashed = false`;
  const files = listDriveFiles(query, maxFiles);
  const rows: DriveItemRow[] = files.map(toDriveItemRow);

  rows.sort((a, b) => {
    if (a.itemType !== b.itemType) {
      return a.itemType === "資料夾" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  return { rows, truncated: rows.length >= maxFiles };
}

export function extractDriveFileId(input: string): string {
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

export function buildDriveFileUrl(file: DriveApiFile): string {
  if (file.alternateLink) {
    return file.alternateLink;
  }
  if (file.webViewLink) {
    return file.webViewLink;
  }
  return file.id ? `https://drive.google.com/open?id=${encodeURIComponent(file.id)}` : "#";
}

export function getDriveApi(): {
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
      if (!parent.id) continue;
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
    if (!pageToken || items.length === 0) break;
  }

  return dedupeApiFiles(files).slice(0, maxFiles);
}

function dedupeApiFiles(files: DriveApiFile[]): DriveApiFile[] {
  const idMap = new Map<string, DriveApiFile>();
  for (const file of files) {
    if (file.id) idMap.set(file.id, file);
  }
  return [...idMap.values()];
}

function normalizePath(pathInput: string): string[] {
  return pathInput
    .split(/[/>]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .filter((s) => !SHARED_WITH_ME_SEGMENTS.has(s));
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
  if (mimeType.startsWith("application/vnd.google-apps")) return "--";
  if (sizeBytes <= 0) return "--";

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
  if (!dateString) return new Date(0);
  const parsed = new Date(dateString);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
}

function escapeQuery(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

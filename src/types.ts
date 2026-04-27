export type DriveItemRow = {
  name: string;
  mimeType: string;
  updatedAt: string;
  sizeLabel: string;
  url: string;
  itemType: "資料夾" | "檔案";
};

export type DriveListResult = {
  rows: DriveItemRow[];
  truncated: boolean;
};

export type FolderResolveResult = {
  folderId: string;
  folderName: string;
  normalizedPath: string;
  ambiguousCount: number;
};

export type DriveApiFile = {
  id?: string;
  title?: string;
  mimeType?: string;
  modifiedDate?: string;
  fileSize?: string;
  alternateLink?: string;
  webViewLink?: string;
};

export type TemplateCopyOptions = {
  templateDocIdOrUrl: string;
  targetFolderPath?: string;
  targetFolderId?: string;
  newFileName?: string;
  contentConfig?: StructuredDocConfig;
};

export type TemplateCopyResult = {
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

export type StructuredDocConfig = {
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
  markdownSections?: Array<{
    title: string;
    content: string | string[];
  }>;
};

export type ApplyConfigReport = {
  replacedTexts: string[];
  replacedKeyValues: string[];
  appendedKeyValues: string[];
  replacedMarkdown: string[];
};

export type TemplateInspectionResult = {
  ok: true;
  templateDocId: string;
  templateTitle: string;
  placeholders: string[];
  labelCandidates: string[];
  lineSamples: string[];
  sampleConfig: StructuredDocConfig;
};

export type CopyRequestPayload = {
  action?: string;
  form?: string;
  template?: string;
  name?: string;
  path?: string;
  folderId?: string;
  config?: StructuredDocConfig;
};

export type FormRegistryEntry = {
  templateDocUrl: string;
  targetFolderPath: string;
  prefix: string;
  label: string;
};

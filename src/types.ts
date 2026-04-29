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

export type TableRowsSpec = {
  marker: string;    // placeholder in the template row to locate it, e.g. "{{版本編號}}"
  rows: string[][];  // [rowIndex][colIndex] — values to fill, by column order
};

export type StructuredDocConfig = {
  clearTemplate?: boolean;
  markdownRenderMode?: "raw" | "rich";
  replaceText?: Record<string, string>;
  keyValues?: Record<string, string>;
  appendUnknownKeyValues?: boolean;
  tableRows?: TableRowsSpec[];
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
  step?: string | number;
  fileId?: string;
  form?: string;
  template?: string;
  name?: string;
  path?: string;
  folderId?: string;
  config?: StructuredDocConfig;
  a01?: A01ApiPayload;
};

export type A01VersionRowPayload = {
  date?: string;
  code?: string;
  person?: string;
  desc?: string;
};

export type A01ApiPayload = {
  date?: string;
  product?: string;
  productContact?: string;
  devLead?: string;
  signDevLead?: string[];
  item?: string;
  jira?: string;
  description?: string;
  signer?: string[];
  tester?: string[];
  productOwner?: string[];
  manager?: string[];
  versionRows?: A01VersionRowPayload[];
  type?: {
    newFeature?: boolean;
    modifyFeature?: boolean;
  };
  changeArea?: {
    api?: boolean;
    sdk?: boolean;
    backend?: boolean;
    dataCenter?: boolean;
    database?: boolean;
    other?: boolean;
  };
  sensitive?: {
    mode?: "none" | "partial";
    detail?: string;
  };
  security?: {
    mode?: "existing" | "extra";
    detail?: string;
  };
  specMarkdown?: string | string[];
  specMarkdownFiles?: string | string[];
};

export type FormRegistryEntry = {
  templateDocUrl: string;
  targetFolderPath: string;
  prefix: string;
  label: string;
};

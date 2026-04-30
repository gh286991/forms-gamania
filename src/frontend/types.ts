export type AppView = "selector" | "form" | "drive" | "api-doc";

export type AppContext = {
  defaultView?: AppView;
  defaultForm?: string;
  defaultPath?: string;
  defaultFolderId?: string;
};

declare global {
  interface Window {
    __APP_CONTEXT__?: AppContext;
  }
}

export type DriveItem = {
  name: string;
  mimeType: string;
  updatedAt: string;
  sizeLabel: string;
  url: string;
  itemType: "資料夾" | "檔案";
};

export type DriveResponse = {
  ok?: boolean;
  inputPath?: string;
  normalizedPath?: string;
  folderId?: string;
  ambiguousCount?: number;
  truncated?: boolean;
  itemCount?: number;
  items?: DriveItem[];
  error?: string;
  message?: string;
};

export type CopyResponse = {
  ok?: boolean;
  newFileUrl?: string;
  newName?: string;
  error?: string;
  message?: string;
};

export type VersionRow = {
  date: string;
  code: string;
  person: string;
  desc: string;
};

export type FormValues = {
  date: string;
  product: string;
  productContact: string;
  devLead: string;
  versionRows: VersionRow[];
  item: string;
  jira: string;
  sensitive: string;
  sensitiveDetail: string;
  security: string;
  securityDetail: string;
  description: string;
  signer: string[];
  tester: string[];
  productOwner: string[];
  manager: string[];
  newFeature: boolean;
  modifyFeature: boolean;
  api: boolean;
  sdk: boolean;
  backend: boolean;
  dataCenter: boolean;
  database: boolean;
  other: boolean;
  signDevLead: string[];
};

export type RouteState = {
  view: AppView;
  formCode: string;
  path: string;
  folderId: string;
};

export type DriveAuthState = {
  checked: boolean;
  status: "idle" | "checking" | "ok" | "warn" | "error";
  message: string;
  authUrl?: string;
};

export type MessageState = {
  kind: "none" | "success" | "error";
  text: string;
  url?: string;
};

export type FormOption = {
  code: string;
  label: string;
  enabled: boolean;
  desc: string;
};

export type SharedUser = {
  name: string;
  email: string;
};

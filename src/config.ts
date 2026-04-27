import type { FormRegistryEntry } from "./types";

// Add new form codes here (a02~a07) as needed.
export const FORM_REGISTRY: Record<string, FormRegistryEntry> = {
  a01: {
    templateDocUrl: "https://docs.google.com/document/d/1pND-UIIClViPTwCYDNI32K6bvHilQLsOGpHIn3f4VpI/edit?usp=sharing",
    targetFolderPath: "與我共用/P_行動技術研究專案/15.專案資料夾/Galaxy/014_ISO27001/紀錄/GXY-A01-開發需求",
    prefix: "GXY-A01",
    label: "A01 開發需求單"
  }
};

export const DEFAULT_DRIVE_PATH = "與我共用/P_行動技術研究專案/15.專案資料夾/Galaxy/014_ISO27001/紀錄";
export const MAX_FILES = 1500;
export const SHARED_WITH_ME_SEGMENTS = new Set(["與我共用", "shared with me", "Shared with me"]);

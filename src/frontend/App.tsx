import React, { useEffect, useState } from "react";
import type { AppContext, DriveAuthState, RouteState } from "./types";
import { SelectorView } from "./components/SelectorView";
import { DriveView } from "./components/DriveView";
import { A01FormPage } from "./components/A01FormPage";
import { StartupScreen } from "./components/StartupScreen";
import { callGas } from "./utils/callGas";
import { parseAuthMessage, buildAuthErrorState, toPlainText } from "./utils/helpers";

function getInitialRoute(context: AppContext = {}): RouteState {
  const params = new URLSearchParams(window.location.search || "");
  const action = (params.get("action") || "").toLowerCase();
  const form = (params.get("form") || "").toLowerCase();
  const path = (params.get("path") || context.defaultPath || "").trim();
  const folderId = (params.get("folderId") || context.defaultFolderId || "").trim();

  if ((action === "form" || form === "a01") && form) {
    if (form === "a01") return { view: "form", formCode: "a01", path, folderId };
    return { view: "selector", formCode: form, path, folderId };
  }
  if (action === "drive" || params.get("path") || params.get("folderId")) {
    return { view: "drive", formCode: "", path, folderId };
  }
  if (context.defaultView === "form" && context.defaultForm === "a01") {
    return { view: "form", formCode: "a01", path, folderId };
  }
  return {
    view: context.defaultView === "drive" ? "drive" : "selector",
    formCode: "",
    path,
    folderId
  };
}

function useSyncUrl(route: RouteState) {
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      if (route.view === "selector") {
        url.searchParams.delete("action");
        url.searchParams.delete("form");
        url.searchParams.delete("path");
        url.searchParams.delete("folderId");
      } else if (route.view === "form") {
        url.searchParams.set("action", "form");
        url.searchParams.set("form", route.formCode);
        url.searchParams.delete("path");
        url.searchParams.delete("folderId");
      } else {
        if (route.path) url.searchParams.set("path", route.path);
        else url.searchParams.delete("path");
        if (route.folderId) url.searchParams.set("folderId", route.folderId);
        else url.searchParams.delete("folderId");
        url.searchParams.set("action", "drive");
        url.searchParams.delete("form");
      }
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    } catch {
      // silently ignore in sandboxed iframe environments (GAS)
    }
  }, [route]);
}

export function App() {
  const context = window.__APP_CONTEXT__ || {};

  // null = startup not done yet
  const [authState, setAuthState] = useState<DriveAuthState | null>(null);
  const [route, setRoute] = useState<RouteState>(getInitialRoute(context));
  const [selectorError, setSelectorError] = useState(
    route.view === "selector" && route.formCode && route.formCode !== "a01"
      ? `找不到表單 ${route.formCode.toUpperCase()}，請從選單重新選擇。`
      : ""
  );

  useSyncUrl(route);

  // Show startup screen until all checks pass
  if (authState === null) {
    return (
      <StartupScreen
        onReady={(auth) => setAuthState(auth)}
      />
    );
  }

  async function refreshDriveAuth(force = true) {
    if (force) {
      setAuthState((prev) => prev
        ? { ...prev, status: "checking", message: "正在檢查 Drive 權限…" }
        : prev
      );
    }
    try {
      const raw = await callGas<string>((runner) => {
        (runner as any).authorizeDriveAccess();
      });
      setAuthState(parseAuthMessage(toPlainText(raw)));
    } catch (error) {
      setAuthState(
        buildAuthErrorState(error instanceof Error ? error.message : String(error))
      );
    }
  }

  function openSelector() {
    setSelectorError("");
    setRoute({ ...route, view: "selector", formCode: "", path: route.path, folderId: route.folderId });
  }

  function openDrive() {
    setSelectorError("");
    setRoute({ view: "drive", formCode: "", path: route.path || "", folderId: route.folderId || "" });
  }

  function openForm(code: string) {
    if (code !== "a01") {
      setSelectorError(`找不到表單 ${code.toUpperCase()}，請選擇其他表單`);
      setRoute({ ...route, view: "selector", formCode: "" });
      return;
    }
    setSelectorError("");
    setRoute({ ...route, view: "form", formCode: "a01", path: route.path, folderId: route.folderId });
  }

  return (
    <main className="app-shell">
      {route.view === "selector" ? (
        <SelectorView
          selectorError={selectorError}
          onOpenForm={openForm}
          onOpenDrive={openDrive}
        />
      ) : null}
      {route.view === "drive" ? (
        <DriveView
          initialPath={route.path}
          initialFolderId={route.folderId}
          onBack={openSelector}
        />
      ) : null}
      {route.view === "form" && route.formCode === "a01" ? (
        <A01FormPage
          authState={authState}
          onRefreshAuth={refreshDriveAuth}
          onBack={openSelector}
        />
      ) : null}
    </main>
  );
}

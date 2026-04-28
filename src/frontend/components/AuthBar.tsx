import React from "react";
import type { DriveAuthState } from "../types";

export function AuthBar({
  state,
  onRefresh
}: {
  state: DriveAuthState;
  onRefresh: () => void;
}) {
  if (state.status === "idle") return null;
  return (
    <div className={`auth-bar ${state.status}`}>
      <span className="auth-msg">{state.message}</span>
      {state.authUrl ? (
        <a
          className="auth-link show"
          href={state.authUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          前往授權
        </a>
      ) : null}
      <button type="button" className="auth-refresh" onClick={onRefresh}>
        重新檢查
      </button>
    </div>
  );
}

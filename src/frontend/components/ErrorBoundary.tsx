import React from "react";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (error) {
      return (
        <div style={{ padding: "32px", fontFamily: "monospace", color: "#c00" }}>
          <strong>應用程式發生錯誤</strong>
          <pre style={{ marginTop: "12px", whiteSpace: "pre-wrap", fontSize: "12px" }}>
            {error.message}
            {"\n"}
            {error.stack}
          </pre>
          <button
            style={{ marginTop: "16px", padding: "8px 16px", cursor: "pointer" }}
            onClick={() => this.setState({ error: null })}
          >
            重試
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

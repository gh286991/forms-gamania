export function callGas<T>(invoke: (runner: unknown) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const google = (window as any).google;
    const runner = google?.script?.run;
    if (!runner || !runner.withSuccessHandler) {
      reject(new Error("目前未在 Apps Script 環境執行，請從 Web App 開啟"));
      return;
    }
    const chain = runner
      .withSuccessHandler((result: T) => resolve(result))
      .withFailureHandler((error: unknown) => {
        const msg =
          error && typeof error === "object" && "message" in error
            ? String((error as { message?: unknown }).message)
            : String(error || "執行失敗");
        reject(new Error(msg || "執行失敗"));
      });
    invoke(chain);
  });
}

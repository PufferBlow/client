import { vi } from "vitest";

/**
 * An XMLHttpRequest that sends through the mocked `fetch`, so a test that watches fetch calls also
 * sees uploads, which go through XHR to report their progress.
 */
export function stubXhrOverFetch(): void {
  class XhrOverFetch {
    upload: { onprogress?: unknown } = {};
    onload?: () => void;
    onerror?: () => void;
    onabort?: () => void;
    status = 0;
    responseText = "";
    private method = "GET";
    private url = "";
    private headers: Record<string, string> = {};
    open(method: string, url: string) {
      this.method = method;
      this.url = url;
    }
    setRequestHeader(name: string, value: string) {
      this.headers[name] = value;
    }
    send(body: BodyInit) {
      fetch(this.url, { method: this.method, headers: this.headers, body }).then(
        async (response) => {
          this.status = response.status;
          this.responseText = await response.text();
          this.onload?.();
        },
        () => this.onerror?.(),
      );
    }
    abort() {
      this.onabort?.();
    }
  }
  vi.stubGlobal("XMLHttpRequest", XhrOverFetch);
}

import { act, render, renderHook, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadFile, isInstanceUrl } from "../../lib/files";
import { api } from "../../services/api";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { combinedProgress, uploadProgress, useUploadProgress } from "./store";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

class FakeXhr {
  static last: FakeXhr;
  upload: { onprogress?: (e: { lengthComputable: boolean; loaded: number; total: number }) => void } = {};
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  status = 200;
  responseText = '{"ok":true}';
  open = vi.fn();
  setRequestHeader = vi.fn();
  send = vi.fn();
  abort = () => this.onabort?.();
  constructor() {
    FakeXhr.last = this;
  }
}

describe("upload progress", () => {
  it("reports bytes sent for a form request and resolves with the body", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const seen: Array<[number, number]> = [];
    const done = api.post<{ ok: boolean }>("http://x.test/up", { form: new FormData(), onUploadProgress: (l, t) => seen.push([l, t]) });
    FakeXhr.last.upload.onprogress?.({ lengthComputable: true, loaded: 50, total: 200 });
    FakeXhr.last.onload?.();
    await expect(done).resolves.toEqual({ ok: true });
    expect(seen).toEqual([[50, 200]]);
  });

  it("maps a failed upload to an ApiError", async () => {
    vi.stubGlobal("XMLHttpRequest", FakeXhr);
    const done = api.post("http://x.test/up", { form: new FormData(), onUploadProgress: () => {} });
    FakeXhr.last.onerror?.();
    await expect(done).rejects.toMatchObject({ code: "network" });
  });

  it("tracks a sending message's progress in the store", () => {
    const { result } = renderHook(() => useUploadProgress("local_1"));
    expect(result.current).toBeUndefined();
    act(() => uploadProgress.set("local_1", { loaded: 1, total: 4 }));
    expect(result.current).toEqual({ loaded: 1, total: 4 });
    act(() => uploadProgress.clear("local_1"));
    expect(result.current).toBeUndefined();
  });

  it("adds up several files by their own share of the bytes", () => {
    const reports: Array<{ loaded: number; total: number }> = [];
    const forFile = combinedProgress([100, 300], (p) => reports.push(p));
    forFile(0)(110, 110); // framing makes the body larger than the file; the file's share is capped at its size
    forFile(1)(150, 300);
    expect(reports.at(-1)).toEqual({ loaded: 250, total: 400 });
  });
});

describe("ProgressBar", () => {
  it("shows a percentage, or no value when the size is unknown", () => {
    const { rerender } = render(<ProgressBar loaded={25} total={100} label="Up" />);
    expect(screen.getByRole("progressbar", { name: "Up" })).toHaveAttribute("aria-valuenow", "25");
    rerender(<ProgressBar loaded={25} total={0} label="Up" />);
    expect(screen.getByRole("progressbar", { name: "Up" })).not.toHaveAttribute("aria-valuenow");
  });
});

describe("downloadFile", () => {
  it("streams the body and reports progress", async () => {
    const chunks = [new Uint8Array(30), new Uint8Array(70)];
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const c of chunks) controller.enqueue(c);
        controller.close();
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body, { headers: { "content-length": "100" } })));
    URL.createObjectURL = vi.fn(() => "blob:x");
    URL.revokeObjectURL = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    const seen: number[] = [];
    await downloadFile("http://x.test/f", "f.bin", { onProgress: (l) => seen.push(l) });
    expect(seen).toEqual([0, 30, 100]);
    expect(click).toHaveBeenCalled();
  });

  it("fails on an error status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("no", { status: 404 })));
    await expect(downloadFile("http://x.test/f", "f")).rejects.toThrow("404");
  });
});

describe("isInstanceUrl", () => {
  it("is true only for the signed-in instance's own origin", () => {
    expect(isInstanceUrl("/storage/abc", "http://a.test:7575")).toBe(true);
    expect(isInstanceUrl("http://a.test:7575/storage/abc", "http://a.test:7575")).toBe(true);
    expect(isInstanceUrl("https://evil.test/x", "http://a.test:7575")).toBe(false);
    expect(isInstanceUrl("/x", null)).toBe(false);
  });
});

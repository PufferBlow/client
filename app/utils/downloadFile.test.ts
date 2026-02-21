import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadFileViaBlob } from "./downloadFile";
import { refreshAuthSession, getAuthTokenForRequests } from "../services/authSession";

vi.mock("../services/authSession", () => ({
  refreshAuthSession: vi.fn(),
  getAuthTokenForRequests: vi.fn(),
}));

vi.mock("./logger", () => ({
  logger: {
    api: {
      error: vi.fn(),
    },
  },
}));

describe("downloadFileViaBlob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal(
      "URL",
      Object.assign(URL, {
        createObjectURL: vi.fn(() => "blob:download"),
        revokeObjectURL: vi.fn(),
      }),
    );
    vi.mocked(getAuthTokenForRequests).mockReturnValue(null);
  });

  it("downloads file via blob and triggers browser download", async () => {
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      statusText: "OK",
      headers: new Headers({
        "content-disposition": 'attachment; filename="report.pdf"',
      }),
      blob: vi.fn().mockResolvedValue(new Blob(["pdf"], { type: "application/pdf" })),
    } as unknown as Response);

    const result = await downloadFileViaBlob({
      url: "http://localhost:7575/storage/report-hash",
    });

    expect(result.success).toBe(true);
    expect(result.filename).toBe("report.pdf");
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });

  it("retries once after 401 with refresh", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
        headers: new Headers(),
        blob: vi.fn(),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: "OK",
        headers: new Headers(),
        blob: vi.fn().mockResolvedValue(new Blob(["ok"], { type: "application/octet-stream" })),
      } as unknown as Response);
    vi.mocked(refreshAuthSession).mockResolvedValueOnce({
      success: true,
      authToken: "new-auth-token",
    });

    const result = await downloadFileViaBlob({
      url: "http://localhost:7575/storage/retry-file",
      includeAuthRefresh: true,
    });

    expect(result.success).toBe(true);
    expect(refreshAuthSession).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("returns an error when fetch fails", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error("Network down"));

    const result = await downloadFileViaBlob({
      url: "http://localhost:7575/storage/fail",
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Network down");
  });
});


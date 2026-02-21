import { describe, expect, it } from "vitest";
import { resolveFileTypeMeta } from "./fileTypeMeta";

describe("resolveFileTypeMeta", () => {
  it("maps known document extensions", () => {
    const pdfMeta = resolveFileTypeMeta({ filename: "report.pdf", mimeType: "application/octet-stream" });
    const docxMeta = resolveFileTypeMeta({ filename: "notes.docx" });

    expect(pdfMeta.category).toBe("document");
    expect(pdfMeta.badgeLabel).toBe("PDF");
    expect(docxMeta.category).toBe("document");
    expect(docxMeta.badgeLabel).toBe("DOCX");
  });

  it("maps known source-code extensions", () => {
    const cMeta = resolveFileTypeMeta({ filename: "main.c" });
    const pyMeta = resolveFileTypeMeta({ filename: "worker.py" });
    const javaMeta = resolveFileTypeMeta({ filename: "App.java" });
    const tsMeta = resolveFileTypeMeta({ filename: "ui.ts" });
    const jsMeta = resolveFileTypeMeta({ filename: "runtime.js" });

    expect(cMeta.category).toBe("code");
    expect(cMeta.badgeLabel).toBe("C");
    expect(pyMeta.badgeLabel).toBe("PY");
    expect(javaMeta.badgeLabel).toBe("JAVA");
    expect(tsMeta.badgeLabel).toBe("TS");
    expect(jsMeta.badgeLabel).toBe("JS");
  });

  it("prefers extension mapping over generic mime type", () => {
    const meta = resolveFileTypeMeta({
      filename: "script.ts",
      mimeType: "application/octet-stream",
    });

    expect(meta.category).toBe("code");
    expect(meta.badgeLabel).toBe("TS");
  });

  it("falls back to unknown for unsupported file types", () => {
    const meta = resolveFileTypeMeta({
      filename: "blob.customext",
      mimeType: "application/octet-stream",
    });

    expect(meta.category).toBe("unknown");
    expect(meta.badgeLabel).toBeUndefined();
  });
});


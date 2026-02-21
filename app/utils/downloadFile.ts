import { refreshAuthSession, getAuthTokenForRequests } from "../services/authSession";
import { logger } from "./logger";

interface DownloadFileInput {
  url: string;
  filename?: string;
  mimeType?: string;
  includeAuthRefresh?: boolean;
}

interface DownloadFileResult {
  success: boolean;
  filename?: string;
  error?: string;
}

const decodeFilename = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const parseContentDispositionFilename = (value: string | null): string | null => {
  if (!value) return null;

  const utf8Match = value.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
  if (utf8Match?.[1]) {
    return decodeFilename(utf8Match[1].trim());
  }

  const simpleMatch = value.match(/filename\s*=\s*"?([^";]+)"?/i);
  if (simpleMatch?.[1]) {
    return decodeFilename(simpleMatch[1].trim());
  }

  return null;
};

const fallbackFilenameFromUrl = (url: string): string => {
  try {
    const parsed = new URL(url, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    const pathname = parsed.pathname || "";
    const tail = pathname.split("/").pop() || "";
    return decodeFilename(tail) || "download";
  } catch {
    return "download";
  }
};

const maybeAttachAuthToken = (rawUrl: string): string => {
  const token = getAuthTokenForRequests();
  if (!token) return rawUrl;

  try {
    const parsed = new URL(rawUrl, typeof window !== "undefined" ? window.location.origin : "http://localhost");
    if (parsed.pathname.includes("/api/v1/storage/file/")) {
      parsed.searchParams.set("auth_token", token);
    }
    if (/^https?:\/\//i.test(rawUrl)) {
      return parsed.toString();
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return rawUrl;
  }
};

const fetchDownloadResponse = async (url: string): Promise<Response> => {
  return fetch(url, {
    method: "GET",
  });
};

export const downloadFileViaBlob = async ({
  url,
  filename,
  mimeType,
  includeAuthRefresh = true,
}: DownloadFileInput): Promise<DownloadFileResult> => {
  if (!url) {
    return {
      success: false,
      error: "Missing file URL",
    };
  }

  let preparedUrl = maybeAttachAuthToken(url);
  let response: Response;

  try {
    response = await fetchDownloadResponse(preparedUrl);
  } catch (error) {
    logger.api.error("Download request failed", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Download failed",
    };
  }

  if (response.status === 401 && includeAuthRefresh) {
    const refreshResult = await refreshAuthSession("file_download_retry");
    if (refreshResult.success) {
      try {
        preparedUrl = maybeAttachAuthToken(url);
        response = await fetchDownloadResponse(preparedUrl);
      } catch (error) {
        logger.api.error("Retry download request failed", error);
        return {
          success: false,
          error: error instanceof Error ? error.message : "Download retry failed",
        };
      }
    }
  }

  if (!response.ok) {
    const error = `Download failed (${response.status} ${response.statusText})`;
    logger.api.error(error, { url: preparedUrl });
    return {
      success: false,
      error,
    };
  }

  let blob: Blob;
  try {
    blob = await response.blob();
  } catch (error) {
    logger.api.error("Failed to read download blob", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Invalid file response",
    };
  }

  const dispositionFilename = parseContentDispositionFilename(response.headers.get("content-disposition"));
  const resolvedFilename = filename || dispositionFilename || fallbackFilenameFromUrl(preparedUrl);

  try {
    const blobMimeType = blob.type || mimeType || "application/octet-stream";
    const downloadBlob = blob.type ? blob : new Blob([blob], { type: blobMimeType });
    const objectUrl = URL.createObjectURL(downloadBlob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = resolvedFilename || "download";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(objectUrl);

    return {
      success: true,
      filename: anchor.download,
    };
  } catch (error) {
    logger.api.error("Failed to trigger browser download", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unable to start browser download",
    };
  }
};


import type { ApiResponse } from './apiClient';
import { createApiClient } from './apiClient';

export interface CDNFile {
  filename: string;
  url: string;
  size: number;
  uploaded_at: string;
  content_type: string;
}

export interface CDNFileInfo extends CDNFile {
  metadata: Record<string, any>;
}

// File/CDN Management functions (Server Owner only)
export const listCDNFiles = async (directory: string, authToken: string): Promise<ApiResponse<{ status_code: number; files: CDNFile[] }>> => {
  const apiClient = createApiClient();
  return apiClient.post(`/api/v1/cdn/files`, {
    auth_token: authToken,
    directory,
  });
};

export const deleteCDNFile = async (fileUrl: string, authToken: string): Promise<ApiResponse<{ status_code: number; message: string }>> => {
  const apiClient = createApiClient();
  return apiClient.post(`/api/v1/cdn/delete-file`, {
    auth_token: authToken,
    file_url: fileUrl,
  });
};

export const getCDNFileInfo = async (fileUrl: string, authToken: string): Promise<ApiResponse<{ status_code: number; file_info: CDNFileInfo }>> => {
  const apiClient = createApiClient();
  return apiClient.post(`/api/v1/cdn/file-info`, {
    auth_token: authToken,
    file_url: fileUrl,
  });
};

export const cleanupOrphanedFiles = async (subdirectory: string, authToken: string): Promise<ApiResponse<{ status_code: number; message: string; cleaned_count: number }>> => {
  const apiClient = createApiClient();
  return apiClient.post(`/api/v1/cdn/cleanup-orphaned`, {
    auth_token: authToken,
    subdirectory,
  });
};

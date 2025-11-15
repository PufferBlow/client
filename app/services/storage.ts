import type { ApiResponse } from './apiClient';
import { createApiClient } from './apiClient';

export interface StorageFile {
  filename: string;
  url: string;
  size: number;
  uploaded_at: string;
  content_type: string;
}

export interface StorageFileInfo extends StorageFile {
  metadata: Record<string, any>;
}

// File/Storage Management functions (Server Owner only)
export const listStorageFiles = async (directory: string, authToken: string): Promise<ApiResponse<{ status_code: number; files: StorageFile[] }>> => {
  const apiClient = createApiClient();
  return apiClient.post(`/api/v1/storage/files`, {
    auth_token: authToken,
    directory,
  });
};

export const deleteStorageFile = async (fileUrl: string, authToken: string): Promise<ApiResponse<{ status_code: number; message: string }>> => {
  const apiClient = createApiClient();
  return apiClient.post(`/api/v1/storage/delete-file`, {
    auth_token: authToken,
    file_url: fileUrl,
  });
};

export const getStorageFileInfo = async (fileUrl: string, authToken: string): Promise<ApiResponse<{ status_code: number; file_info: StorageFileInfo }>> => {
  const apiClient = createApiClient();
  return apiClient.post(`/api/v1/storage/file-info`, {
    auth_token: authToken,
    file_url: fileUrl,
  });
};

export const cleanupOrphanedFiles = async (subdirectory: string, authToken: string): Promise<ApiResponse<{ status_code: number; message: string; cleaned_count: number }>> => {
  const apiClient = createApiClient();
  return apiClient.post(`/api/v1/storage/cleanup-orphaned`, {
    auth_token: authToken,
    subdirectory,
  });
};

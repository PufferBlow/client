import { logger } from '../utils/logger';
import { getHostPortFromStorage as getHostPort } from './user';

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // Remove trailing slash
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isFormData: boolean = false
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      logger.api.debug(`Making request to ${url}`, options);

      const response = await fetch(url, {
        ...options,
        headers: {
          // Don't set Content-Type for FormData - let the browser set it with boundary
          ...(options.body && !isFormData && { 'Content-Type': 'application/json' }),
          ...options.headers,
        },
      });

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

        // Try to parse error response as JSON to get FastAPI detail messages
        try {
          const errorJson = await response.json();
          if (errorJson.detail) {
            errorMessage = errorJson.detail;
          } else if (errorJson.error) {
            errorMessage = errorJson.error;
          }
        } catch {
          // If JSON parsing fails, use text or fallback
          try {
            const errorText = await response.text();
            if (errorText) {
              errorMessage = errorText;
            }
          } catch {
            // Use default error message
          }
        }

        logger.api.error(`Request failed: ${response.status} ${response.statusText}`, errorMessage);
        return {
          success: false,
          error: errorMessage,
        };
      }

      const data = await response.json();
      logger.api.debug('Request successful', data);
      return {
        success: true,
        data,
      };
    } catch (error) {
      logger.api.error('Request error', error);

      // Check if it's a CORS error
      if (error instanceof TypeError && error.message.includes('CORS')) {
        return {
          success: false,
          error: 'CORS error: The server does not allow cross-origin requests from this domain. Please check server configuration.',
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async get<T>(endpoint: string, params?: Record<string, string>, headers?: Record<string, string>, method?: string): Promise<ApiResponse<T>> {
    let fullEndpoint = endpoint;
    if (params) {
      const url = new URL(`http://dummy${endpoint}`);
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
      fullEndpoint = url.pathname + url.search;
    }
    return this.request<T>(fullEndpoint, { headers, method: method || 'GET' });
  }

  async post<T>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    const isFormData = body instanceof FormData;
    return this.request<T>(endpoint, {
      method: 'POST',
      body: isFormData ? body : (body ? JSON.stringify(body) : undefined),
      headers,
    }, isFormData);
  }

  async put<T>(endpoint: string, body?: any, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  async delete<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    let fullEndpoint = endpoint;
    if (params) {
      const url = new URL(`http://dummy${endpoint}`);
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
      fullEndpoint = url.pathname + url.search;
    }
    return this.request<T>(fullEndpoint, {
      method: 'DELETE',
    });
  }
}

export const createApiClient = (hostPort?: string): ApiClient => {
  let selectedHostPort = hostPort || getHostPort() || 'localhost:7575';

  // If no port is specified, default to 7575
  if (selectedHostPort && !selectedHostPort.includes(':')) {
    selectedHostPort = `${selectedHostPort}:7575`;
  }

  const baseUrl = `http://${selectedHostPort}`;
  return new ApiClient(baseUrl);
};

// Utility function to convert relative storage URLs to full API URLs
export const convertToFullStorageUrl = (storageUrl: string): string => {
  if (storageUrl.startsWith('http://') || storageUrl.startsWith('https://')) {
    // Already a full URL, return as-is
    return storageUrl;
  }

  // If it's a relative storage URL starting with /storage, convert it to full API URL
  if (storageUrl.startsWith('/storage')) {
    const hostPort = getHostPort() || 'localhost:7575';
    const baseUrl = `http://${hostPort}`;
    return `${baseUrl}${storageUrl}`;
  }

  // Otherwise return as-is (might be unrelated URL)
  return storageUrl;
};

// Blocked IPs API service functions
export interface BlockedIP {
  ip: string;
  reason: string;
  blocked_at: string;
}

export interface BlockIPRequest {
  auth_token: string;
  ip: string;
  reason: string;
}

export interface UnblockIPRequest {
  auth_token: string;
  ip: string;
}

export interface ListBlockedIPsResponse {
  blocked_ips: BlockedIP[];
}

// Blocked IPs API service functions
export const listBlockedIPs = async (authToken: string): Promise<ApiResponse<ListBlockedIPsResponse>> => {
  const apiClient = createApiClient();
  return apiClient.post<ListBlockedIPsResponse>('/api/v1/blocked-ips/list', {
    auth_token: authToken
  });
};

export const blockIP = async (authToken: string, ip: string, reason: string): Promise<ApiResponse<{ message: string; reason: string }>> => {
  const apiClient = createApiClient();
  return apiClient.post<{ message: string; reason: string }>('/api/v1/blocked-ips/block', {
    auth_token: authToken,
    ip,
    reason
  });
};

export const unblockIP = async (authToken: string, ip: string): Promise<ApiResponse<{ message: string }>> => {
  const apiClient = createApiClient();
  return apiClient.post<{ message: string }>('/api/v1/blocked-ips/unblock', {
    auth_token: authToken,
    ip
  });
};

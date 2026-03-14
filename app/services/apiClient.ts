import { logger } from '../utils/logger';
import { getAuthTokenForRequests, refreshAuthSession } from './authSession';
import { resolveInstance, resolveStoredInstance } from './instance';
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

  private withAuthTokenInEndpoint(endpoint: string, authToken: string | null): string {
    if (!authToken) return endpoint;
    try {
      const url = new URL(`http://dummy${endpoint}`);
      if (!url.searchParams.has('auth_token')) {
        return endpoint;
      }
      url.searchParams.set('auth_token', authToken);
      return `${url.pathname}${url.search}`;
    } catch {
      return endpoint;
    }
  }

  private withAuthTokenInBody(
    body: BodyInit | null | undefined,
    authToken: string | null,
    isFormData: boolean
  ): BodyInit | null | undefined {
    if (!body || !authToken) return body;

    if (isFormData && body instanceof FormData) {
      const clonedFormData = new FormData();
      body.forEach((value, key) => {
        clonedFormData.append(key, value);
      });
      if (clonedFormData.has('auth_token')) {
        clonedFormData.set('auth_token', authToken);
      }
      return clonedFormData;
    }

    if (typeof body === 'string') {
      try {
        const parsed = JSON.parse(body);
        if (parsed && typeof parsed === 'object' && 'auth_token' in parsed) {
          return JSON.stringify({
            ...parsed,
            auth_token: authToken,
          });
        }
      } catch {
        return body;
      }
    }

    if (body instanceof URLSearchParams) {
      const clonedParams = new URLSearchParams(body);
      if (clonedParams.has('auth_token')) {
        clonedParams.set('auth_token', authToken);
      }
      return clonedParams;
    }

    return body;
  }

  private withUpdatedAuthToken(
    options: RequestInit,
    authToken: string | null,
    isFormData: boolean
  ): RequestInit {
    return {
      ...options,
      body: this.withAuthTokenInBody(options.body, authToken, isFormData),
    };
  }

  private async performFetch(
    endpoint: string,
    options: RequestInit,
    isFormData: boolean
  ): Promise<Response> {
    const url = `${this.baseUrl}${endpoint}`;
    logger.api.debug(`Making request to ${url}`, options);

    return fetch(url, {
      ...options,
      headers: {
        // Don't set Content-Type for FormData - let the browser set it with boundary
        ...(options.body && !isFormData && { 'Content-Type': 'application/json' }),
        ...(this.getNodeSessionToken() && { 'X-Pufferblow-Node-Session': this.getNodeSessionToken() as string }),
        ...options.headers,
      },
    });
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    isFormData: boolean = false
  ): Promise<ApiResponse<T>> {
    try {
      const initialAuthToken = getAuthTokenForRequests();
      let requestEndpoint = this.withAuthTokenInEndpoint(endpoint, initialAuthToken);
      let requestOptions = this.withUpdatedAuthToken(options, initialAuthToken, isFormData);
      let response = await this.performFetch(requestEndpoint, requestOptions, isFormData);

      if (
        response.status === 401 &&
        !requestEndpoint.includes('/api/v1/auth/refresh') &&
        !requestEndpoint.includes('/api/v1/users/signin') &&
        !requestEndpoint.includes('/api/v1/users/signup')
      ) {
        const refreshResult = await refreshAuthSession('api_401_retry');
        if (refreshResult.success) {
          const refreshedAuthToken = refreshResult.authToken || getAuthTokenForRequests();
          requestEndpoint = this.withAuthTokenInEndpoint(endpoint, refreshedAuthToken);
          requestOptions = this.withUpdatedAuthToken(
            options,
            refreshedAuthToken,
            isFormData
          );
          response = await this.performFetch(requestEndpoint, requestOptions, isFormData);
        }
      }

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

  private getNodeSessionToken(): string | null {
    if (typeof window === 'undefined') return null;
    return (
      sessionStorage.getItem('node_session_token') ||
      localStorage.getItem('node_session_token')
    );
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
  const selectedHostPort = hostPort || getHostPort();

  // If no instance is configured, fail fast instead of guessing.
  if (!selectedHostPort) {
    throw new Error('No home instance configured. Please configure your server connection first.');
  }

  return new ApiClient(resolveInstance(selectedHostPort).apiBaseUrl);
};

// Utility function to convert relative storage URLs to full API URLs
export const convertToFullStorageUrl = (storageUrl: string): string => {
  if (storageUrl.startsWith('http://') || storageUrl.startsWith('https://')) {
    // Already a full URL, return as-is
    return storageUrl;
  }

  // If it's a relative storage URL starting with /storage, convert it to full API URL
  if (storageUrl.startsWith('/storage')) {
    const resolved = resolveStoredInstance(getHostPort());
    return resolved ? `${resolved.apiBaseUrl}${storageUrl}` : storageUrl;
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

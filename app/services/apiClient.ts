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
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      logger.api.debug(`Making request to ${url}`, options);

      const response = await fetch(url, {
        ...options,
        headers: {
          ...(options.body && { 'Content-Type': 'application/json' }),
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.api.error(`Request failed: ${response.status} ${response.statusText}`, errorText);
        return {
          success: false,
          error: `HTTP ${response.status}: ${response.statusText}`,
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
    return this.request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    });
  }

  async put<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    let fullEndpoint = endpoint;
    if (params) {
      const url = new URL(`http://dummy${endpoint}`);
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
      fullEndpoint = url.pathname + url.search;
    }
    return this.request<T>(fullEndpoint, {
      method: 'PUT',
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

export const createApiClient = (): ApiClient => {
  const hostPort = getHostPort() || 'localhost:7575';
  const baseUrl = `http://${hostPort}`;
  return new ApiClient(baseUrl);
};

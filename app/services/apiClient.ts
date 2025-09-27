import { logger } from '../utils/logger';

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
          'Content-Type': 'application/json',
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
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async get<T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> {
    let fullEndpoint = endpoint;
    if (params) {
      const url = new URL(`http://dummy${endpoint}`);
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
      fullEndpoint = url.pathname + url.search;
    }
    return this.request<T>(fullEndpoint);
  }

  async post<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    let fullEndpoint = endpoint;
    if (body) {
      const url = new URL(`http://dummy${endpoint}`);
      Object.entries(body).forEach(([key, value]) => {
        url.searchParams.append(key, String(value));
      });
      fullEndpoint = url.pathname + url.search;
    }
    return this.request<T>(fullEndpoint, {
      method: 'POST',
    });
  }

  async put<T>(endpoint: string, body?: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'DELETE',
    });
  }
}

export const createApiClient = (hostPort: string): ApiClient => {
  const baseUrl = `http://${hostPort}`;
  return new ApiClient(baseUrl);
};

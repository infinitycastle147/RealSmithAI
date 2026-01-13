/**
 * API configuration utility
 * Handles API base URL for both development and production
 * 
 * In development: Uses Vite proxy (empty string = relative path)
 * In production: Uses VITE_API_URL environment variable
 */
export const getApiBaseUrl = (): string => {
  // In production, use the backend URL from environment variable
  // In development, return empty string to use Vite proxy
  return import.meta.env.VITE_API_URL || '';
};

/**
 * Build full API URL for an endpoint
 * @param endpoint - API endpoint path (e.g., 'gemini/script' or 'quota/status')
 * @returns Full URL to the API endpoint
 */
export const getApiUrl = (endpoint: string): string => {
  const baseUrl = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${baseUrl}/api/${cleanEndpoint}`;
};

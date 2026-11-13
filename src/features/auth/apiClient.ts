import { apiUrl } from '../../shared/apiBase';

export const apiClient = {
  post(path: string, options: RequestInit): Promise<Response> {
    return fetch(apiUrl(path), { ...options, method: 'POST' });
  },
};

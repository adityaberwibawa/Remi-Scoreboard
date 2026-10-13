/** Konfigurasi API remote + error bersama (tanpa dependensi siklus). */

export class RemoteApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'RemoteApiError';
    this.status = status;
  }
}

export function baseUrl(): string {
  return (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');
}

/** Mock dipakai bila base URL belum diisi (dev tanpa backend). */
export function useMock(): boolean {
  if (process.env.EXPO_PUBLIC_USE_MOCK === '0') return false;
  return baseUrl().length === 0;
}

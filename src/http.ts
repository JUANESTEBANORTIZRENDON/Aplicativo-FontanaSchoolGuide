export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string, readonly details?: Record<string, unknown>) {
    super(message);
  }
}

export function escapar(value: string | number | null | undefined): string {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

// Cliente de la API: mismo origen, JSON y errores con el mensaje del servidor.
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const unavailable = 'No se pudo conectar con el servidor. Verifica que Fontana School esté iniciado e intenta nuevamente.';
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });
  } catch {
    throw new ApiError(unavailable, 0);
  }
  if (response.status === 204) return undefined as T;
  if (response.status === 401 && path !== '/auth/login' && path !== '/auth/me') {
    location.assign('/login');
    throw new ApiError('Tu sesión venció. Inicia sesión nuevamente para continuar.', 401);
  }
  const text = await response.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError(response.status >= 500 ? unavailable : 'El servidor devolvió una respuesta no válida. Intenta nuevamente.', response.status);
  }
  if (!response.ok) {
    const data = (body && typeof body === 'object' ? body : {}) as { message?: unknown; code?: unknown; details?: unknown };
    const details = data.details && typeof data.details === 'object' ? data.details as Record<string, unknown> : undefined;
    const fields = details ? Object.entries(details).filter(([key, value]) => key !== 'blockedReason' && typeof value === 'string').map(([, value]) => value as string) : [];
    const message = typeof data.message === 'string' ? data.message : 'No se pudo completar la solicitud.';
    throw new ApiError(fields.length && data.code === 'VALIDATION_ERROR' ? `${message} ${fields.join(' ')}` : message, response.status, typeof data.code === 'string' ? data.code : undefined, details);
  }
  return body as T;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

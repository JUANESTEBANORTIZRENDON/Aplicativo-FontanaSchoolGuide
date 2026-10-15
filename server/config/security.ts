export const BCRYPT_ROUNDS = 12;
export const PASSWORD_MIN_LENGTH = 10;
// bcrypt solo usa los primeros 72 bytes.
export const PASSWORD_MAX_BYTES = 72;

export const SESSION_COOKIE = 'fontana_session';
export const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;

export const LOGIN_LIMITS = {
  windowMs: 15 * 60_000,
  // Fallos permitidos para la misma IP y el mismo identificador.
  perIdentifier: 5,
  // Fallos permitidos para una IP con cualquier identificador.
  perIp: 25,
};

export const OVERRIDE_REASON_MIN = 10;
export const STATUS_REASON_MIN = 10;

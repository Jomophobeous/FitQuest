type Primitive = string | number | boolean | null | undefined;

const SENSITIVE_KEY_PATTERNS = [
  /token/i,
  /secret/i,
  /password/i,
  /passcode/i,
  /key/i,
  /authorization/i,
  /cookie/i,
  /refresh/i,
  /session/i,
  /biometric/i,
  /receipt/i,
  /idtoken/i,
];

const REDACTED = '[REDACTED]';

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function sanitizePrimitive(value: Primitive): Primitive {
  if (typeof value !== 'string') return value;
  if (value.length <= 8) return REDACTED;
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

export function redactForLog<T>(input: T): T {
  if (input === null || input === undefined) return input;

  if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
    return sanitizePrimitive(input as Primitive) as T;
  }

  if (Array.isArray(input)) {
    return input.map((item) => redactForLog(item)) as T;
  }

  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (isSensitiveKey(key)) {
        out[key] = REDACTED;
      } else {
        out[key] = redactForLog(value);
      }
    }
    return out as T;
  }

  return input;
}

export function safeInfo(message: string, data?: Record<string, unknown>): void {
  if (data) {
    if (__DEV__) console.log(message, redactForLog(data));
    return;
  }
  if (__DEV__) console.log(message);
}

export function safeWarn(message: string, data?: Record<string, unknown>): void {
  if (data) {
    if (__DEV__) console.warn(message, redactForLog(data));
    return;
  }
  if (__DEV__) console.warn(message);
}

export async function safeError(
  message: string,
  error?: unknown,
  data?: Record<string, unknown>
): Promise<void> {
  const payload = {
    ...(data || {}),
    error: error instanceof Error
      ? { name: error.name, message: error.message }
      : typeof error === 'string'
        ? { message: error }
        : undefined,
  };

  if (__DEV__) console.error(message, redactForLog(payload));
}

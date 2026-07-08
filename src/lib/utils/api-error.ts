type ApiErrorShape = {
  response?: {
    data?: {
      message?: string | string[];
      errorCode?: string;
      params?: Record<string, unknown>;
    };
  };
};

/**
 * Resolves a human-readable, translated message from an API error.
 *
 * Resolution order:
 *  1. If the response includes an `errorCode`, look up `errors.<errorCode>` in i18n,
 *     interpolating `params` (e.g. `{{name}}`) when present.
 *  2. Fall back to the raw `message` string from the response body.
 *  3. Fall back to the provided `fallback` string.
 *
 * i18next returns the key itself when no translation is found, so the
 * `translated !== key` guard is the canonical "key exists" check.
 */
export function resolveApiError(
  e: unknown,
  t: (key: string, params?: Record<string, unknown>) => string,
  fallback?: string,
): string | undefined {
  const data = (e as ApiErrorShape | null | undefined)?.response?.data;
  if (data?.errorCode) {
    const key = `errors.${data.errorCode}`;
    const translated = t(key, data.params);
    if (translated !== key) return translated;
  }
  const rawMessage = data?.message;
  const message = Array.isArray(rawMessage)
    ? rawMessage.length > 0
      ? rawMessage.join('; ')
      : undefined
    : rawMessage;
  return message ?? fallback;
}

const TOKEN_PATTERN = /Bearer\s+[A-Za-z0-9._~+\/-]+/gi;
const SECRET_FIELD_PATTERN = /(token|secret|authorization)\s*[:=]\s*[^,\s]+/gi;

export function redactSensitiveText(input: string, extraSecrets: string[] = []): string {
  let output = input.replace(TOKEN_PATTERN, "Bearer [REDACTED]");
  output = output.replace(SECRET_FIELD_PATTERN, "$1=[REDACTED]");

  for (const secret of extraSecrets) {
    if (!secret) continue;
    output = output.split(secret).join("[REDACTED]");
  }

  return output;
}

export function safeErrorMessage(error: unknown, extraSecrets: string[] = []): string {
  if (error instanceof Error) {
    return redactSensitiveText(error.message, extraSecrets);
  }

  return redactSensitiveText(String(error), extraSecrets);
}

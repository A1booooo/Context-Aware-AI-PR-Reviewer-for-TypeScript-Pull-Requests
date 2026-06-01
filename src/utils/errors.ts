const SENSITIVE_REPLACEMENTS: Array<[pattern: RegExp, replacement: string]> = [
  [/\bGITHUB_TOKEN\s*=\s*[^\s,;]+/g, 'GITHUB_TOKEN=[REDACTED]'],
  [/\bOPENAI_API_KEY\s*=\s*[^\s,;]+/g, 'OPENAI_API_KEY=[REDACTED]'],
  [/\bANTHROPIC_API_KEY\s*=\s*[^\s,;]+/g, 'ANTHROPIC_API_KEY=[REDACTED]'],
  [/\bAuthorization\s*:\s*Bearer\s+[^\s,;]+/gi, 'Authorization: [REDACTED]'],
  [/\bAuthorization\s*=\s*[^\s,;]+(?:\s+[^\s,;]+)?/gi, 'Authorization=[REDACTED]'],
  [/\btoken\s*=\s*[^\s,;]+/gi, 'token=[REDACTED]'],
  [/\bapi[_\s-]?key\s*:\s*[^\s,;]+/gi, 'api key: [REDACTED]']
];

export function redactSensitiveText(value: string): string {
  return SENSITIVE_REPLACEMENTS.reduce((sanitized, [pattern, replacement]) => {
    return sanitized.replace(pattern, replacement);
  }, value);
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return redactSensitiveText(error.message);
  }

  return redactSensitiveText(String(error));
}

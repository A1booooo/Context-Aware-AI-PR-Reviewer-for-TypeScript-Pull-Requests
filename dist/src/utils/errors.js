"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redactSensitiveText = redactSensitiveText;
exports.getErrorMessage = getErrorMessage;
const SENSITIVE_REPLACEMENTS = [
    [/\bGITHUB_TOKEN\s*=\s*[^\s,;]+/g, 'GITHUB_TOKEN=[REDACTED]'],
    [/\bOPENAI_API_KEY\s*=\s*[^\s,;]+/g, 'OPENAI_API_KEY=[REDACTED]'],
    [/\bANTHROPIC_API_KEY\s*=\s*[^\s,;]+/g, 'ANTHROPIC_API_KEY=[REDACTED]'],
    [/\bAuthorization\s*:\s*Bearer\s+[^\s,;]+/gi, 'Authorization: [REDACTED]'],
    [/\bAuthorization\s*=\s*[^\s,;]+(?:\s+[^\s,;]+)?/gi, 'Authorization=[REDACTED]'],
    [/\btoken\s*=\s*[^\s,;]+/gi, 'token=[REDACTED]'],
    [/\bapi[_\s-]?key\s*:\s*[^\s,;]+/gi, 'api key: [REDACTED]']
];
function redactSensitiveText(value) {
    return SENSITIVE_REPLACEMENTS.reduce((sanitized, [pattern, replacement]) => {
        return sanitized.replace(pattern, replacement);
    }, value);
}
function getErrorMessage(error) {
    if (error instanceof Error) {
        return redactSensitiveText(error.message);
    }
    return redactSensitiveText(String(error));
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REVIEW_RESULT_JSON_SCHEMA = void 0;
exports.cleanJsonResponse = cleanJsonResponse;
exports.parseReviewJson = parseReviewJson;
exports.REVIEW_RESULT_JSON_SCHEMA = {
    type: 'object',
    additionalProperties: false,
    properties: {
        summary: { type: 'string' },
        findings: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: true,
                properties: {
                    file: { type: 'string' },
                    code_snippet: { type: 'string' },
                    line_hint: { type: 'number' },
                    severity: {
                        type: 'string',
                        enum: ['low', 'medium', 'high']
                    },
                    confidence: { type: 'number' },
                    category: { type: 'string' },
                    message: { type: 'string' },
                    suggestion: { type: 'string' }
                },
                required: ['file', 'severity', 'confidence', 'message']
            }
        },
        test_suggestions: {
            type: 'array',
            items: { type: 'string' }
        },
        truncation_notes: {
            type: 'array',
            items: { type: 'string' }
        }
    },
    required: ['summary', 'findings']
};
function cleanJsonResponse(text) {
    const trimmed = text.trim();
    const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (fencedMatch) {
        return fencedMatch[1].trim();
    }
    return trimmed;
}
function parseReviewJson(text) {
    const cleanedText = cleanJsonResponse(text);
    try {
        const parsed = JSON.parse(cleanedText);
        if (!isPlainObject(parsed)) {
            return createMalformedReviewResult(text, 'Model returned non-object JSON review output.');
        }
        return normalizeReviewResult(parsed);
    }
    catch {
        return createMalformedReviewResult(text);
    }
}
function normalizeReviewResult(value) {
    const summary = asNonEmptyString(value.summary) ?? 'AI review completed without a structured summary.';
    const findings = normalizeFindings(value.findings);
    const testSuggestions = normalizeStringArray(value.test_suggestions);
    const truncationNotes = normalizeStringArray(value.truncation_notes);
    return {
        summary,
        findings,
        ...(testSuggestions.length > 0 ? { test_suggestions: testSuggestions } : {}),
        ...(truncationNotes.length > 0 ? { truncation_notes: truncationNotes } : {})
    };
}
function normalizeFindings(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    const findings = [];
    for (const item of value) {
        if (!isPlainObject(item)) {
            continue;
        }
        const file = asNonEmptyString(item.file);
        const message = asNonEmptyString(item.message);
        if (!file || !message) {
            continue;
        }
        const finding = {
            file,
            severity: normalizeSeverity(item.severity),
            confidence: normalizeConfidence(item.confidence),
            message
        };
        const codeSnippet = asNonEmptyString(item.code_snippet);
        const category = asNonEmptyString(item.category);
        const suggestion = asNonEmptyString(item.suggestion);
        const lineHint = normalizeOptionalLineHint(item.line_hint);
        if (codeSnippet) {
            finding.code_snippet = codeSnippet;
        }
        if (category) {
            finding.category = category;
        }
        if (suggestion) {
            finding.suggestion = suggestion;
        }
        if (lineHint !== undefined) {
            finding.line_hint = lineHint;
        }
        findings.push(finding);
    }
    return findings;
}
function normalizeSeverity(value) {
    if (value === 'low' || value === 'medium' || value === 'high') {
        return value;
    }
    return 'medium';
}
function normalizeConfidence(value) {
    if (typeof value !== 'number' || Number.isNaN(value) || !Number.isFinite(value)) {
        return 0;
    }
    if (value < 0) {
        return 0;
    }
    if (value > 1) {
        return 1;
    }
    return value;
}
function normalizeOptionalLineHint(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return undefined;
    }
    return Math.max(1, Math.floor(value));
}
function normalizeStringArray(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((item) => asNonEmptyString(item))
        .filter((item) => item !== undefined);
}
function createMalformedReviewResult(rawText, fallbackSummary) {
    return {
        summary: fallbackSummary ?? summarizeRawText(rawText),
        findings: [],
        raw_text: rawText
    };
}
function summarizeRawText(rawText) {
    const firstParagraph = rawText
        .trim()
        .split(/\r?\n\r?\n/)
        .map((part) => part.trim())
        .find((part) => part.length > 0);
    if (!firstParagraph) {
        return 'Unable to parse structured AI review output.';
    }
    if (firstParagraph.length <= 280) {
        return firstParagraph;
    }
    return `${firstParagraph.slice(0, 277)}...`;
}
function asNonEmptyString(value) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

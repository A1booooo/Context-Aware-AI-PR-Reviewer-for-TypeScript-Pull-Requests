"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseStructuredReview = parseStructuredReview;
const schema_1 = require("./schema");
function parseStructuredReview(rawOutput) {
    const normalizedOutput = stripCodeFences(rawOutput);
    let parsedValue;
    try {
        parsedValue = JSON.parse(normalizedOutput);
    }
    catch {
        return createParseErrorResult('parse_error', 'Failed to parse structured review JSON.');
    }
    if (!isPlainObject(parsedValue)) {
        return createParseErrorResult('invalid_structure', 'Structured review output must be a JSON object.');
    }
    const payload = parsedValue;
    const summaryFindings = parseSummaryFindings(payload.summary_findings);
    const { inlineFindings, downgradedSummaryFindings } = parseInlineFindings(payload.inline_findings);
    return {
        ok: true,
        summaryFindings: [...summaryFindings, ...downgradedSummaryFindings],
        inlineFindings
    };
}
function stripCodeFences(rawOutput) {
    const trimmedOutput = rawOutput.trim();
    const fencedMatch = trimmedOutput.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
    if (!fencedMatch) {
        return trimmedOutput;
    }
    return fencedMatch[1].trim();
}
function parseSummaryFindings(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value.flatMap((item) => {
        const finding = parseSummaryFinding(item);
        return finding ? [finding] : [];
    });
}
function parseInlineFindings(value) {
    if (!Array.isArray(value)) {
        return {
            inlineFindings: [],
            downgradedSummaryFindings: []
        };
    }
    const inlineFindings = [];
    const downgradedSummaryFindings = [];
    for (const item of value) {
        const summaryDraft = parseSummaryFindingDraft(item);
        if (!summaryDraft) {
            continue;
        }
        if (!isPlainObject(item)) {
            continue;
        }
        const file = item.file;
        const codeSnippet = item.code_snippet;
        if ((0, schema_1.isNonEmptyString)(file) && (0, schema_1.isNonEmptyString)(codeSnippet)) {
            inlineFindings.push({
                ...summaryDraft,
                file,
                codeSnippet
            });
            continue;
        }
        downgradedSummaryFindings.push(toSummaryFinding(summaryDraft));
    }
    return {
        inlineFindings,
        downgradedSummaryFindings
    };
}
function parseSummaryFinding(value) {
    const findingDraft = parseSummaryFindingDraft(value);
    if (!findingDraft) {
        return null;
    }
    return toSummaryFinding(findingDraft);
}
function parseSummaryFindingDraft(value) {
    if (!isPlainObject(value)) {
        return null;
    }
    const severity = value.severity;
    const confidence = value.confidence;
    if (!(0, schema_1.isReviewSeverity)(severity) || !(0, schema_1.isConfidenceScore)(confidence)) {
        return null;
    }
    const title = pickCoreSummaryText(value);
    if (!title) {
        return null;
    }
    const description = (0, schema_1.isNonEmptyString)(value.description) ? value.description.trim() : undefined;
    return {
        title,
        severity,
        confidence,
        description
    };
}
function pickCoreSummaryText(value) {
    const candidates = [value.title, value.message, value.description];
    for (const candidate of candidates) {
        if ((0, schema_1.isNonEmptyString)(candidate)) {
            return candidate.trim();
        }
    }
    return null;
}
function toSummaryFinding(findingDraft) {
    if (findingDraft.description === undefined) {
        return {
            title: findingDraft.title,
            severity: findingDraft.severity,
            confidence: findingDraft.confidence
        };
    }
    return {
        title: findingDraft.title,
        severity: findingDraft.severity,
        confidence: findingDraft.confidence,
        description: findingDraft.description
    };
}
function createParseErrorResult(code, message) {
    return {
        ok: false,
        error: {
            code,
            message
        },
        summaryFindings: [],
        inlineFindings: []
    };
}
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

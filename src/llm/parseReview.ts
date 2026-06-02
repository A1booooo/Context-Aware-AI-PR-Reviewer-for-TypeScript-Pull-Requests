import type {
  CandidateInlineFinding,
  StructuredReviewParseError,
  StructuredReviewParseResult,
  SummaryFinding
} from './schema';
import {
  isConfidenceScore,
  isNonEmptyString,
  isReviewSeverity
} from './schema';

interface StructuredReviewPayload {
  summary_findings?: unknown;
  inline_findings?: unknown;
}

interface SummaryFindingDraft {
  title: string;
  severity: SummaryFinding['severity'];
  confidence: number;
  description?: string;
}

export function parseStructuredReview(rawOutput: string): StructuredReviewParseResult {
  const normalizedOutput = stripCodeFences(rawOutput);

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(normalizedOutput);
  } catch {
    return createParseErrorResult('parse_error', 'Failed to parse structured review JSON.');
  }

  if (!isPlainObject(parsedValue)) {
    return createParseErrorResult(
      'invalid_structure',
      'Structured review output must be a JSON object.'
    );
  }

  const payload = parsedValue as StructuredReviewPayload;
  const summaryFindings = parseSummaryFindings(payload.summary_findings);
  const { inlineFindings, downgradedSummaryFindings } = parseInlineFindings(
    payload.inline_findings
  );

  return {
    ok: true,
    summaryFindings: [...summaryFindings, ...downgradedSummaryFindings],
    inlineFindings
  };
}

function stripCodeFences(rawOutput: string): string {
  const trimmedOutput = rawOutput.trim();
  const fencedMatch = trimmedOutput.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

  if (!fencedMatch) {
    return trimmedOutput;
  }

  return fencedMatch[1].trim();
}

function parseSummaryFindings(value: unknown): SummaryFinding[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    const finding = parseSummaryFinding(item);
    return finding ? [finding] : [];
  });
}

function parseInlineFindings(value: unknown): {
  inlineFindings: CandidateInlineFinding[];
  downgradedSummaryFindings: SummaryFinding[];
} {
  if (!Array.isArray(value)) {
    return {
      inlineFindings: [],
      downgradedSummaryFindings: []
    };
  }

  const inlineFindings: CandidateInlineFinding[] = [];
  const downgradedSummaryFindings: SummaryFinding[] = [];

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

    if (isNonEmptyString(file) && isNonEmptyString(codeSnippet)) {
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

function parseSummaryFinding(value: unknown): SummaryFinding | null {
  const findingDraft = parseSummaryFindingDraft(value);

  if (!findingDraft) {
    return null;
  }

  return toSummaryFinding(findingDraft);
}

function parseSummaryFindingDraft(value: unknown): SummaryFindingDraft | null {
  if (!isPlainObject(value)) {
    return null;
  }

  const severity = value.severity;
  const confidence = value.confidence;

  if (!isReviewSeverity(severity) || !isConfidenceScore(confidence)) {
    return null;
  }

  const title = pickCoreSummaryText(value);

  if (!title) {
    return null;
  }

  const description = isNonEmptyString(value.description) ? value.description.trim() : undefined;

  return {
    title,
    severity,
    confidence,
    description
  };
}

function pickCoreSummaryText(value: Record<string, unknown>): string | null {
  const candidates = [value.title, value.message, value.description];

  for (const candidate of candidates) {
    if (isNonEmptyString(candidate)) {
      return candidate.trim();
    }
  }

  return null;
}

function toSummaryFinding(findingDraft: SummaryFindingDraft): SummaryFinding {
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

function createParseErrorResult(
  code: StructuredReviewParseError['error']['code'],
  message: string
): StructuredReviewParseError {
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export const REVIEW_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;

export type ReviewSeverity = (typeof REVIEW_SEVERITIES)[number];

export interface SummaryFinding {
  title: string;
  severity: ReviewSeverity;
  confidence: number;
  description?: string;
}

export interface CandidateInlineFinding extends SummaryFinding {
  file: string;
  codeSnippet: string;
}

export interface StructuredReviewParseSuccess {
  ok: true;
  summaryFindings: SummaryFinding[];
  inlineFindings: CandidateInlineFinding[];
}

export interface StructuredReviewParseError {
  ok: false;
  error: {
    code: 'parse_error' | 'invalid_structure';
    message: string;
  };
  summaryFindings: SummaryFinding[];
  inlineFindings: CandidateInlineFinding[];
}

export type StructuredReviewParseResult =
  | StructuredReviewParseSuccess
  | StructuredReviewParseError;

export function isReviewSeverity(value: unknown): value is ReviewSeverity {
  return typeof value === 'string' && REVIEW_SEVERITIES.includes(value as ReviewSeverity);
}

export function isConfidenceScore(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

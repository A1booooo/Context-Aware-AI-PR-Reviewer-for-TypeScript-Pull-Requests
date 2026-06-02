export const DEFAULT_REVIEW_FOCUS = [
  'bug-risk',
  'security',
  'test-coverage',
  'maintainability',
  'react-hooks',
  'typescript-types'
] as const;

export const DEFAULT_EXCLUDE_PATTERNS = [
  'dist/**',
  'build/**',
  'coverage/**',
  'node_modules/**',
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  '*.min.js',
  '*.min.css'
] as const;

export const DEFAULT_REVIEWER_CONFIG = {
  language: 'zh-CN',
  max_files: 20,
  max_patch_chars_per_file: 6000,
  include_full_file_context: false,
  exclude: [...DEFAULT_EXCLUDE_PATTERNS],
  review: {
    severity_threshold: 'medium',
    max_inline_comments: 5,
    confidence_threshold: 0.75,
    focus: [...DEFAULT_REVIEW_FOCUS]
  }
} as const;

export type ReviewSeverityThreshold = 'low' | 'medium' | 'high';

export interface ReviewerConfig {
  language: string;
  max_files: number;
  max_patch_chars_per_file: number;
  include_full_file_context: boolean;
  exclude: string[];
  review: {
    severity_threshold: ReviewSeverityThreshold;
    max_inline_comments: number;
    confidence_threshold: number;
    focus: string[];
  };
}

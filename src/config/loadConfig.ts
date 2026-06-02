import fs from 'node:fs';
import path from 'node:path';

import { parse } from 'yaml';

import {
  DEFAULT_REVIEWER_CONFIG,
  type ReviewerConfig,
  type ReviewSeverityThreshold
} from './schema';

const CONFIG_FILE_NAME = '.ai-pr-review.yml';
const REVIEW_SEVERITY_THRESHOLDS: ReviewSeverityThreshold[] = [
  'low',
  'medium',
  'high'
];

interface LoadReviewerConfigOptions {
  cwd?: string;
}

type RawConfig = Record<string, unknown>;

export function loadReviewerConfig(
  options: LoadReviewerConfigOptions = {}
): ReviewerConfig {
  const cwd = options.cwd ?? process.cwd();
  const configPath = path.join(cwd, CONFIG_FILE_NAME);

  if (!fs.existsSync(configPath)) {
    return cloneDefaultReviewerConfig();
  }

  const fileContents = fs.readFileSync(configPath, 'utf8');
  const parsedConfig = parseReviewerConfigYaml(fileContents);
  const validatedConfig = validateReviewerConfig(parsedConfig);

  return mergeReviewerConfigWithDefaults(validatedConfig);
}

function parseReviewerConfigYaml(fileContents: string): unknown {
  try {
    return parse(fileContents);
  } catch {
    throw new Error('Invalid .ai-pr-review.yml: failed to parse YAML.');
  }
}

function validateReviewerConfig(config: unknown): RawConfig {
  if (config === null || config === undefined) {
    return {};
  }

  if (!isPlainObject(config)) {
    throw new Error('Invalid .ai-pr-review.yml: root config must be an object.');
  }

  assertSupportedKeys(config, [
    'language',
    'max_files',
    'max_patch_chars_per_file',
    'include_full_file_context',
    'exclude',
    'review'
  ]);

  if (
    'language' in config &&
    (typeof config.language !== 'string' || config.language.trim().length === 0)
  ) {
    throw new Error(
      'Invalid .ai-pr-review.yml: language must be a non-empty string.'
    );
  }

  if (
    'max_files' in config &&
    !isPositiveInteger(config.max_files)
  ) {
    throw new Error(
      'Invalid .ai-pr-review.yml: max_files must be a positive integer.'
    );
  }

  if (
    'max_patch_chars_per_file' in config &&
    !isPositiveInteger(config.max_patch_chars_per_file)
  ) {
    throw new Error(
      'Invalid .ai-pr-review.yml: max_patch_chars_per_file must be a positive integer.'
    );
  }

  if (
    'include_full_file_context' in config &&
    typeof config.include_full_file_context !== 'boolean'
  ) {
    throw new Error(
      'Invalid .ai-pr-review.yml: include_full_file_context must be a boolean.'
    );
  }

  if ('exclude' in config) {
    assertStringArray(config.exclude, 'exclude');
  }

  if ('review' in config) {
    validateReviewConfig(config.review);
  }

  return config;
}

function validateReviewConfig(reviewConfig: unknown): void {
  if (!isPlainObject(reviewConfig)) {
    throw new Error('Invalid .ai-pr-review.yml: review must be an object.');
  }

  assertSupportedKeys(reviewConfig, [
    'severity_threshold',
    'max_inline_comments',
    'confidence_threshold',
    'focus'
  ], 'review');

  if (
    'severity_threshold' in reviewConfig &&
    !REVIEW_SEVERITY_THRESHOLDS.includes(
      reviewConfig.severity_threshold as ReviewSeverityThreshold
    )
  ) {
    throw new Error(
      'Invalid .ai-pr-review.yml: review.severity_threshold must be one of "low", "medium", or "high".'
    );
  }

  if (
    'max_inline_comments' in reviewConfig &&
    !isNonNegativeInteger(reviewConfig.max_inline_comments)
  ) {
    throw new Error(
      'Invalid .ai-pr-review.yml: review.max_inline_comments must be a non-negative integer.'
    );
  }

  if (
    'confidence_threshold' in reviewConfig &&
    !isConfidenceThreshold(reviewConfig.confidence_threshold)
  ) {
    throw new Error(
      'Invalid .ai-pr-review.yml: review.confidence_threshold must be a number between 0 and 1.'
    );
  }

  if ('focus' in reviewConfig) {
    assertStringArray(reviewConfig.focus, 'review.focus');
  }
}

function mergeReviewerConfigWithDefaults(config: RawConfig): ReviewerConfig {
  const reviewConfig = isPlainObject(config.review) ? config.review : {};

  return {
    language:
      typeof config.language === 'string'
        ? config.language
        : DEFAULT_REVIEWER_CONFIG.language,
    max_files:
      typeof config.max_files === 'number'
        ? config.max_files
        : DEFAULT_REVIEWER_CONFIG.max_files,
    max_patch_chars_per_file:
      typeof config.max_patch_chars_per_file === 'number'
        ? config.max_patch_chars_per_file
        : DEFAULT_REVIEWER_CONFIG.max_patch_chars_per_file,
    include_full_file_context:
      typeof config.include_full_file_context === 'boolean'
        ? config.include_full_file_context
        : DEFAULT_REVIEWER_CONFIG.include_full_file_context,
    exclude: mergeExcludePatterns(config.exclude),
    review: {
      severity_threshold:
        typeof reviewConfig.severity_threshold === 'string'
          ? (reviewConfig.severity_threshold as ReviewSeverityThreshold)
          : DEFAULT_REVIEWER_CONFIG.review.severity_threshold,
      max_inline_comments:
        typeof reviewConfig.max_inline_comments === 'number'
          ? reviewConfig.max_inline_comments
          : DEFAULT_REVIEWER_CONFIG.review.max_inline_comments,
      confidence_threshold:
        typeof reviewConfig.confidence_threshold === 'number'
          ? reviewConfig.confidence_threshold
          : DEFAULT_REVIEWER_CONFIG.review.confidence_threshold,
      focus: Array.isArray(reviewConfig.focus)
        ? [...reviewConfig.focus]
        : [...DEFAULT_REVIEWER_CONFIG.review.focus]
    }
  };
}

function mergeExcludePatterns(excludePatterns: unknown): string[] {
  if (!Array.isArray(excludePatterns)) {
    return [...DEFAULT_REVIEWER_CONFIG.exclude];
  }

  return [...new Set([...DEFAULT_REVIEWER_CONFIG.exclude, ...excludePatterns])];
}

function cloneDefaultReviewerConfig(): ReviewerConfig {
  return {
    language: DEFAULT_REVIEWER_CONFIG.language,
    max_files: DEFAULT_REVIEWER_CONFIG.max_files,
    max_patch_chars_per_file: DEFAULT_REVIEWER_CONFIG.max_patch_chars_per_file,
    include_full_file_context:
      DEFAULT_REVIEWER_CONFIG.include_full_file_context,
    exclude: [...DEFAULT_REVIEWER_CONFIG.exclude],
    review: {
      severity_threshold: DEFAULT_REVIEWER_CONFIG.review.severity_threshold,
      max_inline_comments: DEFAULT_REVIEWER_CONFIG.review.max_inline_comments,
      confidence_threshold:
        DEFAULT_REVIEWER_CONFIG.review.confidence_threshold,
      focus: [...DEFAULT_REVIEWER_CONFIG.review.focus]
    }
  };
}

function assertSupportedKeys(
  value: Record<string, unknown>,
  supportedKeys: string[],
  parentPath?: string
): void {
  for (const key of Object.keys(value)) {
    if (!supportedKeys.includes(key)) {
      const fieldPath = parentPath ? `${parentPath}.${key}` : key;
      throw new Error(
        `Invalid .ai-pr-review.yml: unsupported field "${fieldPath}".`
      );
    }
  }
}

function assertStringArray(value: unknown, fieldPath: string): asserts value is string[] {
  if (
    !Array.isArray(value) ||
    value.some((entry) => typeof entry !== 'string' || entry.trim().length === 0)
  ) {
    throw new Error(
      `Invalid .ai-pr-review.yml: ${fieldPath} must be an array of non-empty strings.`
    );
  }
}

function isConfidenceThreshold(value: unknown): value is number {
  return typeof value === 'number' && value >= 0 && value <= 1;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export { DEFAULT_REVIEWER_CONFIG } from './schema';

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_REVIEWER_CONFIG,
  loadReviewerConfig
} from '../../../src/config/loadConfig';

const tempDirectories: string[] = [];

function createTempRepoDirectory(): string {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'ai-pr-review-config-test-')
  );
  tempDirectories.push(directory);
  return directory;
}

function writeReviewerConfig(directory: string, contents: string): void {
  fs.writeFileSync(path.join(directory, '.ai-pr-review.yml'), contents, 'utf8');
}

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('loadReviewerConfig', () => {
  it('uses safe defaults when the config file is missing', () => {
    const repoDirectory = createTempRepoDirectory();

    const config = loadReviewerConfig({ cwd: repoDirectory });

    expect(config).toEqual(DEFAULT_REVIEWER_CONFIG);
  });

  it('merges valid config values with defaults', () => {
    const repoDirectory = createTempRepoDirectory();

    writeReviewerConfig(
      repoDirectory,
      [
        'language: en-US',
        'max_files: 3',
        'exclude:',
        '  - vendor/**',
        'review:',
        '  severity_threshold: high',
        '  focus:',
        '    - security'
      ].join('\n')
    );

    const config = loadReviewerConfig({ cwd: repoDirectory });

    expect(config.language).toBe('en-US');
    expect(config.max_files).toBe(3);
    expect(config.max_patch_chars_per_file).toBe(
      DEFAULT_REVIEWER_CONFIG.max_patch_chars_per_file
    );
    expect(config.exclude).toEqual([
      ...DEFAULT_REVIEWER_CONFIG.exclude,
      'vendor/**'
    ]);
    expect(config.review).toEqual({
      severity_threshold: 'high',
      max_inline_comments: DEFAULT_REVIEWER_CONFIG.review.max_inline_comments,
      confidence_threshold:
        DEFAULT_REVIEWER_CONFIG.review.confidence_threshold,
      focus: ['security']
    });
  });

  it('fails clearly when the config contains invalid values', () => {
    const repoDirectory = createTempRepoDirectory();

    writeReviewerConfig(
      repoDirectory,
      [
        'max_patch_chars_per_file: nope',
        'review:',
        '  confidence_threshold: 5'
      ].join('\n')
    );

    expect(() => loadReviewerConfig({ cwd: repoDirectory })).toThrow(
      'Invalid .ai-pr-review.yml: max_patch_chars_per_file must be a positive integer.'
    );
  });

  it('fails clearly when the config contains unsupported fields', () => {
    const repoDirectory = createTempRepoDirectory();

    writeReviewerConfig(
      repoDirectory,
      [
        'language: zh-CN',
        'review:',
        '  severity_threshold: medium',
        'extra_field: true'
      ].join('\n')
    );

    expect(() => loadReviewerConfig({ cwd: repoDirectory })).toThrow(
      'Invalid .ai-pr-review.yml: unsupported field "extra_field".'
    );
  });
});

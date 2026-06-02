"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_REVIEWER_CONFIG = exports.DEFAULT_EXCLUDE_PATTERNS = exports.DEFAULT_REVIEW_FOCUS = void 0;
exports.DEFAULT_REVIEW_FOCUS = [
    'bug-risk',
    'security',
    'test-coverage',
    'maintainability',
    'react-hooks',
    'typescript-types'
];
exports.DEFAULT_EXCLUDE_PATTERNS = [
    'dist/**',
    'build/**',
    'coverage/**',
    'node_modules/**',
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    '*.min.js',
    '*.min.css'
];
exports.DEFAULT_REVIEWER_CONFIG = {
    language: 'zh-CN',
    max_files: 20,
    max_patch_chars_per_file: 6000,
    include_full_file_context: false,
    exclude: [...exports.DEFAULT_EXCLUDE_PATTERNS],
    review: {
        severity_threshold: 'medium',
        max_inline_comments: 5,
        confidence_threshold: 0.75,
        focus: [...exports.DEFAULT_REVIEW_FOCUS]
    }
};

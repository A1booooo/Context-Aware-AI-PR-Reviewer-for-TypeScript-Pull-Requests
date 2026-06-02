"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_REVIEWER_CONFIG = void 0;
exports.loadReviewerConfig = loadReviewerConfig;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const yaml_1 = require("yaml");
const schema_1 = require("./schema");
const CONFIG_FILE_NAME = '.ai-pr-review.yml';
const REVIEW_SEVERITY_THRESHOLDS = [
    'low',
    'medium',
    'high'
];
function loadReviewerConfig(options = {}) {
    const cwd = options.cwd ?? process.cwd();
    const configPath = node_path_1.default.join(cwd, CONFIG_FILE_NAME);
    if (!node_fs_1.default.existsSync(configPath)) {
        return cloneDefaultReviewerConfig();
    }
    const fileContents = node_fs_1.default.readFileSync(configPath, 'utf8');
    const parsedConfig = parseReviewerConfigYaml(fileContents);
    const validatedConfig = validateReviewerConfig(parsedConfig);
    return mergeReviewerConfigWithDefaults(validatedConfig);
}
function parseReviewerConfigYaml(fileContents) {
    try {
        return (0, yaml_1.parse)(fileContents);
    }
    catch {
        throw new Error('Invalid .ai-pr-review.yml: failed to parse YAML.');
    }
}
function validateReviewerConfig(config) {
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
    if ('language' in config &&
        (typeof config.language !== 'string' || config.language.trim().length === 0)) {
        throw new Error('Invalid .ai-pr-review.yml: language must be a non-empty string.');
    }
    if ('max_files' in config &&
        !isPositiveInteger(config.max_files)) {
        throw new Error('Invalid .ai-pr-review.yml: max_files must be a positive integer.');
    }
    if ('max_patch_chars_per_file' in config &&
        !isPositiveInteger(config.max_patch_chars_per_file)) {
        throw new Error('Invalid .ai-pr-review.yml: max_patch_chars_per_file must be a positive integer.');
    }
    if ('include_full_file_context' in config &&
        typeof config.include_full_file_context !== 'boolean') {
        throw new Error('Invalid .ai-pr-review.yml: include_full_file_context must be a boolean.');
    }
    if ('exclude' in config) {
        assertStringArray(config.exclude, 'exclude');
    }
    if ('review' in config) {
        validateReviewConfig(config.review);
    }
    return config;
}
function validateReviewConfig(reviewConfig) {
    if (!isPlainObject(reviewConfig)) {
        throw new Error('Invalid .ai-pr-review.yml: review must be an object.');
    }
    assertSupportedKeys(reviewConfig, [
        'severity_threshold',
        'max_inline_comments',
        'confidence_threshold',
        'focus'
    ], 'review');
    if ('severity_threshold' in reviewConfig &&
        !REVIEW_SEVERITY_THRESHOLDS.includes(reviewConfig.severity_threshold)) {
        throw new Error('Invalid .ai-pr-review.yml: review.severity_threshold must be one of "low", "medium", or "high".');
    }
    if ('max_inline_comments' in reviewConfig &&
        !isNonNegativeInteger(reviewConfig.max_inline_comments)) {
        throw new Error('Invalid .ai-pr-review.yml: review.max_inline_comments must be a non-negative integer.');
    }
    if ('confidence_threshold' in reviewConfig &&
        !isConfidenceThreshold(reviewConfig.confidence_threshold)) {
        throw new Error('Invalid .ai-pr-review.yml: review.confidence_threshold must be a number between 0 and 1.');
    }
    if ('focus' in reviewConfig) {
        assertStringArray(reviewConfig.focus, 'review.focus');
    }
}
function mergeReviewerConfigWithDefaults(config) {
    const reviewConfig = isPlainObject(config.review) ? config.review : {};
    return {
        language: typeof config.language === 'string'
            ? config.language
            : schema_1.DEFAULT_REVIEWER_CONFIG.language,
        max_files: typeof config.max_files === 'number'
            ? config.max_files
            : schema_1.DEFAULT_REVIEWER_CONFIG.max_files,
        max_patch_chars_per_file: typeof config.max_patch_chars_per_file === 'number'
            ? config.max_patch_chars_per_file
            : schema_1.DEFAULT_REVIEWER_CONFIG.max_patch_chars_per_file,
        include_full_file_context: typeof config.include_full_file_context === 'boolean'
            ? config.include_full_file_context
            : schema_1.DEFAULT_REVIEWER_CONFIG.include_full_file_context,
        exclude: mergeExcludePatterns(config.exclude),
        review: {
            severity_threshold: typeof reviewConfig.severity_threshold === 'string'
                ? reviewConfig.severity_threshold
                : schema_1.DEFAULT_REVIEWER_CONFIG.review.severity_threshold,
            max_inline_comments: typeof reviewConfig.max_inline_comments === 'number'
                ? reviewConfig.max_inline_comments
                : schema_1.DEFAULT_REVIEWER_CONFIG.review.max_inline_comments,
            confidence_threshold: typeof reviewConfig.confidence_threshold === 'number'
                ? reviewConfig.confidence_threshold
                : schema_1.DEFAULT_REVIEWER_CONFIG.review.confidence_threshold,
            focus: Array.isArray(reviewConfig.focus)
                ? [...reviewConfig.focus]
                : [...schema_1.DEFAULT_REVIEWER_CONFIG.review.focus]
        }
    };
}
function mergeExcludePatterns(excludePatterns) {
    if (!Array.isArray(excludePatterns)) {
        return [...schema_1.DEFAULT_REVIEWER_CONFIG.exclude];
    }
    return [...new Set([...schema_1.DEFAULT_REVIEWER_CONFIG.exclude, ...excludePatterns])];
}
function cloneDefaultReviewerConfig() {
    return {
        language: schema_1.DEFAULT_REVIEWER_CONFIG.language,
        max_files: schema_1.DEFAULT_REVIEWER_CONFIG.max_files,
        max_patch_chars_per_file: schema_1.DEFAULT_REVIEWER_CONFIG.max_patch_chars_per_file,
        include_full_file_context: schema_1.DEFAULT_REVIEWER_CONFIG.include_full_file_context,
        exclude: [...schema_1.DEFAULT_REVIEWER_CONFIG.exclude],
        review: {
            severity_threshold: schema_1.DEFAULT_REVIEWER_CONFIG.review.severity_threshold,
            max_inline_comments: schema_1.DEFAULT_REVIEWER_CONFIG.review.max_inline_comments,
            confidence_threshold: schema_1.DEFAULT_REVIEWER_CONFIG.review.confidence_threshold,
            focus: [...schema_1.DEFAULT_REVIEWER_CONFIG.review.focus]
        }
    };
}
function assertSupportedKeys(value, supportedKeys, parentPath) {
    for (const key of Object.keys(value)) {
        if (!supportedKeys.includes(key)) {
            const fieldPath = parentPath ? `${parentPath}.${key}` : key;
            throw new Error(`Invalid .ai-pr-review.yml: unsupported field "${fieldPath}".`);
        }
    }
}
function assertStringArray(value, fieldPath) {
    if (!Array.isArray(value) ||
        value.some((entry) => typeof entry !== 'string' || entry.trim().length === 0)) {
        throw new Error(`Invalid .ai-pr-review.yml: ${fieldPath} must be an array of non-empty strings.`);
    }
}
function isConfidenceThreshold(value) {
    return typeof value === 'number' && value >= 0 && value <= 1;
}
function isNonNegativeInteger(value) {
    return Number.isInteger(value) && value >= 0;
}
function isPositiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
var schema_2 = require("./schema");
Object.defineProperty(exports, "DEFAULT_REVIEWER_CONFIG", { enumerable: true, get: function () { return schema_2.DEFAULT_REVIEWER_CONFIG; } });

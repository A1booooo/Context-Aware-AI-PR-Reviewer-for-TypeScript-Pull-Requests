"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MAX_PATCH_CHARACTERS = exports.DEFAULT_DIFF_FILTER_RULES = exports.DEFAULT_MINIFIED_FILE_SUFFIXES = exports.DEFAULT_LOCK_FILE_NAMES = exports.DEFAULT_GENERATED_FILE_SUFFIXES = exports.DEFAULT_GENERATED_PATH_SEGMENTS = exports.DEFAULT_GENERATED_PATH_PREFIXES = exports.DEFAULT_DOCS_ONLY_PATH_PREFIXES = exports.DEFAULT_DOCS_ONLY_EXTENSIONS = void 0;
exports.filterPullRequestFiles = filterPullRequestFiles;
const truncatePatch_1 = require("./truncatePatch");
Object.defineProperty(exports, "DEFAULT_MAX_PATCH_CHARACTERS", { enumerable: true, get: function () { return truncatePatch_1.DEFAULT_MAX_PATCH_CHARACTERS; } });
exports.DEFAULT_DOCS_ONLY_EXTENSIONS = ['.md', '.mdx', '.txt'];
exports.DEFAULT_DOCS_ONLY_PATH_PREFIXES = ['docs/'];
exports.DEFAULT_GENERATED_PATH_PREFIXES = ['dist/', 'build/', 'coverage/'];
exports.DEFAULT_GENERATED_PATH_SEGMENTS = ['/generated/'];
exports.DEFAULT_GENERATED_FILE_SUFFIXES = [
    '.generated.ts',
    '.generated.tsx',
    '.generated.js',
    '.generated.jsx'
];
exports.DEFAULT_LOCK_FILE_NAMES = [
    'package-lock.json',
    'pnpm-lock.yaml',
    'yarn.lock',
    'bun.lockb'
];
exports.DEFAULT_MINIFIED_FILE_SUFFIXES = [
    '.min.js',
    '.min.css',
    '.min.mjs',
    '.min.cjs'
];
exports.DEFAULT_DIFF_FILTER_RULES = {
    docsOnlyExtensions: exports.DEFAULT_DOCS_ONLY_EXTENSIONS,
    docsOnlyPathPrefixes: exports.DEFAULT_DOCS_ONLY_PATH_PREFIXES,
    generatedPathPrefixes: exports.DEFAULT_GENERATED_PATH_PREFIXES,
    generatedPathSegments: exports.DEFAULT_GENERATED_PATH_SEGMENTS,
    generatedFileSuffixes: exports.DEFAULT_GENERATED_FILE_SUFFIXES,
    lockFileNames: exports.DEFAULT_LOCK_FILE_NAMES,
    minifiedFileSuffixes: exports.DEFAULT_MINIFIED_FILE_SUFFIXES,
    maxPatchCharacters: truncatePatch_1.DEFAULT_MAX_PATCH_CHARACTERS
};
function filterPullRequestFiles(files, options = {}) {
    const includedFiles = [];
    const excludedFiles = [];
    const maxPatchCharacters = options.maxPatchCharacters ?? exports.DEFAULT_DIFF_FILTER_RULES.maxPatchCharacters;
    for (const file of files) {
        const reason = getExclusionReason(file);
        if (reason) {
            excludedFiles.push({
                filename: file.filename,
                reason
            });
            continue;
        }
        if (file.kind !== 'text_patch') {
            continue;
        }
        const truncatedPatch = (0, truncatePatch_1.truncatePatch)(file.patch, {
            maxCharacters: maxPatchCharacters
        });
        includedFiles.push({
            ...file,
            patch: truncatedPatch.patch,
            wasTruncated: truncatedPatch.wasTruncated,
            originalPatchLength: truncatedPatch.originalPatchLength,
            truncatedPatchLength: truncatedPatch.truncatedPatchLength
        });
    }
    return {
        includedFiles,
        excludedFiles
    };
}
function getExclusionReason(file) {
    if (file.kind === 'deleted') {
        return 'deleted';
    }
    if (file.kind === 'missing_patch') {
        return 'missing_patch';
    }
    const normalizedPath = normalizePath(file.filename);
    if (isGeneratedFile(normalizedPath)) {
        return 'generated';
    }
    if (isLockFile(normalizedPath)) {
        return 'lock_file';
    }
    if (isMinifiedFile(normalizedPath)) {
        return 'minified';
    }
    if (isDocsOnlyFile(normalizedPath)) {
        return 'docs_only';
    }
    return null;
}
function normalizePath(filename) {
    return filename.replace(/\\/g, '/').toLowerCase();
}
function isGeneratedFile(normalizedPath) {
    return (exports.DEFAULT_DIFF_FILTER_RULES.generatedPathPrefixes.some((prefix) => normalizedPath.startsWith(prefix)) ||
        exports.DEFAULT_DIFF_FILTER_RULES.generatedPathSegments.some((segment) => normalizedPath.includes(segment)) ||
        exports.DEFAULT_DIFF_FILTER_RULES.generatedFileSuffixes.some((suffix) => normalizedPath.endsWith(suffix)));
}
function isLockFile(normalizedPath) {
    const filename = normalizedPath.split('/').at(-1) ?? normalizedPath;
    return exports.DEFAULT_DIFF_FILTER_RULES.lockFileNames.some((lockFileName) => lockFileName === filename);
}
function isMinifiedFile(normalizedPath) {
    return exports.DEFAULT_DIFF_FILTER_RULES.minifiedFileSuffixes.some((suffix) => normalizedPath.endsWith(suffix));
}
function isDocsOnlyFile(normalizedPath) {
    return (exports.DEFAULT_DIFF_FILTER_RULES.docsOnlyPathPrefixes.some((prefix) => normalizedPath.startsWith(prefix)) ||
        exports.DEFAULT_DIFF_FILTER_RULES.docsOnlyExtensions.some((extension) => normalizedPath.endsWith(extension)));
}

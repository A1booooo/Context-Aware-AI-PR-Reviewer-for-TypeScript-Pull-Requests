"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DETERMINISTIC_SUMMARY_MARKER = void 0;
exports.formatDeterministicSummaryComment = formatDeterministicSummaryComment;
exports.DETERMINISTIC_SUMMARY_MARKER = '<!-- ai-pr-review-assistant -->';
const EXCLUDED_REASON_ORDER = [
    'deleted',
    'missing_patch',
    'generated',
    'lock_file',
    'minified',
    'docs_only'
];
function formatDeterministicSummaryComment(options) {
    const changedFilesCount = options.includedFiles.length + options.excludedFiles.length;
    const excludedReasonSummary = summarizeExcludedReasons(options.excludedFiles);
    const truncatedFiles = options.includedFiles
        .filter((file) => file.wasTruncated)
        .sort((left, right) => left.filename.localeCompare(right.filename));
    const includedFiles = [...options.includedFiles].sort((left, right) => left.filename.localeCompare(right.filename));
    const lines = [
        exports.DETERMINISTIC_SUMMARY_MARKER,
        '## PR Summary',
        'This summary publishes validated AI findings when available. Raw model output is never published.',
        '',
        `PR: #${options.metadata.pullNumber} ${options.metadata.title}`,
        `Changed files count: ${changedFilesCount}`,
        `Included files count: ${options.includedFiles.length}`,
        `Excluded files count: ${options.excludedFiles.length}`,
        '',
        'Included file summary:'
    ];
    if (includedFiles.length === 0) {
        lines.push('- none');
    }
    else {
        for (const file of includedFiles) {
            lines.push(`- ${file.filename}`);
        }
    }
    lines.push('', 'Excluded reason summary:');
    if (excludedReasonSummary.length === 0) {
        lines.push('- none');
    }
    else {
        for (const summaryLine of excludedReasonSummary) {
            lines.push(summaryLine);
        }
    }
    lines.push('', 'Truncated files summary:');
    if (truncatedFiles.length === 0) {
        lines.push('- none');
    }
    else {
        for (const file of truncatedFiles) {
            lines.push(`- ${file.filename} (${file.truncatedPatchLength}/${file.originalPatchLength} chars kept)`);
        }
    }
    lines.push('', 'Context status:');
    if (!options.reviewContext) {
        lines.push('- not built');
    }
    else {
        lines.push(`- full file context mode: ${options.reviewContext.fullFileContext.mode}`);
        lines.push(`- full file context reason: ${options.reviewContext.fullFileContext.reason}`);
        lines.push(`- metadata notes count: ${options.reviewContext.notes.length}`);
    }
    lines.push('', 'AI review status:');
    if (!options.aiReview) {
        lines.push('- not requested');
    }
    else if (options.aiReview.status === 'completed') {
        lines.push('- status: completed');
        lines.push(`- validated summary findings count: ${options.aiReview.findings.length}`);
    }
    else {
        lines.push(`- status: ${options.aiReview.status}`);
        lines.push(`- reason: ${options.aiReview.code}`);
        lines.push(`- details: ${options.aiReview.message}`);
    }
    lines.push('', 'Validated AI findings:');
    if (!options.aiReview || options.aiReview.status !== 'completed') {
        lines.push('- none');
    }
    else if (options.aiReview.findings.length === 0) {
        lines.push('- none');
    }
    else {
        for (const finding of sortSummaryFindings(options.aiReview.findings)) {
            lines.push(`- [${finding.severity}] ${finding.title} (confidence ${finding.confidence.toFixed(2)})`);
            if (finding.description) {
                lines.push(`  ${finding.description}`);
            }
        }
    }
    lines.push('', 'Downgraded inline findings:');
    if (!options.downgradedInlineFindings || options.downgradedInlineFindings.length === 0) {
        lines.push('- none');
    }
    else {
        for (const finding of sortDowngradedInlineFindings(options.downgradedInlineFindings)) {
            lines.push(`- [${finding.severity}] ${finding.file}: ${finding.title} (reason: ${finding.reason}, confidence ${finding.confidence.toFixed(2)})`);
        }
    }
    return lines.join('\n');
}
function summarizeExcludedReasons(excludedFiles) {
    const counts = new Map();
    for (const file of excludedFiles) {
        counts.set(file.reason, (counts.get(file.reason) ?? 0) + 1);
    }
    return EXCLUDED_REASON_ORDER.filter((reason) => counts.has(reason)).map((reason) => `- ${reason}: ${counts.get(reason)}`);
}
function sortSummaryFindings(findings) {
    return [...findings].sort((left, right) => {
        if (left.severity !== right.severity) {
            return compareSeverity(left.severity, right.severity);
        }
        return right.confidence - left.confidence;
    });
}
function compareSeverity(left, right) {
    const severityRank = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3
    };
    return severityRank[left] - severityRank[right];
}
function sortDowngradedInlineFindings(findings) {
    return [...findings].sort((left, right) => {
        if (left.file !== right.file) {
            return left.file.localeCompare(right.file);
        }
        if (left.severity !== right.severity) {
            return compareSeverity(left.severity, right.severity);
        }
        return right.confidence - left.confidence;
    });
}

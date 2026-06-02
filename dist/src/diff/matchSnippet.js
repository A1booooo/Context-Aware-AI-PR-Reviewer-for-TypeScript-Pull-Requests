"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.matchCandidateInlineFindings = matchCandidateInlineFindings;
function matchCandidateInlineFindings(options) {
    const parsedPatches = new Map(options.patches.map((patch) => [normalizePath(patch.filename), parsePatch(patch.patch)]));
    const validatedInlineFindings = [];
    const downgradedFindings = [];
    for (const finding of options.inlineFindings) {
        if (finding.confidence < options.confidenceThreshold) {
            downgradedFindings.push({
                ...finding,
                reason: 'low_confidence'
            });
            continue;
        }
        const normalizedFile = normalizePath(finding.file);
        const parsedPatch = parsedPatches.get(normalizedFile);
        if (!parsedPatch) {
            downgradedFindings.push({
                ...finding,
                reason: 'wrong_file'
            });
            continue;
        }
        const normalizedSnippet = normalizeContent(finding.codeSnippet);
        const matchingAddedLines = parsedPatch.addedLineNumbersByContent.get(normalizedSnippet) ?? [];
        if (matchingAddedLines.length > 0) {
            if (validatedInlineFindings.length >= options.maxInlineComments) {
                downgradedFindings.push({
                    ...finding,
                    reason: 'max_inline_comments'
                });
                continue;
            }
            validatedInlineFindings.push({
                ...finding,
                path: finding.file,
                line: matchingAddedLines[0]
            });
            continue;
        }
        downgradedFindings.push({
            ...finding,
            reason: parsedPatch.nonAddedLineContents.has(normalizedSnippet)
                ? 'non_added_line_match'
                : 'no_match'
        });
    }
    return {
        validatedInlineFindings,
        downgradedFindings
    };
}
function parsePatch(patch) {
    const addedLineNumbersByContent = new Map();
    const nonAddedLineContents = new Set();
    const lines = patch.split('\n');
    let currentNewLineNumber = null;
    for (const line of lines) {
        const hunkStart = parseHunkStart(line);
        if (hunkStart !== null) {
            currentNewLineNumber = hunkStart;
            continue;
        }
        if (currentNewLineNumber === null || line === '\\ No newline at end of file') {
            continue;
        }
        if (line.startsWith('+++') || line.startsWith('---')) {
            continue;
        }
        if (line.startsWith('+')) {
            const content = normalizeContent(line.slice(1));
            pushLineNumber(addedLineNumbersByContent, content, currentNewLineNumber);
            currentNewLineNumber += 1;
            continue;
        }
        if (line.startsWith('-')) {
            nonAddedLineContents.add(normalizeContent(line.slice(1)));
            continue;
        }
        const content = line.startsWith(' ') ? line.slice(1) : line;
        nonAddedLineContents.add(normalizeContent(content));
        currentNewLineNumber += 1;
    }
    return {
        addedLineNumbersByContent,
        nonAddedLineContents
    };
}
function parseHunkStart(line) {
    const match = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (!match) {
        return null;
    }
    return Number.parseInt(match[1], 10);
}
function pushLineNumber(lineNumbersByContent, content, lineNumber) {
    const existingLineNumbers = lineNumbersByContent.get(content);
    if (existingLineNumbers) {
        existingLineNumbers.push(lineNumber);
        return;
    }
    lineNumbersByContent.set(content, [lineNumber]);
}
function normalizePath(path) {
    return path.replace(/\\/g, '/');
}
function normalizeContent(content) {
    return content.trim();
}

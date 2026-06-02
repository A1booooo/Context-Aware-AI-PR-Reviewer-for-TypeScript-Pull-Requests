"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.REVIEW_SEVERITIES = void 0;
exports.isReviewSeverity = isReviewSeverity;
exports.isConfidenceScore = isConfidenceScore;
exports.isNonEmptyString = isNonEmptyString;
exports.REVIEW_SEVERITIES = ['low', 'medium', 'high', 'critical'];
function isReviewSeverity(value) {
    return typeof value === 'string' && exports.REVIEW_SEVERITIES.includes(value);
}
function isConfidenceScore(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
}
function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim().length > 0;
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDeterministicSummaryWorkflow = runDeterministicSummaryWorkflow;
exports.run = run;
const logger_1 = require("./utils/logger");
const errors_1 = require("./utils/errors");
const comments_1 = require("./github/comments");
const buildReviewContext_1 = require("./context/buildReviewContext");
const filterFiles_1 = require("./diff/filterFiles");
const publishSummary_1 = require("./review/publishSummary");
const client_1 = require("./llm/client");
const parseReview_1 = require("./llm/parseReview");
const loadConfig_1 = require("./config/loadConfig");
async function defaultStartup() {
    return Promise.resolve();
}
async function runDeterministicSummaryWorkflow(options) {
    const logger = options.logger ?? (0, logger_1.createLogger)();
    const filteredFiles = (0, filterFiles_1.filterPullRequestFiles)(options.pullRequestContext.files, {
        excludePatterns: options.config.exclude,
        maxPatchCharacters: options.config.max_patch_chars_per_file,
        maxIncludedFiles: options.config.max_files
    });
    const reviewContext = await (0, buildReviewContext_1.buildReviewContext)({
        metadata: options.pullRequestContext.metadata,
        includedFiles: filteredFiles.includedFiles,
        excludedFiles: filteredFiles.excludedFiles,
        config: options.config
    });
    const aiReview = await buildSummaryAiReview({
        llmClient: options.llmClient,
        reviewContext
    });
    const result = await (0, publishSummary_1.publishDeterministicSummary)({
        metadata: options.pullRequestContext.metadata,
        includedFiles: filteredFiles.includedFiles,
        excludedFiles: filteredFiles.excludedFiles,
        reviewContext: reviewContext.metadata,
        aiReview,
        client: options.commentsClient
    });
    logger.info(`Summary review comment ${result.action} for PR #${options.pullRequestContext.metadata.pullNumber}.`);
    return result;
}
async function run(options = {}) {
    const logger = options.logger ?? (0, logger_1.createLogger)();
    const startup = options.startup ?? defaultStartup;
    const createCommentsClient = options.createCommentsClient ?? comments_1.createGitHubCommentsClientFromEnvironment;
    const createLlmClient = options.createLlmClient ?? client_1.createOpenAiReviewClientFromEnvironment;
    const getReviewerConfig = options.loadConfig ?? loadConfig_1.loadReviewerConfig;
    logger.info('Action starting.');
    try {
        const config = getReviewerConfig();
        const pullRequestContext = await startup();
        if (pullRequestContext) {
            const commentsClient = createCommentsClient();
            if (commentsClient) {
                await runDeterministicSummaryWorkflow({
                    logger,
                    pullRequestContext,
                    commentsClient,
                    llmClient: createLlmClient(),
                    config
                });
            }
            else {
                logger.info('Skipping deterministic summary publish because GITHUB_TOKEN is not configured.');
            }
        }
        logger.info('Action finished successfully.');
    }
    catch (error) {
        logger.error(`Action failed: ${(0, errors_1.getErrorMessage)(error)}`);
        throw error;
    }
}
if (require.main === module) {
    run().catch(() => {
        process.exitCode = 1;
    });
}
async function buildSummaryAiReview(options) {
    const llmResult = await options.llmClient.requestStructuredReview({
        reviewContext: options.reviewContext
    });
    if (llmResult.status === 'success') {
        return parseSummaryAiReview(llmResult);
    }
    if (llmResult.status === 'skipped') {
        return {
            status: 'skipped',
            code: llmResult.code,
            message: llmResult.message
        };
    }
    return {
        status: 'degraded',
        code: llmResult.code,
        message: llmResult.message
    };
}
function parseSummaryAiReview(llmResult) {
    const parsedReview = (0, parseReview_1.parseStructuredReview)(llmResult.outputText);
    if (!parsedReview.ok) {
        return {
            status: 'degraded',
            code: parsedReview.error.code,
            message: 'AI review degraded because the provider returned malformed structured JSON. Raw model output was discarded.'
        };
    }
    return {
        status: 'completed',
        findings: parsedReview.summaryFindings
    };
}

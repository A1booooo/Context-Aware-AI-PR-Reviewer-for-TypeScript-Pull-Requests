"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.run = run;
const logger_1 = require("./utils/logger");
const errors_1 = require("./utils/errors");
async function defaultStartup() {
    return Promise.resolve();
}
async function run(options = {}) {
    const logger = options.logger ?? (0, logger_1.createLogger)();
    const startup = options.startup ?? defaultStartup;
    logger.info('Action starting.');
    try {
        await startup();
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

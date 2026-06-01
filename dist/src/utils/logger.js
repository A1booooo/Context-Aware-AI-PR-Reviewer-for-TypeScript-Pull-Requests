"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogger = createLogger;
const errors_1 = require("./errors");
function createLogger() {
    return {
        info(message) {
            console.log((0, errors_1.redactSensitiveText)(message));
        },
        error(message) {
            console.error((0, errors_1.redactSensitiveText)(message));
        }
    };
}

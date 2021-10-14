"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCardFormatFromRequest = void 0;
const interfaces_1 = require("@cardstack/core/src/interfaces");
const DEFAULT_FORMAT = 'isolated';
function getCardFormatFromRequest(formatQueryParam) {
    if (!formatQueryParam) {
        return DEFAULT_FORMAT;
    }
    let format;
    if (Array.isArray(formatQueryParam)) {
        format = formatQueryParam[0];
    }
    else {
        format = formatQueryParam;
    }
    if (format) {
        if (interfaces_1.isFormat(format)) {
            return format;
        }
        else {
            throw new Error(`${format} is not a valid format`);
        }
    }
    else {
        return DEFAULT_FORMAT;
    }
}
exports.getCardFormatFromRequest = getCardFormatFromRequest;
//# sourceMappingURL=routes.js.map
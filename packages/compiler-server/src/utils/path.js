"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureTrailingSlash = void 0;
function ensureTrailingSlash(p) {
    return p.replace(/\/$/, '') + '/';
}
exports.ensureTrailingSlash = ensureTrailingSlash;
//# sourceMappingURL=path.js.map
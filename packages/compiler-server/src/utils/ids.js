"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nanoid = void 0;
const nanoid_1 = require("nanoid");
// Use the default nanoid alphabet, but remove dashes, as that's our deliminator
exports.nanoid = nanoid_1.customAlphabet(nanoid_1.urlAlphabet.replace('-', ''), 15);
//# sourceMappingURL=ids.js.map
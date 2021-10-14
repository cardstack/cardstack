"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BASE_CARD_REALM_CONFIG = void 0;
const path_1 = require("path");
const fs_realm_1 = __importDefault(require("../../src/realms/fs-realm"));
exports.BASE_CARD_REALM_CONFIG = {
    url: 'https://cardstack.com/base',
    directory: path_1.join(__dirname, '..', '..', '..', 'base-cards'),
    class: fs_realm_1.default,
};
//# sourceMappingURL=fixtures.js.map
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorMiddleware = exports.Conflict = exports.BadRequest = exports.NotFound = void 0;
const jsonapi_serializer_1 = require("jsonapi-serializer");
class NotFound extends Error {
    constructor() {
        super(...arguments);
        this.status = 404;
    }
}
exports.NotFound = NotFound;
class BadRequest extends Error {
    constructor() {
        super(...arguments);
        this.status = 400;
    }
}
exports.BadRequest = BadRequest;
class Conflict extends Error {
    constructor() {
        super(...arguments);
        this.status = 409;
    }
}
exports.Conflict = Conflict;
async function errorMiddleware(ctx, next) {
    var _a, _b;
    try {
        await next();
    }
    catch (err) {
        let status = (_a = err.status) !== null && _a !== void 0 ? _a : '500';
        let title = (_b = err.message) !== null && _b !== void 0 ? _b : 'An unexpected exception occured';
        ctx.status = parseInt(status);
        ctx.body = new jsonapi_serializer_1.Error({
            status,
            title,
        });
        // console.error(err);
    }
}
exports.errorMiddleware = errorMiddleware;
//# sourceMappingURL=errors.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Server = void 0;
const koa_1 = __importDefault(require("koa"));
const cors_1 = __importDefault(require("@koa/cors"));
const koa_bodyparser_1 = __importDefault(require("koa-bodyparser"));
const watcher_1 = require("./watcher");
const errors_1 = require("./middleware/errors");
const card_building_1 = require("./context/card-building");
const card_routes_1 = require("./routes/card-routes");
class Server {
    constructor(app, options) {
        this.app = app;
        this.options = options;
    }
    static async create(options) {
        let { realms, cardCacheDir, routeCard } = options;
        // NOTE: PR defining how to do types on Koa context and application:
        // https://github.com/DefinitelyTyped/DefinitelyTyped/pull/31704
        let app = new koa_1.default()
            .use(errors_1.errorMiddleware)
            .use(koa_bodyparser_1.default())
            // .use(logger())
            .use(cors_1.default({ origin: '*' }));
        card_building_1.setupCardBuilding(app, { realms, cardCacheDir });
        let router = await card_routes_1.cardRoutes(app.context, routeCard);
        app.use(router.routes());
        app.use(router.allowedMethods());
        return new this(app, options);
    }
    async primeCache() {
        let { options: { cardCacheDir, realms }, app: { context: { builder }, }, } = this;
        watcher_1.cleanCache(cardCacheDir);
        await watcher_1.primeCache(realms, builder);
    }
    async startWatching() {
        let { options: { realms }, app: { context: { builder }, }, } = this;
        this.watchers = watcher_1.setupWatchers(realms, builder);
    }
    stopWatching() {
        if (this.watchers) {
            for (let watcher of this.watchers) {
                watcher.close();
            }
        }
    }
}
exports.Server = Server;
//# sourceMappingURL=server.js.map
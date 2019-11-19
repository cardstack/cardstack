#!/usr/bin/env node
"use strict";
/* eslint-disable no-process-exit */
/* eslint-disable node/shebang */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = __importDefault(require("@cardstack/logger"));
const main_1 = require("../main");
const log = logger_1.default('cardstack/server');
if (process.env.EMBER_ENV === 'test') {
    logger_1.default.configure({
        defaultLevel: 'warn'
    });
}
else {
    logger_1.default.configure({
        defaultLevel: 'warn',
        logLevels: [['cardstack/*', 'info']]
    });
}
function startupConfig() {
    let config = {
        port: 3000
    };
    if (process.env.PORT) {
        config.port = parseInt(process.env.PORT, 10);
    }
    return config;
}
process.on('warning', (warning) => {
    if (warning.stack) {
        process.stderr.write(warning.stack);
    }
});
if (process.connected === false) {
    // This happens if we were started by another node process with IPC
    // and that parent has already died by the time we got here.
    //
    // (If we weren't started under IPC, `process.connected` is
    // undefined, so this never happens.)
    log.info(`Shutting down because connected parent process has already exited.`);
    process.exit(0);
}
process.on('disconnect', () => {
    log.info(`Hub shutting down because connected parent process exited.`);
    process.exit(0);
});
async function runServer(config) {
    let app = await main_1.makeServer();
    app.listen(config.port);
    log.info("server listening on %s", config.port);
    if (process.connected) {
        process.send('hub hello');
    }
}
runServer(startupConfig()).catch((err) => {
    log.error("Server failed to start cleanly: %s", err.stack || err);
    process.exit(-1);
});
//# sourceMappingURL=cardstack-hub.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const server_1 = require("./server");
const path_1 = require("path");
const realm_manager_1 = __importDefault(require("./realm-manager"));
const yargs_1 = __importDefault(require("yargs/yargs"));
const helpers_1 = require("yargs/helpers");
const cardCacheDir = path_1.join(__dirname, '..', '..', 'compiled');
const realms = new realm_manager_1.default([
    {
        url: 'https://cardstack.com/base/',
        directory: path_1.join(__dirname, '..', '..', 'base-cards'),
    },
    {
        url: 'https://demo.com/',
        directory: path_1.join(__dirname, '..', '..', 'demo-cards'),
    },
]);
async function serve(args) {
    let server = await server_1.Server.create({
        realms,
        cardCacheDir,
        routeCard: args.routeCard,
    });
    await server.primeCache();
    await server.startWatching();
    server.app.listen(args.port);
}
async function prime() {
    let server = await server_1.Server.create({
        realms,
        cardCacheDir,
    });
    await server.primeCache();
}
yargs_1.default(helpers_1.hideBin(process.argv))
    .command('serve', 'start the server', (yargs) => {
    return yargs
        .option('port', {
        alias: 'p',
        type: 'number',
        description: 'Port to bind on',
        default: 3000,
    })
        .option('routeCard', {
        type: 'string',
        description: 'URL for servers route card',
        default: 'https://demo.com/routes',
    });
}, serve)
    .command('prime', 'prime the server cache', prime)
    .demandCommand()
    .help().argv;
//# sourceMappingURL=index.js.map
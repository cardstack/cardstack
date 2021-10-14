import Koa from 'koa';
import { ServerOptions } from './interfaces';
export declare class Server {
    app: Koa;
    private options;
    static create(options: ServerOptions): Promise<Server>;
    private watchers;
    private constructor();
    primeCache(): Promise<void>;
    startWatching(): Promise<void>;
    stopWatching(): void;
}

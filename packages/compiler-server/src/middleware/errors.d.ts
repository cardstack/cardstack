export declare class NotFound extends Error {
    status: number;
}
export declare class BadRequest extends Error {
    status: number;
}
export declare class Conflict extends Error {
    status: number;
}
export declare function errorMiddleware(ctx: any, next: any): Promise<void>;

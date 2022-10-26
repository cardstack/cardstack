/// <reference types="ember__component" />
type PostionalArgs = [string, number, number] | [string, number] | [string];
declare function truncateMiddle([input, startLength, endLength]: PostionalArgs): string;
declare const _default: import("@ember/component/helper").FunctionBasedHelper<{
    Args: {
        Positional: PostionalArgs;
        Named: import("@ember/component/helper").EmptyObject;
    };
    Return: string;
}>;
export { _default as default, truncateMiddle };

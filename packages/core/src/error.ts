export function printCompilerError(err: unknown) {
  // TODO: this is where we should implement handling for known & expected error
  // types so that they don't include stack traces, while still showing full
  // stack traces for truly unexpected errors
  return String(err);
}

class CompilerError extends Error {
  isCompilerError = true;
}
export class InvalidKeysError extends CompilerError {}

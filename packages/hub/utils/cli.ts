export function errorCatcher(error: unknown) {
  console.error('\n🚨 Hub command failed with error:\n');
  console.error(error);
  // eslint-disable-next-line no-process-exit
  process.exit(1);
}

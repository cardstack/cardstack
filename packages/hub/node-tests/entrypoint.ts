import '@cardstack/test-support/prepare-node-tests';

function importAll(r: Record<string, Function>) {
  r.keys().forEach(r);
}
importAll((require as any).context('.', true, /-test\.ts$/));

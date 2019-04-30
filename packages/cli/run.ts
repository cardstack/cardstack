import { createHash } from "crypto";
import { join } from "path";
import { tmpdir } from "os";
import hashForDep from "hash-for-dep";
import UI from 'console-ui';

interface Options {
  dir: string;
  ui: UI;
}

function workDir(cardDir: string): string {
  let hash = createHash("md5");
  hash.update(cardDir + "\0" + hashForDep(__dirname));
  return join(tmpdir(), "cardstack", hash.digest("hex").slice(0, 6));
}

export default async function run({ dir, ui }: Options) {
  ui.writeInfoLine(`running the card in ${dir}`);
  ui.writeInfoLine(`using temp dir ${workDir(dir)}`);
}

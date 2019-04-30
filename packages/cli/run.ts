import { createHash } from "crypto";
import { join, dirname } from "path";
import { tmpdir } from "os";
import hashForDep from "hash-for-dep";
import UI from 'console-ui';
import { execFileSync } from "child_process";
import { ensureDirSync } from "fs-extra";

const appName = "cardstack-standard-app";

interface Options {
  dir: string;
  ui: UI;
}

function getWorkDir(cardDir: string): string {
  let hash = createHash("md5");
  hash.update(cardDir + "\0" + (process.env.CARDSTACK_DEV_NOCACHE ? 'nocache' : hashForDep(__dirname)));
  return join(tmpdir(), "cardstack", hash.digest("hex").slice(0, 6));
}

export default async function run({ dir, ui }: Options) {
  let workDir = getWorkDir(dir);
  ensureDirSync(workDir);
  ui.writeInfoLine(`running the card in ${dir}`);
  ui.writeInfoLine(`using temp dir ${workDir}`);
  generateEmberApp(workDir);
  installDependencies(join(workDir, appName));
}

function generateEmberApp(workDir: string) {
  let ember = require.resolve('ember-cli/bin/ember');
  let blueprint = dirname(require.resolve('@ember/octane-app-blueprint/package.json'));
  execFileSync(ember, ["new", appName, "--blueprint", blueprint, "--skip-npm", "--skip-git"], { cwd: workDir });
}

function installDependencies(appDir: string) {
  let yarn = require.resolve('yarn/bin/yarn');
  execFileSync(yarn, [
    "add",
    "--dev",
    "@cardstack/hub",
    "@cardstack/jsonapi",
    "@cardstack/ephemeral"
  ], { cwd: appDir });
}

import { createHash } from "crypto";
import { join, dirname } from "path";
import { tmpdir } from "os";
import hashForDep from "hash-for-dep";
import UI from "console-ui";
import { execFileSync } from "child_process";
import {
  ensureDirSync,
  pathExistsSync,
  writeFileSync,
  mkdirpSync,
} from "fs-extra";

const appName = "cardstack-standard-app";

const ephemeralConfig = `
module.exports = [
  {
    type: 'data-sources',
    id: 'default',
    attributes: {
      'source-type': '@cardstack/ephemeral'
    }
  },
  {
    type: 'plugin-configs',
    id: '@cardstack/hub',
    relationships: {
      'default-data-source': {
        data: { type: 'data-sources', id: 'default' }
      }
    }
  }
];
`;

const routerJS = `
import EmberRouter from "@ember/routing/router";
import config from "./config/environment";
import { cardstackRoutes } from '@cardstack/routing';

const Router = EmberRouter.extend({
  location: config.locationType,
  rootURL: config.rootURL
});

Router.map(cardstackRoutes);

export default Router;
`;

interface Options {
  dir: string;
  ui: UI;
}

function getWorkDir(cardDir: string): string {
  let hash = createHash("md5");
  hash.update(
    cardDir +
      "\0" +
      (process.env.CARDSTACK_DEV ? "nocache" : hashForDep(__dirname))
  );
  return join(tmpdir(), "cardstack", hash.digest("hex").slice(0, 6));
}

export default async function run({ dir, ui }: Options) {
  let workDir = getWorkDir(dir);
  ensureDirSync(workDir);
  ui.writeInfoLine(`running the card in ${dir}`);
  ui.writeInfoLine(`using temp dir ${workDir}`);
  let appDir = join(workDir, appName);
  if (!pathExistsSync(appDir)) {
    generateEmberApp(workDir);
    installDependencies(appDir);
    enhanceApp(appDir);
  }
}

function generateEmberApp(workDir: string) {
  let ember = require.resolve("ember-cli/bin/ember");
  let blueprint = dirname(
    require.resolve("@ember/octane-app-blueprint/package.json")
  );
  execFileSync(
    ember,
    ["new", appName, "--blueprint", blueprint, "--skip-npm", "--skip-git"],
    { cwd: workDir }
  );
}

const cardstackDeps = [
  "hub",
  "jsonapi",
  "ephemeral",
];

function installDependencies(appDir: string) {
  let yarn = require.resolve("yarn/bin/yarn");
  if (process.env.CARDSTACK_DEV) {
    for (let pkgName of cardstackDeps) {
      execFileSync(yarn, ["link"], { cwd: join(__dirname, '..', pkgName) });
    }
    execFileSync(yarn, ["link", ...cardstackDeps.map(d => `@cardstack/${d}`)], { cwd: appDir });
  }
  execFileSync(yarn, ["add", "--dev", ...cardstackDeps.map(d => `@cardstack/${d}`)], { cwd: appDir });
}

function enhanceApp(appDir: string) {
  mkdirpSync(join(appDir, "cardstack", "data-sources"));
  writeFileSync(
    join(appDir, "cardstack", "data-sources", "ephemeral.js"),
    ephemeralConfig
  );
  writeFileSync(join(appDir, "app", "router.js"), routerJS);
}

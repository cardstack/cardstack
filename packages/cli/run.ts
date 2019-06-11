import { createHash } from "crypto";
import { join, dirname } from "path";
import { tmpdir } from "os";
import hashForDep from "hash-for-dep";
import UI from "console-ui";
import { Memoize } from "typescript-memoize";
import { spawnSync, SpawnSyncOptions } from "child_process";
import {
  ensureDirSync,
  pathExistsSync,
  writeFileSync,
  mkdirpSync,
  removeSync,
  readFileSync,
} from "fs-extra";
import { rewriteEmberCLIBuild } from "./rewriters";

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

const optionalFeatures = `
{
  "application-template-wrapper": false,
  "jquery-integration": true,
  "template-only-glimmer-components": true
}
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

const cardstackDeps = ["hub", "jsonapi", "ephemeral"];
const otherDeps = [
  "@embroider/core",
  "@embroider/compat",
  "@embroider/webpack",
  "@ember/jquery"
];

interface Options {
  dir: string;
  ui: UI;
}

export default async function run(options: Options) {
  let runner = new Runner(options);
  return runner.run();
}

class Runner {
  private cardDir: string;
  private ui: UI;

  constructor({ dir, ui }: Options) {
    this.cardDir = dir;
    this.ui = ui;
    ensureDirSync(this.workDir);
    ui.writeInfoLine(`running the card in ${this.cardDir}`);
    ui.writeInfoLine(`using temp dir ${this.workDir}`);
  }

  @Memoize()
  private get workDir(): string {
    let hash = createHash("md5");
    hash.update(
      this.cardDir +
        "\0" +
        (process.env.CARDSTACK_DEV ? "nocache" : hashForDep(__dirname))
    );
    return join(tmpdir(), "cardstack", hash.digest("hex").slice(0, 6));
  }

  @Memoize()
  private get appDir(): string {
    return join(this.workDir, appName);
  }

  async run() {
    this.ensureAppReady();
  }

  private ensureAppReady() {
    let readyMarker = join(this.appDir, ".cardstack-ready");
    if (!pathExistsSync(readyMarker)) {
      removeSync(this.appDir);
      this.generateEmberApp();
      this.installDependencies();
      this.enhanceApp();
      writeFileSync(readyMarker, "");
    }
  }

  private generateEmberApp() {
    let ember = require.resolve("ember-cli/bin/ember");
    let blueprint = dirname(
      require.resolve("@ember/octane-app-blueprint/package.json")
    );
    this.exec(
      ember,
      [
        "new",
        appName,
        "--blueprint",
        blueprint,
        "--skip-npm",
        "--skip-git",
        "--welcome",
        "false",
      ],
      { cwd: this.workDir }
    );
  }

  private installDependencies() {
    let yarn = require.resolve("yarn/bin/yarn");
    if (process.env.CARDSTACK_DEV) {
      for (let pkgName of cardstackDeps) {
        this.exec(yarn, ["link"], { cwd: join(__dirname, "..", pkgName) });
      }
      this.exec(yarn, ["link", ...cardstackDeps.map(d => `@cardstack/${d}`)], {
        cwd: this.appDir,
      });
    }
    this.exec(
      yarn,
      [
        "add",
        "--dev",
        ...cardstackDeps.map(d => `@cardstack/${d}`),
        ...otherDeps,
      ],
      {
        cwd: this.appDir,
      }
    );
  }

  private enhanceApp() {
    mkdirpSync(join(this.appDir, "cardstack", "data-sources"));
    writeFileSync(
      join(this.appDir, "cardstack", "data-sources", "ephemeral.js"),
      ephemeralConfig
    );
    writeFileSync(join(this.appDir, "app", "router.js"), routerJS);

    // workaround for https://github.com/ember-cli/ember-octane-blueprint/issues/100
    writeFileSync(
      join(this.appDir, "app", "templates", "application.hbs"),
      "{{outlet}}"
    );

    let buildFilePath = join(this.appDir, "ember-cli-build.js");
    writeFileSync(buildFilePath, rewriteEmberCLIBuild(readFileSync(buildFilePath, 'utf8')));

    mkdirpSync(join(this.appDir, "config"));
    let optionalConfigPath = join(this.appDir, "config", "optional-features.json");
    writeFileSync(optionalConfigPath, optionalFeatures);
  }

  private exec(command: string, args: string[], options: SpawnSyncOptions) {
    let child = spawnSync(command, args, options);
    if (child.status !== 0) {
      this.ui.write(child.stdout.toString("utf8"), "INFO");
      this.ui.write(child.stderr.toString("utf8"), "ERROR");
      throw new Error(`${command} failed`);
    }
  }
}

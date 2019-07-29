import { createHash } from "crypto";
import { join, dirname } from "path";
import { tmpdir } from "os";
import hashForDep from "hash-for-dep";
import UI from "console-ui";
import { Memoize } from "typescript-memoize";
import {
  ensureDirSync,
  pathExistsSync,
  writeFileSync,
  mkdirpSync,
  removeSync,
  readFileSync,
  copySync
} from "fs-extra";
import { rewriteEmberCLIBuild } from "./rewriters";
import exec from "./utils/exec";

const appName = "@cardstack/cardhost";

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

export default async function preBuild(options: Options) {
  let builder = new PreBuilder(options);
  return builder.preBuild();
}

class PreBuilder {
  private destDir: string;
  private ui: UI;

  constructor({ dir, ui }: Options) {
    this.destDir = dir;
    this.ui = ui;
    ensureDirSync(this.workDir);
    ui.writeInfoLine(`using temp dir ${this.workDir}`);
    ui.writeInfoLine(`destination is ${this.destDir}/blueprints`);
  }

  @Memoize()
  private get workDir(): string {
    let hash = createHash("md5");
    hash.update(
      this.destDir +
        "\0" +
        (process.env.CARDSTACK_DEV ? "nocache" : hashForDep(__dirname))
    );
    return join(tmpdir(), "cardstack", hash.digest("hex").slice(0, 6));
  }

  @Memoize()
  private get appDir(): string {
    return join(this.workDir, appName);
  }

  private exclude(filepath: string) {
    if (filepath.includes("node_modules")) {
      return false;
    } else if (filepath.includes(".cardstack-ready")) {
      return false;
    } else {
      return true;
    }
  }

  private copyToBlueprint() {
    let blueprintsDir = join(this.destDir, "blueprints");
    ensureDirSync(blueprintsDir);
    copySync(this.appDir, blueprintsDir, { filter: this.exclude });
    this.ui.writeInfoLine(
      `Blueprints are now ready for review in ${this.destDir}/blueprints`
    );
  }

  async preBuild() {
    this.createFiles();
  }

  // generate all app files in a tmp directory, and copy them into the cwd/blueprints on success
  private createFiles() {
    let readyMarker = join(this.appDir, ".cardstack-ready");
    if (!pathExistsSync(readyMarker)) {
      removeSync(this.appDir);
      this.generateEmberApp();
      this.installDependencies();
      this.enhanceApp();
      writeFileSync(readyMarker, "");
      this.copyToBlueprint();
    }
  }

  private generateEmberApp() {
    let ember = require.resolve("ember-cli/bin/ember");
    let blueprint = dirname(
      require.resolve("@ember/octane-app-blueprint/package.json")
    );
    exec(
      ember,
      [
        "new",
        appName,
        "--blueprint",
        blueprint,
        "--skip-npm",
        "--skip-git",
        "--welcome",
        "false"
      ],
      { cwd: this.workDir },
      this.ui
    );
  }

  private installDependencies() {
    let yarn = require.resolve("yarn/bin/yarn");
    exec(
      yarn,
      [
        "add",
        "--dev",
        ...cardstackDeps.map(d => `@cardstack/${d}`),
        ...otherDeps
      ],
      {
        cwd: this.appDir
      },
      this.ui
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
      "{{#cardstack-edges}}{{outlet}}{{/cardstack-edges}}"
    );

    let buildFilePath = join(this.appDir, "ember-cli-build.js");
    writeFileSync(
      buildFilePath,
      rewriteEmberCLIBuild(readFileSync(buildFilePath, "utf8"))
    );

    mkdirpSync(join(this.appDir, "config"));
    let optionalConfigPath = join(
      this.appDir,
      "config",
      "optional-features.json"
    );
    writeFileSync(optionalConfigPath, optionalFeatures);
  }
}

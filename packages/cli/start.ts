import { join, dirname } from "path";
import UI from "console-ui";
import { Memoize } from "typescript-memoize";
import {
  ensureDirSync,
  pathExistsSync,
  writeFileSync,
  removeSync,
  copySync
} from "fs-extra";
import exec from "./utils/exec";

const appName = "cardhost";

const cardstackDeps = ["hub", "jsonapi", "ephemeral"];

interface Options {
  "hub-dir": string;
  ui: UI;
}

export default async function run(options: Options) {
  let runner = new Runner(options);
  return runner.run();
}

class Runner {
  private runningDir: string;
  private ui: UI;

  constructor({ "hub-dir": hubDir, ui }: Options) {
    this.runningDir = hubDir;
    this.ui = ui;
    ensureDirSync(this.runningDir);
  }

  @Memoize()
  private get appDir(): string {
    return join(this.runningDir, appName);
  }

  async run() {
    this.ensureAppReady();
  }

  // if no app exists yet, copy it from blueprints into temp, and yarn install
  private ensureAppReady() {
    let readyMarker = join(this.appDir, ".cardstack-ready");
    if (!pathExistsSync(readyMarker)) {
      removeSync(this.appDir);
      this.applyBlueprints();
      this.installDependencies();
      writeFileSync(readyMarker, "");
    }
  }

  private applyBlueprints() {
    let blueprints = dirname(require.resolve('@cardstack/cardhost/package.json'));
    copySync(blueprints, this.appDir);
  }

  private installDependencies() {
    let yarn = require.resolve("yarn/bin/yarn");
    // when CARDSTACK_DEV is true, yarn link the Card SDK locally instead of using the published packages
    if (process.env.CARDSTACK_DEV) {
      for (let pkgName of cardstackDeps) {
        exec(yarn, ["link"], { cwd: join(__dirname, "..", pkgName) }, this.ui);
      }
      exec(
        yarn,
        ["link", ...cardstackDeps.map(d => `@cardstack/${d}`)],
        {
          cwd: this.appDir
        },
        this.ui
      );
    }
    exec(
      yarn,
      ["install"],
      {
        cwd: this.appDir
      },
      this.ui
    );
  }
}

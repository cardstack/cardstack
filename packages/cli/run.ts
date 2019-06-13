import { createHash } from "crypto";
import { join } from "path";
import { tmpdir } from "os";
import hashForDep from "hash-for-dep";
import UI from "console-ui";
import { Memoize } from "typescript-memoize";
import {
  ensureDirSync,
  pathExistsSync,
  writeFileSync,
  removeSync,
  copySync,
} from "fs-extra";
import exec from "./utils/exec";

const appName = "cardstack-standard-app";

const cardstackDeps = ["hub", "jsonapi", "ephemeral"];

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
    let blueprints = join(__dirname, "blueprints");
    copySync(blueprints, this.appDir);
  }

  private installDependencies() {
    let yarn = require.resolve("yarn/bin/yarn");
    // when CARDSTACK_DEV is true, yarn link the Card SDK locally instead of using the published packages
    if (process.env.CARDSTACK_DEV) {
      for (let pkgName of cardstackDeps) {
        exec(yarn, ["link"], { cwd: join(__dirname, "..", pkgName) }, this.ui);
      }
      exec(yarn, ["link", ...cardstackDeps.map(d => `@cardstack/${d}`)], {
        cwd: this.appDir,
      },
      this.ui);
    }
    exec(
      yarn,
      [
        "install",
      ],
      {
        cwd: this.appDir,
      },
      this.ui
    );
  }
}

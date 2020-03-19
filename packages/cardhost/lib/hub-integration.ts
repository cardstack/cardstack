/* eslint-env node */

// Untyped dependencies
// @ts-ignore
import mergeTrees from 'broccoli-merge-trees';
// @ts-ignore
import Funnel from 'broccoli-funnel';

import { WatchedDir } from 'broccoli-source';
import Plugin from 'broccoli-plugin';
import { homedir } from 'os';
import { ensureDirSync, removeSync } from 'fs-extra';
import symlinkOrCopy from 'symlink-or-copy';
import { spawn } from 'child_process';
import { join } from 'path';
import { InputNode } from 'broccoli-node-api';

function prepareHub(): Promise<void> {
  let resolveHubReady: () => void;
  let rejectHubReady: (err: any) => void;
  let hubReady: Promise<void> = new Promise((r, e) => {
    resolveHubReady = r;
    rejectHubReady = e;
  });

  if (process.env.HUB_URL) {
    resolveHubReady!();
  } else {
    process.env.HUB_URL = 'http://localhost:3000';
    console.log('Starting Cardstack Hub...'); // eslint-disable-line no-console
    if (process.env.EMBER_ENV === 'test') {
      process.env.PGDATABASE = `test_db_${Math.floor(100000 * Math.random())}`;
      console.log(`  creating hub DB ${process.env.PGDATABASE}`); // eslint-disable-line no-console
    }
    let bin = require.resolve('@cardstack/hub/bin/cardstack-hub.js');
    let child = spawn(process.execPath, [bin], { stdio: [0, 1, 2, 'ipc'] });

    child.on('message', msg => {
      if (typeof msg === 'object' && msg != null && msg.hubStartupComplete) {
        resolveHubReady();
      }
    });
    child.on('exit', () => {
      rejectHubReady('hub exited before it was ready');
    });
  }

  if (!process.env.HUB_BROWSER_MODULE_DIR) {
    process.env.HUB_BROWSER_MODULE_DIR = join(homedir(), '.cardstack', 'card-files-cache', 'browser-entrypoints');
  }

  // needed because the hub might still be starting up, but broccoli will throw before we can block.
  ensureDirSync(process.env.HUB_BROWSER_MODULE_DIR);

  return hubReady;
}

export function appTree(): InputNode {
  let hubReady = prepareHub();
  return mergeTrees([
    'app',
    new Funnel(new BlockUntilReady(hubReady, new WatchedDir(process.env.HUB_BROWSER_MODULE_DIR!)), {
      destDir: 'browser-entrypoints',
    }),
  ]);
}

class BlockUntilReady extends Plugin {
  private firstBuild = true;
  constructor(private readyPromise: Promise<void>, inputTree: InputNode) {
    super([inputTree], { annotation: 'BlockUntilReady' });
  }

  async build() {
    await this.readyPromise;
    if (this.firstBuild) {
      removeSync(this.outputPath);
      symlinkOrCopy.sync(this.inputPaths[0], this.outputPath);
      this.firstBuild = false;
    }
  }
}

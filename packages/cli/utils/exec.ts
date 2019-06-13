import { spawnSync, SpawnSyncOptions } from "child_process";
import UI from "console-ui";

export default function(command: string, args: string[], options: SpawnSyncOptions, ui: UI) {
  let child = spawnSync(command, args, options);
  if (child.status !== 0) {
    ui.write(child.stdout.toString("utf8"), "INFO");
    ui.write(child.stderr.toString("utf8"), "ERROR");
    throw new Error(`${command} failed`);
  }
}
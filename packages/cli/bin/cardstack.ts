#!/usr/bin/env node

// This rule is confused by us being TypeScript (the package.json file points at
// our JS output, so we are not technically a "binary" in package.json).
/* eslint-disable node/shebang */

import yargs from "yargs";
import UI from "console-ui";
import { homedir } from "os";
import { join } from "path";
const ui = new UI();

yargs
  .scriptName("cardstack")
  .command(
    "start",
    "Start your local Cardstack Hub",
    args => {
      return args.option("hub-dir", {
        alias: "d",
        describe: "path to your local running cardstack hub",
        type: "string",
        default: join(homedir(), ".cardstack"),
      });
    },
    async function(argv) {
      let run = await import("../start");
      await run.default(Object.assign({ ui }, argv));
    }
  )
  .command(
    "pre-build",
    "Generate new blueprints",
    args => {
      return args.option("dir", {
        alias: "d",
        describe: "destination directory for the blueprints",
        type: "string",
        default: process.cwd()
      });
    },
    async function(argv) {
      let preBuild = await import("../pre-build");
      await preBuild.default(Object.assign({ ui }, argv));
    }
  )

  .command('new <card-name>', 'Create a card', (args) => {
    return args.positional('card-name', {
      describe: 'the name for the new Card',
      type: 'string',
      demandOption: true,
      normalize: true
    });
  }, async function (argv) {
    let newCard = await import('../new-card');
    await newCard.default(Object.assign({ ui }, argv));
  })
  .command('load', 'Load a card into your Cardstack Hub', (args) => {
    return args.option('card-dir', {
      alias: "c",
      describe: 'The path to the card you want to load',
      type: 'string',
      normalize: true,
      default: process.cwd(),
    }).option("hub-dir", {
      alias: "d",
      describe: "The location of your running hub",
      type: "string",
      default: join(homedir(), ".cardstack"),
    });
  }, async function (argv) {
    let load = await import('../load');
    return load.default(Object.assign({ ui }, argv));
  })
  .demandCommand(1, 'Use any of the commands below.\n')
  .strict()
  .fail((msg, err) => {
    if (msg) {
      ui.write(msg + "\n", "ERROR");
    }
    if (err) {
      ui.writeError(err);
    } else {
      yargs.showHelp();
    }
    process.exit(-1);
  }).argv;

#!/usr/bin/env node

// This rule is confused by us being TypeScript (the package.json file points at
// our JS output, so we are not technically a "binary" in package.json).
/* eslint-disable node/shebang */

import yargs from "yargs";
import UI from "console-ui";
const ui = new UI();

yargs
  .scriptName("cardstack")
  .command(
    "start",
    "Start the Cardstack environment",
    args => {
      return args.option("dir", {
        alias: "d",
        describe: "path to your .cardstack local data storage directory",
        type: "string",
        default: process.cwd()
      });
    },
    async function(argv) {
      let run = await import("../run");
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
  .command('play <card-name>', 'Choose a card to render', (args) => {
    return args.positional('card-name', {
      describe: 'the name of an existing card',
      type: 'string',
      demandOption: true,
      normalize: true
    });
  }, async function () {
    ui.write('coming soon!');
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

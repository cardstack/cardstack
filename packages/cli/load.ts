import UI from "console-ui";
import { pathExistsSync, writeFileSync, readFileSync, ensureSymlinkSync } from "fs-extra";
import { join, resolve, dirname } from "path";
import { sync as resolveSync } from 'resolve';

interface Options {
  "hub-dir": string;
  "card-dir": string;
  ui: UI;
}

interface CardPkg {
  name: string;
  peerDependencies?: {
    [name: string]: string;
  };
}

const resolvableExtensions = ['js'];

export default async function loadCard({ ui, "hub-dir": hubDir, "card-dir": cardDir }: Options) {
  // we want an absolute path to the card so that imports are handled correctly
  cardDir = resolve(cardDir);

  let cardPkg: CardPkg = await import(join(cardDir, 'package.json'));
  await linkPeerDeps(ui, hubDir, cardDir, cardPkg);
  await createEntrypoints(ui, hubDir, cardDir, cardPkg);
}

async function createEntrypoints(ui: UI, hubDir: string, cardDir: string, cardPkg: CardPkg) {
  for (let format of ['isolated', 'embedded']) {
    let componentFile;
    for (let extension of resolvableExtensions) {
      let candidateFile = join(cardDir, `${format}.${extension}`);
      if (pathExistsSync(candidateFile)) {
        componentFile = candidateFile;
        break;
      }
    }

    let templateFile;
    let candidateFile = join(cardDir, `${format}.hbs`);
    if (pathExistsSync(candidateFile)) {
      templateFile = candidateFile;
    }

    if (componentFile || templateFile) {
      let entrypoint = join(hubDir, 'app', 'components', 'cards', `${cardPkg.name}-${format}.js`);
      let sourceLines = [];
      if (componentFile) {
        sourceLines.push(`export { default as component } from "${componentFile}";`);
      } else {
        sourceLines.push(`export const component = undefined;`);
      }
      if (templateFile) {
        sourceLines.push(`export { default as template } from "${templateFile}";`);
      } else {
        sourceLines.push(`export const template = undefined;`);
      }
      ui.writeLine(`emitting entrypoint ${entrypoint}`);
      writeFileSync(entrypoint, sourceLines.join("\n"), 'utf8');
    }
  }
}

async function linkPeerDeps(ui: UI, hubDir: string, cardDir: string, cardPkg: CardPkg) {
  let filename = join(hubDir, '.embroider-app-path');
  let appPath;
  try {
    appPath = readFileSync(filename, 'utf8');
  } catch(err) {
    if (err.code !== 'ENOENT') {
      throw err;
    }
    ui.writeLine(`Your cardstack hub does not appear to be running (couldn't read ${filename})`, 'ERROR');
    process.exit(-1);
  }
  if (!cardPkg.peerDependencies) {
    return;
  }
  for (let pkgName of Object.keys(cardPkg.peerDependencies)) {
    try {
      let target = resolveSync(`${pkgName}/package.json`, { basedir: appPath });
      ensureSymlinkSync(dirname(target), join(cardDir, 'node_modules', pkgName), 'dir');
    } catch (err) {
      if (err.code !== 'MODULE_NOT_FOUND') {
        throw err;
      }
      ui.writeLine(`The card ${cardPkg.name} has a peerDependency on ${pkgName}, which is not available in the Hub`, 'ERROR');
      process.exit(-1);
    }
  }
}

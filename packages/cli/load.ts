import UI from "console-ui";
import { pathExistsSync, writeFileSync } from "fs-extra";
import { join, resolve } from "path";

interface Options {
  "hub-dir": string;
  "card-dir": string;
  ui: UI;
}

const resolvableExtensions = ['js'];

export default async function loadCard({ ui, "hub-dir": hubDir, "card-dir": cardDir }: Options) {
  // we want an absolute path to the card so that imports are handled correctly
  cardDir = resolve(cardDir);
  let cardPkg = await import(join(cardDir, 'package.json'));
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

// import { CompiledCard, RawCard } from './../../core/src/interfaces';
import type { loader } from 'webpack';
import { getOptions } from 'loader-utils';
// import { RawCard } from '@cardstack/core/src/interfaces';
import walkSync from 'walk-sync';
// import { basename } from 'path';
// import Builder from './builder';

interface LoaderOptions {
  realm: string;
}

const IGNORE_FILES = ['raw.json', 'compiled', 'card.json'];

export default async function cardLoader(
  this: loader.LoaderContext,
  cardJson: any
): Promise<string> {
  let { realm } = getOptions(this) as LoaderOptions;
  // let builder = new Builder({ realm });
  // console.log(builder);

  this.fs.realpathSync = function (path: any) {
    return path;
  };

  let base = this.context;
  let filePaths = walkSync(base, {
    directories: false,
    ignore: IGNORE_FILES,
    fs: this.fs,
  });
  let files: { [key: string]: string } = {};

  for (const p in filePaths) {
    let fullPath = base + '/' + filePaths[p];
    let content = this.fs.readFileSync(fullPath, 'utf8');
    files[filePaths[p]] = content.toString('utf8');
    this.dependency(fullPath);
  }

  // TODO: Get config based loader working with options passed in correctly working
  console.log({ realm, base });
  console.log(cardJson);

  // let cardDir = await opendir(base);
  // for await (const dirent of cardDir) {
  //   files[dirent.name] = await readFile(join(base, dirent.name), 'utf-8');
  // }
  let rawCard = {
    url: `${realm}/${base}`,
    files,
  };
  return JSON.stringify(rawCard);
}

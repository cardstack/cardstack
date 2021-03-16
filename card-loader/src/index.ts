import type { loader } from "webpack";
import { getOptions, stringifyRequest } from "loader-utils";
import { RawCard } from "@cardstack/core/src/interfaces";
import { opendir, readFile } from "fs/promises";
import { basename, join } from "path";

export default async function cardLoader(
  this: loader.LoaderContext,
  cardJson: any
): Promise<string> {
  let base = this.context;
  let files = {};
  // TODO: Get config based loader working with options passed in correctly working
  // let options = getOptions(this);
  let realm = "https://cardstack.com/base/models";
  let name = basename(base);

  let cardDir = await opendir(base);
  for await (const dirent of cardDir) {
    files[dirent.name] = await readFile(join(base, dirent.name), "utf-8");
  }

  return JSON.stringify({
    url: `${realm}/${name}`,
    files,
  });
}

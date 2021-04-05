import walkSync from "walk-sync";
import {
  Builder as BuilderInterface,
  RawCard,
  CompiledCard,
  assertValidRawCard,
} from "@cardstack/core/src/interfaces";
import { RealmConfig } from "./interfaces";
import { Compiler } from "@cardstack/core/src/compiler";
import fs from "fs";
import { join } from "path";
import { NotFound } from "./error";

export default class Builder implements BuilderInterface {
  private compiler = new Compiler({
    lookup: (url) => this.getCompiledCard(url),
    define: (...args) => this.defineModule(...args),
  });

  // private cache: Map<string, CompiledCard>;
  private realms: RealmConfig[];

  constructor(params: { realms: RealmConfig[] }) {
    this.realms = params.realms;
  }

  private async defineModule(moduleURL: string, source: string): Promise<void> {
    console.log(moduleURL);

    // source = dynamicCardTransform(moduleURL, source);
    // eval(source);
  }

  private locateURL(url: string): string {
    for (let realm of this.realms) {
      if (url.startsWith(realm.url)) {
        return join(realm.directory, url.replace(realm.url, ""));
      }
    }
    throw new NotFound(`${url} is not in a realm we know about`);
  }

  async getRawCard(url: string): Promise<RawCard> {
    let dir = this.locateURL(url);
    let files: any = {};
    for (let file of walkSync(dir, {
      directories: false,
    })) {
      let fullPath = join(dir, file);
      files[file] = fs.readFileSync(fullPath, "utf8");
    }
    let cardJSON = files["card.json"];
    if (!cardJSON) {
      throw new Error(`${url} is missing card.json`);
    }
    delete files["card.json"];
    let card = JSON.parse(cardJSON);
    Object.assign(card, { files, url });
    assertValidRawCard(card);
    return card;
  }
  async getCompiledCard(url: string): Promise<CompiledCard> {
    // TODO: Check the compiled cards
    // let compiledCard = this.cache.get(url);

    // // Typescript didn't seem to trust this.cache.has(...) as a sufficient null guarentee
    // if (compiledCard) {
    //   return compiledCard;
    // }

    let rawCard = await this.getRawCard(url);
    let compiledCard = await this.compiler.compile(rawCard);
    // this.cache.set(url, compiledCard);

    return compiledCard;
  }
}

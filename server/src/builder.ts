import walkSync from "walk-sync";
import type {
  Builder as BuilderInterface,
  RawCard,
  CompiledCard,
} from "@cardstack/core/src/interfaces";
import { RealmsConfig } from "./interfaces";
import { Compiler } from "@cardstack/core/src/compiler";
import fs from "fs";

export default class Builder implements BuilderInterface {
  private compiler = new Compiler({
    lookup: (url) => this.getCompiledCard(url),
    define: (...args) => this.defineModule(...args),
  });

  // private cache: Map<string, CompiledCard>;
  private realms: RealmsConfig;

  constructor(params: { realms: RealmsConfig }) {
    // this.cache = new Map();
    this.realms = new Map(Object.entries(params.realms));
  }

  private async defineModule(moduleURL: string, source: string): Promise<void> {
    console.log(moduleURL);

    // source = dynamicCardTransform(moduleURL, source);
    // eval(source);
  }

  buildCardURL(realmName: string, id: string): string | undefined {
    let realm = this.realms.get(realmName);
    if (!realm) {
      return;
    }
    // TODO: We should resolve this
    return `${realm}/node_modules/${id}`;
  }

  async getRawCard(url: string): Promise<RawCard> {
    let filePaths = walkSync(url, {
      directories: false,
    });
    let files: any = {};

    for (const p in filePaths) {
      let fullPath = url + "/" + filePaths[p];
      files[filePaths[p]] = fs.readFileSync(fullPath, "utf8");
    }

    return { url, files };
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

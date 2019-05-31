import { join } from "path";
import { writeFileSync, ensureDirSync } from "fs-extra";
import UI from "console-ui";
import { todo } from "@cardstack/plugin-utils/todo-any";
import blueprint from "./blueprint";

interface Options {
  cardName?: todo; // todo - figure out how to make this required in TS
  ui: UI;
}

class CardGenerator {
  private cardName: string;
  private ui: UI;

  constructor({ cardName, ui }: Options) {
    this.cardName = cardName;
    this.ui = ui;
    ui.writeInfoLine(
      `Creating a Card named ${this.cardName} in the current directory`
    );
  }

  async createFiles() {
    // iterate over blueprint one level deep and create files
    // creates files like some-card-name/components/embedded.hbs
    for (let key in blueprint) {
      blueprint[key].forEach((file) => {
        ensureDirSync(join(this.cardName, key));
        writeFileSync(join(this.cardName, key, file.filename), file.contents);
      });
    }
  }
}

export default async function newCard(options: Options) {
  let generator = new CardGenerator(options);
  return generator.createFiles();
}

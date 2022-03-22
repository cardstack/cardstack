import {
  Saved,
  Unsaved,
  ResourceObject,
  CardModel,
  CardService,
  CardModelArgs,
  CardComponentModule,
} from '@cardstack/core/src/interfaces';
import BaseCardModel, {
  CardModelConstructor,
  CreatedState,
  LoadedState,
} from '@cardstack/core/src/card-model';
import Component from '@glimmer/component';
// @ts-ignore @ember/component doesn't declare setComponentTemplate...yet!
import { setComponentTemplate } from '@ember/component';
import { hbs } from 'ember-cli-htmlbars';
import { registerDestructor } from '@ember/destroyable';
import { tracked as _tracked } from '@glimmer/tracking';

const CardModelForBrowser: CardModelConstructor = class CardModelForBrowser extends BaseCardModel {
  private _componentModule: CardComponentModule | undefined;
  private wrapperComponent: unknown | undefined;

  constructor(
    cards: CardService,
    state: CreatedState | LoadedState,
    args: CardModelArgs
  ) {
    super(cards, state, args);

    registerDestructor(this, this.didRecompute.bind(this));

    let prop = tracked(this, '_schemaInstance', {
      enumerable: true,
      writable: true,
      configurable: true,
    });
    if (prop) {
      Object.defineProperty(this, '_schemaInstance', prop);
    }
  }

  serialize(): ResourceObject<Saved | Unsaved> {
    let response = super.serialize();
    delete response.meta; // no need to serialize the meta on the browser
    return response;
  }

  async editable(): Promise<CardModel> {
    if (this.state.type !== 'loaded') {
      throw new Error(`tried to derive an editable card from an unsaved card`);
    }
    let editable = (await this.cards.loadModel(
      this.state.url,
      'edit'
    )) as CardModelForBrowser;

    await editable.recompute();

    return editable;
  }

  async component(): Promise<unknown> {
    if (!this.wrapperComponent) {
      let innerComponent = (await this.componentModule()).default;
      let self = this;

      await this.recompute();

      this.wrapperComponent = setComponentTemplate(
        hbs`<this.component @model={{this.data}} @set={{this.set}} />`,
        class extends Component {
          component = innerComponent;
          set = self.setters;
          get data() {
            return self.data;
          }
        }
      );
    }
    return this.wrapperComponent;
  }

  protected makeCompleteData(): boolean {
    return false;
  }

  private async componentModule() {
    if (!this._componentModule) {
      this._componentModule = await this.cards.loadModule<CardComponentModule>(
        this.componentModuleRef
      );
    }
    return this._componentModule;
  }
};

export default CardModelForBrowser;

function tracked(
  target: CardModel,
  prop: string,
  desc: PropertyDescriptor
): PropertyDescriptor | void {
  //@ts-ignore the types for glimmer tracked don't seem to be lining
  return _tracked(target, prop, desc);
}

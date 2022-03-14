import {
  Saved,
  Unsaved,
  ResourceObject,
  CardModel,
  CardService,
  CardModelArgs,
  SerializerMap,
  CardComponentModule,
} from '@cardstack/core/src/interfaces';
import BaseCardModel, {
  CreatedState,
  LoadedState,
} from '@cardstack/core/src/card-model';
import Component from '@glimmer/component';
// @ts-ignore @ember/component doesn't declare setComponentTemplate...yet!
import { setComponentTemplate } from '@ember/component';
import { hbs } from 'ember-cli-htmlbars';
import { registerDestructor } from '@ember/destroyable';
import { tracked as _tracked } from '@glimmer/tracking';

export default class CardModelForBrowser
  extends BaseCardModel
  implements CardModel
{
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

  protected async beginRecompute(): Promise<void> {
    // need to load component module since usedFields originates from there
    await this.componentModule();
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

  protected get serializerMap(): SerializerMap {
    if (!this._componentModule) {
      throw new Error(
        `ComponentModule has not yet been loaded for card model ${this.url}`
      );
    }
    return this._componentModule.serializerMap;
  }

  protected get usedFields(): string[] {
    if (!this._componentModule) {
      throw new Error(
        `ComponentModule has not yet been loaded for card model ${this.url}`
      );
    }
    return this._componentModule.usedFields;
  }

  protected get allFields(): string[] {
    if (!this._componentModule) {
      throw new Error(
        `ComponentModule has not yet been loaded for card model ${this.url}`
      );
    }
    // as far as the browser can tell all the fields that the server told it
    // about are all that exist
    return this._componentModule.usedFields;
  }

  private async componentModule() {
    if (!this._componentModule) {
      this._componentModule = await this.cards.loadModule<CardComponentModule>(
        this.componentModuleRef
      );
    }
    return this._componentModule;
  }
}

function tracked(
  target: CardModel,
  prop: string,
  desc: PropertyDescriptor
): PropertyDescriptor | void {
  //@ts-ignore the types for glimmer tracked don't seem to be lining
  return _tracked(target, prop, desc);
}

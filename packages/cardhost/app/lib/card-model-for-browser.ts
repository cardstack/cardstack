import {
  Setter,
  Saved,
  Unsaved,
  ResourceObject,
  CardModel,
  RawCardData,
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
import merge from 'lodash/merge';
import { restartableTask } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import { registerDestructor } from '@ember/destroyable';
import { tracked as _tracked } from '@glimmer/tracking';

export default class CardModelForBrowser
  extends BaseCardModel
  implements CardModel
{
  setters: Setter;
  private wrapperComponent: unknown | undefined;

  constructor(
    cards: CardService,
    state: CreatedState | LoadedState,
    args: CardModelArgs
  ) {
    super(cards, state, args);

    this.setters = this.makeSetter();
    registerDestructor(this, this.rerenderFinished.bind(this));

    let prop = tracked(this, '_schemaInstance', {
      enumerable: true,
      writable: true,
      configurable: true,
    });
    if (prop) {
      Object.defineProperty(this, '_schemaInstance', prop);
    }
  }

  async computeData(schemaInstance?: any): Promise<Record<string, any>> {
    // need to load component module since usedFields originates from there
    await this.componentModule();
    return super.computeData(schemaInstance);
  }

  serialize(): ResourceObject<Saved | Unsaved> {
    let response = super.serialize();

    // no need to serialize the meta on the browser
    delete response.meta;
    return response;
  }

  setData(_data: RawCardData) {
    throw new Error('unimplemented');
  }

  async editable(): Promise<CardModel> {
    if (this.state.type !== 'loaded') {
      throw new Error(`tried to derive an editable card from an unsaved card`);
    }
    let editable = (await this.cards.loadModel(
      this.state.url,
      'edit'
    )) as CardModelForBrowser;

    await editable.computeData();

    return editable;
  }

  async component(): Promise<unknown> {
    if (!this.wrapperComponent) {
      let innerComponent = (await this.componentModule()).default;
      let self = this;

      await this.computeData();

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

  @restartableTask async rerenderData(
    data: Record<string, any>
  ): Promise<void> {
    this.rawData = merge({}, this.rawData, data);
    let newSchemaInstance = await this.createSchemaInstance();
    await this.computeData(newSchemaInstance);
    this._schemaInstance = newSchemaInstance;
  }

  async rerenderFinished() {
    await taskFor(this.rerenderData).last;
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

  protected async componentModule() {
    if (!this._componentModule) {
      this._componentModule = await this.cards.loadModule<CardComponentModule>(
        this.componentModuleRef
      );
    }
    return this._componentModule;
  }

  // TODO move this into the base class so that the hub can share it
  private makeSetter(segments: string[] = []): Setter {
    let s = (value: any) => {
      let innerSegments = segments.slice();
      let lastSegment = innerSegments.pop();
      if (!lastSegment) {
        return;
      }

      let data = this.shapeData('all-fields');
      let cursor: any = data;
      for (let segment of innerSegments) {
        let nextCursor = cursor[segment];
        if (!nextCursor) {
          nextCursor = {};
          cursor[segment] = nextCursor;
        }
        cursor = nextCursor;
      }
      cursor[lastSegment] = value;
      taskFor(this.rerenderData).perform(data);
    };
    (s as any).setters = new Proxy(
      {},
      {
        get: (target: any, prop: string, receiver: unknown) => {
          if (typeof prop === 'string') {
            return this.makeSetter([...segments, prop]);
          } else {
            return Reflect.get(target, prop, receiver);
          }
        },
      }
    );

    return s;
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

import {
  CardModel,
  SerializerMap,
  CardEnv,
  CompiledCard,
  ComponentInfo,
  RawCard,
  Format,
  CardContent,
} from '@cardstack/core/src/interfaces';
import { deserializeAttributes } from '@cardstack/core/src/serializers';
// import { tracked } from '@glimmer/tracking';

export interface NewCardParams {
  realm: string;
  parentCardURL: string;
}

export interface CreatedState {
  type: 'created';
  realm: string;
  parentCardURL: string;
  serializerMap: SerializerMap;
}

interface LoadedState {
  type: 'loaded';
  url: string;
  format: Format;
  serializerMap: SerializerMap;
  rawData: NonNullable<RawCard['data']>;
  schemaModule: CompiledCard['schemaModule']['global'];
  componentModule: ComponentInfo['moduleName']['global'];
  usedFields: ComponentInfo['usedFields'];
  deserialized: boolean;
  original: CardModel | undefined;
}

export default class CardModelForHub implements CardModel {
  setters: undefined;
  private _data: any;
  private state: CreatedState | LoadedState;

  constructor(private cards: CardEnv, state: CreatedState | Omit<LoadedState, 'deserialized' | 'original'>) {
    if (state.type == 'created') {
      this.state = state;
    } else {
      this.state = {
        ...state,
        deserialized: false,
        original: undefined,
      };
    }
  }

  adoptIntoRealm(realm: string): CardModel {
    if (this.state.type !== 'loaded') {
      throw new Error(`tried to adopt from an unsaved card`);
    }
    return new (this.constructor as typeof CardModelForHub)(this.cards, {
      type: 'created',
      realm,
      parentCardURL: this.state.url,
      serializerMap: this.serializerMap,
    });
  }

  get innerComponent(): unknown {
    throw new Error('Hub does not have use of innerComponent');
  }

  get serializerMap(): SerializerMap {
    return this.state.serializerMap;
  }

  get url(): string {
    if (this.state.type === 'created') {
      throw new Error(`bug: card in state ${this.state.type} does not have a url`);
    }
    return this.state.url;
  }

  async editable(): Promise<CardModel> {
    if (this.state.type !== 'loaded') {
      throw new Error(`tried to derive an editable card from an unsaved card`);
    }
    let editable = (await this.cards.load(this.state.url, 'edit')) as CardModelForHub;
    (editable.state as LoadedState).original = this;
    return editable;
  }

  get data(): any {
    switch (this.state.type) {
      case 'loaded':
        if (!this.state.deserialized) {
          this._data = deserializeAttributes(this.state.rawData, this.serializerMap);
          this.state.deserialized = true;
        }
        return this._data;
      case 'created':
        throw new Error('unimplemented');
      default:
        throw assertNever(this.state);
    }
  }

  /**
   * @deprecated temporary scaffolding until card-service's CardContent => CardModel
   * refactor complete. Consumers of CardModel should be refactored to use `data`
   * and other TBD methods instead of this.
   */
  get cardContent(): CardContent {
    if (this.state.type === 'created') {
      throw new Error('Dont use this right now');
    }
    return {
      data: this.state.rawData,
      schemaModule: this.state.schemaModule,
      usedFields: this.state.usedFields,
      componentModule: this.state.componentModule,
      url: this.state.url,
      format: this.state.format,
    };
  }

  private wrapperComponent: unknown | undefined;

  get component(): unknown {
    if (!this.wrapperComponent) {
      this.wrapperComponent = this.cards.prepareComponent(this, this.innerComponent);
    }
    return this.wrapperComponent;
  }

  async save(): Promise<void> {
    throw new Error('unimplemented');
  }
}

function assertNever(value: never) {
  throw new Error(`should never happen ${value}`);
}

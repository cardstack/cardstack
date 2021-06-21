import Service from '@ember/service';
import { tracked } from '@glimmer/tracking';
import config from '../config/environment';
import {
  ColorCustomizationOption,
  PatternCustomizationOption,
} from '../utils/web3-strategies/types';

interface ColorCustomizationResponseObject {
  attributes: {
    'pattern-color': string;
    'text-color': string;
    background: string;
    description?: string;
  };
  id: string;
}

interface PatternCustomizationResponseObject {
  attributes: {
    'pattern-url': string;
    description?: string;
  };
  id: string;
}

// TODO: move this to orbit.js/ember-data
let convertToColorCustomizationOption = (
  o: ColorCustomizationResponseObject
): ColorCustomizationOption => {
  return {
    patternColor: o.attributes['pattern-color'],
    textColor: o.attributes['text-color'],
    headerBackground: o.attributes.background,
    description: o.attributes.description,
    id: o.id,
  };
};

let convertToPatternCustomizationOption = (
  o: PatternCustomizationResponseObject
): PatternCustomizationOption => {
  return {
    patternUrl: o.attributes['pattern-url'],
    description: o.attributes.description,
    id: o.id,
  };
};

export default class CardCustomizationOptions extends Service {
  @tracked loaded = false;
  @tracked patternOptions: PatternCustomizationOption[] | null = null;
  @tracked colorOptions: ColorCustomizationOption[] | null = null;

  constructor(props: any) {
    super(props);
    this.fetchCustomizationOptions();
  }

  async fetchCustomizationOptions() {
    let [_colorOptions, _patternOptions] = await Promise.all([
      fetch(`${config.hubURL}/api/prepaid-card-color-schemes`, {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.api+json',
        },
      })
        .then((v) => v.json())
        .then((v) => v.data.map(convertToColorCustomizationOption)),

      fetch(`${config.hubURL}/api/prepaid-card-patterns`, {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.api+json',
        },
      })
        .then((v) => v.json())
        .then((v) => v.data.map(convertToPatternCustomizationOption)),
    ]);

    this.patternOptions = _patternOptions;
    this.colorOptions = _colorOptions;
    this.loaded = true;
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'card-customization-options': CardCustomizationOptions;
  }
}

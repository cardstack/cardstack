import Service from '@ember/service';
import config from '../config/environment';
import {
  ColorCustomizationOption,
  PatternCustomizationOption,
} from '../utils/web3-strategies/types';
import { task } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';

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
  async fetchCustomizationOptions() {
    return taskFor(this.fetchCustomizationOptionsTask).perform();
  }

  get patternOptions() {
    return this.lastValue?.patternOptions;
  }

  get colorOptions() {
    return this.lastValue?.colorOptions;
  }

  get loaded() {
    return taskFor(this.fetchCustomizationOptionsTask).last?.isSuccessful;
  }

  get lastValue() {
    let v = taskFor(this.fetchCustomizationOptionsTask).last?.value;
    if (v) {
      return v as {
        patternOptions: PatternCustomizationOption[];
        colorOptions: ColorCustomizationOption[];
      };
    } else {
      return null;
    }
  }

  @task *fetchCustomizationOptionsTask(): any {
    let [colorOptions, patternOptions] = yield Promise.all([
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

    return {
      patternOptions,
      colorOptions,
    };
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'card-customization-options': CardCustomizationOptions;
  }
}

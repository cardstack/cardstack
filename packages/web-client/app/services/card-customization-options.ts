import Service from '@ember/service';
import config from '../config/environment';
import { all, task } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import { tracked } from '@glimmer/tracking';

export interface ColorCustomizationOption {
  headerBackground: string;
  textColor: string;
  patternColor: string;
  id: string;
  description?: string;
}

export interface PatternCustomizationOption {
  patternUrl: string | null;
  id: string;
  description?: string;
}

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
  @tracked patternOptions: PatternCustomizationOption[] | null = [];
  @tracked colorOptions: ColorCustomizationOption[] | null = [];

  async ensureCustomizationOptionsLoaded() {
    if (!this.loaded) {
      return taskFor(this.fetchCustomizationOptions).perform();
    }
  }

  @task *fetchPatternOptions(): any {
    let response = yield fetch(`${config.hubURL}/api/prepaid-card-patterns`, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.api+json',
      },
    });
    let _patternOptions = yield response.json();
    return _patternOptions.data.map(convertToPatternCustomizationOption);
  }

  @task *fetchColorOptions(): any {
    let response = yield fetch(
      `${config.hubURL}/api/prepaid-card-color-schemes`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.api+json',
        },
      }
    );
    let _colorOptions = yield response.json();
    return _colorOptions.data.map(convertToColorCustomizationOption);
  }

  groupColors(colorOptions: ColorCustomizationOption[]) {
    let gradientOptions = [];
    let nonGradientOptions = [];
    for (let option of colorOptions as ColorCustomizationOption[]) {
      if (option.headerBackground.includes('linear-gradient')) {
        gradientOptions.push(option);
      } else {
        nonGradientOptions.push(option);
      }
    }
    return [...nonGradientOptions, ...gradientOptions];
  }

  placeBlankPatternFirst(patternOptions: PatternCustomizationOption[]) {
    let blankIndex = patternOptions.findIndex(
      (a: PatternCustomizationOption) => !a.patternUrl
    );
    if (blankIndex !== -1) {
      let blank = patternOptions.splice(blankIndex, 1)[0];
      return [blank, ...patternOptions];
    } else {
      return patternOptions;
    }
  }

  @task({ drop: true })
  *fetchCustomizationOptions(): any {
    try {
      let [_colorOptions, _patternOptions] = yield all([
        taskFor(this.fetchColorOptions).perform(),
        taskFor(this.fetchPatternOptions).perform(),
      ]);

      this.colorOptions = this.groupColors(_colorOptions);
      this.patternOptions = this.placeBlankPatternFirst(_patternOptions);
      this.loaded = true;
    } catch (e) {
      console.error('Failed to fetch prepaid card customization options');
      console.error(e);
      this.patternOptions = [];
      this.colorOptions = [];
      this.loaded = false;
    }
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'card-customization-options': CardCustomizationOptions;
  }
}

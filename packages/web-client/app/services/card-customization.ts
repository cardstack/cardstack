import Service from '@ember/service';
import config from '../config/environment';
import { all, task, TaskGenerator } from 'ember-concurrency';
import { taskFor } from 'ember-concurrency-ts';
import { tracked } from '@glimmer/tracking';
import { inject as service } from '@ember/service';
import HubAuthentication from './hub-authentication';
import { getResolver } from '@cardstack/did-resolver';
import { Resolver } from 'did-resolver';

export type ColorCustomizationOption = {
  background: string;
  textColor: string;
  patternColor: string;
  id: string;
  description?: string;
};

export type PatternCustomizationOption = {
  patternUrl: string | null;
  id: string;
  description?: string;
};

export interface PrepaidCardCustomization {
  did: string;
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
    background: o.attributes.background,
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

interface CreateCustomizationTaskParams {
  issuerName: string;
  colorSchemeId: string;
  patternId: string;
}

export default class CardCustomization extends Service {
  @service declare hubAuthentication: HubAuthentication;
  @tracked loaded = false;
  @tracked patternOptions: PatternCustomizationOption[] | null = [];
  @tracked colorSchemeOptions: ColorCustomizationOption[] | null = [];

  async ensureCustomizationOptionsLoaded() {
    if (!this.loaded) {
      return taskFor(this.fetchCustomizationOptionsTask).perform();
    }
  }

  @task *fetchPatternOptionsTask(): any {
    let response = yield fetch(`${config.hubURL}/api/prepaid-card-patterns`, {
      method: 'GET',
      headers: {
        Accept: 'application/vnd.api+json',
      },
    });
    let _patternOptions = yield response.json();
    return _patternOptions.data.map(convertToPatternCustomizationOption);
  }

  @task *fetchColorSchemeOptionsTask(): any {
    let response = yield fetch(
      `${config.hubURL}/api/prepaid-card-color-schemes`,
      {
        method: 'GET',
        headers: {
          Accept: 'application/vnd.api+json',
        },
      }
    );
    let _colorSchemeOptions = yield response.json();
    return _colorSchemeOptions.data.map(convertToColorCustomizationOption);
  }

  groupColors(colorSchemeOptions: ColorCustomizationOption[]) {
    let gradientOptions = [];
    let nonGradientOptions = [];
    for (let option of colorSchemeOptions as ColorCustomizationOption[]) {
      if (option.background.includes('linear-gradient')) {
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
  *fetchCustomizationOptionsTask(): any {
    try {
      let [_colorSchemeOptions, _patternOptions] = yield all([
        taskFor(this.fetchColorSchemeOptionsTask).perform(),
        taskFor(this.fetchPatternOptionsTask).perform(),
      ]);

      this.colorSchemeOptions = this.groupColors(_colorSchemeOptions);
      this.patternOptions = this.placeBlankPatternFirst(_patternOptions);
      this.loaded = true;
    } catch (e) {
      console.error('Failed to fetch prepaid card customization options');
      console.error(e);
      this.patternOptions = [];
      this.colorSchemeOptions = [];
      this.loaded = false;
    }
  }

  @task *createCustomizationTask(
    params: CreateCustomizationTaskParams
  ): TaskGenerator<PrepaidCardCustomization> {
    let response = yield fetch(
      `${config.hubURL}/api/prepaid-card-customizations`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + this.hubAuthentication.authToken,
          Accept: 'application/vnd.api+json',
          'Content-Type': 'application/vnd.api+json',
        },
        body: JSON.stringify({
          data: {
            type: 'prepaid-card-customizations',
            attributes: {
              'issuer-name': params.issuerName,
            },
            relationships: {
              'color-scheme': {
                data: {
                  type: 'prepaid-card-color-schemes',
                  id: params.colorSchemeId,
                },
              },
              pattern: {
                data: {
                  type: 'prepaid-card-patterns',
                  id: params.patternId,
                },
              },
            },
          },
        }),
      }
    );
    let customization = yield response.json();
    if (customization.errors) {
      if (
        customization.errors.length === 1 &&
        Number(customization.errors[0].status) === 401 &&
        customization.errors[0].title === 'No valid auth token'
      ) {
        console.error(
          'Failed to store prepaid card customization due to invalid auth token'
        );
        this.hubAuthentication.authToken = null;
        throw new Error('No valid auth token');
      } else {
        // TODO: this should be changed to a form that communicates the errors
        console.error(
          'Failed to store prepaid card customization, got errors:',
          customization.errors
        );
        throw new Error('Failed to store prepaid card customizations');
      }
    }

    return {
      did: customization.data.attributes.did,
    };
  }

  get didResolver() {
    return new Resolver(getResolver());
  }
}

// DO NOT DELETE: this is how TypeScript knows how to look up your services.
declare module '@ember/service' {
  interface Registry {
    'card-customization': CardCustomization;
  }
}

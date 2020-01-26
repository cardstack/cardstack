import { TestCard } from '@cardstack/test-support/test-card';
import { CardId } from '@cardstack/core/card';

export interface FixtureConfig {
  create?: TestCard[];
  destroy?: {
    cards?: CardId[];
    cardTypes?: CardId[];
  };
}

export default class Fixtures {
  constructor(private config: FixtureConfig) {
    this.config;
  }

  setupTest(_hooks: any) {
    throw new Error(`Fixtures for V2 API not yet implemented`);
  }
}

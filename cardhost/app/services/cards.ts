import { CompiledCard } from '@cardstack/core/src/interfaces';
import Service from '@ember/service';

export default class Cards extends Service {
  async load(
    url: string,
    format: 'isolated'
  ): Promise<{ model: any; component: unknown }> {
    let response = await fetch(`${url}?format=${format}`);

    if (response.status !== 200) {
      throw new Error(`unable to fetch card ${url}: status ${response.status}`);
    }

    let card = (await response.json()) as CompiledCard;

    return { model: card.data, component: card.templateSources[format] };
  }
}

declare module '@ember/service' {
  interface Registry {
    cards: Cards;
  }
}

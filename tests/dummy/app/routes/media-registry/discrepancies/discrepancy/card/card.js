import Route from '@ember/routing/route';
import { typeOf } from '@ember/utils';

export default class MediaRegistryDiscrepanciesDiscrepancyCardCardRoute extends Route {
  model({ innerCardType, innerCardId }) {
    let topLevelCard = this.modelFor('media-registry.discrepancies.discrepancy');
    let parentCard = this.modelFor('media-registry.discrepancies.discrepancy.card');

    let nestedField = parentCard.nestedField ? parentCard.nestedField[innerCardType] : null;
    let nestedCard = nestedField && nestedField.id === innerCardId ? nestedField : null;

    let nestedCompField = parentCard.nestedCompField[innerCardType];
    let nestedCompCard;

    if (nestedCompField) {
      let value = nestedCompField.tempField || nestedCompField.tempCollection || nestedCompField.value;

      if (nestedCompField.type === 'collection' && value && value.length) {
        nestedCompCard = value.find(el => el.id === innerCardId);
      } else if (typeOf(nestedCompField) === 'array' && nestedCompField.length) {
        nestedCompCard = nestedCompField.find(el => el.id === innerCardId);
      } else {
        nestedCompCard = nestedCompField.id === innerCardId ? nestedCompField : null;
      }
    } else {
      nestedCompCard = null;
    }

    return {
      nestedField: nestedCard,
      nestedCompField: nestedCompCard,
      parentCard,
      topLevelCard,
      cardType: innerCardType,
      cardId: innerCardId,
      route: 'media-registry.discrepancies.discrepancy.card.card'
    }
  }
}

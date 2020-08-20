import Route from '@ember/routing/route';
import { typeOf } from '@ember/utils';

export default class MediaRegistryDiscrepanciesDiscrepancyCardCardRoute extends Route {
  model({ innerCardCardType, innerCardCardId }) {
    let topLevelCard = this.modelFor('media-registry.discrepancies.discrepancy');
    let grandParentCard = this.modelFor('media-registry.discrepancies.discrepancy.card');
    let parentCard = this.modelFor('media-registry.discrepancies.discrepancy.card.card');

    let nestedField = parentCard.nestedField ? parentCard.nestedField[innerCardCardType] : null;
    let nestedCard = nestedField && nestedField.id === innerCardCardId ? nestedField : null;

    let nestedCompField = parentCard.nestedCompField[innerCardCardType];
    let nestedCompCard;

    if (nestedCompField) {
      let value = nestedCompField.tempField || nestedCompField.tempCollection || nestedCompField.value;

      if (nestedCompField.type === 'collection' && value && value.length) {
        nestedCompCard = value.find(el => el.id === innerCardCardId);
      } else if (typeOf(nestedCompField) === 'array' && nestedCompField.length) {
        nestedCompCard = nestedCompField.find(el => el.id === innerCardCardId);
      } else {
        nestedCompCard = nestedCompField.id === innerCardCardId ? nestedCompField : null;
      }
    } else {
      nestedCompCard = null;
    }

    return {
      nestedField: nestedCard,
      nestedCompField: nestedCompCard,
      parentCard,
      grandParentCard,
      topLevelCard,
      cardType: innerCardCardType,
      cardId: innerCardCardId,
      route: 'media-registry.discrepancies.discrepancy.card.card.card'
    }
  }
}

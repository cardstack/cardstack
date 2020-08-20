import Route from '@ember/routing/route';

export default class MediaRegistryDiscrepanciesDiscrepancyCardRoute extends Route {
  model({ cardType, cardId }) {
    let card = this.modelFor('media-registry.discrepancies.discrepancy');

    let baseField = card.baseCard.isolatedFields.find(el => el.title === cardType);
    let compField = card.compCard.isolatedFields.find(el => el.title === cardType);
    let baseCard;
    let compCard;

    let value = baseField.tempField || baseField.tempCollection || baseField.value;
    if (value) {
      if (value.length) {
        baseCard = value.find(el => el.id === cardId);
      } else {
        baseCard = compField.value;
      }
    } else {
      baseCard = null;
    }

    if (compField.value) {
      if (compField.value.length) {
        compCard = compField.value.find(el => el.id === cardId);
      } else {
        compCard = compField.value;
      }
    } else {
      compCard = null;
    }

    return {
      nestedField: baseCard,
      nestedCompField: compCard,
      topLevelCard: card,
      cardType,
      cardId,
      route: 'media-registry.discrepancies.discrepancy.card'
    }
  }
}

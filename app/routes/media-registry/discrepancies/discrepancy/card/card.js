import Route from '@ember/routing/route';

export default class MediaRegistryDiscrepanciesDiscrepancyCardCardRoute extends Route {
  model({ innerCardType, innerCardId }) {
    let { currentOrg, orgs } = this.modelFor('media-registry');
    let card = this.modelFor('media-registry.discrepancies.discrepancy');
    let parentCard = this.modelFor('media-registry.discrepancies.discrepancy.card');

    let topBaseField = parentCard.nestedField[innerCardType];
    let topCompField = parentCard.nestedCompField[innerCardType];

    let baseCard = {};
    let compCard = {};

    if (topBaseField && topBaseField.id === innerCardId) {
      baseCard = topBaseField;
    }

    if (parentCard.nestedField.tempField) {
      baseCard.tempField = parentCard.nestedField.tempField[innerCardType];
    }

    if (topCompField && topCompField.id === innerCardId) {
      compCard = topCompField;
    }

    return {
      currentOrg,
      orgs,
      nestedField: baseCard,
      nestedCompField: compCard,
      parentCard,
      topLevelCard: card,
      cardType: innerCardType,
      cardId: innerCardId,
      route: 'media-registry.discrepancies.discrepancy.card.card'
    }
  }
}

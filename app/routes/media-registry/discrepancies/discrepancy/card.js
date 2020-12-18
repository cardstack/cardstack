import Route from '@ember/routing/route';

export default class MediaRegistryDiscrepanciesDiscrepancyCardRoute extends Route {
  model({ cardType, cardId }) {
    let { currentOrg, orgs } = this.modelFor('media-registry');
    let card = this.modelFor('media-registry.discrepancies.discrepancy');

    let baseField = card.baseCard.isolatedFields.find(el => el.title === cardType);
    let compField = card.compCard.isolatedFields.find(el => el.title === cardType);
    let baseCard = {};
    let compCard = {};

    if (baseField.value) {
      baseCard = baseField.value.length ? baseField.value.find(el => el.id === cardId) : baseField.value;
    }

    if (baseField.tempField) {
      if (baseField.tempField.type === 'collection' && baseField.tempField.value) {
        baseCard.tempField = baseField.tempField.value.length ? baseField.tempField.value.find(el => el.id === cardId) : baseField.tempField.value;
      } else {
        baseCard.tempField = baseField.tempField;
      }
    }

    if (compField.value) {
      compCard = compField.value.length ? compField.value.find(el => el.id === cardId) : compField.value;
    } else {
      compCard = null;
    }

    return {
      currentOrg,
      orgs,
      nestedField: baseCard,
      nestedCompField: compCard,
      topLevelCard: card,
      cardType,
      cardId,
      route: 'media-registry.discrepancies.discrepancy.card'
    }
  }
}

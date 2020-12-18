import Route from '@ember/routing/route';
import { fetchCollection } from 'dummy/media';

export default class MediaRegistryAgreementsRoute extends Route {
  titleToken() {
    return 'Agreements';
  }

  async model({ agreementId }) {
    let org = this.modelFor('media-registry').currentOrg;
    let agreements = await fetchCollection('transfer_agreements_verifi');
    let agreement = agreements.find(el => el.reference_code === agreementId);
    let collection;

    if (agreement && agreement.catalog_id) {
      let collections = await fetchCollection('collections');
      collection = collections.find(el => el.id === agreement.catalog_id);
      collection.description = null;
    }

    return {
      org,
      agreement,
      collection
    };
  }
}

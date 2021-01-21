// import ENV from './config/environment';
// import fetch from 'fetch';
import RSVP from 'rsvp';
import allTracksCombined from './data/fixtures/media-registry/api/all_tracks_combined';
import bunnyRecordsCollection from './data/fixtures/media-registry/api/bunny_records_collections';
import collections from './data/fixtures/media-registry/api/collections';
import crdRecordsCollections from './data/fixtures/media-registry/api/crd_records_collections';
import customCatalogBatchFTable1 from './data/fixtures/media-registry/api/custom_catalog_batch_f_table_1';
import musicalWorks from './data/fixtures/media-registry/api/musical-works';
import profiles from './data/fixtures/media-registry/api/profiles';
import songsByPiaMidinaBbClarkeTable1 from './data/fixtures/media-registry/api/songs_by_pia_midina_bb_clarke_table_1';
import transferAgreementsVerifi from './data/fixtures/media-registry/api/transfer_agreements_verifi';

const MAP = {
  all_tracks_combined: allTracksCombined,
  bunny_records_collection: bunnyRecordsCollection,
  collections: collections,
  crd_records_collections: crdRecordsCollections,
  custom_catalog_batch_f_table_1: customCatalogBatchFTable1,
  'musical-works': musicalWorks,
  profiles: profiles,
  songs_by_pia_midina_bb_clarke_table_1: songsByPiaMidinaBbClarkeTable1,
  transfer_agreements_verifi: transferAgreementsVerifi,
};

export async function fetchCollection(collection) {
  // NOTE: Eventually this will return when we complete the
  // switch over to Mirage
  // let url =  `${ENV.rootURL}media-registry/api/${collection}.json`;

  // let res = await fetch(url);
  // return await res.json();
  let result = MAP[collection];
  if (!result) {
    throw new Error(`Unknown Collection Data requested: ${collection}`);
  }
  return RSVP.resolve(result);
}

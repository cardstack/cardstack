import Route from '@ember/routing/route';
import { fetchCollection } from '@cardstack/boxel/media';
import { formatId } from '@cardstack/boxel/utils/format-id';
import { titleize } from '@cardstack/boxel/utils/titleize';

export default class MediaRegistryProductsAlbumRoute extends Route {
  titleToken(model) {
    return `${titleize(model.album)} (${titleize(model.type_of_album)})`;
  }

  async model({ albumId }) {
    const tracks = await fetchCollection('all_tracks_combined');
    const musicalWorks = await fetchCollection('musical-works');
    const allCollections = await fetchCollection('collections');

    const albumTracks = tracks.filter((el) => formatId(el.album) === albumId);

    let { currentOrg } = this.modelFor('media-registry');
    let model = {};
    model.currentOrg = currentOrg;

    let {
      album,
      artist,
      collection_ids,
      cover_art,
      cover_art_date,
      cover_art_large,
      cover_art_medium,
      cover_art_thumb,
      genre,
      label,
      owner,
      owner_id,
      type_of_album,
    } = albumTracks[0];

    model = {
      album,
      artist,
      collection_ids,
      cover_art,
      cover_art_date,
      cover_art_large,
      cover_art_medium,
      cover_art_thumb,
      genre,
      label,
      owner,
      owner_id,
      type_of_album,
    };

    model.tracks = albumTracks;

    model.tracks.map((el, i) => {
      el.musicalWork = musicalWorks.find((item) => item.id === el.id);
      el.track_no = String(i + 1);
    });

    model.collections = allCollections.filter((el) =>
      model.collection_ids.includes(el.id)
    );

    return model;
  }
}

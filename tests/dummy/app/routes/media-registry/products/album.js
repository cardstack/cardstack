import Route from '@ember/routing/route';
import { fetchCollection } from 'dummy/media';
import { formatId } from '@cardstack/boxel/utils/format-id';

export default class MediaRegistryProductsAlbumRoute extends Route {
  async model({ albumId }) {
    const tracks = await fetchCollection('all_tracks_combined');
    const musicalWorks = await fetchCollection('musical-works');
    const allCollections = this.modelFor('media-registry')?.collection;

    const albumTracks = tracks.filter(el => formatId(el.album) === albumId);

    let model = {};

    let {
      album,
      artist,
      catalog,
      cover_art,
      cover_art_date,
      cover_art_large,
      cover_art_medium,
      cover_art_thumb,
      genre,
      owner,
      type_of_album
    } = albumTracks[0];

    model = {
      album,
      artist,
      catalog,
      cover_art,
      cover_art_date,
      cover_art_large,
      cover_art_medium,
      cover_art_thumb,
      genre,
      owner,
      type_of_album
    };

    model.tracks = albumTracks;

    model.tracks.map((el, i) => {
      el.musicalWork = musicalWorks.find(item => formatId(item.title) === formatId(el.song_title));
      el.track_no = String(i + 1);
    });

    const catalogs = model.catalog.map(el => formatId(el));
    model.collections = allCollections.filter(el => catalogs.includes(el.id));

    return model;
  }
}

import Controller from '@ember/controller';
import { action } from '@ember/object';

export default class MediaRegistryProductsAlbumController extends Controller {
  get headerDetailFields() {
    if (!this.model) { return null; }
    return [
      {
        title: 'label',
        value: this.model.label
      },
      {
        title: 'Release Type',
        value: this.model.type_of_album
      },
      {
        title: 'tracks',
        value: this.model.tracks.length
      }
    ];
  }

  get fields() {
    if (!this.model || !this.model.tracks) { return null; }

    let totalDuration = this.model.tracks.map(el => {
      let [ m, s ] = el.length.split(':');
      return m * 60 + Number(s);
    }).reduce((acc, cur) => acc + cur);

    let minutes = Math.floor(totalDuration / 60);
    let seconds = totalDuration - (minutes * 60);
    let formattedTotalDuration = [ minutes, seconds ].join(':');

    return [
      {
        type: 'collection',
        format: 'table',
        value: {
          rows: this.model.tracks,
          columns: [
            {
              name: 'Track No.',
              valuePath: 'track_no',
              width: 125,
              isFixed: 'left',
              textAlign: 'right'
            },
            {
              name: 'Title',
              valuePath: 'title',
              width: 290,
              titleCase: true,
              hasAudio: true
            },
            {
              name: 'Duration',
              valuePath: 'length',
              width: 145,
              textAlign: 'right'
            },
            {
              name: 'Artist',
              valuePath: 'artist',
              width: 235
            },
            {
              name: 'Artwork',
              valuePath: 'cover_art_thumb',
              width: 235,
              type: 'image'
            },
            {
              name: 'Genre',
              valuePath: 'genre',
              width: 235
            },
          ],
          footerRows: [
            {
              track_no: `${this.model.tracks.length}`,
              length: `${formattedTotalDuration}`
            }
          ]
        }
      }
    ]
  }

  @action
  transitionToCatalog(id) {
    this.transitionToRoute('media-registry.collection', id);
  }

  @action
  transitionToItem(item) {
    if (!item || !item.id) { return; }
    this.transitionToRoute('media-registry.item', item.id);
  }
}

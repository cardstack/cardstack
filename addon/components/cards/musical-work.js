import Component from '@glimmer/component';

export default class MusicalWork extends Component {
  get musicalWorkIsolated() {
    let card = this.args.model;
    return {
      "title": card?.title,
      "writers": [
        {
          title: 'Lyricist',
          value: card?.artistName || card?.artist,
          type: card?.artistName ? 'card' : 'text',
          component: card?.artistName ? 'cards/composer' : null
        },
        {
          title: 'Composer',
          value: card?.composerName || card?.composer,
          type: card?.composerName ? 'card' : 'text',
          component: card?.composerName ? 'cards/composer' : null
        }
      ],
      "iswc": card?.iswc,
      "verifi id": {
        id: card?.verifi_id,
        type: 'card',
        component: 'cards/registration-embedded',
        value: {
          verifi_id: card?.verifi_id,
          verifi_reg_date: card?.verifi_reg_date,
          asset_type: card?.version_type
        }
      },
      "version type": card?.version_type,
      "publisher": card?.publisher,
      "copyright notice": card?.copyright_notice
    };
  }
}

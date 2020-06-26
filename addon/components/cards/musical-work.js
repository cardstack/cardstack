import Component from '@glimmer/component';

export default class MusicalWork extends Component {
  get musicalWorkIsolated() {
    let card = this.args.model;
    return {
      "title": card?.title,
      "writers": [
        {
          title: 'Lyricist',
          value: card?.artistName || card?.artist
        },
        {
          title: 'Composer',
          value: card?.composerName || card?.composer
        }
      ],
      "iswc": card?.iswc,
      "verifi id": {
        id: card?.verifi_id,
        component: 'cards/registration-embedded',
        verifi_id: card?.verifi_id,
        verifi_reg_date: card?.verifi_reg_date,
        asset_type: card?.version_type
      },
      "version type": card?.version_type,
      "publisher": card?.publisher,
      "copyright notice": card?.copyright_notice
    };
  }
}

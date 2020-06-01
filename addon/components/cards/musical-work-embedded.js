import Component from '@glimmer/component';
import { truncateVerifiId } from '@cardstack/boxel/utils/truncate-verifi-id';

export default class MusicalWorkEmbedded extends Component {
  get musicalWorkEmbedded() {
    let card = this.args.model;
    if (!card) { return 'N/A'; }

    return {
      id: card?.iswc,
      type: 'musical-work',
      imgURL: '/media-registry/musical-work.svg',
      title: card?.title,
      description: card.composer ? `by ${card?.artist}, ${card?.composer}` : `by ${card?.artist}`,
      fields: [
        {
          title: 'version type',
          value: card?.version_type
        },
        {
          title: 'iswc',
          value: card?.iswc
        },
        {
          title: 'verifi id',
          value: truncateVerifiId(card?.verifi_id)
        }
      ]
    }
  }
}

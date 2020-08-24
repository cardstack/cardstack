import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { truncateVerifiId } from '@cardstack/boxel/utils/truncate-verifi-id';
import { titleize } from '@cardstack/boxel/utils/titleize';
import { formatId } from '@cardstack/boxel/utils/format-id';

export default class MusicalWorkEmbedded extends Component {
  @service router;

  get musicalWorkEmbedded() {
    let card = this.args.model;
    if (!card) { return 'N/A'; }

    return {
      id: card?.iswc,
      type: 'musical-work',
      imgURL: '/media-registry/musical-work.svg',
      title: titleize(card?.title),
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

  @action
  transitionToMusicalWork() {
    if (formatId(this.args.model.title) === 'the-sun-comes-out') {
      this.router.transitionTo('media-registry.musical-works.work', 'the-sun-comes-out-wmg-v1');
    } else {
      this.router.transitionTo('media-registry.item.musical-work', formatId(this.args.model.title));
    }
  }
}

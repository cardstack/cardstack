import Component from '@glimmer/component';
import { inject as service } from '@ember/service';
import { action } from '@ember/object';
import { truncateVerifiId } from 'dummy/utils/truncate-verifi-id';
import { titleize } from 'dummy/utils/titleize';
import { formatId } from 'dummy/utils/format-id';
import MusicalWorkSvg from 'dummy/images/media-registry/musical-work.svg';

export default class MusicalWorkEmbedded extends Component {
  @service router;

  get musicalWorkEmbedded() {
    let card = this.args.model;
    if (!card) {
      return 'N/A';
    }

    return {
      id: card?.iswc,
      type: 'musical-work',
      imgURL: MusicalWorkSvg,
      title: titleize(card?.title),
      description: card.composer
        ? `by ${card?.artist}, ${card?.composer}`
        : `by ${card?.description}`,
      fields: [
        {
          title: 'iswc',
          value: card?.iswc,
        },
        {
          title: 'verifi id',
          value: truncateVerifiId(card?.verifi_id),
        },
      ],
    };
  }

  @action
  transitionToMusicalWork() {
    if (this.args.model.id === 'the-sun-comes-out') {
      if (this.args.model.version) {
        return this.router.transitionTo(
          'media-registry.musical-works.work-version',
          'the-sun-comes-out',
          this.args.model.version
        );
      }
      this.router.transitionTo(
        'media-registry.musical-works.work',
        'the-sun-comes-out'
      );
    } else {
      this.router.transitionTo(
        'media-registry.item.musical-work',
        formatId(this.args.model.title)
      );
    }
  }
}

import Controller from '@ember/controller';
import { titleize } from 'dummy/utils/titleize';
import MusicalWorkSvg from 'dummy/images/media-registry/musical-work.svg';

export default class MediaRegistryItemMusicalWorkController extends Controller {
  get headerFields() {
    if (!this.model) {
      return null;
    }

    return {
      image: MusicalWorkSvg,
      title: this.model.title,
      description: this.model.composer
        ? `by ${this.model.artist}, ${this.model.composer}`
        : `by ${this.model.artist}`,
    };
  }

  get isolatedFields() {
    if (!this.model) {
      return null;
    }
    return [
      {
        title: 'title',
        value: titleize(this.model?.title),
      },
      {
        title: 'writers',
        value: [
          {
            title: 'Lyricist',
            value: this.model.lyricists,
            type: 'collection',
            component: 'cards/composer',
          },
          {
            title: 'Composer',
            value: this.model.composers,
            type: 'collection',
            component: 'cards/composer',
          },
        ],
      },
      {
        title: 'iswc',
        value: this.model?.iswc,
      },
      {
        title: 'verifi id',
        id: this.model?.verifi_id,
        type: 'card',
        component: 'cards/registration-embedded',
        value: {
          verifi_id: this.model?.verifi_id,
          verifi_reg_date: this.model?.verifi_reg_date,
          asset_type: this.model?.version_type,
        },
      },
      {
        title: 'version type',
        value: this.model?.version_type,
      },
      {
        title: 'publisher',
        value: this.model?.publisher,
      },
      {
        title: 'copyright notice',
        value: this.model?.copyright_notice,
      },
    ];
  }
}

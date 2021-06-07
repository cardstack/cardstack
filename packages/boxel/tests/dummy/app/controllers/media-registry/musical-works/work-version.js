/* eslint-disable ember/no-side-effects */
import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import MusicalWorkSvg from 'dummy/images/media-registry/musical-work.svg';

export default class MediaRegistryMusicalWorksWorkVersionController extends Controller {
  queryParams = ['version'];
  @tracked version = this.model ? this.model.work.version : null;

  get work() {
    let work = this.model.work;
    if (work.version) {
      this.version = work.version;
    }
    return work;
  }

  get headerFields() {
    if (!this.model) {
      return null;
    }

    return {
      image: MusicalWorkSvg,
      title: this.work.title || 'N/A',
      description: this.work.description ? `by ${this.work.description}` : null,
    };
  }

  get isolatedFields() {
    if (!this.model || !this.work) {
      return null;
    }

    return [
      {
        title: 'title',
        value: this.work.title,
      },
      {
        title: 'writers',
        type: 'collection',
        component: 'cards/publishing-representation',
        value: this.work.publishing_representatives,
      },
      {
        title: 'iswc',
        value: this.work.iswc,
      },
      {
        title: 'verifi_id',
        type: 'card',
        component: 'cards/registration-embedded',
        value: {
          id: this.work.verifi_id,
          verifi_id: this.work.verifi_id,
          verifi_reg_date: this.work.verifi_reg_date,
          asset_type: this.work.verifi_asset_type,
        },
      },
      {
        title: 'version_type',
        type: this.work.version_type ? 'card' : null,
        component: 'cards/file',
        value: this.work.version_type
          ? {
              id: 'original-work',
              type: 'version-type',
              title: this.work.version_type,
            }
          : null,
      },
      {
        title: 'ownership_splits',
        type: 'manuscript-share',
        value: this.ownershipSplits,
      },
      {
        title: 'publishers',
        type: 'card',
        component: 'cards/territory',
        value: this.work.publishers,
      },
      {
        title: 'copyright_notice',
        value: this.work.copyright_notice,
      },
    ];
  }

  get ownershipSplits() {
    if (!this.work || !this.work.lyricist || !this.work.composers.length) {
      return null;
    }

    let lyricistShare = '50%';
    let lyricist = {
      title: `${this.work.lyricist} (Lyricist)`,
      value: lyricistShare,
    };

    let composerShare = `${50 / this.work.composers.length}%`;
    let composers = this.work.composers.map((el) => {
      return {
        title: `${el} (Composer)`,
        value: composerShare,
      };
    });

    let shares = composers;
    shares = [lyricist, ...shares];

    return shares;
  }
}

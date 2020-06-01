import Component from '@glimmer/component';

export default class RegistrationEmbedded extends Component {
  get registrationEmbedded() {
    let { congress_id, verifi_id } = this.args.model;

    if (congress_id) {
      return {
        id: congress_id,
        type: 'registration',
        imgURL: '/media-registry/library-congress-logo.svg',
        title: this.args.model?.song_title,
        fields: [
          {
            title: 'type of work',
            value: 'Sound Recording (Form SR)'
          },
          {
            title: 'registration no.',
            value: congress_id
          },
        ]
      }
    }

    if (verifi_id) {
      return {
        id: verifi_id,
        type: 'registration',
        imgURL: '/media-registry/verifi-logo.svg',
        title: 'Verifi Registry',
        description: verifi_id,
        fields: [
          {
            title: 'asset type',
            value: this.args.model.asset_type || 'Master Recording'
          },
          {
            title: 'created',
            value: this.args.model.asset_type ? '2019-03-03' : '2020-02-17',
            type: 'date'
          },
        ]
      }
    }

    return null;
  }
}

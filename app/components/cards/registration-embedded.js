import Component from '@glimmer/component';
import VerifiLogoSvg from '@cardstack/boxel/images/media-registry/verifi-logo.svg';

export default class RegistrationEmbedded extends Component {
  get registrationEmbedded() {
    let verifi_id = this.args.model?.verifi_id;

    if (verifi_id) {
      return {
        id: verifi_id,
        type: 'registration',
        imgURL: VerifiLogoSvg,
        title: 'Verifi Registry',
        description: verifi_id,
        fields: [
          {
            title: 'asset type',
            value: this.args.model.asset_type || 'Master Recording',
          },
          {
            title: 'created',
            value: this.args.model.verifi_reg_date,
            type: 'date',
          },
        ],
      };
    }

    return null;
  }
}

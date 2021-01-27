import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import {
  bunnyLogo,
  bunnyLogoIcon,
  crdRecordsIcon,
  crdRecordsLogo,
  lisaTrackProfile,
  steveRightsProfile,
  wmgLogo,
} from '../../../data/organizations';

const ORGS = [
  {
    id: 'bunny_records',
    type: 'label',
    title: 'Bunny Records',
    iconURL: bunnyLogoIcon,
    logoURL: bunnyLogo,
    user: {
      title: 'Lisa Track',
      role: 'Administrator',
      imgURL: lisaTrackProfile,
    },
  },
  {
    id: 'crd_records',
    type: 'label',
    title: 'CRD Records',
    iconURL: crdRecordsIcon,
    logoURL: crdRecordsLogo,
    user: {
      title: 'Steve Rights',
      role: 'Catalog Manager',
      imgURL: steveRightsProfile,
    },
  },
  {
    id: 'warner-music-group',
    type: 'label',
    title: 'Warner Music Group',
    iconURL: wmgLogo,
    logoURL: wmgLogo,
  },
];

export default class extends Component {
  orgs = ORGS;
  @tracked currentOrg = ORGS[0];
  @action onChooseOrg(orgId) {
    this.currentOrg = ORGS.find((o) => o.id === orgId);
  }
}

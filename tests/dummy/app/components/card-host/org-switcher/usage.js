import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { A } from '@ember/array';
import {
  bunnyLogo,
  bunnyLogoIcon,
  crdRecordsIcon,
  crdRecordsLogo,
  lisaTrackProfile,
  steveRightsProfile,
  ampLogo,
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
    id: 'allegro-music-publishing',
    type: 'publisher',
    title: 'Allegro Music Publishing',
    iconURL: ampLogo,
    logoURL: ampLogo,
  },
];

export default class extends Component {
  @tracked orgs = A(ORGS);
  @tracked currentOrg = ORGS[0];
  @tracked ariaLabel = 'View catalog for ';
  @action onChooseOrg(orgId) {
    this.currentOrg = ORGS.find((o) => o.id === orgId);
  }
}

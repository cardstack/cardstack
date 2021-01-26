/* eslint-disable no-console */
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
  user = {
    id: 'lisa-track',
    type: 'participant',
    title: 'Lisa Track',
    description: 'Administrator',
    imgURL: 'media-registry/profiles/Lisa-Track.jpg',
    organization: 'bunny_records',
    ipi: '',
    pro: '',
    email: 'lisa@bunnyrecords.com',
    website: '',
    number_of_recordings: '',
    phone: '+1 215 288 3032',
    date_of_birth: '1987-03-16',
    address: '347 Bloom Ave',
    city: 'Philadelphia',
    state: 'PA',
    zipcode: '19124',
    country: 'United States',
  };
  @action onChooseOrg(orgId) {
    this.currentOrg = ORGS.find((o) => o.id === orgId);
  }
  @action clickedHome() {
    console.log('clicked home');
  }
  @action clickedUser() {
    console.log('clicked user');
  }
}

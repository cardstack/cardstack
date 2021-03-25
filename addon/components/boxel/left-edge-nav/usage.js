/* eslint-disable no-console */
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';

import AMPLogo from '@cardstack/boxel/usage-support/images/orgs/amp-logo.png';
import BunnyLogo from '@cardstack/boxel/usage-support/images/orgs/bunny-logo.svg';
import CRDLogo from '@cardstack/boxel/usage-support/images/orgs/crd-logo.svg';
import LisaImg from '@cardstack/boxel/usage-support/images/users/Lisa-Track.jpg';

const ORGS = [
  {
    id: 'org-1',
    title: 'Bunny Records',
    iconURL: BunnyLogo,
    brandColor: '#FF1D6C',
  },
  {
    id: 'org-2',
    title: 'CRD Records',
    iconURL: CRDLogo,
    brandColor: 'var(--boxel-blue)',
  },
  {
    id: 'org-3',
    title: 'Allegro Music Publishing',
    iconURL: AMPLogo,
  },
];

const USER = {
  title: 'Lisa Track',
  imgURL: LisaImg,
};

export default class extends Component {
  orgs = ORGS;
  user = USER;

  @tracked currentOrg = ORGS[0];

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

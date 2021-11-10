/* eslint-disable no-console */
import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import './usage.css';

import AMPLogo from '@cardstack/boxel/usage-support/images/orgs/amp-logo.png';
import BunnyLogo from '@cardstack/boxel/usage-support/images/orgs/bunny-logo.svg';
import CRDLogo from '@cardstack/boxel/usage-support/images/orgs/crd-logo.svg';
import LisaImg from '@cardstack/boxel/usage-support/images/users/Lisa-Track.jpg';

interface ExampleOrg {
  id: string;
  title: string;
  iconURL: string;
  brandColor: string;
}
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
] as ExampleOrg[];

const USER = {
  title: 'Lisa Track',
  imgURL: LisaImg,
};

export default class extends Component {
  orgs = ORGS;
  user = USER;

  @tracked currentOrg: ExampleOrg | undefined = ORGS[0];

  @action onChooseOrg(orgId: string): void {
    this.currentOrg = ORGS.find((o) => o.id === orgId);
  }
  @action clickedHome(): void {
    console.log('clicked home');
  }
  @action clickedUser(): void {
    console.log('clicked user');
  }
}

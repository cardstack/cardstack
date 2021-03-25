import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { A } from '@ember/array';

import BunnyLogo from '@cardstack/boxel/usage-support/images/orgs/bunny-logo.svg';
import CRDLogo from '@cardstack/boxel/usage-support/images/orgs/crd-logo.svg';

const ORGS = [
  {
    id: 'org1',
    title: 'Bunny Records',
    iconURL: BunnyLogo,
    brandColor: '#FF1D6C',
  },
  {
    id: 'org2',
    title: 'CRD Records',
    iconURL: CRDLogo,
    brandColor: 'var(--boxel-blue)',
  },
  {
    id: 'org3',
    title: 'Warbler Music',
    brandColor: 'var(--boxel-navy)',
  },
  {
    id: 'org4',
    title: 'DSP',
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

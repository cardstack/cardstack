import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import CRDLogo from '@cardstack/boxel/usage-support/images/orgs/crd-icon.svg';

export default class BoxelOrgHeaderComponent extends Component {
  @tracked title = 'CRD Records';
  @tracked logoURL = CRDLogo;
  @tracked backgroundColor = 'var(--boxel-blue)';
  @tracked color = 'var(--boxel-light)';
  @tracked logoSize = 'auto 2rem';
  @tracked logoPosition = 'center';
}

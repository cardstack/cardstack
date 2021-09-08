import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import CRDLogo from '@cardstack/boxel/usage-support/images/orgs/crd-icon.svg';

export default class BoxelOrgTitleComponent extends Component {
  @tracked title = 'CRD Records';
  @tracked iconURL = CRDLogo;
  @tracked color = '#ffffff';
  @tracked logoSize = 'auto 2rem';
  @tracked logoPosition = 'center';
}

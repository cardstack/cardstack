import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';
import CRDLogo from '@cardstack/boxel/usage-support/images/orgs/crd-icon.svg';

export default class BoxelOrgTitleComponent extends Component {
  @tracked title = 'CRD Records';
  @tracked iconURL = CRDLogo;
  @tracked color = '#ffffff';
  @tracked font = '900 1.125rem/1.333 var(--boxel-font-family)';
  @tracked letterSpacing = 'var(--boxel-lsp-xxl)';
  @tracked logoSize = 'auto 2rem';
  @tracked logoPosition = 'center';
  @tracked textTransform = 'uppercase';
}

import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelOrgSwitcher from './index';
import DemoStage from 'dummy/components/doc/demo-stage';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { fn } from '@ember/helper';
import { A } from '@ember/array';
import { Org } from './org';

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
] as Org[];

export default class OrgSwitcherUsage extends Component {
  @tracked orgs = A(ORGS);
  @tracked currentOrg: Org | undefined = ORGS[0];
  @action onChooseOrg(orgId: string): void {
    this.currentOrg = ORGS.find((o) => o.id === orgId);
  }

  <template>
    <FreestyleUsage @name="OrgSwitcher">
      <:example>
        <DemoStage @width="80px" @paddingX="0px" @bg="boxel-purple-800">
          <BoxelOrgSwitcher
            @orgs={{this.orgs}}
            @currentOrg={{this.currentOrg}}
            @onChooseOrg={{this.onChooseOrg}}
          />
        </DemoStage>
      </:example>
      <:api as |Args|>
        <Args.Object
          @name="currentOrg"
          @value={{this.currentOrg}}
          @description="The organization to show as selected."
          @jsonCollapseDepth={{0}}
        />
        <Args.Action
          @name="onChooseOrg"
          @value={{this.onChooseOrg}}
          @description="fires when an org icon is clicked, sending the org ID"
        />
        <Args.Array
          @name="orgs"
          @type="Object"
          @items={{this.orgs}}
          @description="The organizations to show."
          @jsonCollapseDepth={{0}}
          @onChange={{fn (mut this.orgs)}}
        />
      </:api>
    </FreestyleUsage>

  </template>
}

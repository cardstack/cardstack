import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelDashboard from './index';
import BoxelLeftEdgeNav from '../left-edge-nav';
import BoxelOrgHeader from '../org-header';
import { tracked } from '@glimmer/tracking';
//@ts-expect-error glint does not think this is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { fn, hash } from '@ember/helper';
import cssVar from '@cardstack/boxel/helpers/css-var';

export default class DashboardUsage extends Component {
  @tracked displayLeftEdge = true;
  @tracked darkTheme = true;

  @tracked backgroundColor = 'inherit';
  @tracked color = 'inherit';

  <template>
    <FreestyleUsage @name="Dashboard">
      <:example>
        <BoxelDashboard
          @displayLeftEdge={{this.displayLeftEdge}}
          @darkTheme={{this.darkTheme}}
          style={{cssVar
            boxel-dashboard-background-color=this.backgroundColor
            boxel-dashboard-color=this.color
          }}
        >
          <:leftEdge>
            <BoxelLeftEdgeNav
              @home={{hash icon="cardstack" height="2rem"}}
              class="dashboard-usage-left-edge-nav"
            />
          </:leftEdge>
          <:header>
            <BoxelOrgHeader @title="Cardstack" />
          </:header>
          <:body>
            Content
          </:body>
        </BoxelDashboard>
      </:example>
      <:api as |Args|>
        <Args.Bool
          @name="displayLeftEdge"
          @description="allows space for the left-edge"
          @defaultValue="false"
          @value={{this.displayLeftEdge}}
          @onInput={{fn (mut this.displayLeftEdge)}}
        />
        <Args.Bool
          @name="darkTheme"
          @description="dark-themed version"
          @defaultValue="false"
          @value={{this.darkTheme}}
          @onInput={{fn (mut this.darkTheme)}}
        />
        {{!-- template-lint-disable no-unbound --}}
        <Args.String
          @name="--boxel-dashboard-background-color"
          @defaultValue={{unbound this.backgroundColor}}
          @value={{this.backgroundColor}}
          @onInput={{fn (mut this.backgroundColor)}}
        />
        <Args.String
          @name="--boxel-dashboard-color"
          @description="text color"
          @defaultValue={{unbound this.color}}
          @value={{this.color}}
          @onInput={{fn (mut this.color)}}
        />
      </:api>
    </FreestyleUsage>

  </template>
}

import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelDashboard from './index';
import BoxelLeftEdgeNav from '../left-edge-nav';
import BoxelOrgHeader from '../org-header';
import { tracked } from '@glimmer/tracking';
import { fn, hash } from '@ember/helper';
import cssVar from '@cardstack/boxel/helpers/css-var';
import { cssVariable, CSSVariableInfo } from 'ember-freestyle/decorators/css-variable';

export default class DashboardUsage extends Component {
  @tracked displayLeftEdge = true;
  @tracked darkTheme = true;

  cssClassName = "boxel-dashboard";
  @cssVariable declare boxelDashboardBackgroundColor: CSSVariableInfo;
  @cssVariable declare boxelDashboardColor: CSSVariableInfo;

  <template>
    <FreestyleUsage @name="Dashboard">
      <:example>
        <BoxelDashboard
          @displayLeftEdge={{this.displayLeftEdge}}
          @darkTheme={{this.darkTheme}}
          style={{cssVar
            boxel-dashboard-background-color=this.boxelDashboardBackgroundColor.value
            boxel-dashboard-color=this.boxelDashboardColor.value
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
      </:api>
      <:cssVars as |CSS|>
        <CSS.Basic
          @name="boxel-dashboard-background-color"
          @type="color"
          @description="The background color"
          @defaultValue={{this.boxelDashboardBackgroundColor.defaults}}
          @value={{this.boxelDashboardBackgroundColor.value}}
          @onInput={{this.boxelDashboardBackgroundColor.update}}
        />
        <CSS.Basic
          @name="boxel-dashboard-color"
          @type="color"
          @description="The text color"
          @defaultValue={{this.boxelDashboardColor.defaults}}
          @value={{this.boxelDashboardColor.value}}
          @onInput={{this.boxelDashboardColor.update}}
        />
      </:cssVars>
    </FreestyleUsage>

  </template>
}

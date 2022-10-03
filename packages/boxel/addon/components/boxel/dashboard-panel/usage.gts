import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

//@ts-expect-error glint does not think array is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { fn, array } from '@ember/helper';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import cssVar from '@cardstack/boxel/helpers/css-var';

import BoxelDashboardPanel from './index';

export default class BoxelDashboardPanelUsage extends Component {
  @tracked title = 'A Dashboard Panel';
  @tracked description = 'It looks like this.'
  @tracked noCollapse = false;
  @tracked hideCaret = false;

  @tracked summaryPadding = 'var(--boxel-sp-sm) var(--boxel-sp-xl)';
  @tracked collapseText = "'Hide\ details'";
  @tracked expandText = "'Show details'";

  <template>
    <FreestyleUsage @name="DashboardPanel">
      <:example>
        <BoxelDashboardPanel
          @title={{this.title}}
          @description={{this.description}}
          @noCollapse={{this.noCollapse}}
          @hideCaret={{this.hideCaret}}
          style={{cssVar
            boxel-dashboard-panel-summary-padding=this.summaryPadding
            boxel-dashboard-panel-collapse-text=this.collapseText
            boxel-dashboard-panel-expand-text=this.expandText
          }}
        >
          <:detail>
            detail!
          </:detail>
        </BoxelDashboardPanel>
      </:example>
      <:api as |Args|>
        <Args.String
          @name="title"
          @required={{true}}
          @value={{this.title}}
          @onInput={{fn (mut this.title)}}
        />
        <Args.String
          @name="description"
          @required={{true}}
          @value={{this.description}}
          @onInput={{fn (mut this.description)}}
        />
        <Args.Bool
          @name="noCollapse"
          @description="xyz"
          @value={{this.noCollapse}}
          @onInput={{fn (mut this.noCollapse)}}
        />
        <Args.Bool
          @name="hideCaret"
          @description="Hide the caret in the expand/collapse buttons"
          @value={{this.hideCaret}}
          @onInput={{fn (mut this.hideCaret)}}
        />
        {{!-- template-lint-disable no-unbound --}}
        <Args.String
          @name="--boxel-dashboard-panel-summary-padding"
          @defaultValue={{unbound this.summaryPadding}}
          @value={{this.summaryPadding}}
          @onInput={{fn (mut this.summaryPadding)}}
        />
        <Args.String
          @name="--boxel-dashboard-panel-collapse-text"
          @defaultValue={{unbound this.collapseText}}
          @value={{this.collapseText}}
          @onInput={{fn (mut this.collapseText)}}
        />
        <Args.String
          @name="--boxel-dashboard-panel-expand-text"
          @defaultValue={{unbound this.expandText}}
          @value={{this.expandText}}
          @onInput={{fn (mut this.expandText)}}
        />
      </:api>
    </FreestyleUsage>

    <FreestyleUsage @name="DashboardPanel with aside and footer">
      <:example>
        <BoxelDashboardPanel
          @title={{this.title}}
          @description={{this.description}}
          @noCollapse={{this.noCollapse}}
          @hideCaret={{this.hideCaret}}
        >
          <:detail>
            detail!
          </:detail>
          <:footer>
            footerfixme
          </:footer>
        </BoxelDashboardPanel>
      </:example>
    </FreestyleUsage>
  </template>
}

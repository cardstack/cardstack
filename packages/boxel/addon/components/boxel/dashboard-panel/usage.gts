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

  @tracked summaryPadding = 'var(--boxel-sp-sm) var(--boxel-sp-xl)';

  <template>
    <FreestyleUsage @name="DashboardPanel">
      <:example>
        <BoxelDashboardPanel
          @title={{this.title}}
          @description={{this.description}}
          @noCollapse={{this.noCollapse}}
          style={{cssVar
            boxel-dashboard-panel-summary-padding=this.summaryPadding
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
        {{!-- template-lint-disable no-unbound --}}
        <Args.String
          @name="--boxel-dashboard-panel-summary-padding"
          @defaultValue={{unbound this.summaryPadding}}
          @value={{this.summaryPadding}}
          @onInput={{fn (mut this.summaryPadding)}}
        />
      </:api>
    </FreestyleUsage>
  </template>
}

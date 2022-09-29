import Component from '@glimmer/component';
import { tracked } from '@glimmer/tracking';

//@ts-expect-error glint does not think array is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { fn, array } from '@ember/helper';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';

import BoxelDashboardPanel from './index';



export default class BoxelDashboardPanelUsage extends Component {
  @tracked title = 'A Dashboard Panel';
  @tracked description = 'It looks like this.'
  @tracked noCollapse = false;

  <template>
    <FreestyleUsage @name="DashboardPanel">
      <:example>
        <BoxelDashboardPanel
          @title={{this.title}}
          @description={{this.description}}
          @noCollapse={{this.noCollapse}}
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
      </:api>
    </FreestyleUsage>
  </template>
}

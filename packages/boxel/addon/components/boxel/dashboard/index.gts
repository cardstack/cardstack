import Component from '@glimmer/component';
import cn from '@cardstack/boxel/helpers/cn';
import '@cardstack/boxel/styles/global.css';
import './index.css';

interface Signature {
  Element: HTMLDivElement;
  Args: {
    displayLeftEdge?: boolean;
    darkTheme?: boolean;
  };
  Blocks: {
    body: [];
    header: [];
    leftEdge: [];
  } 
}

export default class BoxelDashboard extends Component<Signature> {
  <template>
    <div
      class={{cn
        "boxel-dashboard"
        boxel-dashboard--with-left-edge=@displayLeftEdge
        boxel-dashboard--dark-theme=@darkTheme
      }}
      ...attributes
    >
      {{#if @displayLeftEdge}}
        <div class="boxel-dashboard__left-edge-container">
          {{yield to="leftEdge"}}
        </div>
      {{/if}}

      <div class="boxel-dashboard__header-container">
        {{yield to="header"}}
      </div>

      <div class="boxel-dashboard__body-container">
        {{yield to="body"}}
      </div>
    </div>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::Dashboard': typeof BoxelDashboard;
  }
}


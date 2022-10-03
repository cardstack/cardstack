import Component from '@glimmer/component';
import '@cardstack/boxel/styles/global.css';
import './index.css';
import cn from '@cardstack/boxel/helpers/cn';
import cssUrl from "@cardstack/boxel/helpers/css-url";
import { svgJar } from '@cardstack/boxel/utils/svg-jar';

interface Signature {
  Element: HTMLDetailsElement;
  Args: {
    noCollapse?: boolean;
    noBottomPadding?: boolean;
    hideCaret?: boolean;
    title: string;
    description: string;
    heroImageUrl: string;
    summaryHeroImageUrl: string;
  }
  Blocks: {
    detail: []
    footer: []
  }
}

export default class CardPayDashboardPanel extends Component<Signature> {
  <template>
    <details
      class={{cn
        "boxel-dashboard-panel"
        boxel-dashboard-panel--no-collapse=@noCollapse
        boxel-dashboard-panel--no-bottom-padding=@noBottomPadding
        boxel-dashboard-panel--has-footer=(has-block 'footer')
      }}
      ...attributes
      open={{@noCollapse}}
      >
      <summary class="boxel-dashboard-panel__summary">
        <div class="boxel-dashboard-panel__summary-content">
          <div class="boxel-dashboard-panel__summary-hero" style={{cssUrl "background-image" @summaryHeroImageUrl}} />
          <h2 class="boxel-dashboard-panel__summary-title">{{@title}}</h2>
          <p class="boxel-dashboard-panel__summary-desc">{{@description}}</p>
        </div>
        <div class="boxel-dashboard-panel__marker">
          {{#unless @hideCaret}}
            {{svgJar "caret" class="boxel-dashboard-panel__marker-icon" role="presentation"}}
          {{/unless}}
        </div>
        {{#if (has-block 'footer')}}
          <footer class="boxel-dashboard-panel__footer boxel-dashboard-panel__summary-footer" aria-label="closed-footer">
            {{yield to="footer"}}
          </footer>
        {{/if}}
      </summary>
      <section class="boxel-dashboard-panel__main">
        <header class="boxel-dashboard-panel__header">
          <h2 class="boxel-dashboard-panel__header-title">{{@title}}</h2>
          <p class="boxel-dashboard-panel__header-desc">{{@description}}</p>
        </header>
        <div class="boxel-dashboard-panel__hero" style={{cssUrl "background-image" @heroImageUrl}} />
        {{yield to="detail"}}
      </section>
      {{#if (has-block 'footer')}}
        <footer class="boxel-dashboard-panel__footer boxel-dashboard-panel__detail-footer" aria-label="open-footer">
          {{yield to="footer"}}
        </footer>
      {{/if}}
    </details>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::DashboardPanel': typeof CardPayDashboardPanel;
  }
}

import Component from '@glimmer/component';
import cn from '@cardstack/boxel/helpers/cn';
import cssUrl from "@cardstack/boxel/helpers/css-url";
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import Panel from './panel';

interface Signature {
  Element: HTMLDetailsElement;
  Args: {
    noCollapse?: boolean;
    noBottomPadding?: boolean;
    panel: Panel
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
        "dashboard-details"
        dashboard-details--no-collapse=@noCollapse
        dashboard-details--no-bottom-padding=@noBottomPadding
        dashboard-details--has-footer=(has-block 'footer')
      }}
      ...attributes
      open={{@noCollapse}}
      >
      <summary class="dashboard-details__summary">
        <div class="dashboard-details__summary-content">
          <div class="dashboard-panel__summary-hero" style={{cssUrl "background-image" @panel.summaryHeroImageUrl}} />
          <h2 class="dashboard-panel__summary-title">{{@panel.title}}</h2>
          <p class="dashboard-panel__summary-desc">{{@panel.description}}</p>
        </div>
        <div class="dashboard-details__marker">
          {{svgJar "caret-right" class="dashboard-details__marker-icon" role="presentation"}}
        </div>
        {{#if (has-block 'footer')}}
          <footer class="dashboard-panel__footer dashboard-panel__summary-footer" aria-label="closed-footer">
            {{yield to="footer"}}
          </footer>
        {{/if}}
      </summary>
      <section class="dashboard-panel">
        <header class="dashboard-panel__header">
          <h2 class="dashboard-panel__header-title">{{@panel.title}}</h2>
          <p class="dashboard-panel__header-desc">{{@panel.description}}</p>
        </header>
        <div class="dashboard-panel__hero" style={{cssUrl "background-image" @panel.heroImageUrl}} />
        {{yield to="detail"}}
      </section>
      {{#if (has-block 'footer')}}
        <footer class="dashboard-panel__footer dashboard-panel__detail-footer" aria-label="open-footer">
          {{yield to="footer"}}
        </footer>
      {{/if}}
    </details>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'CardPay::DashboardPanel': typeof CardPayDashboardPanel;
  }
}

import Component from '@glimmer/component';
import cn from '@cardstack/boxel/helpers/cn';
import not from 'ember-truth-helpers/helpers/not';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';
import { Section } from '../panel';

interface Signature {
  Element: HTMLElement;
  Args: {
    section: Section;
  }
  Blocks: {
    cta: []
    disclaimer: []
  }
}

export default class CardPayDashboardPanelSection extends Component<Signature> {
  <template>
    <section class={{cn "dashboard-panel-section" dashboard-panel-section--bottom-aligned=(not @section.title) dashboard-panel-section--has-disclaimer=(has-block "disclaimer")}} ...attributes>
      <div class="dashboard-panel-section__body">
        {{#if @section.icon}}
          {{svgJar @section.icon role="presentation" width="72"}}
        {{/if}}
        <h3 class="dashboard-panel-section__title">{{@section.title}}</h3>
        <p class="dashboard-panel-section__desc">{{@section.description}}</p>

        {{#if @section.bullets}}
          <ul class="dashboard-panel-section__list">
            {{#each @section.bullets as |bullet|}}
              <li class="dashboard-panel-section__list-item">{{bullet}}</li>
            {{/each}}
          </ul>
        {{/if}}
      </div>

      {{yield to="cta"}}

      {{#if (has-block "disclaimer")}}
        <small class="dashboard-panel-section__disclaimer">
          {{yield to="disclaimer"}}
        </small>
      {{/if}}
    </section>
  </template>
}

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'CardPay::DashboardPanel::Section': typeof CardPayDashboardPanelSection;
  }
}

import type { TemplateOnlyComponent } from '@ember/component/template-only';
import { svgJar } from '@cardstack/boxel/utils/svg-jar';

import './index.css';

type Info = { 
  title: string; description: string;
}

const panelTitle = 'Scheduled crypto payments for your convenience';

const schedulerSteps: Array<Info> = [
  {
    title: 'Set up your payment account',
    description: 'Connect your wallet, choose a blockchain, set up your safe',
  },
  {
    title: 'Schedule your payments',
    description: 'Specify the date & time for upcoming & recurring transactions',
  },
  {
    title: 'Track your transactions',
    description: 'See details of your past & future crypto payments at a glance',
  },
];


const schedulerFeatures: Array<Info & { iconName: string; }> = [
  {
    title: 'Non-Custodial',
    description: 'Retain full control of your tokens',
    iconName: 'non-custodial'
  },
  {
    title: 'Reliable',
    description: 'Be sure that your payments go through',
       iconName: 'checked'
  },
  {
    title: 'Punctual',
    description: 'Never miss a payment again',
       iconName: 'punctual'
  },
];

interface Signature {
  Element: HTMLElement;
  Args: { 
    open?: boolean 
  };
}

const ScheduleCollapsePanel: TemplateOnlyComponent<Signature> = <template>
  <details class='collapse-panel' ...attributes open={{@open}}>
    <summary class='collapse-panel__summary'>
      <div class='collapse-panel__summary-collapsed'>
        <span>{{panelTitle}}</span>
        <span class='collapse-panel__summary-panel-button'>Expand</span>
      </div>
    </summary>
    <div class='collapse-panel__details'>
      <div class='collapse-panel__details-content'>
        <h2>{{panelTitle}}</h2>
        <ul>
          {{#each schedulerFeatures as |feature|}}
            <li>
              {{svgJar feature.iconName role='listitem'}}
              <h4>{{feature.title}}</h4>
              <p>{{feature.description}}</p>
            </li>
          {{/each}}
        </ul>
      </div>
      <div class='collapse-panel__details-overlay'>
        <h3>Start using this payment scheduler dApp:</h3>
        <ol>
          {{#each schedulerSteps as |step|}}
            <li>
              <h4>{{step.title}}</h4>
              <p>{{step.description}}</p>
            </li>
          {{/each}}
        </ol>
      </div>
    </div>
  </details>
</template>

export default ScheduleCollapsePanel;

import type { TemplateOnlyComponent } from '@ember/component/template-only';
import { type EmptyObject } from '@ember/component/helper';

import './index.css';

interface Signature {
  Element: HTMLElement;
  Args: { 
    noCollapse?: boolean
    };
  Blocks: EmptyObject;
}

const panelTitle = 'Scheduled crypto payments for your convenience';

const ScheduleCollapsePanel: TemplateOnlyComponent<Signature> = <template>
  <details class='collapse-panel' ...attributes open={{@noCollapse}}>
    <summary class='collapse-panel__summary'>
      <div class='collapse-panel__summary-collapsed'>
        <span>{{panelTitle}}</span>
        <span class='collapse-panel__summary-panel-button'>Expand</span>
      </div>
    </summary>
    <div class='collapse-panel__details'>
      <div class='collapse-panel__details-content'>
        <h2>{{panelTitle}}</h2>
      </div>
      <div class='collapse-panel__details-overlay'>
        <h3>Start using this payment scheduler dApp:</h3>
      </div>
    </div>
  </details>
</template>

export default ScheduleCollapsePanel;

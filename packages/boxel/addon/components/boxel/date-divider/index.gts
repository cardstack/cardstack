import type { TemplateOnlyComponent } from '@ember/component/template-only';
import '@cardstack/boxel/styles/global.css';
import './index.css';
import { dayjsFormat } from '@cardstack/boxel/helpers/dayjs-format';
import now from '@cardstack/boxel/helpers/now';
import or from 'ember-truth-helpers/helpers/or';


export interface Signature {
  Element: HTMLDivElement;
  Args: {
    date?: string;
  };
  Blocks: {
    'default': [],
  }
}

const DateDivider: TemplateOnlyComponent<Signature> = <template>
  <div class="boxel-date-divider" ...attributes>
    <hr class="boxel-date-divider__hr">
    <time class="boxel-date-divider__date">{{dayjsFormat (or @date (now)) "MMMM D, YYYY"}}</time>
  </div>
</template>

export default DateDivider;

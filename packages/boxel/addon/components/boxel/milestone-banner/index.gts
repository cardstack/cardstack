import type { TemplateOnlyComponent } from '@ember/component/template-only';
import { type EmptyObject } from '@ember/component/helper';
import '@cardstack/boxel/styles/global.css';
import './index.css';

export interface Signature {
  Element: HTMLDivElement;
  Args: {
    title?: string;
    status?: string;
  };
  Blocks: EmptyObject;
}

const MilestoneBanner: TemplateOnlyComponent<Signature> = <template>
  <div class="boxel-milestone-banner" ...attributes>
    <span class="boxel-milestone-banner__title">{{@title}}</span>
    <span class="boxel-milestone-banner__status">{{@status}}</span>
  </div>
</template>

export default MilestoneBanner;

import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelExpandableBanner from './index';
import { tracked } from '@glimmer/tracking';
import cssVar from '@cardstack/boxel/helpers/css-var';
import { fn } from '@ember/helper';

import './usage.css';

export default class ExpandableBannerUsage extends Component {
  @tracked icon = 'payment';
  @tracked summary = 'Deposit funds to become a Supplier';

  @tracked minHeight = '5rem';
  @tracked minHeightOpen = '15rem';
  @tracked textColor = 'var(--boxel-light)';
  @tracked backgroundColor = 'var(--boxel-purple-400)';
  @tracked verticalGap = 'var(--boxel-sp)';
  @tracked horizontalGap = 'var(--boxel-sp-lg)';

  <template>
    <FreestyleUsage @name="ExpandableBanner">
      <:example>
          <BoxelExpandableBanner
            @icon={{this.icon}}
            @summary={{this.summary}}
            style={{cssVar
              boxel-expandable-banner-min-height=this.minHeight
              boxel-expandable-banner-min-height-open=this.minHeightOpen
              boxel-expandable-banner-text-color=this.textColor
              boxel-expandable-banner-background-color=this.backgroundColor
              boxel-expandable-banner-vertical-gap=this.verticalGap
              boxel-expandable-banner-horizontal-gap=this.horizontalGap
            }}
          >
            <p class="expandable-banner-usage-paragraph">
              As a Supplier, you deposit funds from your Ethereum Mainnet wallet into the CARD Protocol’s Reserve Pool
              and receive the corresponding amount of CPXD tokens in your Gnosis Chain wallet.
            </p>
            <p class="expandable-banner-usage-paragraph">
              We currently support two types of asset you can deposit into the Reserve Pool:
              <ul class="expandable-banner-usage-list">
                <li>Dai stablecoins (DAI)</li>
                <li>Cardstack ERC-20 tokens (CARD)</li>
              </ul>
            </p>
            <p class="expandable-banner-usage-paragraph">
              The CARD Protocol’s Reserve Pool facilitates payments between customers and merchants on the Cardstack Network.
            </p>
            <p class="expandable-banner-usage-paragraph expandable-banner-usage-fine-print">
              Fees: Suppliers earn transaction fees of 0.5% for all transactions across the CARD Protocol. Those fees
              will be distributed to Suppliers based on their proportional share of supplied tokens in the Reserve Pool,
              averaged over the 30-day period in which the transactions occurred.
              <a class="expandable-banner-usage-link" href="#">More details here.</a>
            </p>
          </BoxelExpandableBanner>
      </:example>

      <:api as |Args|>
        <Args.String @name="icon" @value={{this.icon}} @onInput={{fn (mut this.icon)}} @description="Name of the icon on the left of the summary text, passed to svg-jar."/>
        <Args.String @name="summary" @value={{this.summary}} @onInput={{fn (mut this.summary)}} @description="The text of the summary element"/>
        {{!-- template-lint-disable no-unbound --}}
        <Args.String
          @name="--boxel-expandable-banner-min-height"
          @defaultValue={{unbound this.minHeight}}
          @value={{this.minHeight}}
          @onInput={{fn (mut this.minHeight)}}
        />
        <Args.String
          @name="--boxel-expandable-banner-min-height-open"
          @defaultValue={{unbound this.minHeightOpen}}
          @value={{this.minHeightOpen}}
          @onInput={{fn (mut this.minHeightOpen)}}
        />
        <Args.String
          @name="--boxel-expandable-banner-text-color"
          @defaultValue={{unbound this.textColor}}
          @value={{this.textColor}}
          @onInput={{fn (mut this.textColor)}}
        />
        <Args.String
          @name="--boxel-expandable-banner-background-color"
          @defaultValue={{unbound this.backgroundColor}}
          @value={{this.backgroundColor}}
          @onInput={{fn (mut this.backgroundColor)}}
        />
        <Args.String
          @name="--boxel-expandable-banner-vertical-gap"
          @defaultValue={{unbound this.verticalGap}}
          @value={{this.verticalGap}}
          @onInput={{fn (mut this.verticalGap)}}
        />
        <Args.String
          @name="--boxel-expandable-banner-horizontal-gap"
          @defaultValue={{unbound this.horizontalGap}}
          @value={{this.horizontalGap}}
          @onInput={{fn (mut this.horizontalGap)}}
        />
        <Args.Yield @description="The content in the details element"/>
      </:api>
    </FreestyleUsage>    
  </template>
}

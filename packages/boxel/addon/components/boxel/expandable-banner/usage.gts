import Component from '@glimmer/component';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelExpandableBanner from './index';
import { tracked } from '@glimmer/tracking';
import cssVar from '@cardstack/boxel/helpers/css-var';
import { fn } from '@ember/helper';
import { cssVariable, CSSVariableInfo } from 'ember-freestyle/decorators/css-variable';

import './usage.css';

export default class ExpandableBannerUsage extends Component {
  @tracked icon = 'payment';
  @tracked summary = 'Deposit funds to become a Supplier';

  cssClassName = 'boxel-expandable-banner';
  @cssVariable declare boxelExpandableBannerMinHeight: CSSVariableInfo;
  @cssVariable declare boxelExpandableBannerMinHeightOpen: CSSVariableInfo;
  @cssVariable declare boxelExpandableBannerTextColor: CSSVariableInfo;
  @cssVariable declare boxelExpandableBannerBackgroundColor: CSSVariableInfo;
  @cssVariable declare boxelExpandableBannerVerticalGap: CSSVariableInfo;
  @cssVariable declare boxelExpandableBannerHorizontalGap: CSSVariableInfo;

  <template>
    <FreestyleUsage @name="ExpandableBanner">
      <:example>
          <BoxelExpandableBanner
            @icon={{this.icon}}
            @summary={{this.summary}}
            style={{cssVar
              boxel-expandable-banner-min-height=this.boxelExpandableBannerMinHeight.value
              boxel-expandable-banner-min-height-open=this.boxelExpandableBannerMinHeightOpen.value
              boxel-expandable-banner-text-color=this.boxelExpandableBannerTextColor.value
              boxel-expandable-banner-background-color=this.boxelExpandableBannerBackgroundColor.value
              boxel-expandable-banner-vertical-gap=this.boxelExpandableBannerVerticalGap.value
              boxel-expandable-banner-horizontal-gap=this.boxelExpandableBannerHorizontalGap.value
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
        <Args.String
          @name="icon"
          @description="Name of the icon on the left of the summary text, passed to svg-jar."
          @value={{this.icon}}
          @onInput={{fn (mut this.icon)}}
        />
        <Args.String
          @name="summary"
          @description="The text of the summary element"
          @value={{this.summary}}
          @onInput={{fn (mut this.summary)}}
        />
        <Args.Yield @description="The content in the details element"/>
      </:api>
      <:cssVars as |Css|>
        <Css.Basic
          @name="boxel-expandable-banner-min-height"
          @type="dimension"
          @defaultValue={{this.boxelExpandableBannerMinHeight.defaults}}
          @value={{this.boxelExpandableBannerMinHeight.value}}
          @onInput={{this.boxelExpandableBannerMinHeight.update}}
        />
        <Css.Basic
          @name="boxel-expandable-banner-min-height-open"
          @type="dimension"
          @defaultValue={{this.boxelExpandableBannerMinHeightOpen.defaults}}
          @value={{this.boxelExpandableBannerMinHeightOpen.value}}
          @onInput={{this.boxelExpandableBannerMinHeightOpen.update}}
        />
        <Css.Basic
          @name="boxel-expandable-banner-text-color"
          @type="color"
          @defaultValue={{this.boxelExpandableBannerTextColor.defaults}}
          @value={{this.boxelExpandableBannerTextColor.value}}
          @onInput={{this.boxelExpandableBannerTextColor.update}}
        />
        <Css.Basic
          @name="boxel-expandable-banner-background-color"
          @type="color"
          @defaultValue={{this.boxelExpandableBannerBackgroundColor.defaults}}
          @value={{this.boxelExpandableBannerBackgroundColor.value}}
          @onInput={{this.boxelExpandableBannerBackgroundColor.update}}
        />
        <Css.Basic
          @name="boxel-expandable-banner-vertical-gap"
          @type="dimension"
          @defaultValue={{this.boxelExpandableBannerVerticalGap.defaults}}
          @value={{this.boxelExpandableBannerVerticalGap.value}}
          @onInput={{this.boxelExpandableBannerVerticalGap.update}}
        />
        <Css.Basic
          @name="boxel-expandable-banner-horizontal-gap"
          @type="dimension"
          @defaultValue={{this.boxelExpandableBannerHorizontalGap.defaults}}
          @value={{this.boxelExpandableBannerHorizontalGap.value}}
          @onInput={{this.boxelExpandableBannerHorizontalGap.update}}
        />
      </:cssVars>
    </FreestyleUsage>    
  </template>
}

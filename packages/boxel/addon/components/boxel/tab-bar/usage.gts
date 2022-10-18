import Component from '@glimmer/component';
import { action } from '@ember/object';
import { tracked } from '@glimmer/tracking';
import FreestyleUsage from 'ember-freestyle/components/freestyle/usage';
import BoxelTabBar from './index';
//@ts-expect-error glint does not think this is consumed-but it is consumed in the template https://github.com/typed-ember/glint/issues/374
import { fn, array, hash } from '@ember/helper';
import menuItem from '@cardstack/boxel/helpers/menu-item';
import link from 'ember-link/helpers/link';
import cssVar from '@cardstack/boxel/helpers/css-var';
import { cssVariable, CSSVariableInfo } from 'ember-freestyle/decorators/css-variable';

export default class TabBarUsage extends Component {
  cssClassName = 'boxel-tab-bar';
  @cssVariable declare boxelTabBarBackgroundColor: CSSVariableInfo;
  @cssVariable declare boxelTabBarBorderBottom: CSSVariableInfo;
  @cssVariable declare boxelTabBarColorActive: CSSVariableInfo;
  @cssVariable declare boxelTabBarFont: CSSVariableInfo;
  @cssVariable declare boxelTabBarFontWeightHover: CSSVariableInfo;

  @tracked spread = false;

  @action log(message: string): void {
    // eslint-disable-next-line no-console
    console.log(message);
  }

  <template>
    <FreestyleUsage @name="TabBar">
      <:description>
        The container has <code>role='tablist'</code>.
        The generated links have <code>role='tab'</code> and <code>id=[routeName]</code>,
        so the corresponding <code>role="tabpanel"</code> element can have <code>aria-labelledby=[routeName]</code>.
      </:description>
      <:example>
        <BoxelTabBar
          @items={{array
            (menuItem
              "Home"
              (link route="index")
            )
            (menuItem
              "Docs"
              (link route="docs" query=(hash s="Components" ss="<Boxel::TabBar>"))
            )
            (menuItem
              "About"
              (link route="about")
              inactive=true
            )
          }}
          @spread={{this.spread}}
          style={{cssVar
            boxel-tab-bar-background-color=this.boxelTabBarBackgroundColor.value
            boxel-tab-bar-border-bottom=this.boxelTabBarBorderBottom.value
            boxel-tab-bar-color-active=this.boxelTabBarColorActive.value
            boxel-tab-bar-font=this.boxelTabBarFont.value
            boxel-tab-bar-font-weight-hover=this.boxelTabBarFontWeightHover.value
          }}
        />
      </:example>
      <:api as |Args|>
        <Args.Object
          @name="items"
          @description="An array of link MenuItems, created using the 'menu-item' helper. The menu-item helper accepts the menu item text as its first argument, and a link (as created using ember-link) as the second argument."
        />
        <Args.Bool
          @name="spread"
          @optional={{true}}
          @description="Should the items spread across the width of the container?"
          @onInput={{fn (mut this.spread)}}
          @value={{this.spread}}
        />
      </:api>
      <:cssVars as |Css|>
        <Css.Basic
          @name="boxel-tab-bar-background-color"
          @type="color"
          @defaultValue={{this.boxelTabBarBackgroundColor.defaults}}
          @value={{this.boxelTabBarBackgroundColor.value}}
          @onInput={{this.boxelTabBarBackgroundColor.update}}
        />
        <Css.Basic
          @name="boxel-tab-bar-color-active"
          @type="color"
          @defaultValue={{this.boxelTabBarColorActive.defaults}}
          @value={{this.boxelTabBarColorActive.value}}
          @onInput={{this.boxelTabBarColorActive.update}}
        />
        <Css.Basic
          @name="boxel-tab-bar-border-bottom"
          @type="border"
          @defaultValue={{this.boxelTabBarBorderBottom.defaults}}
          @value={{this.boxelTabBarBorderBottom.value}}
          @onInput={{this.boxelTabBarBorderBottom.update}}
        />
        <Css.Basic
          @name="boxel-tab-bar-font"
          @type="font"
          @defaultValue={{this.boxelTabBarFont.defaults}}
          @value={{this.boxelTabBarFont.value}}
          @onInput={{this.boxelTabBarFont.update}}
        />
        <Css.Basic
          @name="boxel-tab-bar-font-weight-hover"
          @type="font-weight"
          @defaultValue={{this.boxelTabBarFontWeightHover.defaults}}
          @value={{this.boxelTabBarFontWeightHover.value}}
          @onInput={{this.boxelTabBarFontWeightHover.update}}
        />
      </:cssVars>
    </FreestyleUsage>

    <FreestyleUsage @name="TabBar with ids and icons">
      <:description>
        The <code>id</code> for the generated link can be overridden to ensure uniqueness.
      </:description>
      <:example>
        <BoxelTabBar
          @items={{array
            (menuItem "Home" (link route="index") icon="gear" id="home2")
            (menuItem "Docs" (link route="docs" query=(hash s="Components" ss="<Boxel::TabBar>")) icon="clock" id="demo2")
            (menuItem "About" (link route="about") icon="library" inactive=true id="about2")
          }}
          @spread={{true}}
        />
      </:example>
    </FreestyleUsage>

  </template>
}

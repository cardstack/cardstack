import '@glint/environment-ember-loose';
import '@cardstack/boxel/glint';

// prettier-ignore
import { ComponentLike, HelperLike } from '@glint/template';
import AndHelper from 'ember-truth-helpers/helpers/and';
import EqHelper from 'ember-truth-helpers/helpers/eq';
import OrHelper from 'ember-truth-helpers/helpers/or';
import NotHelper from 'ember-truth-helpers/helpers/not';
import GtHelper from 'ember-truth-helpers/helpers/gt';
import type cn from '@cardstack/boxel/helpers/cn';
import type cssUrl from '@cardstack/boxel/helpers/css-url';
import type cssVar from '@cardstack/boxel/helpers/css-var';
import type onClickOutside from '@cardstack/web-client/modifiers/on-click-outside';
import { type svgJar } from '@cardstack/boxel/utils/svg-jar';
import type toggle from 'ember-composable-helpers/helpers/toggle';
// import type BoxelActionChin from '@cardstack/boxel/components/boxel/action-chin';
// import type BoxelButton from '@cardstack/boxel/components/boxel/button';
// import type BoxelCardContainer from '@cardstack/boxel/components/boxel/card-container';
// import type BoxelDashboard from '@cardstack/boxel/components/boxel/dashboard';
// import type BoxelLeftEdgeNav from '@cardstack/boxel/components/boxel/left-edge-nav';
// import type BoxelModal from '@cardstack/boxel/components/boxel/modal';
// import type BoxelOrgHeader from '@cardstack/boxel/components/boxel/org-header';
// import type BoxelOrgTitle from '@cardstack/boxel/components/boxel/org-title';
// import type BoxelOrgSwitcher from '@cardstack/boxel/components/boxel/org-switcher';
// import type BoxelProgressIcon from '@cardstack/boxel/components/boxel/progress-icon';

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    and: typeof AndHelper;
    eq: typeof EqHelper;
    or: typeof OrHelper;
    not: typeof NotHelper;
    gt: typeof GtHelper;
    cn: typeof cn;
    'css-url': typeof cssUrl;
    'css-var': typeof cssVar;
    'on-click-outside': typeof onClickOutside;
    'page-title': HelperLike<{
      Args: { Positional: [title: string] };
      Return: void;
    }>;
    'svg-jar': typeof svgJar;
    toggle: typeof toggle;

    ToElsewhere: ComponentLike<{
      Args: {
        named: string;
        send: ComponentLike;
      };
    }>;

    // TODO: why doesn't import of '@cardstack/boxel/glint' take care of this for us?
    // 'Boxel::ActionChin': typeof BoxelActionChin;
    // 'Boxel::Button': typeof BoxelButton;
    // 'Boxel::CardContainer': typeof BoxelCardContainer;
    // 'Boxel::Dashboard': typeof BoxelDashboard;
    // 'Boxel::LeftEdgeNav': typeof BoxelLeftEdgeNav;
    // 'Boxel::Modal': typeof BoxelModal;
    // 'Boxel::OrgHeader': typeof BoxelOrgHeader;
    // 'Boxel::OrgTitle': typeof BoxelOrgTitle;
    // 'Boxel::OrgSwitcher': typeof BoxelOrgSwitcher;
    // 'Boxel::ProgressIcon': typeof BoxelProgressIcon;
  }
}

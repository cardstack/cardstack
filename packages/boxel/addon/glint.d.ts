import '@glint/environment-ember-loose';

import type BoxelButton from '@cardstack/boxel/components/boxel/button';
import type BoxelActionChin from '@cardstack/boxel/components/boxel/action-chin';
import type BoxelCardContainer from '@cardstack/boxel/components/boxel/card-container';
import type BoxelDashboard from '@cardstack/boxel/components/boxel/dashboard';
import type BoxelLeftEdgeNav from '@cardstack/boxel/components/boxel/left-edge-nav';
import type BoxelModal from '@cardstack/boxel/components/boxel/modal';
import type BoxelOrgHeader from '@cardstack/boxel/components/boxel/org-header';
import type BoxelOrgTitle from '@cardstack/boxel/components/boxel/org-title';
import type BoxelOrgSwitcher from '@cardstack/boxel/components/boxel/org-switcher';
import type BoxelProgressIcon from '@cardstack/boxel/components/boxel/progress-icon';

declare module '@glint/environment-ember-loose/registry' {
  export default interface Registry {
    'Boxel::ActionChin': typeof BoxelActionChin;
    'Boxel::Button': typeof BoxelButton;
    'Boxel::CardContainer': typeof BoxelCardContainer;
    'Boxel::Dashboard': typeof BoxelDashboard;
    'Boxel::LeftEdgeNav': typeof BoxelLeftEdgeNav;
    'Boxel::Modal': typeof BoxelModal;
    'Boxel::OrgHeader': typeof BoxelOrgHeader;
    'Boxel::OrgTitle': typeof BoxelOrgTitle;
    'Boxel::OrgSwitcher': typeof BoxelOrgSwitcher;
    'Boxel::ProgressIcon': typeof BoxelProgressIcon;
  }
}

import { inject as service } from '@ember/service';
import Component from '@glimmer/component';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { tracked } from '@glimmer/tracking';
import { MerchantSafe } from '@cardstack/cardpay-sdk';
import { action } from '@ember/object';
import { MerchantInfo } from '@cardstack/web-client/resources/merchant-info';
import { useResource } from 'ember-resources';

class CreateSpaceWorkflowSelectBusiness extends Component<WorkflowCardComponentArgs> {
  @service declare layer2Network: Layer2Network;
  @tracked merchantSafes: MerchantSafe[] | null = null;
  @tracked selectedSafe: MerchantSafe | null = null;

  get merchantData() {
    if (this.selectedSafe) {
      return useResource(this, MerchantInfo, () => ({
        infoDID: this.selectedSafe!.infoDID,
      }));
    } else {
      return null;
    }
  }

  @action async setupBusinessAccountSelection() {
    await this.layer2Network.waitForAccount;

    let merchantSafes = this.layer2Network.safes.value.filterBy(
      'type',
      'merchant'
    ) as MerchantSafe[];

    this.merchantSafes = merchantSafes;

    if (merchantSafes.length > 0) {
      let merchantAddress = this.args.workflowSession.getValue(
        'merchantSafeAddress'
      );

      if (merchantAddress) {
        let safe = merchantSafes.findBy('address', merchantAddress);
        if (safe) {
          this.selectedSafe = safe;
        } else {
          this.selectedSafe = merchantSafes[0];
        }
      } else {
        this.selectedSafe = merchantSafes[0];
      }
    }
  }

  @action chooseSafe(safe: MerchantSafe) {
    this.selectedSafe = safe;
    this.args.workflowSession.setValue(
      'merchantSafeAddress',
      this.selectedSafe!.address
    );
  }
}

export default CreateSpaceWorkflowSelectBusiness;

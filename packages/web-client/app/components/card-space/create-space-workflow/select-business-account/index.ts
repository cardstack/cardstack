import { inject as service } from '@ember/service';
import Component from '@glimmer/component';
import { WorkflowCardComponentArgs } from '@cardstack/web-client/models/workflow';
import Layer2Network from '@cardstack/web-client/services/layer2-network';
import { tracked } from '@glimmer/tracking';
import { MerchantSafe } from '@cardstack/cardpay-sdk';
import { action } from '@ember/object';
import { MerchantInfo } from '@cardstack/web-client/resources/merchant-info';
import { useResource } from 'ember-resources';
import MerchantInfoService from '@cardstack/web-client/services/merchant-info';
import { taskFor } from 'ember-concurrency-ts';

class CreateSpaceWorkflowSelectBusiness extends Component<WorkflowCardComponentArgs> {
  @service declare layer2Network: Layer2Network;
  @tracked merchantSafes: MerchantSafe[] | null = null;
  @tracked selectedSafe: MerchantSafe | null = null;
  @service declare merchantInfo: MerchantInfoService;

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

    let safes = this.layer2Network.safes.value;

    let availableMerchantInfosDIDs = (
      await taskFor(
        this.merchantInfo.fetchMerchantInfosAvailableForCardSpace
      ).perform()
    ).mapBy('did');

    let merchantSafes = safes.filter((safe) => {
      return (
        safe.type == 'merchant' &&
        availableMerchantInfosDIDs.includes(safe.infoDID)
      );
    }) as MerchantSafe[];

    this.merchantSafes = merchantSafes;

    let safeToSelect;

    if (merchantSafes.length > 0) {
      let merchantAddress = this.args.workflowSession.getValue(
        'merchantSafeAddress'
      );

      if (merchantAddress) {
        let safe = merchantSafes.findBy('address', merchantAddress);
        if (safe) {
          safeToSelect = safe;
        } else {
          safeToSelect = merchantSafes[0];
        }
      } else {
        safeToSelect = merchantSafes[0];
      }
    }

    if (safeToSelect) {
      this.chooseSafe(safeToSelect);
    }
  }

  @action chooseSafe(safe: MerchantSafe) {
    this.selectedSafe = safe;
    this.args.workflowSession.setValue(
      'merchantSafeAddress',
      this.selectedSafe!.address
    );

    this.args.workflowSession.setValue('merchantInfoDID', safe.infoDID);
  }
}

export default CreateSpaceWorkflowSelectBusiness;

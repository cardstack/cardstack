import { Resource } from 'ember-resources';
// eslint-disable-next-line no-restricted-imports
import {
  Safe,
  PrepaidCardSafe,
  MerchantSafe,
  DepotSafe,
} from '@cardstack/cardpay-sdk/sdk/safes';
import { taskFor, TaskFunction } from 'ember-concurrency-ts';
import { reads } from 'macro-decorators';
import { tracked } from '@glimmer/tracking';
import BN from 'bn.js';
import { ViewSafesResult } from '@cardstack/cardpay-sdk/sdk/safes/base';
import { faceValueOptions } from '@cardstack/web-client/components/card-pay/issue-prepaid-card-workflow';
import {
  BridgedTokenSymbol,
  ConvertibleSymbol,
  getBridgedSymbol,
  BridgeableSymbol,
} from '@cardstack/web-client/utils/token';

export interface SafesResourceStrategy {
  viewSafesTask: TaskFunction;
  convertFromSpend(symbol: ConvertibleSymbol, amount: number): Promise<string>;
  getLatestSafe(address: string): Promise<Safe>;
  getBlockHeight(): Promise<BN>;
}

interface Args {
  named: {
    strategy: SafesResourceStrategy;
    walletAddress: string;
  };
}

interface IndividualSafeState {
  safe: Safe;
  blockNumber: number;
}

abstract class TrackedSafe {
  @tracked address!: Safe['address'];
  @tracked createdAt!: Safe['createdAt'];
  @tracked tokens!: Safe['tokens'];
  @tracked owners!: Safe['owners'];

  update(safe: Safe) {
    this.tokens = safe.tokens;
    this.owners = safe.owners;
    this.address = safe.address;
    this.createdAt = safe.createdAt;
  }

  toJSON() {
    throw new Error('Tracked safes do not support conversion to JSON');
  }
}

// https://stackoverflow.com/questions/57324324/how-to-prevent-requiredt-in-typescript-from-removing-undefined-from-the-ty
type RequiredKeepUndefined<T> = { [K in keyof T]-?: [T[K]] } extends infer U
  ? U extends Record<keyof U, [any]>
    ? { [K in keyof U]: U[K][0] }
    : never
  : never;

export class TrackedPrepaidCardSafe
  extends TrackedSafe
  implements RequiredKeepUndefined<PrepaidCardSafe>
{
  type = 'prepaid-card' as PrepaidCardSafe['type'];
  @tracked issuingToken!: PrepaidCardSafe['issuingToken'];
  @tracked spendFaceValue!: PrepaidCardSafe['spendFaceValue'];
  @tracked prepaidCardOwner!: PrepaidCardSafe['prepaidCardOwner'];
  @tracked hasBeenUsed!: PrepaidCardSafe['hasBeenUsed'];
  @tracked issuer!: PrepaidCardSafe['issuer'];
  @tracked reloadable!: PrepaidCardSafe['reloadable'];
  @tracked transferrable!: PrepaidCardSafe['transferrable'];
  @tracked customizationDID: PrepaidCardSafe['customizationDID'];

  constructor(safe: PrepaidCardSafe) {
    super();
    this.update(safe);
  }

  update(safe: PrepaidCardSafe) {
    super.update(safe);
    this.issuingToken = safe.issuingToken;
    this.spendFaceValue = safe.spendFaceValue;
    this.prepaidCardOwner = safe.prepaidCardOwner;
    this.hasBeenUsed = safe.hasBeenUsed;
    this.issuer = safe.issuer;
    this.reloadable = safe.reloadable;
    this.transferrable = safe.transferrable;
    this.customizationDID = safe.customizationDID;
  }
}

export class TrackedMerchantSafe
  extends TrackedSafe
  implements RequiredKeepUndefined<MerchantSafe>
{
  type = 'merchant' as MerchantSafe['type'];
  @tracked accumulatedSpendValue!: MerchantSafe['accumulatedSpendValue'];
  @tracked merchant!: MerchantSafe['merchant'];
  @tracked infoDID: MerchantSafe['infoDID'];

  constructor(safe: MerchantSafe) {
    super();
    this.update(safe);
  }

  update(safe: MerchantSafe) {
    super.update(safe);
    this.accumulatedSpendValue = safe.accumulatedSpendValue;
    this.merchant = safe.merchant;
    this.infoDID = safe.infoDID;
  }
}

export class TrackedDepotSafe
  extends TrackedSafe
  implements RequiredKeepUndefined<DepotSafe>
{
  type = 'depot' as DepotSafe['type'];
  @tracked infoDID: DepotSafe['infoDID'];

  constructor(safe: DepotSafe) {
    super();
    this.update(safe);
  }

  update(safe: DepotSafe) {
    super.update(safe);
    this.infoDID = safe.infoDID;
  }
}

export class Safes extends Resource<Args> {
  @reads('args.named.strategy.viewSafesTask')
  declare viewSafesTask: TaskFunction;
  @reads('viewSafesTask.isRunning') declare isLoading: boolean;
  graphData: ViewSafesResult = {
    safes: [],
    blockNumber: 0,
  };
  individualSafeUpdateData: Record<string, IndividualSafeState> = {};
  @tracked safeReferences: Record<string, Safe> = {};
  @tracked value: Safe[] = [];
  @tracked issuePrepaidCardDaiMinValue: BN | undefined;

  constructor(owner: unknown, args: Args) {
    super(owner, args);
    this.fetch();
    this.fetchIssuePrepaidCardDaiMinValue();
  }

  updateReferences(safes: Safe[]) {
    // FIXME maybe this should never happen? but it is in tests… need mock graph responses?
    if (!safes) {
      return;
    }

    // create stuff
    for (let safe of safes) {
      if (!this.safeReferences[safe.address]) {
        if (safe.type === 'depot') {
          this.safeReferences[safe.address] = new TrackedDepotSafe(safe);
        } else if (safe.type === 'prepaid-card') {
          this.safeReferences[safe.address] = new TrackedPrepaidCardSafe(safe);
        } else if (safe.type === 'merchant') {
          this.safeReferences[safe.address] = new TrackedMerchantSafe(safe);
        } else {
          this.safeReferences[safe.address] = safe;
        }
      }
    }

    const isTrackedPrepaidCardSafe = (
      something: any
    ): something is TrackedPrepaidCardSafe => {
      return something instanceof TrackedPrepaidCardSafe;
    };
    const isTrackedDepotSafe = (
      something: any
    ): something is TrackedDepotSafe => {
      return something instanceof TrackedDepotSafe;
    };
    const isTrackedMerchantSafe = (
      something: any
    ): something is TrackedMerchantSafe => {
      return something instanceof TrackedMerchantSafe;
    };

    let safesWithLatestValues = [];
    for (let address in this.safeReferences) {
      let graphDataSafe = this.graphDataByAddress[address];
      let individualUpdate = this.individualSafeUpdateData[address];
      let selectedSafe: Safe;
      if (graphDataSafe && individualUpdate) {
        selectedSafe =
          individualUpdate.blockNumber > this.graphData.blockNumber
            ? individualUpdate.safe
            : graphDataSafe;
      } else {
        selectedSafe = graphDataSafe ?? individualUpdate.safe;
      }

      if (isTrackedPrepaidCardSafe(this.safeReferences[address])) {
        (this.safeReferences[address] as TrackedPrepaidCardSafe).update(
          selectedSafe as PrepaidCardSafe
        );
      } else if (isTrackedDepotSafe(this.safeReferences[address])) {
        (this.safeReferences[address] as TrackedDepotSafe).update(
          selectedSafe as DepotSafe
        );
      } else if (isTrackedMerchantSafe(this.safeReferences[address])) {
        (this.safeReferences[address] as TrackedMerchantSafe).update(
          selectedSafe as MerchantSafe
        );
      } else {
        this.safeReferences[address] = selectedSafe;
      }

      safesWithLatestValues.push(this.safeReferences[address]);
    }

    safesWithLatestValues.sort(
      (safe1, safe2) => safe2.createdAt - safe1.createdAt
    );

    this.value = safesWithLatestValues;
  }

  async fetch() {
    this.graphData = await taskFor(this.viewSafesTask).perform(
      this.args.named.walletAddress
    );

    this.updateReferences(this.graphData.safes);
  }

  async fetchIssuePrepaidCardDaiMinValue() {
    let spendMinValue = Math.min(...faceValueOptions);
    let daiMinValue = await this.args.named.strategy.convertFromSpend(
      'DAI',
      spendMinValue
    );

    this.issuePrepaidCardDaiMinValue = new BN(daiMinValue);
  }

  get issuePrepaidCardSourceSafes() {
    if (!this.issuePrepaidCardDaiMinValue) {
      return [];
    }

    let tokenOptions = ['DAI.CPXD' as BridgedTokenSymbol];
    let minimumFaceValue = new BN(this.issuePrepaidCardDaiMinValue);
    let compatibleSafeTypes = ['depot', 'merchant'];
    let compatibleSafes = this.value.filter((safe) =>
      compatibleSafeTypes.includes(safe.type)
    );
    return compatibleSafes.filter((safe) => {
      let compatibleTokens = safe.tokens.filter((token) =>
        tokenOptions.includes(
          getBridgedSymbol(token.token.symbol as BridgeableSymbol)
        )
      );

      return compatibleTokens.any((token) =>
        minimumFaceValue.lte(new BN(token.balance))
      );
    });
  }

  async updateOne(address: string) {
    let blockNumber = (
      await this.args.named.strategy.getBlockHeight()
    ).toNumber();
    let safe = await this.args.named.strategy.getLatestSafe(address);

    if (!safe) {
      throw new Error(`There is no safe for address: ${address}`);
    }

    this.individualSafeUpdateData[address] = {
      safe,
      blockNumber,
    };

    this.updateReferences([safe]);

    return safe;
  }

  async updateDepot(): Promise<DepotSafe | void> {
    if (this.depot)
      return this.updateOne(this.depot.address) as Promise<DepotSafe>;
  }

  clear() {
    this.graphData = {
      safes: [],
      blockNumber: 0,
    };
    this.individualSafeUpdateData = {};
    this.safeReferences = {};
    this.value = [];
  }

  getByAddress(address: string): Safe | undefined {
    return this.safeReferences[address];
  }

  get graphDataByAddress() {
    const res: Record<string, Safe> = {};

    for (let safe of this.graphData.safes) {
      res[safe.address] = safe;
    }

    return res;
  }

  get depot() {
    return this.value.find((safe) => safe.type === 'depot');
  }
}

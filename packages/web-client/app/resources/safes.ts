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

export interface SafesResourceStrategy {
  viewSafesTask: TaskFunction;
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
  @tracked address!: PrepaidCardSafe['address'];
  @tracked createdAt!: PrepaidCardSafe['createdAt'];
  @tracked tokens!: PrepaidCardSafe['tokens'];
  @tracked owners!: PrepaidCardSafe['owners'];
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
    this.address = safe.address;
    this.createdAt = safe.createdAt;
    this.tokens = safe.tokens;
    this.owners = safe.owners;
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
  @tracked address!: MerchantSafe['address'];
  @tracked createdAt!: MerchantSafe['createdAt'];
  @tracked tokens!: MerchantSafe['tokens'];
  @tracked owners!: MerchantSafe['owners'];
  @tracked accumulatedSpendValue!: MerchantSafe['accumulatedSpendValue'];
  @tracked merchant!: MerchantSafe['merchant'];
  @tracked infoDID: MerchantSafe['infoDID'];

  constructor(safe: MerchantSafe) {
    super();
    this.update(safe);
  }

  update(safe: MerchantSafe) {
    this.address = safe.address;
    this.createdAt = safe.createdAt;
    this.tokens = safe.tokens;
    this.owners = safe.owners;
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
  @tracked address!: DepotSafe['address'];
  @tracked createdAt!: DepotSafe['createdAt'];
  @tracked tokens!: DepotSafe['tokens'];
  @tracked owners!: DepotSafe['owners'];
  @tracked infoDID: DepotSafe['infoDID'];

  constructor(safe: DepotSafe) {
    super();
    this.update(safe);
  }

  update(safe: DepotSafe) {
    this.address = safe.address;
    this.createdAt = safe.createdAt;
    this.tokens = safe.tokens;
    this.owners = safe.owners;
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

  constructor(owner: unknown, args: Args) {
    super(owner, args);
    this.fetch();
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
    return this.value.find((s) => s.address === address);
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

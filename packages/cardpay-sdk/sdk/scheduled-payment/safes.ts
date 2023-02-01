import { convertChainIdToName } from '../network-config-utils';
import { query } from '../utils/graphql';

const safesQuery = `
  query($account: ID!) {
    account(id: $account) {
      safes {
        safe {
          id
          spModule
        }
      }
    }
  }
`;

const spModuleAddressBySafeAddressQuery = 'query($safe: ID!) {safe(id: $safe) {id spModule}}';

interface Safe {
  address: string;
  spModuleAddress: string;
}

export async function getSafesWithSpModuleEnabled(chainId: number, accountAddress: string): Promise<Safe[]> {
  let networkName = convertChainIdToName(chainId);
  let result = await query(networkName, safesQuery, { account: accountAddress });

  if (!result.data.account) return [];

  return result.data.account.safes.map((safeData: any) => {
    let safe = safeData.safe;
    return { address: safe.id, spModuleAddress: safe.spModule };
  });
}

export async function getSpModuleAddressBySafeAddress(
  chainId: number,
  safeAddress: string
): Promise<string | undefined> {
  let networkName = convertChainIdToName(chainId);
  let result = await query(networkName, spModuleAddressBySafeAddressQuery, { safe: safeAddress });

  if (!result.data.safe) return undefined;
  return result.data.safe.spModule;
}

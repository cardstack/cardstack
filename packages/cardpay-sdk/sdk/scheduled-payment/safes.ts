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

interface Safe {
  address: string;
  spModuleAddress: string;
}

export async function getSafesWithSpModuleEnabled(network: string, accountAddress: string): Promise<Safe[]> {
  let result = await query(network, safesQuery, { account: accountAddress });

  if (!result.data.account) return [];

  return result.data.account.safes.map((safeData: any) => {
    let safe = safeData.safe;
    return { address: safe.id, spModuleAddress: safe.spModule };
  });
}

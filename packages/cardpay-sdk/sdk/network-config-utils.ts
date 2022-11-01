import { ethereumNetworks, gnosisNetworks, networkIds, polygonNetworks } from './constants';
import { HubConfigResponse } from './hub-config';

export const getConfigByNetwork = (config: HubConfigResponse, network: string | number) => {
  const networkName = (typeof network === 'number' ? networkIds[network] : network) as string;

  if (ethereumNetworks.includes(networkName)) return config.web3.ethereum;
  if (gnosisNetworks.includes(networkName)) return config.web3.gnosis;
  if (polygonNetworks.includes(networkName)) return config.web3.polygon;

  return { rpcNodeWssUrl: '', rpcNodeHttpsUrl: '' };
};

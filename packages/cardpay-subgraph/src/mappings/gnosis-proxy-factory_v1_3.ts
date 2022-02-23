import { ProxyCreation } from '../../generated/Gnosis_v1_3/GnosisProxyFactory_v1_3';
import { processGnosisProxyEvent } from './gnosis-proxy-factory';

export function handleProxyCreation(event: ProxyCreation): void {
  processGnosisProxyEvent(event.params.proxy, event, '1.3');
}

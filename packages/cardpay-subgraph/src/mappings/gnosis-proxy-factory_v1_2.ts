import { ProxyCreation } from '../../generated/Gnosis_v1_2/GnosisProxyFactory_v1_2';
import { processGnosisProxyEvent } from './gnosis-proxy-factory';

export function handleProxyCreation(event: ProxyCreation): void {
  processGnosisProxyEvent(event.params.proxy, event, '1.2');
}

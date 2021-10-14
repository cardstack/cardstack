import { ComponentInfo, RawCard, CompiledCard } from '@cardstack/core/src/interfaces';
import type { CardJSONResponse } from '@cardstack/core/src/interfaces';
export declare function serializeCard(url: string, data: RawCard['data'], component: ComponentInfo): Promise<CardJSONResponse>;
export declare function deserialize(payload: any): any;
export declare function serializeRawCard(card: RawCard, compiled?: CompiledCard): Promise<object>;

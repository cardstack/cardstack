export { RawCardDeserializer } from './raw-card-deserializer';
export { RawCardSerializer } from './raw-card-serializer';

export function findIncluded(doc: any, ref: { type: string; id: string }) {
  return doc.included?.find((r: any) => r.id === ref.id && r.type === ref.type);
}

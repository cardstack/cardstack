export interface Realm {
  origin: string;
  id: string;
}

export const CARDSTACK_PUBLIC_REALM: Realm = { origin: 'https://base.cardstack.com', id: 'public' };

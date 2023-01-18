import { TokenDetail } from '@cardstack/cardpay-sdk';
import { helper } from '@ember/component/helper';

type PostionalArgs = [TokenDetail[] | undefined];

interface Signature {
  Args: {
    Positional: PostionalArgs;
  };
  Return: TokenDetail[];
}

const SYMBOLS_TO_ICONS: Record<string, string> = {
  CARD: 'card-token',
  'CARD.CPXD': 'card-cpxd-token',
  DAI: 'dai-token',
  'DAI.CPXD': 'dai-cpxd-token',
  WETH: 'eth',
  WMATIC: 'matic',
};

export function withTokenIcons([tokenDetails]: PostionalArgs) {
  if (!tokenDetails) {
    return [];
  }
  const result = tokenDetails.map((tokenDetail) => {
    return {
      ...tokenDetail,
      icon: SYMBOLS_TO_ICONS[tokenDetail.symbol] || '',
    };
  });
  return result;
}

export default helper<Signature>(withTokenIcons);

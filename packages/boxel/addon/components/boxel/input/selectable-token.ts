// Note: The cardpay-sdk package as an equivalent TokenDetail type that is usually a more expressive
//  choice when used in a package that has a dependency on the SDK.
export interface SelectableToken {
  name: string;
  symbol: string;
  address: string;
  decimals: number;
  logoURI?: string;
}

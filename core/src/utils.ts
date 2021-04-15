const SPECIAL_CHAR_REPLACEMENT = '-';

export function encodeCardURL(url: string): string {
  return url
    .replace('://', SPECIAL_CHAR_REPLACEMENT)
    .replace(/([;,/?:@&=+$])/g, SPECIAL_CHAR_REPLACEMENT);
}

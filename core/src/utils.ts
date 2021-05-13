const SPECIAL_CHAR_REPLACEMENT = '-';

export function encodeCardURL(url: string): string {
  return url
    .replace(/\/$/, '') // No need for trailing slashes
    .replace('://', SPECIAL_CHAR_REPLACEMENT)
    .replace(/([;,/?:@&=+$])/g, SPECIAL_CHAR_REPLACEMENT);
}

export function getBasenameAndExtension(
  filename: string
): { basename: string; extension: string } {
  let extensionMatch = filename.match(/\.[^/.]+$/);
  let extension = extensionMatch ? extensionMatch[0] : '';
  let basename = filename.replace(extension, '');

  return { basename, extension };
}

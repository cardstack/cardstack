import { Format, isFormat } from '@cardstack/core/src/interfaces';

const DEFAULT_FORMAT = 'isolated';

export function getCardFormatFromRequest(formatQueryParam?: string | string[]): Format {
  if (!formatQueryParam) {
    return DEFAULT_FORMAT;
  }

  let format;
  if (Array.isArray(formatQueryParam)) {
    format = formatQueryParam[0];
  } else {
    format = formatQueryParam;
  }

  if (format) {
    if (isFormat(format)) {
      return format;
    } else {
      throw new Error(`${format} is not a valid format`);
    }
  } else {
    return DEFAULT_FORMAT;
  }
}

import { timeout } from 'ember-concurrency';
import config from '@cardstack/ssr-web/config/environment';

const FIRST_RETRY_DELAY = config.environment === 'test' ? 100 : 1000;
class Storage404 extends Error {}

export function isStorage404(e: Error): e is Storage404 {
  return e instanceof Storage404;
}

/**
 * Fetches resources stored in off-chain (S3) storage.
 *
 * @param resource The URL for the desired resource
 * @param shouldRetry Whether to retry if fetching fails
 * @returns The resource stored in off-chain storage
 */
export async function fetchOffChainJson(
  resource: string,
  shouldRetry: boolean
): Promise<any> {
  let maxAttempts = shouldRetry ? 10 : 1;
  let attemptNum = 1;
  while (attemptNum <= maxAttempts) {
    try {
      let jsonApiResponse = await fetch(resource);
      if (!jsonApiResponse.ok) {
        if (jsonApiResponse.status === 403) {
          throw new Storage404();
        } else {
          let errorBodyText = await jsonApiResponse.text();
          throw new Error(errorBodyText);
        }
      }
      let jsonApiDocument = await jsonApiResponse.json();
      return jsonApiDocument;
    } catch (err) {
      if (attemptNum === maxAttempts) {
        throw err;
      }
      attemptNum++;
      await timeout(FIRST_RETRY_DELAY * attemptNum);
    }
  }
}

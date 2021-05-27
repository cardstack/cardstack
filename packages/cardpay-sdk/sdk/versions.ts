import { satisfies } from 'semver';
interface APIVersionMap<T> {
  [version: string]: T;
}
export function getAPIVersion<T>(apiVersionMap: APIVersionMap<T>, protocolVersion: string): T {
  let availableApiVersions = Object.keys(apiVersionMap).sort().reverse();
  let satisfyingApiVersion: string | undefined;
  for (let possibleApiVersion of availableApiVersions) {
    // we'll use the ~ Tilde Range comparator which will permit patch version
    // for previous patches with the same minor, but not permit previous minors.
    // This means that we need an explicit API version for all minor versions of
    // the cardpay protocol. For patch versions, it's up to use if we want a
    // specific API version for a patch, otherwise the previous most recent
    // patch version of the API will be used. This will allow us to build API's
    // for not yet deployed contracts, where the SDK will switch to the future
    // version of the API as soon as the on-chain protocol version updates.
    // https://www.npmjs.com/package/semver
    if (satisfies(protocolVersion, `~${possibleApiVersion}`)) {
      satisfyingApiVersion = possibleApiVersion;
      break;
    }
  }

  if (!satisfyingApiVersion) {
    throw new Error(
      `Could not find a version of the API that satisfies cardpay protocol version ${protocolVersion} for PrepaidCard`
    );
  }

  return apiVersionMap[satisfyingApiVersion];
}

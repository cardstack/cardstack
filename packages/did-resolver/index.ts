import { DIDDocument, DIDResolutionOptions, DIDResolutionResult, ParsedDID, Resolver } from 'did-resolver';
import { shake_128 } from 'js-sha3';
import shortUuid from 'short-uuid';
import invert from 'lodash/invert';
import kebabCase from 'lodash/kebabCase';
import * as uuidv4 from 'uuid';

const CURRENT_VERSION = 1;

type CardstackIdentifierType = 'PrepaidCardCustomization' | 'MerchantInfo' | 'SupplierInfo';

const DID_TYPE_TO_SHORT_TYPE = {
  PrepaidCardCustomization: 'p',
  MerchantInfo: 'm',
  SupplierInfo: 's',
} as Record<CardstackIdentifierType, string>;

const SHORT_TYPE_TO_DID_TYPE = invert({ ...DID_TYPE_TO_SHORT_TYPE }) as Record<string, CardstackIdentifierType>;

export function getResolver() {
  async function resolve(
    did: string,
    parsed: ParsedDID,
    _didResolver: Resolver,
    _options: DIDResolutionOptions
  ): Promise<DIDResolutionResult> {
    let cardstackIdentifier = parseIdentifier(parsed.id);
    let path = kebabCase(cardstackIdentifier.type);
    let didDocument: DIDDocument = {
      '@context': [
        'https://www.w3.org/ns/did/v1',
        'https://identity.foundation/EcdsaSecp256k1RecoverySignature2020/lds-ecdsa-secp256k1-recovery2020-0.0.jsonld',
      ],
      id: did,
      alsoKnownAs: [`https://storage.cardstack.com/${path}/${cardstackIdentifier.uniqueId}.json`],
      verificationMethod: [],
      authentication: [],
      assertionMethod: [],
    };

    return {
      didResolutionMetadata: { contentType: 'application/did+ld+json' },
      didDocument,
      didDocumentMetadata: {},
    };
  }

  return { cardstack: resolve };
}

interface EncodeOptions {
  type: CardstackIdentifierType;
  version?: number;
  uniqueId?: string;
}

export function encodeDID(opts: EncodeOptions): string {
  return new CardstackIdentifier(
    opts.version ?? CURRENT_VERSION,
    opts.type,
    opts.uniqueId || shortUuid.generate()
  ).toDID();
}

const SHAKE_128_OUTPUT_BITS = 64;
const HASH_LENGTH = SHAKE_128_OUTPUT_BITS / 4;
const hashFunc = (data: string) => shake_128(data, SHAKE_128_OUTPUT_BITS);

class CardstackIdentifier {
  version: number;
  type: CardstackIdentifierType;
  uniqueId: string;

  constructor(version: number, type: CardstackIdentifierType, uniqueId: string) {
    this.version = version;
    this.type = type;
    this.uniqueId = normalizeUniqueId(uniqueId);
  }

  toDID() {
    let versionString = numberToVersionChar(this.version);
    let result = `${versionString}${DID_TYPE_TO_SHORT_TYPE[this.type]}${this.uniqueId}`;
    let checksum = hashFunc(result);
    return `did:cardstack:${result}${checksum}`;
  }
}

function normalizeUniqueId(candidate: string) {
  if (isFlickrBase58(candidate)) {
    return candidate;
  }
  if (uuidv4.validate(candidate)) {
    return shortUuid().fromUUID(candidate);
  }
  throw new Error(`uniqueId must be a flickrBase58 or RFC4122 v4-compliant UUID. Was: "${candidate}"`);
}

function isFlickrBase58(candidate: string) {
  let translator = shortUuid();
  return candidate.length === translator.maxLength && candidate.match(new RegExp(`^[${translator.alphabet}]+$`));
}

export function parseIdentifier(identifier: string): CardstackIdentifier {
  let data = identifier.substring(0, identifier.length - HASH_LENGTH);
  let checksum = identifier.substring(identifier.length - HASH_LENGTH, identifier.length);
  if (hashFunc(data) !== checksum) {
    throw new Error('Invalid DID identifier: checksum failed');
  }
  let version = versionFromChar(data[0]);
  let type = SHORT_TYPE_TO_DID_TYPE[data[1]];
  if (!type) {
    throw new Error(`Invalid DID identifier: unknown type "${data[1]}"`);
  }
  let uniqueId = data.substring(2);
  return new CardstackIdentifier(version, type, uniqueId);
}

const ASCII_START_ZERO = 48;
const ASCII_START_TEN = 65;
const ASCII_START_THIRTY_SIX = 97;

function numberToVersionChar(v: number): string {
  if (v >= 0 && v <= 9) {
    return String.fromCharCode(v + ASCII_START_ZERO);
  }
  if (v >= 10 && v <= 10 + 25) {
    return String.fromCharCode(v + ASCII_START_TEN - 10);
  }
  if (v >= 36 && v <= 36 + 25) {
    return String.fromCharCode(v + ASCII_START_THIRTY_SIX - 36);
  }
  throw new Error(`version out of supported range: ${v}`);
}

function versionFromChar(v: string): number {
  let charCode = v.charCodeAt(0);
  if (charCode >= ASCII_START_ZERO && charCode <= ASCII_START_ZERO + 9) {
    return charCode - ASCII_START_ZERO;
  }
  if (charCode >= ASCII_START_TEN && charCode <= ASCII_START_TEN + 25) {
    return charCode - ASCII_START_TEN + 10;
  }
  if (charCode >= ASCII_START_THIRTY_SIX && charCode <= ASCII_START_THIRTY_SIX + 25) {
    return charCode - ASCII_START_THIRTY_SIX + 36;
  }
  throw new Error(`Unsupported version character ${v}`);
}

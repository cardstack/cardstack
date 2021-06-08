# cardstack DID Resolver

This library is intended to resolve Cardstack [Decentralized Identifiers](https://w3c.github.io/did-core/) to their associated [DID Documents](https://w3c-ccg.github.io/did-spec/#did-documents).

It supports the proposed [Decentralized Identifiers](https://w3c-ccg.github.io/did-spec/) spec from
the [W3C Credentials Community Group](https://w3c-ccg.github.io).

It requires the `did-resolver` library, which is the primary interface for resolving DIDs.

## DID method

Cardstack supports a family of DIDs that begin with `did:cardstack:`

## DID Document

The DID resolver takes the DID and constructs the DID Document.


## Resolving a DID document

The resolver presents a simple `resolver()` function that returns a ES6 Promise returning the DID
document.

```js
import { Resolver } from 'did-resolver'
import { getResolver } from '@cardstack/did-resolver'

const cardstackResolver = getResolver()

const didResolver = new Resolver({
    ...cardstackResolver
    //...you can flatten multiple resolver methods into the Resolver
})

didResolver.resolve('did:cardstack:1p123456...').then(result => console.log(result.didDocument))

// You can also use async/await syntax
(async () => {
    const result = await didResolver.resolve('did:cardstack:1p123456...');
    console.log(result.didDocument);
})();
```

The resolved DIDDocument will have a `alsoKnownAs` property that is an array containing a URL to a json document with details of the resource.

## Encoding a DID

This package exports an `encodeDID` function that can be used to create a DID string.

```js
import { encodeDID } from '@cardstack/did-resolver'

let did = encodeDID({ type: 'SupplierInfo' });
console.log(did); // => 'did:cardstack:1sicq4U2Dq678AtWufbxJBg7120d206cf61b50d4'
```

By default, `encodeDID` will provide the version and generate a uniqueId for you, but you can also specify them: 

```js
import { encodeDID } from '@cardstack/did-resolver'
import shortUuid from 'short-uuid';

let did = encodeDID({ type: 'SupplierInfo', version: 5, uniqueId: shortUuid.generate() });
```

## About the cardstack method identifier format

An example of a cardstack method identifier is:

```
1sicq4U2Dq678AtWufbxJBg7120d206cf61b50d4
12[---------3----------][------4-------]
```

Let's break down the parts:

1) First character: represents the version, uses "0"-"9" for 0-9, "A-Z" for 10-35, "a-z" for 36-61

2) Second character: represents the type, 'p' for PrepaidCardCustomization, 'm' for MerchantInfo, 's' for SupplierInfo

3) Next 22 characters: unique identifier, you can generate this using `shortUuid.generate()`

4) Last 16 characters: checksum, hash of the identifier up to this point, calculated using shake_128 with 64 bits of output

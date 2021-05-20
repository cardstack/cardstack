# Authentication 

## Getting an auth token

When a app.cardstack.com dapp user initiates an action that requires Hub authentication,
the client will use a `HubAuth.authenticate` from the SDK.

This method will first initiate a `GET` request to `https://hub.cardstack.com/api/session`

(If already logged in, this endpoint returns the address you are logged in as.) _TODO_

If not logged in, returns 401 with a nonce generated from the timestamp and a server-only secret, along with a version. _Implemented_

The server will enforce that the nonce is good for 5 minutes or until used once.

[Here's the code the server uses to generate the nonce](./packages/hub/utils/authentication.ts#L37)

The SDK method will then create a typed data structure as defined by EIP-712, incorporating the nonce,
and ask the layer 2 wallet to sign it. 

It will then `POST` the structure and the signature to `https://hub.cardstack.com/api/session`

The request body will look like this:

```json
{
  "data": {
    "attributes": {
      "authData": { "EIP-712 data including user address and nonce": "..." },
      "signature": "[EIP-712 signature]",
    }
  }
}
```
[Here is the implementation of the SDK method.](./packages/cardpay-sdk/sdk/hub-auth.ts)

When the server receives the POST, it does the following:

* Server use EC recover function to verify that the signature was signed by the signer. On failure, 401 "Signature not verified" _Implemented_
* Server verifies the nonce signature. On failure, 401 "Invalid nonce". [Here's the implementation of verification](./packages/hub/utils/authentication.ts#L45) _Implemented_
* Server verifies that nonce is less than 5 minutes old. On failure, 401 "Expired nonce" _TODO_
* Server verifies that nonce is not in redis SET of recently used nonces. On failure, 401 "Nonce already used" _TODO_
* Server retires the nonce by adding it to the redis SET of used nonces (5 minute TTL on items in the set) _TODO_ 
* Server builds an authorization bearer token. [Here's the code to build the auth token](./packages/hub/utils/authentication.ts#L57) _Implemented_


## Using an auth token

The client stores the auth token in local storage and sends it to future hub API calls as an Authorization header

On those calls, the server looks for an Authorization header, decrypts the token and verifies it is not expired. If the token is not present, invalid, or expired, return 401 with a new nonce.
Otherwise, do normal operations with the verified address made available as part of the session for API routes to use.

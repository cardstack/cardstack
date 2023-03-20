# cardpay-sdk <!-- omit in toc -->
This is a package that provides an SDK to use the Cardpay protocol.

### Special Considerations <!-- omit in toc -->
 One item to note that all token amounts that are provided to the API must strings and be in native units of the token (usually `wei`) unless otherwise noted. All token amounts returned by the API will also be in native units (again, this usually means `wei`). You can use `Web3.utils.toWei()` and `Web3.utils.fromWei()` to convert to and from units of `wei`. Because ethereum numbers can be so large, it is unsafe to represent these natively in Javascript, and in fact it is very common for a smart contract to return numbers that are simply too large to be represented natively in Javascript. For this reason, within Javascript the only safe way to natively handle numbers coming from Ethereum is as a `string`. If you need to perform math on a number coming from Ethereum use the `BigNumber` feature of the ethers library.

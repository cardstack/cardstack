/* eslint @typescript-eslint/no-explicit-any: "off" */

// Here are all the global AssemblyScript types that we use. There's a bunch
// more. Add more here as necessary to suppress false positive TS errors
declare type i32 = any;
declare const assert: any;
declare const I32: any;

namespace NodeJS {
  interface Global {
    assert: any;
    I32: any;
  }
}

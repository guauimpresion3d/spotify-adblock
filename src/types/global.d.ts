// These are minimal ambient module declarations to satisfy the TypeScript compiler
// in environments where the full @types/node package is not installed. They are
// intentionally typed as `any` to avoid polluting the typings of the consumer
// application. For full type-safety install `@types/node`.

declare module 'net' {
  const net: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  export = net;
}

declare module 'http' {
  const http: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  export = http;
}

declare module 'url' {
  const url: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  export = url;
}

declare module 'path' {
  const path: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  export = path;
}

declare module 'fs' {
  const fs: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  export = fs;
}

declare module 'http-mitm-proxy' {
  const factory: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  export = factory;
}

declare module 'http-proxy' {
  const proxy: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  export = proxy;
}

declare module 'node-forge' {
  const forge: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  export = forge;
}

declare const process: any; // Node.js process global
// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const require: any;
declare const module: any;

declare namespace NodeJS {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface ErrnoException extends Error {
    code?: string | number;
    // add any other relevant fields
    [key: string]: any;
  }
}

declare const forge: any; 
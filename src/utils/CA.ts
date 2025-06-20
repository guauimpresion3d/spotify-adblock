/* eslint-disable @typescript-eslint/ban-ts-comment */
import fs from 'fs';
import path from 'path';
import forge from 'node-forge';
import mkdirp from 'mkdirp';
import async from 'async';

const { pki } = forge;

const CAattrs = [
  { name: 'commonName', value: 'https://github.com/AnanthVivekanand/spotify-adblock-macos' },
  { name: 'countryName', value: 'spotify-adblock-macos' },
  { shortName: 'ST', value: 'spotify-adblock-macos' },
  { name: 'localityName', value: 'spotify-adblock-macos' },
  { name: 'organizationName', value: 'spotify-adblock-macos' },
  { shortName: 'OU', value: 'spotify-adblock-macos' },
];

const CAextensions = [
  { name: 'basicConstraints', cA: true },
  {
    name: 'keyUsage',
    keyCertSign: true,
    digitalSignature: true,
    nonRepudiation: true,
    keyEncipherment: true,
    dataEncipherment: true,
  },
  {
    name: 'extKeyUsage',
    serverAuth: true,
    clientAuth: true,
    codeSigning: true,
    emailProtection: true,
    timeStamping: true,
  },
  {
    name: 'nsCertType',
    client: true,
    server: true,
    email: true,
    objsign: true,
    sslCA: true,
    emailCA: true,
    objCA: true,
  },
  { name: 'subjectKeyIdentifier' },
];

const ServerAttrs = [
  { name: 'countryName', value: 'spotify-adblock-macos' },
  { shortName: 'ST', value: 'spotify-adblock-macos' },
  { name: 'localityName', value: 'spotify-adblock-macos' },
  { name: 'organizationName', value: 'spotify-adblock-macos' },
  { shortName: 'OU', value: 'spotify-adblock-macos' },
];

const ServerExtensions = [
  { name: 'basicConstraints', cA: false },
  {
    name: 'keyUsage',
    keyCertSign: false,
    digitalSignature: true,
    nonRepudiation: false,
    keyEncipherment: true,
    dataEncipherment: true,
  },
  {
    name: 'extKeyUsage',
    serverAuth: true,
    clientAuth: true,
    codeSigning: false,
    emailProtection: false,
    timeStamping: false,
  },
  {
    name: 'nsCertType',
    client: true,
    server: true,
    email: false,
    objsign: false,
    sslCA: false,
    emailCA: false,
    objCA: false,
  },
  { name: 'subjectKeyIdentifier' },
];

interface AsyncCallback<T = unknown> {
  (err?: Error | null, result?: T): void;
}

export class CA {
  private baseCAFolder!: string;

  private certsFolder!: string;

  private keysFolder!: string;

  // We intentionally keep these as `any` to avoid the
  // need for full `@types/node-forge` dependency.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private CAcert!: any;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private CAkeys!: any;

  // ---------------------------------------------------------------------------
  // Lifecycle helpers
  // ---------------------------------------------------------------------------
  static create(caFolder: string, callback: AsyncCallback<CA>): void {
    const ca = new CA();
    ca.baseCAFolder = caFolder;
    ca.certsFolder = path.join(ca.baseCAFolder, 'certs');
    ca.keysFolder = path.join(ca.baseCAFolder, 'keys');

    async.series(
      [
        mkdirp.bind(null, ca.baseCAFolder),
        mkdirp.bind(null, ca.certsFolder),
        mkdirp.bind(null, ca.keysFolder),
        (cb: async.ErrorCallback<Error>) => {
          fs.exists(path.join(ca.certsFolder, 'ca.crt'), (exists) => {
            if (exists) {
              ca.loadCA(cb);
            } else {
              ca.generateCA(cb);
            }
          });
        },
      ],
      (err?: Error | null) => {
        if (err) {
          callback(err);
          return;
        }
        callback(null, ca);
      },
    );
  }

  // Generate random 16-bytes hexadecimal serial number
  private randomSerialNumber(): string {
    let sn = '';
    for (let i = 0; i < 4; i += 1) {
      sn += (`00000000${Math.floor(Math.random() * 256 ** 4).toString(16)}`).slice(-8);
    }
    return sn;
  }

  private generateCA(callback: async.ErrorCallback<Error>): void {
    pki.rsa.generateKeyPair({ bits: 2048 }, (err, keys) => {
      if (err) {
        callback(err);
        return;
      }

      const cert = pki.createCertificate();
      cert.publicKey = keys.publicKey;
      cert.serialNumber = this.randomSerialNumber();
      cert.validity.notBefore = new Date();
      cert.validity.notBefore.setDate(cert.validity.notBefore.getDate() - 1);
      cert.validity.notAfter = new Date();
      cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 10);
      cert.setSubject(CAattrs);
      cert.setIssuer(CAattrs);
      cert.setExtensions(CAextensions);
      cert.sign(keys.privateKey, forge.md.sha256.create());

      this.CAcert = cert;
      this.CAkeys = keys;

      async.parallel(
        [
          fs.writeFile.bind(null, path.join(this.certsFolder, 'ca.crt'), pki.certificateToPem(cert)),
          fs.writeFile.bind(null, path.join(this.keysFolder, 'ca.private.key'), pki.privateKeyToPem(keys.privateKey)),
          fs.writeFile.bind(null, path.join(this.keysFolder, 'ca.public.key'), pki.publicKeyToPem(keys.publicKey)),
        ],
        callback,
      );
    });
  }

  private loadCA(callback: async.ErrorCallback<Error>): void {
    async.auto(
      {
        certPEM: (cb: AsyncCallback<string>) => {
          fs.readFile(path.join(this.certsFolder, 'ca.crt'), 'utf-8', cb);
        },
        keyPrivatePEM: (cb: AsyncCallback<string>) => {
          fs.readFile(path.join(this.keysFolder, 'ca.private.key'), 'utf-8', cb);
        },
        keyPublicPEM: (cb: AsyncCallback<string>) => {
          fs.readFile(path.join(this.keysFolder, 'ca.public.key'), 'utf-8', cb);
        },
      },
      (err, results: { certPEM: string; keyPrivatePEM: string; keyPublicPEM: string }) => {
        if (err) {
          callback(err);
          return;
        }

        this.CAcert = pki.certificateFromPem(results.certPEM);
        this.CAkeys = {
          privateKey: pki.privateKeyFromPem(results.keyPrivatePEM),
          publicKey: pki.publicKeyFromPem(results.keyPublicPEM),
        } as any;

        callback();
      },
    );
  }

  // Generate certificate/key pair for the given hosts
  generateServerCertificateKeys(hosts: string[] | string, cb: (cert: string, privateKey: string) => void): void {
    const hostsArray = typeof hosts === 'string' ? [hosts] : hosts;
    const mainHost = hostsArray[0];

    const keysServer = pki.rsa.generateKeyPair(2048);
    const certServer = pki.createCertificate();
    certServer.publicKey = keysServer.publicKey;
    certServer.serialNumber = this.randomSerialNumber();
    certServer.validity.notBefore = new Date();
    certServer.validity.notBefore.setDate(certServer.validity.notBefore.getDate() - 1);
    certServer.validity.notAfter = new Date();
    certServer.validity.notAfter.setFullYear(certServer.validity.notBefore.getFullYear() + 2);

    const attrsServer = [...ServerAttrs];
    attrsServer.unshift({ name: 'commonName', value: mainHost });

    certServer.setSubject(attrsServer as any);
    certServer.setIssuer(this.CAcert.issuer.attributes);
    certServer.setExtensions(
      ServerExtensions.concat([
        {
          name: 'subjectAltName',
          altNames: hostsArray.map((host) => {
            if (/^[\\d.]+$/.test(host)) {
              return { type: 7, ip: host };
            }
            return { type: 2, value: host };
          }),
        } as any,
      ]) as any,
    );

    certServer.sign(this.CAkeys.privateKey, forge.md.sha256.create());

    const certPem = pki.certificateToPem(certServer);
    const keyPrivatePem = pki.privateKeyToPem(keysServer.privateKey);
    const keyPublicPem = pki.publicKeyToPem(keysServer.publicKey);

    fs.writeFile(path.join(this.certsFolder, `${mainHost.replace(/\*/g, '_')}.crt`), certPem, (error) => {
      if (error) console.error(`Failed to save certificate to disk in ${this.certsFolder}`, error);
    });
    fs.writeFile(path.join(this.keysFolder, `${mainHost.replace(/\*/g, '_')}.key`), keyPrivatePem, (error) => {
      if (error) console.error(`Failed to save private key to disk in ${this.keysFolder}`, error);
    });
    fs.writeFile(path.join(this.keysFolder, `${mainHost.replace(/\*/g, '_')}.public.key`), keyPublicPem, (error) => {
      if (error) console.error(`Failed to save public key to disk in ${this.keysFolder}`, error);
    });

    cb(certPem, keyPrivatePem);
  }

  getCACertPath(): string {
    return path.join(this.certsFolder, 'ca.crt');
  }
}

// Export a singleton instance compatible with the original API
// ---------------------------------------------------------------------------

let defaultCA: CA | null = null;

export function create(caFolder: string, callback: AsyncCallback<CA>): void {
  CA.create(caFolder, (err, caInstance) => {
    if (!err && caInstance) defaultCA = caInstance;
    callback(err, caInstance);
  });
}

export function generateServerCertificateKeys(hosts: string[] | string, cb: (cert: string, privateKey: string) => void): void {
  if (!defaultCA) {
    throw new Error('CA has not been initialised yet');
  }
  defaultCA.generateServerCertificateKeys(hosts, cb);
} 
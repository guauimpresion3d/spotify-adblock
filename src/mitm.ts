import Proxy from 'http-mitm-proxy';
import path from 'path';
import net from 'net';
import micromatch from 'micromatch';
import colors from 'colors';

import * as CAUtil from './utils/CA';
import whitelist from './utils/whitelist-mitm';
import blacklist from './utils/blacklist-mitm';

// -----------------------------------------------------------------------------
// Helper setup
// -----------------------------------------------------------------------------

process.on('uncaughtException', (error: Error) => {
  // Prevent the application from crashing on unexpected exceptions
  // eslint-disable-next-line no-console
  console.error(error);
});

const proxy: any = new (Proxy as any)();

proxy.onError((_ctx, err: NodeJS.ErrnoException) => {
  if (err.code === 'ERR_SSL_SSLV3_ALERT_CERTIFICATE_UNKNOWN') {
    // eslint-disable-next-line no-console
    console.log(colors.red.underline("You haven't installed the generated CA certificate"));
    process.exit(1);
  }
});

// ----------------------------------------------------------------------------
// CONNECT handling
// ----------------------------------------------------------------------------
proxy.onConnect((req, socket, _head, callback) => {
  const [host, port] = req.url.split(':');

  // spclient.wg.spotify.com needs the full MitM treatment, so always allow
  if (host === 'spclient.wg.spotify.com') {
    return callback();
  }

  // Forward whitelisted hosts or Spotify's local streaming port (4070)
  if (micromatch.isMatch(host, whitelist) || port === '4070') {
    // eslint-disable-next-line no-console
    console.log(colors.green(`Allowing: ${host}, ${port}`));

    const conn = net.connect({
      port: Number(port),
      host,
      allowHalfOpen: true,
    }, () => {
      // Proxy piping logic once the upstream connection is ready
      conn.on('close', () => conn.end());
      conn.on('finish', () => socket.destroy());

      [conn, socket].forEach((stream) => stream.on('error', (e) => console.error('Error', e)));

      socket.write('HTTP/1.1 200 OK\r\n\r\n', 'UTF-8', () => {
        conn.pipe(socket);
        socket.pipe(conn);
      });
    });

    return;
  }

  // Otherwise block the request
  // eslint-disable-next-line no-console
  console.log(colors.red(`Blocking: ${host}, ${port}`));
});

// ----------------------------------------------------------------------------
// REQUEST handling (after TLS is established)
// ----------------------------------------------------------------------------
proxy.onRequest((ctx, callback) => {
  const completeUrl = `https://${ctx.clientToProxyRequest.headers.host}${ctx.clientToProxyRequest.url}`;

  if (micromatch.isMatch(completeUrl, blacklist)) {
    // eslint-disable-next-line no-console
    console.log(colors.red(`Blocked: ${completeUrl}`));
    ctx.proxyToClientResponse.end(''); // terminate the request
    return;
  }

  return callback();
});

// ----------------------------------------------------------------------------
// Certificate generation
// ----------------------------------------------------------------------------
proxy.onCertificateRequired = (hostname, cb) => cb(null, {
  keyFile: path.resolve('./certs/', `${hostname}.key`),
  certFile: path.resolve('./certs/', `${hostname}.crt`),
});

proxy.onCertificateMissing = (ctx, files, cb) => {
  const hosts = files.hosts || [ctx.hostname];
  CAUtil.generateServerCertificateKeys(hosts, (cert: string, privateKey: string) => {
    cb(null, {
      certFileData: cert,
      keyFileData: privateKey,
      hosts,
    });
  });
  return proxy;
};

// ----------------------------------------------------------------------------
// Startup helper
// ----------------------------------------------------------------------------
export interface ProxyOptions {
  port: number;
}

proxy.start = async function start(opt: ProxyOptions) {
  await CAUtil.create(path.resolve(process.cwd(), 'certs'), (err: Error | null) => {
    if (err) {
      console.error(err);
    }
  });

  proxy.listen(opt);
  // eslint-disable-next-line no-console
  console.log(colors.green(`Proxy is up on port ${opt.port}`));
};

// Default start when executed directly (for "npm start")
if (require.main === module) {
  proxy.start({ port: 8082 });
}

export default proxy; 
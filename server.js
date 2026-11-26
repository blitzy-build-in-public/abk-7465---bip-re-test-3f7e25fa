// Minimal Node.js HTTP server tutorial: it serves GET /hello and answers every
// other method and path with the 404 catch-all, using the built-in http module.
// Requires Node.js >=18.0.0.

'use strict';

const http = require('http');

const DEFAULT_PORT = 3000;
const MIN_PORT = 1024;
const MAX_PORT = 65535;
const BASE_URL = 'http://localhost';
const HELLO_PATH = '/hello';
const HELLO_BODY = 'Hello world';
const NOT_FOUND_BODY = 'Not Found';
const TEXT_CONTENT_TYPE = 'text/plain';
const openSockets = new Set();

// Turn the raw PORT value into a usable port number, or fail with one actionable message.
function resolvePort(rawValue) {
  if (rawValue === undefined) {
    return DEFAULT_PORT;
  }

  // Number() rejects trailing garbage, so '8080abc' fails validation instead of
  // being silently accepted as 8080 the way parseInt would accept it.
  const port = Number(rawValue);

  if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
    throw new Error(
      `Invalid PORT "${rawValue}": PORT must be an integer between ${MIN_PORT} and ${MAX_PORT}.`
    );
  }

  return port;
}

// Convert the raw request target into the pathname used for matching and logging.
function parsePath(requestUrl) {
  try {
    return new URL(requestUrl, BASE_URL).pathname;
  } catch {
    // new URL throws on a malformed target inside the request callback, where an
    // uncaught throw would end the process instead of answering the catch-all.
    return requestUrl;
  }
}

// Write the request log line, in the fixed timestamp method pathname format.
function logRequest(method, pathname) {
  console.log(`${new Date().toISOString()} ${method} ${pathname}`);
}

// Write status, headers and body exactly once, then end the response.
function sendText(res, statusCode, body) {
  // Content-Length is set explicitly because a writeHead without it makes Node
  // fall back to Transfer-Encoding: chunked for the response body.
  const payload = Buffer.byteLength(body, 'utf8');

  res.writeHead(statusCode, {
    'Content-Type': TEXT_CONTENT_TYPE,
    'Content-Length': payload
  });
  res.end(body);
}

// Route handler for the GET /hello success route.
function handleHello(req, res) {
  sendText(res, 200, HELLO_BODY);
}

// Route handler for every request the exact-match dispatch does not accept.
function handleNotFound(req, res) {
  sendText(res, 404, NOT_FOUND_BODY);
}

// The single request listener: parse the target, log the request, then dispatch.
function routeRequest(req, res) {
  const pathname = parsePath(req.url);
  logRequest(req.method, pathname);

  if (req.method === 'GET' && pathname === HELLO_PATH) {
    handleHello(req, res);
    return;
  }

  handleNotFound(req, res);
}

// Build the HTTP server and start tracking the connections it accepts.
function createServer() {
  const server = http.createServer(routeRequest);

  // Sockets are tracked because on the Node 18.0.0 floor server.close() alone
  // waits for keep-alive connections instead of dropping them.
  server.on('connection', (socket) => {
    openSockets.add(socket);
    socket.once('close', () => openSockets.delete(socket));
  });

  return server;
}

// Translate a bind failure into one actionable stderr message and exit status 1.
function attachListenErrorHandler(server, port) {
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(
        `Cannot bind to port ${port}: address already in use (EADDRINUSE). ` +
          'Set PORT to a free port and start again.'
      );
    } else if (error.code === 'EACCES') {
      console.error(
        `Cannot bind to port ${port}: permission denied (EACCES). ` +
          'Ports below 1024 require elevated privileges.'
      );
    } else {
      console.error(
        `Cannot bind to port ${port}: ${error.code}. ` +
          'The port could not be bound; set PORT to a free port and start again.'
      );
    }

    process.exitCode = 1;
  });
}

// Handle SIGINT: log, stop accepting, close tracked connections and exit with status 0.
function attachShutdownHandler(server) {
  process.once('SIGINT', () => {
    console.log('Received SIGINT. Shutting down server.');

    if (server.listening) {
      server.close();
    }

    for (const socket of openSockets) {
      socket.destroy();
    }

    process.exitCode = 0;
  });
}

// Composition root: resolve configuration, build the server, wire it up and listen.
function main() {
  let port;

  try {
    port = resolvePort(process.env.PORT);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const server = createServer();
  attachListenErrorHandler(server, port);
  attachShutdownHandler(server);

  server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

main();

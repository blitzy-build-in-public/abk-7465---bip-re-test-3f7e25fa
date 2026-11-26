# Node.js Hello World HTTP Server

## 1. Purpose

This is a single-file HTTP server built on nothing but Node's built-in `http` module. It answers `GET /hello` with status `200` and the body `Hello world`, and answers every other method and path with `404 Not Found`, logging each request as it arrives. There is no framework to learn, no dependency to install and no build step: the three files run in place.

- `server.js` — the whole application: port validation, request logging, the two route handlers, the response writer, bind-error handling and `SIGINT` shutdown.
- `package.json` — the project name and version, the `npm start` script and the Node.js `>=18.0.0` floor.
- `README.md` — this guide.

This guide is written for running the server on your own machine, and every command in it addresses `http://localhost`. The port itself is not loopback-only: `server.js` calls `server.listen(port)` with no host argument, so Node binds the unspecified address — `::` where the system has IPv6 and `0.0.0.0` otherwise — on every network interface, which means any host that can route to your machine, other machines on your local network included, reaches both routes unless your host firewall blocks the port. What that exposes is bounded: two fixed responses, with no authentication, no TLS, no security header and no rate limiting, and this tutorial adds none of them — so run it on a network you trust, or block the port at the firewall.

## 2. Prerequisites

Node.js 18.0.0 or newer — the floor `package.json` declares in `engines.node`. Check the version you have:

```bash
node --version
```

```text
v22.23.5
```

Any version at or above `v18` works, and later releases — the current LTS lines included — run this server unchanged. The number above is the one this guide was written against, so a different one on your machine is expected.

`curl`, for the request checks in sections 4 and 5, and a POSIX shell — `bash` or `zsh` — for the commands themselves, because `/dev/null`, the `PORT=8080 node server.js` prefix and `echo $?` come from the POSIX shell environment and do not work in `cmd.exe` or PowerShell; on Windows, run the commands in WSL or Git Bash. `curl` ships with macOS, most Linux distributions and Windows 10 and later. Nothing else is needed.

## 3. Installation

Nothing is installed. There are no dependencies, no build step and no configuration file, so `npm install` is never run: the three files are executed directly from the repository root, which is where every command in this guide starts.

## 4. Running the server

From the repository root:

```bash
node server.js
```

```text
Server listening on port 3000
```

The process keeps running and prints that line once. It is written by the listen callback, so it appears only when the port was bound successfully; a bind that fails prints an error instead and no startup line.

The same server through npm, using the `start` script from `package.json`:

```bash
npm start
```

```text

> nodejs-tutorial-hello-world@1.0.0 start
> node server.js

Server listening on port 3000
```

npm prints its own banner first, then the server prints its startup line. Confirm the server answers while it runs:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/hello
```

```text
200
```

Leave this terminal running and open a second one for sections 5 and 6; section 7 has you stop this server before its first case needs `3000` free, and section 8 documents that stop and the status it leaves.

## 5. Testing by hand

The success route:

```bash
curl -i http://localhost:3000/hello
```

```text
HTTP/1.1 200 OK
Content-Type: text/plain
Content-Length: 11
Date: Wed, 25 Nov 2026 23:27:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

Hello world
```

On a terminal `curl` also draws a transfer progress meter on stderr while the request runs; the blocks here show the response itself. The body is exactly eleven bytes and has no trailing newline, so your shell prompt returns on the same line as `Hello world`. The length is checkable:

```bash
curl -s http://localhost:3000/hello | wc -c
```

```text
11
```

An unknown path:

```bash
curl -i http://localhost:3000/invalid
```

```text
HTTP/1.1 404 Not Found
Content-Type: text/plain
Content-Length: 9
Date: Wed, 25 Nov 2026 23:27:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

Not Found
```

A method the route does not accept:

```bash
curl -i -X POST http://localhost:3000/hello
```

```text
HTTP/1.1 404 Not Found
Content-Type: text/plain
Content-Length: 9
Date: Wed, 25 Nov 2026 23:27:34 GMT
Connection: keep-alive
Keep-Alive: timeout=5

Not Found
```

Matching is on method and path together, so `POST /hello` is a 404 with no `Allow` header, even though the path exists. `GET /hello/` is a 404 as well, because the trailing slash makes it a different path, and so is every unknown path. A `HEAD` request gets the 404 status and the headers above with no body, because Node suppresses the body of a `HEAD` response. The `Date`, `Connection` and `Keep-Alive` headers are added by Node and vary with the client's connection mode; the status line, `Content-Type` and `Content-Length` are the ones the server itself sets.

Two timing checks follow, run in the second terminal while the server is up. The first sends 20 requests it discards so the runtime warms up, then measures 200 full client round trips and reports a figure just above the 95th percentile and the slowest of them:

```bash
node -e "const http=require('http');const t=[];let i=0;const WARM=20,TOTAL=220;(function next(){if(i===TOTAL){const m=t.slice(WARM).sort((a,b)=>a-b);console.log('p95_ms='+(m[Math.floor(m.length*0.95)]/1e6).toFixed(3)+' max_ms='+(m[m.length-1]/1e6).toFixed(3));return}const s=process.hrtime.bigint();http.get('http://localhost:3000/hello',r=>{r.resume();r.on('end',()=>{t.push(Number(process.hrtime.bigint()-s));i++;next()})}).on('error',e=>{console.error(e.message);process.exitCode=1})})()"
```

```text
p95_ms=0.256 max_ms=0.719
```

Both figures are milliseconds, and both are far below the 10 ms target; your own figures will differ. A cold first request can exceed 10 ms while the runtime warms up, which is why the first 20 are discarded rather than counted.

The second check puts 100 requests in flight at once and counts the answers:

```bash
node -e "const http=require('http');let done=0,ok=0,err=0;const finish=()=>{if(++done===100)console.log('responses='+done+' ok='+ok+' errors='+err)};for(let i=0;i<100;i++){http.get('http://localhost:3000/hello',r=>{r.resume();if(r.statusCode===200)ok++;r.on('end',finish)}).on('error',()=>{err++;finish()})}"
```

```text
responses=100 ok=100 errors=0
```

All 100 were answered with `200` and none waited on another, which is what concurrency means here: one process serves them all.

## 6. Expected output

The server's own terminal shows the startup line followed by one line per request, each written as the ISO-8601 timestamp, the method and the path:

```text
Server listening on port 3000
2026-11-25T23:27:34.680Z GET /hello
2026-11-25T23:27:34.698Z GET /invalid
2026-11-25T23:27:34.706Z POST /hello
```

The three request lines above are the three distinct cases section 5 prints responses for, in the order they first occurred. Every request adds its own line, so this block is an excerpt rather than a full transcript: the `wc -c` check requests `/hello` a second time, and the two timing clients between them add 320 further `GET /hello` lines. The timestamp is UTC and always carries exactly three fractional digits, so it occupies the same width on every line; yours will differ. The path is the parsed pathname only — never a query string, a header or body content — so `GET /hello?x=1` logs as `GET /hello`. The one exception is a request target Node cannot parse at all, which is logged raw so you can see what arrived. Each line is written before the response goes out, so a request whose client disconnects still appears.

## 7. Configuration

The server you started in section 4 is still running on `3000`. Stop it before the first case below: press `CTRL+C` in that terminal, which prints the shutdown line section 8 documents. The cases that start a server need the port they name to be free, so stop each server you start before you run the next case.

One environment variable, `PORT`, chooses the port. With it unset the server uses `3000`:

```bash
node server.js
```

```text
Server listening on port 3000
```

Set it to any integer from `1024` to `65535`, inclusive:

```bash
PORT=8080 node server.js
```

```text
Server listening on port 8080
```

Only `8080` is bound by that run: nothing answers on `3000` while it runs, because the default applies only when `PORT` is absent.

A value outside that range, a non-integer or an empty value is refused with one message on stderr and exit status `1`:

```bash
PORT=abc node server.js; echo $?
```

```text
Invalid PORT "abc": PORT must be an integer between 1024 and 65535.
1
```

`80`, `70000`, `3000.5` and `PORT=` are rejected the same way, each message naming the value it received. A defined value is never replaced by `3000`: when it is invalid the server stops instead of binding a port you did not ask for. The `1024` floor is what refuses privileged ports — a value below it is caught by that same check before any bind is attempted, so a privileged port is never reached.

If the port is already taken, the server says so and exits `1` without a stack trace. Start a server on `3000` again in the first terminal, exactly as the first case above does, and leave it running; then start a second one in the other terminal and check the status it leaves:

```bash
node server.js; echo $?
```

```text
Cannot bind to port 3000: address already in use (EADDRINUSE). Set PORT to a free port and start again.
1
```

## 8. Shutdown

Press `CTRL+C` in the terminal running the server:

```text
Received SIGINT. Shutting down server.
```

Your terminal echoes `^C` in front of that line; the message itself is the server's. The server stops accepting connections, closes the ones that are open and exits with status `0`. At the shell prompt, right after the process ends:

```bash
echo $?
```

```text
0
```

That status belongs to the `node server.js` process. If you started the server with `npm start` the same shutdown line appears, but the status the shell then reports is `130` — npm's own record of the interrupt rather than the server's exit status — so check the status with `node server.js`.

'use strict';
// Maintainer-only Chrome DevTools Protocol adapter. No third-party packages.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const NAME = 'chrome-cdp';
const VERSION = '1.0.0';
const digest = value => crypto.createHash('sha256').update(value).digest('hex');

function create({ executable, expectedVersion, artifactDir, timeoutMs = 15000, onLifecycle = () => {} } = {}) {
  if (!executable || !expectedVersion) throw new Error('browser executable and exact expectedVersion are required');
  async function session(work, signal) {
    const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pincer-browser-'));
    let child, socket, server, timer, closed = false, serial = 0;
    const pending = new Map(), events = new Map();
    let rejectStop;
    const stopped = new Promise((_, reject) => { rejectStop = reject; });
    // Attach before launch so early aborts never create unhandled rejections.
    stopped.catch(() => {});
    const stop = reason => rejectStop(new Error(reason));
    const abort = () => stop('browser observation aborted');
    const interrupt = () => stop('browser observation interrupted by signal');
    const guard = promise => Promise.race([promise, stopped]);
    const send = (method, params = {}, sessionId) => guard(new Promise((resolve, reject) => {
      const id = ++serial;
      pending.set(id, { resolve, reject });
      try { socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })); }
      catch (e) { pending.delete(id); reject(e); }
    }));
    signal?.addEventListener('abort', abort, { once: true });
    process.on('SIGTERM', interrupt);
    process.on('SIGINT', interrupt);
    timer = setTimeout(() => stop(`browser observation timed out after ${timeoutMs} ms`), timeoutMs);
    try {
      if (signal?.aborted) throw new Error('browser observation aborted');
      child = spawn(executable, ['--headless', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync', '--disable-extensions', '--disable-default-apps', '--disable-domain-reliability', '--metrics-recording-only', '--no-proxy-server', '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1', 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
      onLifecycle({ type: 'launch', pid: child.pid, profile });
      child.once('error', e => stop(`browser launch failed: ${e.message}`));
      child.once('exit', (code, sig) => { if (!closed) stop(`browser exited (${code ?? sig})`); });
      const endpoint = await guard(new Promise(resolve => {
        let stderr = '';
        child.stderr.on('data', chunk => {
          stderr = (stderr + chunk).slice(-16000);
          const match = stderr.match(/DevTools listening on (ws:\/\/127\.0\.0\.1:\d+\/devtools\/browser\/[^\s]+)/);
          if (match) resolve(match[1]);
        });
      }));
      socket = new WebSocket(endpoint);
      socket.addEventListener('message', event => {
        const message = JSON.parse(String(event.data));
        if (message.id && pending.has(message.id)) {
          const p = pending.get(message.id); pending.delete(message.id);
          if (message.error) p.reject(new Error(`${message.error.message}`)); else p.resolve(message.result);
        } else if (message.method && events.has(message.method)) {
          for (const handler of events.get(message.method)) handler(message);
        }
      });
      socket.addEventListener('close', () => { if (!closed) stop('browser connection closed'); });
      socket.addEventListener('error', () => stop('browser connection failed'));
      await guard(new Promise(resolve => socket.addEventListener('open', resolve, { once: true })));
      const version = await send('Browser.getVersion');
      const actualVersion = version.product.replace(/^[^/]+\//, '');
      if (actualVersion !== expectedVersion) throw new Error(`browser version mismatch: expected ${expectedVersion}, observed ${actualVersion}`);
      const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
      const command = (method, params) => send(method, params, sessionId);
      await command('Page.enable');
      await command('Runtime.enable');
      await command('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false });
      const evaluate = async expression => {
        const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
        if (result.exceptionDetails) throw new Error(`browser script failed: ${result.exceptionDetails.text}`);
        return result.result.value;
      };
      const serve = async page => {
        const route = `/candidate-${crypto.randomBytes(16).toString('hex')}`;
        const content = Buffer.from(`<!doctype html><html><head><meta charset="utf-8"></head><body>${page}</body></html>`);
        server = http.createServer((req, res) => {
          if (req.url !== route || req.method !== 'GET') { res.writeHead(404); res.end(); return; }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'; frame-src 'none'; sandbox allow-same-origin allow-scripts", 'Cache-Control': 'no-store' });
          res.end(content);
        });
        await guard(new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); }));
        const url = `http://127.0.0.1:${server.address().port}${route}`;
        await guard(Promise.resolve(onLifecycle({ type: 'server', url })));
        events.set('Fetch.requestPaused', [message => {
          const p = message.params;
          command(p.request.url === url ? 'Fetch.continueRequest' : 'Fetch.failRequest', p.request.url === url ? { requestId: p.requestId } : { requestId: p.requestId, errorReason: 'BlockedByClient' }).catch(e => stop(e.message));
        }]);
        events.set('Page.frameNavigated', [message => {
          if (message.params.frame.url !== url) stop('browser navigated outside the exact candidate route');
        }]);
        await command('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
        const loaded = new Promise(resolve => events.set('Page.loadEventFired', [resolve]));
        const navigation = await command('Page.navigate', { url });
        if (navigation.errorText) throw new Error(`browser navigation failed: ${navigation.errorText}`);
        await guard(loaded);
        return url;
      };
      const click = async box => {
        if (!box || !box.visible) throw new Error('click target has no visible geometry');
        const position = { x: box.x, y: box.y, button: 'left', clickCount: 1 };
        await command('Input.dispatchMouseEvent', { type: 'mousePressed', ...position });
        await command('Input.dispatchMouseEvent', { type: 'mouseReleased', ...position });
      };
      return await guard(work({ command, evaluate, serve, click, version: { name: NAME, version: actualVersion, protocolVersion: version.protocolVersion, executable } }));
    } finally {
      closed = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      process.removeListener('SIGTERM', interrupt);
      process.removeListener('SIGINT', interrupt);
      for (const p of pending.values()) p.reject(new Error('browser session closed'));
      pending.clear();
      if (socket) socket.close();
      if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
      if (child?.pid && child.exitCode === null && child.signalCode === null) {
        const exited = new Promise(resolve => child.once('exit', resolve));
        child.kill('SIGTERM');
        const kill = setTimeout(() => child.kill('SIGKILL'), 1500);
        await exited; clearTimeout(kill);
      }
      fs.rmSync(profile, { recursive: true, force: true });
      onLifecycle({ type: 'closed', pid: child?.pid, profile });
    }
  }
  async function observe({ candidate, page, expectations, id = 'browser', artifactDir: destination, signal }) {
    if (!/^[a-f0-9]{40}$/.test(candidate || '')) throw new Error('browser observation requires candidate commit');
    if (typeof page !== 'string' || !['empty', 'error', 'submitting'].includes(expectations?.state)) throw new Error('unsupported browser expectation');
    const output = destination || artifactDir;
    if (!output) throw new Error('browser artifacts directory required');
    return session(async ({ command, evaluate, serve, click, version }) => {
      const url = await serve(page);
      const observations = await evaluate(`(() => {
        const box = selector => {
          const el = document.querySelector(selector); if (!el) return {visible:false};
          const r=el.getBoundingClientRect(), s=getComputedStyle(el);
          let ancestorsVisible=true;for(let node=el;node;node=node.parentElement){const cs=getComputedStyle(node);if(cs.display==='none'||cs.visibility!=='visible'||Number(cs.opacity)===0)ancestorsVisible=false;}
          const x=r.x+r.width/2, y=r.y+r.height/2, top=document.elementFromPoint(x,y);
          return { visible:ancestorsVisible && r.width>0 && r.height>0 && s.visibility==='visible' && s.display!=='none' && Number(s.opacity)>0 && x>=0 && y>=0 && x<innerWidth && y<innerHeight && (top===el || el.contains(top)), x,y,text:el.textContent.trim() };
        };
        window.__browserClicks=0;
        const button=document.querySelector('button[type=submit]');
        if(button) button.addEventListener('click',event=>{if(event.isTrusted) window.__browserClicks++; event.preventDefault();});
        const email=document.querySelector('#email');
        return {button:box('button[type=submit]'),label:box('label[for=email]'),email:box('#email'),alert:box('[role=alert]'),message:box('#email-error'),busy:document.querySelector('form')?.getAttribute('aria-busy'),invalid:email?.getAttribute('aria-invalid'),describedBy:email?.getAttribute('aria-describedby')};
      })()`);
      // Positive trusted pointer control proves events arrive even when candidate submit is disabled.
      const positive = await evaluate(`(() => {const b=document.createElement('button');b.textContent='Browser input control';b.style='all:initial!important;display:block!important;visibility:visible!important;opacity:1!important;position:fixed!important;right:8px!important;bottom:8px!important;z-index:2147483647!important;padding:8px!important;background:white!important;color:black!important;pointer-events:auto!important';b.id='__browserPositive';document.body.append(b);window.__positiveClicks=0;b.addEventListener('click',e=>{if(e.isTrusted)window.__positiveClicks++});const r=b.getBoundingClientRect();return {visible:true,x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      await click(positive);
      observations.positiveClicks = await evaluate('window.__positiveClicks');
      await evaluate('document.querySelector("#__browserPositive").remove()');
      if (observations.button.visible) await click(observations.button);
      observations.submitClicks = await evaluate('window.__browserClicks');
      if (expectations.state === 'empty' && observations.label.visible) await click(observations.label);
      observations.labelFocus = await evaluate('document.activeElement?.id === "email"');
      const basic = observations.button.visible && observations.email.visible && observations.label.visible && observations.positiveClicks === 1;
      const state = expectations.state;
      const ok = Boolean(basic && (state === 'submitting'
        ? observations.button.text === 'Signing up…' && observations.busy === 'true' && observations.submitClicks === 0
        : state === 'empty'
          ? observations.button.text === 'Sign up' && observations.submitClicks === 1 && observations.labelFocus && !observations.alert.visible
          : observations.alert.visible && observations.alert.text.includes('Enter a valid email') && observations.message.visible && observations.message.text === 'Enter a valid email' && observations.invalid === 'true' && observations.describedBy === 'email-error'));
      fs.mkdirSync(output, { recursive: true });
      const stem = `${candidate}-${id.replace(/[^a-z0-9_-]/gi, '_')}-${crypto.randomBytes(6).toString('hex')}`;
      const screenshot = path.join(output, `${stem}.png`);
      const capture = await command('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      fs.writeFileSync(screenshot, Buffer.from(capture.data, 'base64'));
      const image = { path: screenshot, sha256: digest(fs.readFileSync(screenshot)) };
      const report = { schema: 1, candidate, id, state, pageDigest: digest(page), url, viewport: {width:1024,height:768}, browser: version, adapter: {name:NAME,version:VERSION,digest:digest(fs.readFileSync(__filename))}, observations, ok, screenshot:image };
      const reportPath = path.join(output, `${stem}.json`);
      fs.writeFileSync(reportPath, `${JSON.stringify(report,null,2)}\n`);
      return {ok, detail:`${state}: ${ok ? 'observed requirements satisfied' : 'rendered behavior failed requirements'}`, observations, artifacts:[image,{path:reportPath,sha256:digest(fs.readFileSync(reportPath))}], candidate};
    }, signal);
  }
  return { name: NAME, version: VERSION, real: true, observe, async probe({signal} = {}) {
    return session(async ({ serve, click, evaluate, command, version }) => {
      await serve('<button id="probe">Probe</button>');
      const box = await evaluate('(()=>{const b=document.querySelector("#probe");window.__probe=0;b.addEventListener("click",e=>{if(e.isTrusted)window.__probe++});const r=b.getBoundingClientRect();return {visible:true,x:r.x+r.width/2,y:r.y+r.height/2}})()');
      await click(box);
      if(await evaluate('window.__probe') !== 1) throw new Error('browser native input unavailable');
      const png = await command('Page.captureScreenshot', {format:'png'});
      if(!png.data) throw new Error('browser screenshot unavailable');
      return { ...version, nativeInput: true, screenshot: true };
    }, signal);
  }};
}
module.exports = { name: NAME, version: VERSION, create };

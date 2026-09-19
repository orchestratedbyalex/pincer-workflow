// Explicit maintainer gate: Chrome required; no model or provider sessions.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {create}=require('../scripts/delivery-benchmark-v7/browser.cjs');
const harness=require('../scripts/delivery-benchmark-v7/harness.cjs');
const briefs=require('../scripts/delivery-benchmark-v7/briefs.cjs');
const executable=process.env.PINCER_BROWSER_EXECUTABLE || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const expectedVersion=process.env.PINCER_BROWSER_VERSION || '153.0.8010.48';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'pincer-browser-gate-'));
const lifecycle=[];
const browser=create({executable,expectedVersion,onLifecycle:event=>lifecycle.push(event)});
const verifyCleanup=async events=>{
  for(const event of events.filter(e=>e.type==='closed')){
    assert.equal(fs.existsSync(event.profile),false,'disposable profile removed');
    if(event.pid) assert.throws(()=>process.kill(event.pid,0),{code:'ESRCH'},'Chrome process exited');
  }
  for(const event of events.filter(e=>e.type==='server')) await assert.rejects(fetch(event.url),'local server stopped');
  assert.equal(events.filter(e=>e.type==='launch').length,events.filter(e=>e.type==='closed').length);
};
try{
  assert.equal((await browser.probe()).version,expectedVersion);
  const brief=briefs.loadBrief('ui-states');
  for(const variant of ['control','aria-only','hidden-empty','hidden-error','hidden-loading','transparent-parent']){
    const dir=path.join(root,variant),workspace=path.join(dir,'workspace'),scratch=path.join(dir,'scratch');
    fs.mkdirSync(scratch,{recursive:true});
    harness.prepare(workspace,'ui-states');
    const candidate=brief.controls.apply(workspace,variant,harness.LIB,{date:'2026-09-14T00:00:00Z'});
    const result=await harness.evaluateCandidate({id:'ui-states',workspace,candidate,scratch,browser});
    assert.equal(result.outcome,variant==='control'?'accepted':'rejected',JSON.stringify(result.checks));
    for(const check of result.checks.filter(c=>c.observed)){
      assert.equal(check.observations.positiveClicks,1);
      assert.equal(check.artifacts.length,2);
      const png=fs.readFileSync(check.artifacts[0].path);
      assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
      const report=JSON.parse(fs.readFileSync(check.artifacts[1].path,'utf8'));
      assert.equal(report.candidate,candidate);assert.equal(report.browser.version,expectedVersion);
    }
    if(variant!=='control'){
      assert.equal(result.checks.find(c=>c.id===brief.controls.faults[variant]).result,'failed');
      for(const id of ['empty-state','error-state','escaping'])assert.equal(result.checks.find(c=>c.id===id).result,'passed','broken behavior passes markup');
    }
    fs.writeFileSync(path.join(dir,'evaluation.json'),JSON.stringify(result,null,2));
  }
  const timed=[];
  await assert.rejects(create({executable,expectedVersion,timeoutMs:3000,onLifecycle:e=>{timed.push(e);if(e.type==='server')return new Promise(()=>{});}}).probe(),/timed out/);
  assert.equal(timed.filter(e=>e.type==='server').length,1,'timeout occurred with a listening fixture server');
  await verifyCleanup(timed);
  const interrupted=[];
  await assert.rejects(create({executable,expectedVersion,onLifecycle:e=>{
    interrupted.push(e);if(e.type==='server')process.kill(process.pid,'SIGTERM');
  }}).probe(),/interrupted by signal/);
  await verifyCleanup(interrupted);
  const wrong=[];
  await assert.rejects(create({executable,expectedVersion:'0.0.0.0',onLifecycle:e=>wrong.push(e)}).probe(),/version mismatch/);
  await verifyCleanup(wrong);
  // Untrusted markup cannot request another local endpoint or execute script.
  let requests=0;
  const sentinel=http.createServer((req,res)=>{requests++;res.end('forbidden');});
  await new Promise(resolve=>sentinel.listen(0,'127.0.0.1',resolve));
  try{
    const target=`http://127.0.0.1:${sentinel.address().port}/forbidden`;
    const page=`<form><label for="email">Email</label><input id="email"><button type="submit">Sign up</button></form><img src="${target}"><iframe src="file:///etc/passwd"></iframe><script>fetch(${JSON.stringify(target)})</script><style>body{background-image:url('${target}')}</style>`;
    const result=await browser.observe({candidate:'a'.repeat(40),page,expectations:{state:'empty'},artifactDir:path.join(root,'network')});
    assert.equal(result.ok,true);assert.equal(requests,0);
  }finally{sentinel.closeAllConnections();await new Promise(resolve=>sentinel.close(resolve));}
  await verifyCleanup(lifecycle);
  console.log(`real Chrome browser gate passed; retained artifacts: ${root}`);
}catch(error){
  console.error(`real Chrome gate failed; artifacts: ${root}`);throw error;
}

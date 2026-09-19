import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { repo, tempDir } from './helpers.js';
const require = createRequire(import.meta.url);
const modulePath = path.join(repo,'scripts/delivery-benchmark-v7/orchestrator.cjs');
const claimsPath = path.join(repo,'scripts/delivery-benchmark-v7/run-claims.cjs');
const runner = require(modulePath), claims = require(claimsPath);
const cohort = 'a'.repeat(64);
const cell = { brief:'cli-greenfield', repetition:1, arm:'plain' };
const workers = new Set();
process.on('exit',()=> { for(const child of workers) try { process.kill(-child.pid,'SIGKILL'); } catch {} });
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function until(check, label) { const end=Date.now()+15000; while(Date.now()<end) { if(check()) return; await sleep(15); } throw new Error(`Timed out: ${label}`); }
function planned() { const root=tempDir(); runner.plan(root,{cohort,ids:['cli-greenfield']}); return root; }
function snapshot(root) {
  const out={}; const walk=(dir, prefix='')=> { for(const name of fs.readdirSync(dir).sort()) { const rel=prefix+name, file=path.join(dir,name), stat=fs.lstatSync(file); if(stat.isDirectory()) walk(file,rel+'/'); else out[rel]=stat.isSymbolicLink()?fs.readlinkSync(file):fs.readFileSync(file).toString('base64'); } }; walk(root); return out;
}
const workerFile=path.join(tempDir(),'worker.cjs');
fs.writeFileSync(workerFile,`
const fs=require('node:fs'),path=require('node:path'),{spawn}=require('node:child_process');
const o=require(${JSON.stringify(modulePath)}), c=require(${JSON.stringify(claimsPath)}), h=require(${JSON.stringify(path.join(repo,'scripts/delivery-benchmark-v7/harness.cjs'))});
const [root,control,mode,rep='1']=process.argv.slice(2), cell={brief:'cli-greenfield',repetition:Number(rep),arm:'plain'};
const mark=(name,value='yes')=>fs.writeFileSync(path.join(control,name+'.'+process.pid),String(value));
const held=()=>new Promise(resolve=>{const timer=setInterval(()=>{if(fs.existsSync(path.join(control,'release'))){clearInterval(timer);resolve();}},15)});
(async()=>{
 if(mode==='claim-before'){
  const link=fs.linkSync;fs.linkSync=(a,b)=>{if(b.endsWith(o.cellKey(cell)+'.json')){mark('boundary');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);}return link(a,b);};c.acquire(root,o.cellKey(cell));return;
 }
 if(mode==='claim'||mode==='child'||mode==='registered'){
  const claim=c.acquire(root,o.cellKey(cell));
  if(mode!=='claim') {const child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore',detached:mode==='registered'}); if(mode==='registered') c.registerGroup(claim,{pid:child.pid,pgid:child.pid}); mark('child',child.pid);}
  mark('claimed',claim.owner.token);await held();c.release(claim);return;
 }
 if(mode==='write-before'||mode==='write-after'){
  const claim=c.acquire(root,o.cellKey(cell)); const rename=fs.renameSync;
  fs.renameSync=(a,b)=>{if(b.endsWith('record.json')){if(mode==='write-after')rename(a,b);mark('boundary');Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0);}else rename(a,b);};
  const record=o.readRecord(root,cell);record.reason='crash boundary';record.status='invalid';o.writeRecord(root,cell,record,claim);return;
 }
 if(mode==='rerun') {try {const r=o.claimRerun(root,cell,{cohort:'a'.repeat(64)});mark('result',JSON.stringify({repetition:r?.cell.repetition}));}catch(e){mark('result',JSON.stringify({code:e.code,message:e.message}));}return;}
 h.evaluateCandidate=async()=>({outcome:'rejected',checks:[{id:'fixture',result:'failed',independent:true}]});
 const result=await o.driveRun(root,cell,{cohort:'a'.repeat(64),spendingCap:true,model:'fixture',fixtureSession:async options=>{
   fs.mkdirSync(options.logDir,{recursive:true});fs.writeFileSync(path.join(options.logDir,options.name+'.json'),JSON.stringify({total_cost_usd:1,duration_ms:1000,usage:{input_tokens:1,output_tokens:1}}));mark('launched',options.workspace);await held();return {started:new Date().toISOString(),ended:new Date().toISOString(),end:'completed',status:0};
 }});mark('result',JSON.stringify({code:result.code,refused:result.refused,skipped:result.skipped,status:result.record?.status}));
})().catch(e=>{mark('error',e.stack);process.exitCode=1});
`);
function worker(root,control,mode,rep=1) {
  const child=spawn(process.execPath,[workerFile,root,control,mode,String(rep)],{detached:true,stdio:'ignore'}); workers.add(child);
  child.done=new Promise(resolve=>child.on('exit',(code,signal)=>{workers.delete(child);resolve({code,signal});}));return child;
}
const markers=(control,type)=>fs.readdirSync(control).filter(name=>name.startsWith(type+'.'));
async function finish(child) { const result=await child.done; assert.equal(result.code,0,JSON.stringify(result)); }
async function kill(child) { child.kill('SIGKILL'); await child.done; }

// Two independent processes overlap at one actual session boundary: exactly one launch.
{
 const root=planned(), control=tempDir(); const a=worker(root,control,'drive'), b=worker(root,control,'drive');
 await until(()=>markers(control,'launched').length===1 && markers(control,'result').length===1,'one launch and busy refusal');
 const loser=JSON.parse(fs.readFileSync(path.join(control,markers(control,'result')[0]))); assert.equal(loser.code,'RUN_BUSY');assert.equal(loser.refused,true);
 const before=snapshot(root); const out=await runner.driveRun(root,cell,{cohort,spendingCap:true,fixtureSession:()=>{throw new Error('must not launch');}});
 assert.equal(out.code,'RUN_BUSY');assert.deepEqual(snapshot(root),before,'losing claimant changes no retained artifact or workspace');
 fs.writeFileSync(path.join(control,'release'),'yes');await Promise.all([finish(a),finish(b)]);assert.equal(markers(control,'launched').length,1);
 const terminal=snapshot(root); const skipped=await runner.driveRun(root,cell,{});assert.equal(skipped.skipped,true);assert.deepEqual(snapshot(root),terminal);
}
// Distinct cells hold ownership concurrently with distinct workspaces and event files.
{
 const root=planned(),control=tempDir(),a=worker(root,control,'drive',1),b=worker(root,control,'drive',2);
 await until(()=>markers(control,'launched').length===2,'two independent cells launched');
 const workspaces=markers(control,'launched').map(n=>fs.readFileSync(path.join(control,n),'utf8'));assert.equal(new Set(workspaces).size,2);
 fs.writeFileSync(path.join(control,'release'),'yes');await Promise.all([finish(a),finish(b)]);
 assert.notEqual(runner.recordPath(root,cell),runner.recordPath(root,{...cell,repetition:2}));
}
// Killing before exclusive owner publication leaves no owner and cannot launch work.
{
 const root=planned(),control=tempDir(),child=worker(root,control,'claim-before');
 const before=fs.readFileSync(runner.recordPath(root,cell),'utf8');
 await until(()=>markers(control,'boundary').length,'pre-claim boundary');await kill(child);
 assert.equal(runner.inspectClaim(root,cell),null);const acquired=claims.acquire(root,runner.cellKey(cell));claims.release(acquired);
 assert.equal(fs.readFileSync(runner.recordPath(root,cell),'utf8'),before);
 assert.equal(markers(control,'launched').length,0);
}
// Dead ownership does not auto-reclaim or rerun; explicit recovery retains all bytes.
{
 const root=planned(),control=tempDir(),child=worker(root,control,'claim');await until(()=>markers(control,'claimed').length,'claim exists');
 const token=runner.inspectClaim(root,cell).owner.token;
 assert.throws(()=>runner.recoverRun(root,cell,{token,reason:'live refusal'}),e=>e.code==='RECOVERY_REFUSED');
 await kill(child);await until(()=>runner.inspectClaim(root,cell).state==='dead','owner reaped');
 const before=snapshot(root), result=await runner.driveRun(root,cell,{cohort});assert.equal(result.code,'RUN_RECOVERY_REQUIRED');assert.deepEqual(snapshot(root),before);
 assert.throws(()=>runner.recoverRun(root,cell,{token:'0'.repeat(32),reason:'wrong identity'}),e=>e.code==='RECOVERY_REFUSED');
 const recovered=runner.recoverRun(root,cell,{token,reason:'Killed stand-in confirmed dead; inspect before later resume'});assert.equal(recovered.launches,0);assert.equal(runner.inspectClaim(root,cell),null);
 const after=snapshot(root);for(const [name,data] of Object.entries(before))if(!name.startsWith('.claims/'))assert.equal(after[name],data);
 const receipt=JSON.parse(fs.readFileSync(recovered.archive));assert.equal(receipt.owner.token,token);assert.equal(receipt.launches,0);
}
// A live inherited child, or detached registered supervisor, blocks dead-owner recovery.
for(const mode of ['child','registered']) {
 const root=planned(),control=tempDir(),owner=worker(root,control,mode);await until(()=>markers(control,'child').length,'child custody');
 const childPid=Number(fs.readFileSync(path.join(control,markers(control,'child')[0])));const token=runner.inspectClaim(root,cell).owner.token;
 await kill(owner);const info=runner.inspectClaim(root,cell);assert.equal(info.state,'unknown');
 assert.throws(()=>runner.recoverRun(root,cell,{token,reason:'must refuse live descendants'}),e=>e.code==='RECOVERY_REFUSED');
 try{process.kill(mode==='registered'?-childPid:childPid,'SIGKILL');}catch{}
}
// Atomic checkpoint boundaries leave either the previous or complete new JSON, never truncation.
for(const mode of ['write-before','write-after']) {
 const root=planned(),control=tempDir(),before=fs.readFileSync(runner.recordPath(root,cell),'utf8'),child=worker(root,control,mode);
 await until(()=>markers(control,'boundary').length,'record publication boundary');await kill(child);
 const raw=fs.readFileSync(runner.recordPath(root,cell),'utf8'),record=JSON.parse(raw);
 if(mode==='write-before')assert.equal(raw,before);else{assert.equal(record.status,'invalid');assert.equal(record.reason,'crash boundary');}
 const owner=runner.inspectClaim(root,cell);assert.equal(owner.state,'dead');runner.recoverRun(root,cell,{token:owner.owner.token,reason:'checkpoint inspected'});
 assert.equal(fs.readFileSync(runner.recordPath(root,cell),'utf8'),raw,'recovery never rewrites checkpoint');
}
// Recovery archive failure never drops ownership; a complete prior receipt supports retry.
{
 const root=planned(),control=tempDir(),child=worker(root,control,'claim');await until(()=>markers(control,'claimed').length,'claim');await kill(child);
 const owner=runner.inspectClaim(root,cell).owner, loc=path.join(root,'.claims',runner.cellKey(cell)+'.json');
 const original=fs.unlinkSync;fs.unlinkSync=function(file,...args){if(path.resolve(file)===path.resolve(loc))throw new Error('injected archive-before-unlink failure');return original.call(this,file,...args);};
 try{assert.throws(()=>runner.recoverRun(root,cell,{token:owner.token,reason:'archive boundary'}),/archive-before-unlink/);}finally{fs.unlinkSync=original;}
 assert.equal(runner.inspectClaim(root,cell).owner.token,owner.token);
 const result=runner.recoverRun(root,cell,{token:owner.token,reason:'retry inspected receipt'});assert.equal(JSON.parse(fs.readFileSync(result.archive)).reason,'archive boundary');
}
// Concurrent rerun allocators never overwrite a slot; explicit retries allocate the next one.
{
 const root=planned(),control=tempDir();const record=runner.readRecord(root,cell);record.status='invalid';record.reason='retained original';runner.writeRecord(root,cell,record);const original=fs.readFileSync(runner.recordPath(root,cell),'utf8');
 const children=[worker(root,control,'rerun'),worker(root,control,'rerun')];await Promise.all(children.map(finish));
 const results=markers(control,'result').map(n=>JSON.parse(fs.readFileSync(path.join(control,n))));const slots=results.filter(r=>r.repetition).map(r=>r.repetition);
 assert.ok(slots.length>=1);assert.equal(new Set(slots).size,slots.length);for(const r of results.filter(r=>!r.repetition))assert.equal(r.code,'RUN_BUSY');
 const next=runner.claimRerun(root,cell,{cohort});assert.equal(next.cell.repetition,Math.max(...slots)+1);assert.equal(fs.readFileSync(runner.recordPath(root,cell),'utf8'),original);
}
// Invalid identities, unsafe descendants, unknown/foreign ownership are read-only refusals.
{
 const root=planned(),before=snapshot(root);
 for(const bad of [{...cell,brief:'../escape'},{...cell,arm:'../plain'},{...cell,repetition:0},{...cell,repetition:10},{...cell,run:'forged'}]) {
  await assert.rejects(()=>runner.driveRun(root,bad,{}),e=>e.code==='RUN_ID_INVALID');assert.throws(()=>runner.writeRecord(root,bad,{}));assert.deepEqual(snapshot(root),before);
 }
 const own=claims.acquire(root,runner.cellKey(cell));const file=path.join(root,'.claims',runner.cellKey(cell)+'.json');
 for(const data of ['{',JSON.stringify({...own.owner,host:'another-host'})]) {fs.writeFileSync(file,data);const snap=snapshot(root);assert.equal(runner.inspectClaim(root,cell).state,'unknown');assert.throws(()=>runner.recoverRun(root,cell,{token:own.owner.token,reason:'cannot prove ownership'}));assert.deepEqual(snapshot(root),snap);}
 fs.writeFileSync(file,JSON.stringify(own.owner));claims.release(own);
 const outside=tempDir(),home=runner.runDir(root,cell);fs.renameSync(home,home+'-saved');fs.symlinkSync(outside,home,'dir');const unsafe=snapshot(root);
 await assert.rejects(()=>runner.driveRun(root,cell,{}),e=>e.code==='RUN_PATH_UNSAFE');assert.deepEqual(snapshot(root),unsafe);assert.deepEqual(fs.readdirSync(outside),[]);
}
console.log('benchmark run claim tests passed (independent processes, child custody, kill/publication/recovery boundaries, rerun serialization, containment)');

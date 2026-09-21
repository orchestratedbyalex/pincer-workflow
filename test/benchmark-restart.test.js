import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {repo,tempDir} from './helpers.js';
const require=createRequire(import.meta.url);
const baseModule=path.join(repo,'scripts/delivery-benchmark-v7');
const o=require(path.join(baseModule,'orchestrator.cjs')), effort=require(path.join(baseModule,'effort.cjs')), attempts=require(path.join(baseModule,'attempts.cjs')), harness=require(path.join(baseModule,'harness.cjs'));
const cell={brief:'cli-greenfield',arm:'plain',repetition:1}, cohort='a'.repeat(64);
const provenance=Object.fromEntries(['prompts','driver','collector','evaluator','protocol','caps','configuration'].map(k=>[k,'b'.repeat(64)]));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function until(check,label){const end=Date.now()+20000;while(Date.now()<end){if(check())return;await sleep(20);}throw new Error(`timeout: ${label}`);}
const children=new Set(), groups=new Set();
process.on('exit',()=>{for(const child of children)try{process.kill(-child.pid,'SIGKILL');}catch{}for(const group of groups)try{process.kill(-group,'SIGKILL');}catch{}});
function snap(root){const out={};function visit(dir,prefix=''){if(!fs.existsSync(dir))return;for(const name of fs.readdirSync(dir).sort()){const p=path.join(dir,name),rel=prefix+name;if(fs.lstatSync(p).isSymbolicLink())out[rel]='link:'+fs.readlinkSync(p);else if(fs.lstatSync(p).isDirectory())visit(p,rel+'/');else out[rel]=fs.readFileSync(p).toString('base64');}}visit(root);return out;}
function planned(){const root=tempDir();o.plan(root,{cohort,ids:['cli-greenfield'],provenance});return root;}
const workerFile=path.join(tempDir(),'restart-worker.cjs');
fs.writeFileSync(workerFile,`
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const root=process.argv[2],control=process.argv[3],boundary=process.argv[4],modules=${JSON.stringify(baseModule)};
const o=require(path.join(modules,'orchestrator.cjs')),h=require(path.join(modules,'harness.cjs')),isolate=require(path.join(modules,'isolated-launch.cjs'));
const cell={brief:'cli-greenfield',arm:'plain',repetition:1};
const wait=()=>new Promise(()=>setInterval(()=>{},1000));
const mark=(name,text='yes')=>fs.writeFileSync(path.join(control,name),text);
h.evaluateCandidate=async()=>({outcome:'rejected',checks:[{id:'controlled',result:'failed',independent:true}]});
o.driveRun(root,cell,{cohort:'a'.repeat(64),usageEnvelopeAgreed:true,model:'fixture',unrelatedEdits:{'operator-notes.md':{kind:'untracked',content:'original unrelated bytes'}},fixtureCheckpoint:async(name,state)=>{
 if(name===boundary){
  fs.mkdirSync(state.scratch,{recursive:true});fs.writeFileSync(path.join(state.scratch,'browser-fixture.png'),'retained fixture evidence');
  fs.writeFileSync(path.join(state.workspace,'DEAD-ATTEMPT'),'uncommitted prior work');
  fs.writeFileSync(path.join(state.workspace,'operator-notes.md'),'changed by interrupted candidate');
  h.commitAll(state.workspace,'discarded attempt commit');
  h.git(state.workspace,'replace',state.attempt.base,h.git(state.workspace,'rev-parse','HEAD'));
  fs.writeFileSync(path.join(state.workspace,'.git/hooks/post-checkout'),['#!/bin/sh','exit 88',''].join(String.fromCharCode(10)),{mode:0o755});
  mark('dead-commit',h.git(state.workspace,'rev-parse','HEAD'));mark('boundary');await wait();
 }
},fixtureSession:async options=>{
 if(boundary==='streaming'){
  const watch=setInterval(()=>{const file=path.join(options.logDir,'S1.json');if(fs.existsSync(file)&&fs.readFileSync(file,'utf8').includes('fixture-stream-chunk')){mark('boundary');clearInterval(watch);}},20);
  const study=path.join(control,'study');fs.mkdirSync(path.join(study,'host','claude-config'),{recursive:true});
  return isolate.observeFixture({...options,prompt:'controlled fixture',arm:'plain',stateRoot:path.dirname(options.promptFile),toolVersion:isolate.NATIVE_PROFILE.tool_version,permissionMode:'manual',model:'claude-sonnet-4-6',inputRoot:study,billingMode:'subscription',caps:{turns_per_session:5,wall_clock_minutes:1,spend_usd:1},mode:'stream-descendant',heartbeat:path.join(control,'heartbeat'),timeoutMs:60000});
 }
 fs.mkdirSync(options.logDir,{recursive:true});fs.writeFileSync(path.join(options.logDir,options.name+'.json'),JSON.stringify({type:'result',subtype:'success',total_cost_usd:1.25,duration_api_ms:1000,modelUsage:{fixture:{inputTokens:120,outputTokens:1,cacheReadInputTokens:0,cacheCreationInputTokens:0}}}));fs.writeFileSync(path.join(options.logDir,options.name+'.err'),'');
 return {status:0,end:'completed',started:new Date().toISOString(),ended:new Date().toISOString()};
}}).then(result=>mark('result',JSON.stringify(result))).catch(error=>{mark('error',error.stack);process.exitCode=1;});
`);
function start(root,control,boundary){const child=spawn(process.execPath,[workerFile,root,control,boundary],{detached:true,stdio:'ignore'});children.add(child);child.done=new Promise(r=>child.once('exit',(code,signal)=>{children.delete(child);r({code,signal});}));return child;}
async function killRecover(root,child){const owner=o.inspectClaim(root,cell).owner;for(const group of owner.groups)groups.add(group);child.kill('SIGKILL');await child.done;for(const group of owner.groups)try{process.kill(-group,'SIGKILL');}catch{}await until(()=>o.inspectClaim(root,cell).state==='dead','all killed custody gone');o.recoverRun(root,cell,{token:owner.token,reason:'Controlled killed processes inspected; no remaining children'});}
const originalEvaluate=harness.evaluateCandidate;
harness.evaluateCandidate=async()=>({outcome:'rejected',checks:[{id:'controlled',result:'failed',independent:true}]});
async function resume(root,attempt){return o.driveRun(root,cell,{cohort,usageEnvelopeAgreed:true,model:'fixture',resumeInterrupted:{attempt,reason:'Explicit controlled restart from clean base'},fixtureSession:async options=>{
 fs.mkdirSync(options.logDir,{recursive:true});fs.writeFileSync(path.join(options.logDir,options.name+'.json'),JSON.stringify({type:'result',subtype:'success',total_cost_usd:2,duration_api_ms:1000,modelUsage:{fixture:{inputTokens:30,outputTokens:1,cacheReadInputTokens:0,cacheCreationInputTokens:0}}}));fs.writeFileSync(path.join(options.logDir,options.name+'.err'),'');
 return {status:0,end:'completed',started:new Date().toISOString(),ended:new Date().toISOString()};
}});}
try {
for(const boundary of ['setup','session-start','session-end','pre-evaluation','streaming']){
 const root=planned(),home=o.runDir(root,cell),control=tempDir(),child=start(root,control,boundary);
 await until(()=>fs.existsSync(path.join(control,'boundary'))||fs.existsSync(path.join(control,'error')),'durable checkpoint '+boundary);
 assert.ok(!fs.existsSync(path.join(control,'error')),fs.existsSync(path.join(control,'error'))?fs.readFileSync(path.join(control,'error'),'utf8'):'');
 const checkpoint=o.readRecord(root,cell);assert.equal(checkpoint.schema,8);assert.equal(checkpoint.attempts.length,1);assert.deepEqual(effort.problems(checkpoint),[]);
 if(['session-start','streaming'].includes(boundary)){assert.equal(checkpoint.attempts[0].sessions[0].status,'intent');assert.equal(checkpoint.events.find(e=>e.kind==='session').ended,null);}
 if(['session-end','pre-evaluation'].includes(boundary))assert.equal(checkpoint.attempts[0].sessions[0].status,'completed');
 if(boundary==='setup')assert.equal(checkpoint.attempts[0].sessions.length,0);
 if(boundary==='pre-evaluation')assert.equal(checkpoint.attempts[0].evaluation,'started');
 if(boundary==='streaming')assert.match(fs.readFileSync(path.join(home,checkpoint.attempts[0].sessions[0].payload),'utf8'),/fixture-stream-chunk/,'raw bytes arrive durably before driver completion');
 await killRecover(root,child);
 const oldDir=path.join(home,checkpoint.attempts[0].directory),old=snap(oldDir),before=snap(root);
 const refusal=await o.driveRun(root,cell,{cohort,usageEnvelopeAgreed:true,fixtureSession:()=>{throw new Error('must not launch');}});assert.equal(refusal.code,'ATTEMPT_RESUME_REQUIRED');assert.deepEqual(snap(root),before);
 const wrong=await o.driveRun(root,cell,{cohort,usageEnvelopeAgreed:true,resumeInterrupted:{attempt:'wrong',reason:'not matching'},fixtureSession:()=>{throw new Error('must not launch');}});assert.equal(wrong.code,'ATTEMPT_RESUME_REQUIRED');assert.deepEqual(snap(root),before);
 const originalPrepare=harness.prepare;harness.prepare=()=>{throw new Error('Regeneration must not run on resume');};
 let result;try{result=await resume(root,'attempt-000001');}finally{harness.prepare=originalPrepare;}
 assert.equal(result.record.attempts[1].base,result.record.attempts[0].base,'resume retains the exact original base commit');assert.deepEqual(result.problems,[],JSON.stringify(result.record));assert.deepEqual(effort.problems(result.record),[]);
 const accounting=result.record.measurement;
 if(['session-start','streaming'].includes(boundary)) {
  assert.equal(result.record.reported.cost_usd,null,'unknown prior paid usage cannot become a complete total');
  assert.equal(accounting.metrics.cost_usd.measured_subtotal,2);
 } else {
  assert.equal(result.record.reported.cost_usd,boundary==='setup'?2:3.25,'all completed prior and resumed sessions counted once');
  assert.equal(result.record.reported.tokens,boundary==='setup'?31:152);
 }
 assert.equal(result.record.attempts.length,2);assert.equal(result.record.attempts[0].status,'interrupted');assert.equal(result.record.attempts[1].status,'completed');
 assert.equal(new Set(result.record.events.map(e=>e.id)).size,result.record.events.length);assert.deepEqual(snap(oldDir),old,'all prior payload/workspace/browser scratch bytes unchanged');
 if(['session-start','streaming'].includes(boundary)){const session=result.record.attempts[0].sessions[0];assert.equal(session.status,'unavailable');assert.match(session.unavailable,/no completion checkpoint/);}
 const fresh=path.join(home,result.record.attempts[1].directory,'workspace');assert.ok(!fs.existsSync(path.join(fresh,'DEAD-ATTEMPT')));assert.equal(fs.readFileSync(path.join(fresh,'operator-notes.md'),'utf8'),'original unrelated bytes','restore exact original injection instead of changed old workspace or regenerated recipe');
 if(fs.existsSync(path.join(control,'dead-commit'))){const dead=fs.readFileSync(path.join(control,'dead-commit'),'utf8');assert.notEqual(spawnSync('git',['merge-base','--is-ancestor',dead,'HEAD'],{cwd:fresh}).status,0);assert.notEqual(spawnSync('git',['cat-file','-e',dead],{cwd:fresh}).status,0,'interrupted commit object is absent, not merely outside HEAD ancestry');}
 const terminal=snap(root);assert.equal((await resume(root,'attempt-000002')).skipped,true);assert.deepEqual(snap(root),terminal,'terminal attempts never rerun');
}
// Invalid capture recipes fail before storing bytes or hashes; unsafe source objects refuse.
{
 const root=tempDir(),record=effort.empty({run:'cli-greenfield/rep-1/plain',cohort,brief:'cli-greenfield',arm:'plain',repetition:1,provenance});
 const attempt=attempts.begin(root,record,{sessionNames:['S1']});
 for(const recipe of [
  {'../escape':{kind:'untracked',content:'outside'}},
  {'.env':{kind:'untracked',content:'private'}},
  {'notes.md':{kind:'untracked',content:'sk-ant-'+ 'A'.repeat(30)}},
 ]) {const before=snap(root);assert.throws(()=>attempts.saveUnrelated(root,attempt,recipe));assert.deepEqual(snap(root),before);assert.equal(attempt.unrelated_inputs,null);}
 const source=path.join(root,attempt.directory,'workspace');fs.mkdirSync(source,{recursive:true});fs.symlinkSync(tempDir(),path.join(source,'.git'),'dir');
 const before=snap(root);assert.throws(()=>attempts.restoreBase(root,{...attempt,base:'a'.repeat(40)},path.join(root,'fresh')),e=>e.code==='RUN_PATH_UNSAFE');assert.deepEqual(snap(root),before);
}
// Legacy multi-session uncertainty: known S1 never proves that S2 was not launched.
{
 const root=tempDir(),record=effort.empty({run:'scope-revision/rep-1/plain',cohort,brief:'scope-revision',arm:'plain',repetition:1,provenance});
 const at=new Date().toISOString();record.events=[{kind:'session',id:record.run+':S1',started:at,ended:at}];
 fs.mkdirSync(path.join(root,'logs'));fs.writeFileSync(path.join(root,'logs/S1.json'),'{"total_cost_usd":1.25}');
 attempts.begin(root,record,{resumeInterrupted:{attempt:'legacy',reason:'Inspect historical partial handoff'},sessionNames:['S1','S2']});
 assert.equal(record.attempts[0].sessions.length,2);assert.equal(record.attempts[0].sessions[0].status,'completed');
 assert.equal(record.attempts[0].sessions[1].status,'unavailable');assert.equal(record.attempts[0].sessions[1].intent_at,null);
 assert.match(record.attempts[0].sessions[1].unavailable,/no durable launch/);assert.deepEqual(effort.problems(record),[]);
}
// Reproduce the original persisted setup/S1 restart: preserve old IDs and root artifacts.
{
 const root=planned(),home=o.runDir(root,cell),record=o.readRecord(root,cell),time=new Date().toISOString();
 record.events=[{kind:'stage',id:record.run+':setup',stage:'setup',started:time,ended:time},{kind:'session',id:record.run+':S1',started:time,ended:time}];o.writeRecord(root,cell,record);
 fs.mkdirSync(path.join(home,'logs'));fs.writeFileSync(path.join(home,'logs/S1.json'),'{"total_cost_usd":1.25}');fs.mkdirSync(path.join(home,'scratch'));fs.writeFileSync(path.join(home,'scratch/browser-artifact.png'),'historical fixture');
 const beforeNative=snap(root);const refusedNative=await o.driveRun(root,cell,{cohort,usageEnvelopeAgreed:true,resumeInterrupted:{attempt:'legacy',reason:'Must refuse unknown native originalbase'}});assert.equal(refusedNative.code,'ORIGINAL_BASE_UNAVAILABLE');assert.deepEqual(snap(root),beforeNative);
 const logs=snap(path.join(home,'logs')),scratch=snap(path.join(home,'scratch')),result=await resume(root,'legacy');
 assert.deepEqual(result.record.events.slice(0,2),record.events);assert.equal(result.record.attempts[0].origin,'legacy');assert.deepEqual(effort.problems(result.record),[]);
 assert.deepEqual(snap(path.join(home,'logs')),logs);assert.deepEqual(snap(path.join(home,'scratch')),scratch);
 // Versioned negative cases: traversal, duplicate identity, missing event, unknown schema.
 for(const mutate of [r=>r.attempts[1].sessions[0].payload='../escape',r=>r.attempts.push({...r.attempts[1]}),r=>r.events.splice(r.events.findIndex(e=>e.id.endsWith('attempt-000001:S1')),1),r=>r.attempts[1].directory='../escape',r=>r.attempts[1].sessions=[],r=>r.attempts[1].sessions=[null],r=>r.attempts[1].base=null,r=>{r.attempts[0].status='running';r.attempts[0].ended=null;r.attempts[0].reason=null;},r=>r.attempts[1].sessions[0].unavailable='',r=>r.schema=99]){
  const changed=structuredClone(result.record);mutate(changed);if(changed.attempts[1].sessions[0]?.unavailable==='')changed.attempts[1].sessions[0].status='unavailable';assert.ok(effort.problems(changed).length,'malformed attempt metadata refused');
 }
 const old=structuredClone(record);assert.equal(old.schema,7);assert.deepEqual(effort.problems(old),[],'legacy reader still accepts original record without inventing attempts');assert.ok(!Object.hasOwn(old,'attempts'));
}
}finally{harness.evaluateCandidate=originalEvaluate;}
console.log('benchmark restart tests passed (real kills at four checkpoints and streaming output, explicit resume, retained attempts, schema7/8 readers)');

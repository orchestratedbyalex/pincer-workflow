// Synthetic documents exercise validation/refusal only; they are not native evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {repo,tempDir,write} from './helpers.js';
const require=createRequire(import.meta.url);
const child=require('node:child_process');
const saved=Object.fromEntries(['spawn','spawnSync','exec','execSync','execFile','execFileSync','fork'].map(k=>[k,child[k]]));
let allowVersionProbe=false;
for(const key of Object.keys(saved))child[key]=()=>{throw new Error('READINESS_MUST_NOT_LAUNCH');};
child.spawnSync=()=>{if(allowVersionProbe)return {status:0,stdout:'2.1.273 (Claude Code)\n',stderr:''};throw new Error('READINESS_MUST_NOT_LAUNCH');};
const {inspectStudy,evidenceTarget}=require('../scripts/delivery-benchmark-v7/readiness.cjs');
const {canonical,resolve}=require('../scripts/delivery-benchmark-v7/effective.cjs');
const {SPEC}=require('../scripts/delivery-benchmark-v7/freeze-spec.cjs');
const {observationTarget,PROFILE,NATIVE_PROFILE}=require('../scripts/delivery-benchmark-v7/isolated-launch.cjs');
const sha=value=>crypto.createHash('sha256').update(value).digest('hex');
// schema 1 with the historical API-key profile validates exactly as before; schema 2 (T-121)
// declares the billing mode, estimate caps, the agreed account-usage envelope and the
// native-login checks for a native-login cohort.
function fixture(purpose='measured',{schema=1,profile=PROFILE.name}={}){
 const root=tempDir(),candidate='c'.repeat(40);let cohort='a'.repeat(64);
 fs.mkdirSync(path.join(root,'host/claude-config'),{recursive:true});
 const put=(rel,value)=>{const text=typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value);write(root,rel,text);return {ref:rel,digest:sha(text)};};
 const backing=put('evidence/test-documents.txt','Controlled synthetic documents for validator tests. No actual native observation occurred.');
 const decision=(name,kind,rest={})=>put(`decisions/${name}.json`,{schema:1,kind,approved:true,decided_by:'user',decided_at:'2026-09-19T00:00:00Z',evidence:[backing],...rest});
 const adapter=put('scripts/delivery-benchmark-v7/browser.cjs','module.exports={};');
 const tool=put('tool/native',Buffer.from('7f454c46756e69742d66697874757265','hex')),runtimeFile=put('runtime/browser','browser fixture bytes'),kit=put('kit.tgz','fixture kit archive');
 for(const rel of [SPEC.protocol,...SPEC.harness,SPEC.collector,SPEC.driver])if(!fs.existsSync(path.join(root,rel)))put(rel,'fixture source');
 put(`${SPEC.briefs}/fixture/brief.md`,'fixture brief');put(`${SPEC.briefs}/fixture/evaluator/evaluate.cjs`,'fixture evaluator');
 const inputs={model:'claude-sonnet-4-6',tool:{executable:path.join(root,tool.ref),version:PROFILE.tool_version,kind:'native'},caps:{turns_per_session:3,wall_clock_minutes:2,spend_usd:1},kit:{path:kit.ref,commit:'d'.repeat(40)},configuration:{permission_mode:'manual',cwd_kind:'scratch',isolation_profile:profile},browser:{entry:adapter.ref,roots:[adapter.ref],runtime:{name:'fixture-browser',version:'153.0.8010.48',path:'runtime',executable:runtimeFile.ref}}};
 const resolved=()=>{allowVersionProbe=true;try{return resolve(root,SPEC,inputs,{inputRoot:root});}finally{allowVersionProbe=false;}};
 let retained=resolved();const target=(()=>{try{return observationTarget(retained);}catch{return 'f'.repeat(64);}})();
 const native=put('evidence/native-isolation.json',{schema:1,kind:'native-isolation-observation',fixture:false,target,arms:['plain','pincer','strict'],host_policy_observed:true,authentication_observed:true,personal_configuration_absent:true,...(schema===2?{login_preserved:true,override_refused:true}:{}),evidence:[{path:backing.ref,digest:backing.digest}]});
 inputs.configuration.isolation_observation_digest=native.digest;retained=resolved();cohort=retained.cohort;
 const effective=put('evidence/effective.json',retained);
 const project={id:'fixture-project',base:'b'.repeat(40),access:decision('access','project-access-decision',{project:'fixture-project',base:'b'.repeat(40)})};
 const reviewers=['reviewer-one','reviewer-two'].map(id=>({id,independent:true,decision:decision(id,'reviewer-participation-decision',{reviewer:id,independent:true})}));
 const schedule=[{id:'fixture-session',run:'cli-greenfield/rep-1/plain',name:'S1',arm:'plain',purpose,project:project.id,kit:'K0',prompt_digest:'e'.repeat(64),effective_digest:cohort}];
 const expires=new Date(Date.now()+86400000).toISOString(),accountUsage={max_sessions:3,max_elapsed_minutes:6,agreed:true};
 const allocation=schema===2?{id:'fixture-allocation',root:'runs',session_estimate_cap_usd:1,limit_estimate_usd:3,session_wall_minutes:2,account_usage:accountUsage,expires_at:expires}:{id:'fixture-allocation',root:'runs',limit_usd:3,session_cap_usd:1,session_wall_minutes:2,max_elapsed_minutes:6,expires_at:expires};
 const authorization=decision('authorization','study-authorization',schema===2?{purpose,allocation_id:allocation.id,billing_mode:'subscription',session_turns:3,session_wall_minutes:2,session_estimate_cap_usd:1,limit_estimate_usd:3,account_usage:accountUsage,expires_at:expires,schedule_digest:sha(canonical(schedule))}:{purpose,allocation_id:allocation.id,limit_usd:3,session_cap_usd:1,session_wall_minutes:2,max_elapsed_minutes:6,expires_at:expires,schedule_digest:sha(canonical(schedule))});allocation.decision=authorization;
 const evidence={};
 for(const kind of ['offline','browser','packed','ci','native','smoke','report']){
  evidence[kind]=put(`evidence/${kind}.json`,{schema:1,kind,candidate,execution_target:evidenceTarget(retained),result:'passed',fixture:kind==='offline',purpose:'operational-smoke',arms:['plain','pincer','strict'],checks:Object.fromEntries(['host_policy','authentication','personal_configuration_absent','kit_mechanisms','payload_capture','isolation','browser','stop','cleanup','report_regeneration','login_preserved','override_refused','status_record_sanitized','billing_mode_consistent','estimate_captured','charge_unavailable_labelled'].map(k=>[k,true])),matrix:['ubuntu','macos'].flatMap(os=>[22,24].map(node=>({os,node,result:'passed'}))),evidence:[backing],review:{reviewer:reviewers[0].id,decision:decision(`review-${kind}`,'evidence-review-decision',{reviewer:reviewers[0].id,candidate,kind_reviewed:kind})}});
 }
 const manifest={schema,kind:'pincer-study-readiness',status:'pending',execution:{candidate,effective,observation_target:target,evidence_target:evidenceTarget(retained),inputs:[...Object.entries(retained.effective.helpers.files).map(([ref,digest])=>({ref,digest})),tool,runtimeFile],browser_runtime_root:'runtime',native_observation:native,...(schema===2?{billing:{mode:'subscription',tool_surface:'claude-code',status_record_contract:'claude-auth-status-json-v1'}}:{})},projects:[project],kits:[{id:'K0',commit:'d'.repeat(40),artifact:kit}],schedule,reviewers,authorization,allocation,stop_resume:{unknown_cost:'stop',account_limit:'stop',exhausted_allocation:'stop',changed_inputs:'stop',resume:'explicit-recorded-decision'},evidence,pending_notes:[]};
 const manifestPath=path.join(root,'study.json');
 const persist=()=>write(root,'study.json',JSON.stringify(manifest));persist();
 const inspect=()=>{persist();return inspectStudy({manifestPath,inputRoot:root,purpose});};
 const modifyEvidence=(kind,change)=>{const value=JSON.parse(fs.readFileSync(path.join(root,manifest.evidence[kind].ref),'utf8'));change(value);manifest.evidence[kind]=put(manifest.evidence[kind].ref,value);};
 const refreshExecution=()=>{
  const beforeTarget=manifest.execution.evidence_target;
  retained=resolved();manifest.execution.effective=put('evidence/effective.json',retained);
  manifest.execution.evidence_target=evidenceTarget(retained);
  manifest.execution.inputs=[...Object.entries({...retained.effective.helpers.files,...retained.effective.browser.runtime.files}).map(([ref,digest])=>({ref,digest})),tool];
  for(const entry of manifest.schedule)entry.effective_digest=retained.cohort;
  const approved=JSON.parse(fs.readFileSync(path.join(root,manifest.authorization.ref),'utf8'));
  approved.schedule_digest=sha(canonical(manifest.schedule));manifest.authorization=put(manifest.authorization.ref,approved);manifest.allocation.decision=manifest.authorization;
  assert.equal(observationTarget(retained),manifest.execution.observation_target,'narrow isolation target did not change');
  assert.notEqual(manifest.execution.evidence_target,beforeTarget,'full execution evidence target changed');
 };
 const modifyAuthorization=change=>{const value=JSON.parse(fs.readFileSync(path.join(root,manifest.authorization.ref),'utf8'));change(value);manifest.authorization=put(manifest.authorization.ref,value);manifest.allocation.decision=manifest.authorization;};
 return {root,manifestPath,manifest,put,inspect,modifyEvidence,modifyAuthorization,inputs,refreshExecution,retained};
}
function snapshot(root){const result={};const visit=(dir,prefix='')=>{for(const e of fs.readdirSync(dir,{withFileTypes:true})){const rel=prefix+e.name;if(e.isDirectory())visit(path.join(dir,e.name),rel+'/');else result[rel]=fs.lstatSync(path.join(dir,e.name)).isSymbolicLink()?'link':fs.readFileSync(path.join(dir,e.name)).toString('base64');}};visit(root);return result;}
{
 const f=fixture(),before=snapshot(f.root),result=inspectStudy({manifestPath:f.manifestPath,inputRoot:f.root});
 assert.equal(result.ready,true,JSON.stringify(result.pending));assert.equal(result.launchGrant.session,null);assert.equal(result.launchGrant.execution.effective_digest,f.manifest.schedule[0].effective_digest);assert.deepEqual(snapshot(f.root),before,'readiness never changes artifacts or creates ledger');
 const selected=inspectStudy({manifestPath:f.manifestPath,inputRoot:f.root,nextSessionId:'fixture-session'});assert.equal(selected.launchGrant.session.name,'S1');
 assert.equal(inspectStudy({manifestPath:f.manifestPath,inputRoot:f.root,nextSessionId:'wrong'}).ready,false);
}
// All concrete artifacts still validate after expiry, but the returned authority
// is settlement-only and cannot make readiness or launch admission true.
{
 const f=fixture(),originalNow=Date.now;
 try{
  Date.now=()=>Date.parse(f.manifest.allocation.expires_at)+1000;
  const result=f.inspect();assert.equal(result.ready,false);assert.equal(result.launchGrant,null);
  assert.equal(result.settlementGrant.settlementOnly,true);assert.ok(result.pending.some(p=>p.code==='ALLOCATION_EXPIRED'));
  assert.equal(result.settlementGrant.manifestDigest,sha(fs.readFileSync(f.manifestPath)));
  f.manifest.authorization=null;const invalid=f.inspect();assert.equal(invalid.settlementGrant,null,'expiry does not bypass actual authorization evidence');
 }finally{Date.now=originalNow;}
}
for(const field of ['execution','projects','kits','schedule','reviewers','authorization','allocation']){
 const f=fixture();f.manifest[field]=null;const result=f.inspect();assert.equal(result.ready,false,field);assert.equal(result.launchGrant,null,field);
}
for(const kind of ['offline','browser','packed','ci','native','smoke','report']){
 const f=fixture();f.manifest.evidence[kind]=null;assert.equal(f.inspect().ready,false,kind);
}
for(const mutation of [v=>v.fixture=true,v=>v.execution_target='f'.repeat(64),v=>v.candidate='f'.repeat(40),v=>v.result='outstanding',v=>v.review=null]){
 const f=fixture();f.modifyEvidence('native',mutation);assert.equal(f.inspect().ready,false);
}
{
 const f=fixture();f.modifyEvidence('smoke',v=>{v.checks.cleanup=false;});assert.equal(f.inspect().ready,false);
 const g=fixture();g.modifyEvidence('ci',v=>{v.matrix.pop();});assert.equal(g.inspect().ready,false);
 const h=fixture();h.manifest.allocation.limit_usd=true;assert.equal(h.inspect().ready,false,'boolean cap is no numeric decision');
 const i=fixture();i.manifest.allocation.limit_usd=4;assert.equal(i.inspect().ready,false,'changed budget not covered by original decision');
 const j=fixture();write(j.root,'scripts/delivery-benchmark-v7/browser.cjs','changed');assert.equal(j.inspect().ready,false,'changed current implementation');
 const k=fixture();k.manifest.execution.native_observation=null;assert.equal(k.inspect().ready,false);
}
{
 const f=fixture('operational-smoke');for(const key of ['native','smoke','report'])f.manifest.evidence[key]=null;f.manifest.execution.native_observation=null;
 assert.equal(f.inspect().ready,true,'operational admission does not depend on its future native observations');
 assert.equal(inspectStudy({manifestPath:f.manifestPath,inputRoot:f.root,purpose:'measured'}).ready,false,'smoke decision cannot admit measured work');
}
{
 const f=fixture();f.put('runs/cli-greenfield/rep-1/plain/record.json',{schema:7,run:'cli-greenfield/rep-1/plain',status:'invalid',events:[]});const result=f.inspect();assert.equal(result.ready,false);assert.ok(result.launchGrant,'accounting cannot erase separately valid static grant');assert.ok(result.pending.some(p=>p.code==='ALLOCATION_COST_UNKNOWN'));
}
{
 const f=fixture();f.manifest.authorization={ref:'../outside',digest:'a'.repeat(64)};assert.equal(f.inspect().ready,false);
 const g=fixture();g.put('secrets.txt','sk-ant-'+ 'X'.repeat(40));g.manifest.authorization={ref:'secrets.txt',digest:'a'.repeat(64)};const result=g.inspect();assert.equal(result.ready,false);assert.ok(!JSON.stringify(result).includes('sk-ant-'));
 const sensitive=fixture();sensitive.manifest.authorization=sensitive.put('decisions/private.json',{apiKey:'short-private-value'});assert.equal(sensitive.inspect().ready,false);
 const h=fixture();fs.symlinkSync(h.manifestPath,path.join(h.root,'linked.json'));h.manifest.authorization={ref:'linked.json',digest:'a'.repeat(64)};assert.equal(h.inspect().ready,false);
}
// Fully re-resolved changed executions cannot reuse old reviewed smoke/CI summaries.
for(const mutate of [f=>f.put('runtime/browser','changed actual browser runtime bytes'),f=>{f.inputs.caps.turns_per_session=4;}]){
 const f=fixture();mutate(f);f.refreshExecution();const result=f.inspect();
 assert.equal(result.ready,false);assert.equal(result.launchGrant,null);
 assert.ok(!result.pending.some(p=>p.path==='execution'),JSON.stringify(result.pending));
 for(const kind of ['smoke','ci','native','browser'])assert.ok(result.pending.some(p=>p.path===`evidence.${kind}`&&p.code==='EVIDENCE_MISSING_OR_MISMATCHED'),kind);
}
{
 const f=fixture(),before=evidenceTarget(f.retained),changed=structuredClone(f.retained);
 changed.effective.configuration.isolation_observation_digest='f'.repeat(64);
 changed.inputs.effective=sha(canonical(changed.effective));changed.inputs.configuration=sha(canonical(changed.effective.configuration));
 assert.equal(evidenceTarget(changed),before,'only reviewed raw-observation digest is excluded');
 changed.effective.configuration.permission_mode='plan';
 assert.notEqual(evidenceTarget(changed),before,'other configuration remains bound');
}
// --- Schema 2 (T-121): the native-login manifest through the same read-only inspector -----
{
 const native=(purpose='measured',extra={})=>fixture(purpose,{schema:2,profile:NATIVE_PROFILE.name,...extra});
 const codes=result=>result.pending.map(p=>p.code);
 {
  const f=native(),before=snapshot(f.root),result=f.inspect();
  assert.equal(result.ready,true,JSON.stringify(result.pending));
  assert.deepEqual(result.launchGrant.billing,{mode:'subscription',tool_surface:'claude-code',status_record_contract:'claude-auth-status-json-v1'});
  assert.equal(result.launchGrant.allocation.billing_mode,'subscription');
  assert.deepEqual(result.launchGrant.allocation.account_usage,{max_sessions:3,max_elapsed_minutes:6,agreed:true});
  assert.equal(result.launchGrant.allocation.limit_estimate_usd,3);
  assert.deepEqual(snapshot(f.root),before,'schema 2 inspection is read-only too');
 }
 assert.equal(native('operational-smoke').inspect().ready,true);
 {const f=native();f.manifest.execution.billing=null;assert.ok(codes(f.inspect()).includes('BILLING_MODE_PENDING'));}
 {const f=native();f.manifest.execution.billing.mode='either';assert.ok(codes(f.inspect()).includes('BILLING_MODE_PENDING'));}
 {const f=native();f.manifest.execution.billing.tool_surface='codex';assert.ok(codes(f.inspect()).includes('SURFACE_UNSUPPORTED'),'a Codex record is refused, never relabelled');}
 {const f=native();f.manifest.execution.billing.status_record_contract='invented';assert.ok(codes(f.inspect()).includes('LOGIN_STATUS_CONTRACT_PENDING'));}
 {const f=native();f.manifest.allocation.account_usage=null;assert.ok(codes(f.inspect()).includes('ACCOUNT_USAGE_PENDING'));}
 {const f=native();f.manifest.allocation.account_usage.agreed=false;assert.ok(codes(f.inspect()).includes('ACCOUNT_USAGE_PENDING'));}
 {const f=native();f.modifyAuthorization(d=>{d.account_usage.max_sessions=9;});assert.ok(codes(f.inspect()).includes('ACCOUNT_USAGE_PENDING'),'the envelope is the user decision, not the manifest');}
 {const f=native();f.modifyAuthorization(d=>{d.limit_usd=3;});assert.ok(codes(f.inspect()).includes('LEGACY_FIELD_REFUSED'));}
 {const f=native();f.modifyAuthorization(d=>{d.billing_mode='api';});assert.ok(codes(f.inspect()).includes('BILLING_MODE_PENDING'));}
 {const f=native();f.modifyAuthorization(d=>{d.session_turns=4;});assert.ok(codes(f.inspect()).includes('AUTHORIZATION_SCOPE_MISMATCH'));}
 {const f=native();f.manifest.allocation.session_estimate_cap_usd=2;assert.ok(codes(f.inspect()).includes('CAPS_DECISION_MISMATCH'));}
 {const f=native();f.modifyEvidence('native',v=>{v.checks.login_preserved=false;});assert.ok(codes(f.inspect()).includes('NATIVE_OBSERVATIONS_INCOMPLETE'));}
 {const f=native();f.modifyEvidence('native',v=>{delete v.checks.override_refused;});assert.ok(codes(f.inspect()).includes('NATIVE_OBSERVATIONS_INCOMPLETE'));}
 {const f=native();f.modifyEvidence('smoke',v=>{v.checks.charge_unavailable_labelled=false;});assert.ok(codes(f.inspect()).includes('SMOKE_OBSERVATIONS_INCOMPLETE'));}
 {const f=native();f.modifyEvidence('smoke',v=>{v.checks.estimate_captured=false;});assert.ok(codes(f.inspect()).includes('SMOKE_OBSERVATIONS_INCOMPLETE'));}
 // A native cohort under schema 1 is pending its billing declaration; schema 2 cannot carry
 // the historical profile; an unknown profile is unbound.
 assert.ok(codes(fixture('measured',{schema:1,profile:NATIVE_PROFILE.name}).inspect()).includes('BILLING_MODE_PENDING'));
 assert.ok(codes(fixture('measured',{schema:2,profile:PROFILE.name}).inspect()).includes('PROFILE_INCOMPATIBLE'));
 assert.ok(codes(fixture('measured',{schema:2,profile:'claude-project-native-login-v2'}).inspect()).includes('PROFILE_UNBOUND'));
}
for(const [key,value] of Object.entries(saved))child[key]=value;
const command=path.join(repo,'scripts/delivery-benchmark-v7/readiness.cjs');
const pending=saved.spawnSync(process.execPath,[command,'--manifest',path.join(repo,'docs/prd-v8-artifacts/execution/study.json'),'--require-ready'],{cwd:repo,encoding:'utf8'});
assert.equal(pending.status,2);assert.equal(JSON.parse(pending.stdout).ready,false);
{
 const f=fixture(),before=snapshot(f.root);
 const result=saved.spawnSync(process.execPath,[command,'--manifest',f.manifestPath,'--input-root',f.root,'--require-ready'],{encoding:'utf8'});
 assert.equal(result.status,0,result.stdout+result.stderr);assert.deepEqual(snapshot(f.root),before);
}
console.log('study readiness tests passed (schema 1 and schema 2 synthetic documents validate refusal mechanics only; no native evidence created)');

// A solo operator is allowed only for schema-2 operational smoke, with a scoped decision.
function soloSmoke(){
 const f=fixture('operational-smoke',{schema:2,profile:NATIVE_PROFILE.name});
 const reviewer=f.manifest.reviewers[0];
 const decision=JSON.parse(fs.readFileSync(path.join(f.root,reviewer.decision.ref),'utf8'));
 Object.assign(decision,{kind:'operational-smoke-reviewer-decision',purpose:'operational-smoke',candidate:f.manifest.execution.candidate,independent:false});
 reviewer.independent=false;reviewer.decision=f.put(reviewer.decision.ref,decision);f.manifest.reviewers=[reviewer];
 return {f,reviewer,decision};
}
{
 const {f}=soloSmoke();assert.equal(f.inspect().ready,true);
 const result=inspectStudy({manifestPath:f.manifestPath,inputRoot:f.root,purpose:'measured'});
 assert.equal(result.ready,false);assert.ok(result.pending.some(p=>p.code==='INDEPENDENT_REVIEWERS_PENDING'));
}
for(const change of [d=>d.purpose='measured',d=>d.candidate='f'.repeat(40),d=>d.decided_by='agent',d=>d.approved=false,d=>d.independent=true]){
 const {f,reviewer,decision}=soloSmoke();change(decision);reviewer.decision=f.put(reviewer.decision.ref,decision);
 assert.equal(f.inspect().ready,false,'unapproved or differently scoped operator decision is refused');
}
{const {f}=soloSmoke();f.manifest.reviewers=[];assert.equal(f.inspect().ready,false);}
{const {f}=soloSmoke();f.modifyEvidence('ci',v=>v.review=null);assert.equal(f.inspect().ready,false,'solo smoke still needs actual evidence review');}
console.log('solo operational-smoke reviewer boundaries passed');

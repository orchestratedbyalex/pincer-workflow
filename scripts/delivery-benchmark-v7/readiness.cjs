'use strict';
// T-109: retained evidence and decisions only. No process, browser or model launch.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { secretIn, unsafe } = require('./freeze.cjs');
const { canonical, contained, tree, browserRuntimeTree } = require('./effective.cjs');
const SHA = /^[a-f0-9]{64}$/, COMMIT = /^[a-f0-9]{40}$/;
const ARMS = ['plain', 'pincer', 'strict'];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const positive = value => typeof value === 'number' && Number.isFinite(value) && value > 0;
function need(test, code) { if (!test) throw new Error(code); }
function shape(value, fields, code) { need(object(value) && Object.keys(value).every(k => fields.includes(k)), code); }
function safe(root, relative) {
  need(!unsafe(relative), 'PATH_INVALID');
  need(!/(?:^|\/)(?:\.env(?:\.[^/]*)?|\.ssh|\.aws|\.credentials(?:\.json)?|credentials(?:\.json)?|secrets?(?:\.[^/]*)?)(?:\/|$)/i.test(relative), 'PROTECTED_PATH');
  return contained(root, relative);
}
function read(root, relative, max = 2 * 1024 * 1024) {
  const full = safe(root, relative), stat = fs.statSync(full);
  need(stat.isFile() && stat.size <= max, 'ARTIFACT_SIZE_INVALID');
  const bytes = fs.readFileSync(full);
  const text=bytes.toString('utf8');
  need(!secretIn(text), 'SECRET_MATERIAL_REFUSED');
  let structured;try{structured=JSON.parse(text);}catch{}
  const queue=[structured];let nodes=0;
  while(queue.length){const value=queue.pop();if(!value||typeof value!=='object')continue;need(++nodes<=10000,'ARTIFACT_STRUCTURE_LIMIT');for(const [key,entry]of Object.entries(value)){need(!/^(?:api_?key|password|passwd|secret|credentials|access_token|refresh_token|authorization_header|cookie|private_key)$/i.test(key),'SECRET_MATERIAL_REFUSED');if(entry&&typeof entry==='object')queue.push(entry);}}
  return bytes;
}
function json(root, relative) {
  try { return JSON.parse(read(root, relative).toString('utf8')); }
  catch (error) { if (/^[A-Z_]+$/.test(error.message)) throw error; throw new Error('JSON_ARTIFACT_INVALID'); }
}
function reference(root, ref) {
  shape(ref, ['ref', 'digest'], 'REFERENCE_INVALID');
  need(SHA.test(ref.digest || ''), 'REFERENCE_DIGEST_INVALID');
  const bytes = read(root, ref.ref);
  need(hash(bytes) === ref.digest, 'ARTIFACT_CHANGED');
  try { return JSON.parse(bytes.toString('utf8')); } catch { return null; }
}
function support(root, refs) {
  need(Array.isArray(refs) && refs.length > 0 && refs.length <= 100, 'SUPPORTING_EVIDENCE_MISSING');
  for (const ref of refs) reference(root, ref);
}
function decision(root, ref, kind) {
  const value = reference(root, ref);
  need(object(value) && value.schema === 1 && value.kind === kind && value.approved === true && typeof value.decided_by === 'string' && value.decided_by.trim() && Number.isFinite(Date.parse(value.decided_at)), 'DECISION_INVALID');
  support(root, value.evidence);
  return value;
}
function fileDigest(full) {
  const stat=fs.statSync(full);need(stat.isFile()&&stat.size<=1024*1024*1024,'INPUT_SIZE_INVALID');
  const fd=fs.openSync(full,'r'), h=crypto.createHash('sha256'), buffer=Buffer.alloc(1024*1024);
  try { let size;while((size=fs.readSync(fd,buffer,0,buffer.length,null)))h.update(buffer.subarray(0,size)); }
  finally { fs.closeSync(fd); }
  return h.digest('hex');
}
// Evidence stays bound to the whole execution while adding the reviewed raw isolation
// observation does not make the evidence depend on its own digest.
function evidenceTarget(manifest) {
  need(object(manifest?.effective)&&object(manifest.effective.configuration)&&object(manifest.inputs)&&Array.isArray(manifest.order),'EVIDENCE_TARGET_INPUT_INVALID');
  const effective=structuredClone(manifest.effective);
  delete effective.configuration.isolation_observation_digest;
  const inputs={...manifest.inputs,effective:hash(canonical(effective)),configuration:hash(canonical(effective.configuration))};
  return hash(canonical({inputs,order:manifest.order}));
}
function inspectStudy({ manifestPath, inputRoot, purpose, nextSessionId } = {}) {
  const pending=[];
  const add=(code,at)=>pending.push({code,path:at,detail:code.toLowerCase().replace(/_/g,' ')});
  let root, full, manifest;
  try {
    full=path.join(fs.realpathSync(path.dirname(path.resolve(manifestPath))),path.basename(manifestPath));root=fs.realpathSync(inputRoot || process.cwd());
    manifest=json(root,path.relative(root,full).split(path.sep).join('/'));
    shape(manifest,['schema','kind','status','execution','projects','kits','schedule','reviewers','authorization','allocation','stop_resume','evidence','pending_notes'],'STUDY_MANIFEST_INVALID');
    // Schema 1 (historical API-key path) validates exactly as before. Schema 2 (T-121) adds
    // the declared billing mode, estimate-cap allocation fields, the agreed account-usage
    // envelope and the native-login evidence checks.
    need([1,2].includes(manifest.schema)&&manifest.kind==='pincer-study-readiness','STUDY_MANIFEST_INVALID');
  } catch(error) { add(/^[A-Z_]+$/.test(error.message)?error.message:'MANIFEST_UNREADABLE','manifest');return {ready:false,phase:'pending',pending,launchGrant:null,settlementGrant:null,allocation:null}; }
  purpose=purpose || 'measured';
  if(!['operational-smoke','measured'].includes(purpose))add('PURPOSE_INVALID','purpose');
  const check=(at,fn)=>{try{return fn();}catch(error){add(/^[A-Z_]+$/.test(error.message)?error.message:'REQUIRED_ARTIFACT_UNAVAILABLE',at);return null;}};
  const execution=check('execution',()=>{
    const ex=manifest.execution;
    shape(ex,['candidate','effective','observation_target','evidence_target','inputs','native_observation','browser_runtime_root','source_root',...(manifest.schema===2?['billing']:[])],'EXECUTION_IDENTITY_PENDING');
    need(COMMIT.test(ex.candidate||'')&&SHA.test(ex.observation_target||''),'EXECUTION_IDENTITY_PENDING');
    const retained=reference(root,ex.effective);
    need(retained?.schema===2&&SHA.test(retained.cohort||'')&&retained.effective?.tool?.kind==='native','NATIVE_EFFECTIVE_IDENTITY_REQUIRED');
    need(object(retained.inputs)&&Array.isArray(retained.order)&&retained.inputs.effective===hash(canonical(retained.effective))&&retained.cohort===hash(canonical({inputs:retained.inputs,order:retained.order}))&&canonical(retained.caps)===canonical(retained.effective.caps),'EFFECTIVE_MANIFEST_INCONSISTENT');
    const launcher=require('./isolated-launch.cjs');
    need(Object.hasOwn(launcher.PROFILES,retained.effective.configuration?.isolation_profile),'PROFILE_UNBOUND');
    need(ex.observation_target===launcher.observationTarget(retained),'OBSERVATION_TARGET_MISMATCH');
    need(ex.evidence_target===evidenceTarget(retained),'EVIDENCE_TARGET_MISMATCH');
    need(retained.effective.browser&&retained.effective.configuration?.isolation_profile,'EXECUTION_CAPABILITIES_PENDING');
    need(Array.isArray(ex.inputs)&&ex.inputs.length>0&&ex.inputs.length<=10000,'CURRENT_INPUT_INVENTORY_REQUIRED');
    const inputs=new Map();
    for(const ref of ex.inputs){shape(ref,['ref','digest'],'INPUT_REFERENCE_INVALID');need(SHA.test(ref.digest||'')&&!inputs.has(ref.ref),'INPUT_REFERENCE_INVALID');need(fileDigest(safe(root,ref.ref))===ref.digest,'CURRENT_INPUT_CHANGED');inputs.set(ref.ref,ref.digest);}
    const sourceRoot=ex.source_root?safe(root,ex.source_root):root;
    const frozen=require('./freeze.cjs').compute(sourceRoot,require('./freeze-spec.cjs').SPEC);
    need(['protocol','harness','briefs','evaluators','collector','driver'].every(k=>frozen.inputs[k]===retained.inputs[k]),'FROZEN_EXECUTION_CHANGED');
    const helperFiles=Object.fromEntries(Object.entries(retained.effective.helpers?.files||{}).map(([p,d])=>[ex.source_root?`${ex.source_root}/${p}`:p,d]));
    const expected={...helperFiles,...(retained.effective.browser.files||{}),...(retained.effective.browser.runtime?.files||{})};
    need(Object.keys(expected).length>0&&Object.entries(expected).every(([p,d])=>inputs.get(p)===d),'EXECUTION_INPUT_CLOSURE_INCOMPLETE');
    need(canonical(tree(sourceRoot,'scripts/delivery-benchmark-v7'))===canonical(retained.effective.helpers),'HELPER_CLOSURE_CHANGED');
    const runtime=browserRuntimeTree(root,ex.browser_runtime_root);
    need(runtime.digest===retained.effective.browser.runtime.digest,'BROWSER_RUNTIME_CHANGED');
    need(ex.inputs.some(x=>x.digest===retained.effective.tool.digest),'TOOL_ARTIFACT_UNBOUND');
    return {...ex,retained,effective_digest:retained.cohort};
  });
  // The declared billing mode (schema 2). A native-login cohort under a schema-1 manifest has
  // no declaration and is pending; a historical API-key cohort cannot carry a schema-2 one.
  const NATIVE_PROFILE=require('./isolated-launch.cjs').NATIVE_PROFILE.name;
  const nativeCohort=execution?execution.retained.effective.configuration.isolation_profile===NATIVE_PROFILE:null;
  const billing=execution?check('execution.billing',()=>{
    if(manifest.schema===1){need(!nativeCohort,'BILLING_MODE_PENDING');return null;}
    need(nativeCohort,'PROFILE_INCOMPATIBLE');
    const b=manifest.execution.billing;shape(b,['mode','tool_surface','status_record_contract'],'BILLING_MODE_PENDING');
    need(['subscription','api'].includes(b.mode),'BILLING_MODE_PENDING');
    need(b.tool_surface==='claude-code','SURFACE_UNSUPPORTED');
    need(b.status_record_contract==='claude-auth-status-json-v1','LOGIN_STATUS_CONTRACT_PENDING');
    return b;
  }):null;
  const projects=check('projects',()=>{
    need(Array.isArray(manifest.projects)&&manifest.projects.length>0&&manifest.projects.length<=100,'PROJECT_ACCESS_PENDING');
    const ids=new Set();
    for(const project of manifest.projects){shape(project,['id','base','access'],'PROJECT_INVALID');need(typeof project.id==='string'&&/^[a-z0-9-]+$/.test(project.id)&&!ids.has(project.id)&&COMMIT.test(project.base||''),'PROJECT_INVALID');ids.add(project.id);const d=decision(root,project.access,'project-access-decision');need(d.project===project.id&&d.base===project.base,'PROJECT_ACCESS_MISMATCH');}
    return manifest.projects;
  });
  const kits=check('kits',()=>{
    need(Array.isArray(manifest.kits)&&manifest.kits.length>0&&manifest.kits.length<=10,'KIT_SELECTION_PENDING');const ids=new Set();
    for(const kit of manifest.kits){shape(kit,['id','commit','artifact'],'KIT_INVALID');need(['K0','K1','K2'].includes(kit.id)&&!ids.has(kit.id)&&COMMIT.test(kit.commit||''),'KIT_INVALID');ids.add(kit.id);shape(kit.artifact,['ref','digest'],'KIT_INVALID');need(SHA.test(kit.artifact.digest||'')&&fileDigest(safe(root,kit.artifact.ref))===kit.artifact.digest,'KIT_ARTIFACT_CHANGED');}
    return manifest.kits;
  });
  const reviewers=check('reviewers',()=>{
    // A schema-2 operational smoke checks mechanics, not comparative benefit.
    // Its sole operator is explicitly non-independent and cannot qualify measured use.
    if(manifest.schema===2&&purpose==='operational-smoke'&&Array.isArray(manifest.reviewers)&&manifest.reviewers.length===1){
      const reviewer=manifest.reviewers[0];
      shape(reviewer,['id','independent','decision'],'REVIEWER_INVALID');
      need(typeof reviewer.id==='string'&&reviewer.id.trim()&&reviewer.independent===false,'REVIEWER_INVALID');
      const d=decision(root,reviewer.decision,'operational-smoke-reviewer-decision');
      need(d.decided_by==='user'&&d.reviewer===reviewer.id&&d.independent===false&&d.purpose==='operational-smoke'&&d.candidate===execution?.candidate,'REVIEWER_DECISION_MISMATCH');
      return manifest.reviewers;
    }
    need(Array.isArray(manifest.reviewers)&&manifest.reviewers.length>=2&&manifest.reviewers.length<=20,'INDEPENDENT_REVIEWERS_PENDING');const ids=new Set();
    for(const reviewer of manifest.reviewers){shape(reviewer,['id','independent','decision'],'REVIEWER_INVALID');need(typeof reviewer.id==='string'&&reviewer.id.trim()&&!ids.has(reviewer.id)&&reviewer.independent===true,'REVIEWER_INVALID');ids.add(reviewer.id);const d=decision(root,reviewer.decision,'reviewer-participation-decision');need(d.reviewer===reviewer.id&&d.independent===true,'REVIEWER_DECISION_MISMATCH');}
    return manifest.reviewers;
  });
  const schedule=check('schedule',()=>{
    need(Array.isArray(manifest.schedule)&&manifest.schedule.length>0&&manifest.schedule.length<=1000,'EXACT_SCHEDULE_PENDING');const ids=new Set();
    for(const s of manifest.schedule){shape(s,['id','run','name','arm','purpose','project','kit','prompt_digest','effective_digest'],'SCHEDULE_INVALID');need(typeof s.id==='string'&&/^[A-Za-z0-9._:/-]+$/.test(s.id)&&!ids.has(s.id)&&!unsafe(s.run)&&/^S[1-9][0-9]*$/.test(s.name||'')&&ARMS.includes(s.arm)&&['operational-smoke','measured'].includes(s.purpose)&&SHA.test(s.prompt_digest||'')&&SHA.test(s.effective_digest||''),'SCHEDULE_INVALID');ids.add(s.id);need(projects?.some(p=>p.id===s.project)&&kits?.some(k=>k.id===s.kit),'SCHEDULE_INPUT_UNBOUND');const selectedKit=kits.find(k=>k.id===s.kit);need(execution&&selectedKit.commit===execution.retained.effective.kit.commit&&selectedKit.artifact.digest===execution.retained.effective.kit.digest,'SCHEDULE_KIT_MISMATCH');need(execution&&s.effective_digest===execution.effective_digest,'SCHEDULE_EXECUTION_MISMATCH');}
    need(manifest.schedule.some(s=>s.purpose===purpose),'PURPOSE_NOT_SCHEDULED');
    if(nextSessionId)need(manifest.schedule.some(s=>s.id===nextSessionId&&s.purpose===purpose),'SESSION_NOT_AUTHORIZED');
    return manifest.schedule;
  });
  const allocation=check('allocation',()=>{
    const a=manifest.allocation;
    if(manifest.schema===2){
      // Estimate caps and the agreed account-usage envelope. `session_estimate_cap_usd` is the
      // `--max-budget-usd` list-price cap, `limit_estimate_usd` the aggregate the allocator may
      // reserve; neither is a charge, and the runner enforces no plan quota.
      shape(a,['id','root','decision','session_estimate_cap_usd','limit_estimate_usd','session_wall_minutes','account_usage','expires_at'],'NUMERIC_ALLOCATION_PENDING');
      need(typeof a.id==='string'&&/^[a-zA-Z0-9_-]+$/.test(a.id)&&positive(a.limit_estimate_usd)&&positive(a.session_estimate_cap_usd)&&a.session_estimate_cap_usd<=a.limit_estimate_usd&&Number.isSafeInteger(a.session_wall_minutes)&&a.session_wall_minutes>0,'NUMERIC_ALLOCATION_PENDING');
      const u=a.account_usage;shape(u,['max_sessions','max_elapsed_minutes','agreed'],'ACCOUNT_USAGE_PENDING');
      need(Number.isSafeInteger(u.max_sessions)&&u.max_sessions>0&&positive(u.max_elapsed_minutes)&&u.agreed===true,'ACCOUNT_USAGE_PENDING');
    } else {
      shape(a,['id','root','decision','limit_usd','session_cap_usd','session_wall_minutes','max_elapsed_minutes','expires_at'],'NUMERIC_ALLOCATION_PENDING');
      need(typeof a.id==='string'&&/^[a-zA-Z0-9_-]+$/.test(a.id)&&positive(a.limit_usd)&&positive(a.session_cap_usd)&&a.session_cap_usd<=a.limit_usd&&Number.isSafeInteger(a.session_wall_minutes)&&a.session_wall_minutes>0&&positive(a.max_elapsed_minutes),'NUMERIC_ALLOCATION_PENDING');
    }
    need(Number.isFinite(Date.parse(a.expires_at)),'ALLOCATION_EXPIRY_INVALID');
    need(!unsafe(a.root),'ALLOCATION_ROOT_INVALID');
    // Ledger creation belongs to the allocator; inspection accepts a nonexistent leaf.
    let ancestor=root;for(const part of a.root.split('/')){ancestor=path.join(ancestor,part);if(fs.existsSync(ancestor))need(!fs.lstatSync(ancestor).isSymbolicLink(),'ALLOCATION_ROOT_INVALID');}
    const sessionCap=manifest.schema===2?a.session_estimate_cap_usd:a.session_cap_usd;
    need(execution&&execution.retained.caps.spend_usd===sessionCap&&execution.retained.caps.wall_clock_minutes===a.session_wall_minutes,'CAPS_DECISION_MISMATCH');
    return {...a,root:path.join(root,a.root),...(manifest.schema===2&&billing?{billing_mode:billing.mode}:{})};
  });
  const authorization=check('authorization',()=>{
    need(manifest.authorization,'ACTUAL_AUTHORIZATION_PENDING');
    const d=decision(root,manifest.authorization,'study-authorization');
    if(manifest.schema===2){
      // The user's decision names the billing mode, the estimate caps, the turn cap and the
      // account-usage envelope; the historical dollar fields are refused, never reinterpreted.
      for(const legacy of ['limit_usd','session_cap_usd','max_elapsed_minutes','api_key','apiKey'])need(!Object.hasOwn(d,legacy),'LEGACY_FIELD_REFUSED');
      need(billing&&d.billing_mode===billing.mode,'BILLING_MODE_PENDING');
      need(allocation&&object(d.account_usage)&&canonical(d.account_usage)===canonical(allocation.account_usage),'ACCOUNT_USAGE_PENDING');
      need(d.decided_by==='user'&&d.purpose===purpose&&allocation&&d.allocation_id===allocation.id&&d.limit_estimate_usd===allocation.limit_estimate_usd&&d.session_estimate_cap_usd===allocation.session_estimate_cap_usd&&d.session_wall_minutes===allocation.session_wall_minutes&&execution&&d.session_turns===execution.retained.caps.turns_per_session&&d.expires_at===allocation.expires_at&&schedule&&d.schedule_digest===hash(canonical(schedule)),'AUTHORIZATION_SCOPE_MISMATCH');
    } else {
      need(d.decided_by==='user'&&d.purpose===purpose&&allocation&&d.allocation_id===allocation.id&&d.limit_usd===allocation.limit_usd&&d.session_cap_usd===allocation.session_cap_usd&&d.session_wall_minutes===allocation.session_wall_minutes&&d.max_elapsed_minutes===allocation.max_elapsed_minutes&&d.expires_at===allocation.expires_at&&schedule&&d.schedule_digest===hash(canonical(schedule)),'AUTHORIZATION_SCOPE_MISMATCH');
    }
    need(canonical(manifest.authorization)===canonical(manifest.allocation.decision),'ALLOCATION_DECISION_MISMATCH');return manifest.authorization;
  });
  check('stop_resume',()=>{const s=manifest.stop_resume;shape(s,['unknown_cost','account_limit','exhausted_allocation','changed_inputs','resume'],'STOP_RESUME_PENDING');need(['unknown_cost','account_limit','exhausted_allocation','changed_inputs'].every(k=>s[k]==='stop')&&s.resume==='explicit-recorded-decision','STOP_RESUME_PENDING');});
  const evidence=object(manifest.evidence)?manifest.evidence:{};
  function reviewed(value){need(reviewers?.some(r=>r.id===value.review?.reviewer),'EVIDENCE_REVIEW_PENDING');const d=decision(root,value.review?.decision,'evidence-review-decision');need(d.reviewer===value.review.reviewer&&d.candidate===execution?.candidate&&d.kind_reviewed===value.kind,'EVIDENCE_REVIEW_MISMATCH');}
  function retained(kind,{native=false}={}){return check(`evidence.${kind}`,()=>{need(evidence[kind],'RETAINED_EVIDENCE_PENDING');const value=reference(root,evidence[kind]);need(value?.schema===1&&value.kind===kind&&value.result==='passed'&&value.candidate===execution?.candidate&&value.execution_target===execution?.evidence_target,'EVIDENCE_MISSING_OR_MISMATCHED');if(native||kind==='browser')need(value.fixture===false,'SYNTHETIC_OBSERVATION_REFUSED');support(root,value.evidence);reviewed(value);return value;});}
  for(const kind of ['offline','browser','packed'])retained(kind);
  const ci=retained('ci');if(ci)check('evidence.ci.matrix',()=>{need(Array.isArray(ci.matrix)&&['ubuntu:22','ubuntu:24','macos:22','macos:24'].every(key=>ci.matrix.some(row=>`${row.os}:${row.node}`===key&&row.result==='passed')),'CI_MATRIX_INCOMPLETE');});
  if(purpose==='measured'){
    check('execution.native_observation',()=>{
      need(execution?.native_observation,'NATIVE_ISOLATION_OBSERVATION_PENDING');
      const observation=reference(root,execution.native_observation);
      need(execution.native_observation.digest===execution.retained.effective.configuration.isolation_observation_digest,'NATIVE_ISOLATION_DIGEST_MISMATCH');
      need(observation?.schema===1&&observation.kind==='native-isolation-observation'&&observation.fixture===false&&observation.target===execution.observation_target&&ARMS.every(a=>observation.arms?.includes(a))&&observation.host_policy_observed===true&&observation.authentication_observed===true&&observation.personal_configuration_absent===true,'NATIVE_ISOLATION_OBSERVATION_INVALID');
      support(root,observation.evidence?.map(x=>({ref:x.path,digest:x.digest})));
    });
    // Schema 2 adds the native-login checks: the login survived the constructed environment,
    // the override refusal was exercised (offline, with a synthetic variable), the status
    // record holds only its sanitized fields, and the billing mode matched the login; the
    // smoke additionally labelled the estimate and the unavailable charge.
    const nativeChecks=['host_policy','authentication','personal_configuration_absent','kit_mechanisms',...(manifest.schema===2?['login_preserved','override_refused','status_record_sanitized','billing_mode_consistent']:[])];
    const smokeChecks=['payload_capture','isolation','browser','stop','cleanup','report_regeneration',...(manifest.schema===2?['estimate_captured','charge_unavailable_labelled']:[])];
    const native=retained('native',{native:true});
    if(native)check('evidence.native.checks',()=>need(ARMS.every(arm=>native.arms?.includes(arm))&&nativeChecks.every(k=>native.checks?.[k]===true),'NATIVE_OBSERVATIONS_INCOMPLETE'));
    const smoke=retained('smoke',{native:true});
    if(smoke)check('evidence.smoke.checks',()=>need(smoke.purpose==='operational-smoke'&&ARMS.every(arm=>smoke.arms?.includes(arm))&&smokeChecks.every(k=>smoke.checks?.[k]===true),'SMOKE_OBSERVATIONS_INCOMPLETE'));
    retained('report',{native:true});
  }
  let launchGrant=null, settlementGrant=null, accounting=null;
  if(!pending.length){launchGrant={schema:1,manifestPath:full,manifestDigest:hash(read(root,path.relative(root,full).split(path.sep).join('/'))),inputRoot:root,purpose,allocation,projects,kits,sessions:schedule.filter(s=>s.purpose===purpose),execution:{candidate:execution.candidate,effective_digest:execution.effective_digest,observation_target:execution.observation_target,evidence_target:execution.evidence_target},decision:authorization,authorization:{decisionRef:authorization.ref,decisionDigest:authorization.digest},observationFile:execution.native_observation?.ref||null,billing:billing||null,session:nextSessionId?schedule.find(s=>s.id===nextSessionId):null};
    if(Date.parse(allocation.expires_at)<=Date.now()){
      settlementGrant={...launchGrant,settlementOnly:true};launchGrant=null;
      add('ALLOCATION_EXPIRED','allocation');
    }else accounting=check('accounting',()=>require('./allocation.cjs').inspect({grant:launchGrant}));
    if(accounting&&!accounting.ready)for(const reason of accounting.reasons||[])add(reason.code,'accounting');
  }
  return {ready:pending.length===0,phase:pending.length?'pending':purpose==='operational-smoke'?'offline-ready-for-smoke':'evidence-ready-for-measured',pending,launchGrant,settlementGrant,allocation:accounting};
}
function cli(argv){
  const opts={};let requireReady=false;
  for(let i=0;i<argv.length;i++){const key=argv[i];if(key==='--require-ready'){need(!requireReady,'DUPLICATE_ARGUMENT');requireReady=true;}else{need(['--manifest','--input-root','--purpose','--session'].includes(key)&&argv[i+1]&&!argv[i+1].startsWith('--')&&!Object.hasOwn(opts,key),'ARGUMENT_INVALID');opts[key]=argv[++i];}}
  need(opts['--manifest'],'MANIFEST_REQUIRED');
  const result=inspectStudy({manifestPath:opts['--manifest'],inputRoot:opts['--input-root'],purpose:opts['--purpose'],nextSessionId:opts['--session']});
  process.stdout.write(`${JSON.stringify(result,null,2)}\n`);return requireReady&&!result.ready?2:0;
}
if(require.main===module){try{process.exitCode=cli(process.argv.slice(2));}catch(error){process.stderr.write('readiness: invalid arguments or unreadable study input\n');process.exitCode=2;}}
module.exports={inspectStudy,evidenceTarget,cli};

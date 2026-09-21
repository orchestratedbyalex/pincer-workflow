'use strict';
// Versioned measurement metadata; ownership and record publication stay in orchestrator.
// Every mutator runs under the cell claim. Callers checkpoint begin/intent before effects.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const claims = require('./run-claims.cjs');
const freeze = require('./freeze.cjs');
const SCHEMA = 8;
const now = () => new Date().toISOString();
function fail(code, message) { throw Object.assign(new Error(message), { code }); }
function eventId(record, attempt, suffix) { return `${record.run}:${attempt.id}:${suffix}`; }
function location(home, attempt, leaf) {
  const relative = attempt.origin === 'legacy' ? leaf : `${attempt.directory}/${leaf}`;
  return claims.contained(home, relative);
}
function legacyPresent(home, record) {
  return ['workspace','logs','scratch'].some(name => fs.existsSync(claims.contained(home,name))) || record.events.some(e => e.kind === 'session' || e.kind === 'evaluation' || (e.kind === 'stage' && e.stage === 'setup'));
}
function resumeTarget(home, record) {
  if (record.schema === SCHEMA && record.attempts.length) return record.attempts.at(-1).id;
  return legacyPresent(home, record) ? 'legacy' : null;
}
function requireResume(home, record, decision) {
  const target = resumeTarget(home, record);
  if (!target) return;
  if (!decision || decision.attempt !== target || typeof decision.reason !== 'string' || !decision.reason.trim() || decision.reason.length > 500) fail('ATTEMPT_RESUME_REQUIRED', `Interrupted ${target} requires resumeInterrupted={attempt:${JSON.stringify(target)},reason:<bounded operator decision>}; retained work was not changed.`);
}
function legacyAttempt(home, record, sessionNames) {
  const sessions = [];
  for (const name of sessionNames) {
    const event = record.events.find(e => e.kind === 'session' && e.id === `${record.run}:${name}`);
    const payload = `logs/${name}.json`;
    // Missing later prompts may have launched after the last old checkpoint. Their
    // cost is unknown, never inferred to be zero from a completed earlier session.
    sessions.push({ id:`legacy-000001:${name}`, name, status:event?.ended ? 'completed' : 'unavailable', intent_at:event?.started || null, ended:event?.ended || null,
      payload, stderr:`logs/${name}.err`, unavailable:event?.ended ? null : 'Legacy session has no durable launch/completion checkpoint; usage may be missing or partial.' });
  }
  return {id:'legacy-000001',origin:'legacy',directory:'.',status:'interrupted',started:record.events.find(e=>e.started)?.started || null,ended:now(),reason:'Legacy checkpoint imported without rewriting its events or root artifacts.',base:record.provenance.base || null,configuration_digest:null,unrelated_inputs:null,sessions,evaluation:record.events.some(e=>e.kind==='evaluation')?'completed':'not-started'};
}
function begin(home, record, { resumeInterrupted = null, sessionNames = [] } = {}) {
  if (record.status !== 'pending') fail('ATTEMPT_TERMINAL', 'A terminal cell cannot start another attempt');
  if (![7,SCHEMA].includes(record.schema)) fail('ATTEMPT_SCHEMA', 'Unsupported measurement schema');
  requireResume(home, record, resumeInterrupted);
  if (record.schema === 7) {
    const prior=legacyPresent(home,record);
    record.schema=SCHEMA; record.attempts=prior?[legacyAttempt(home,record,sessionNames)]:[];
  }
  const previous=record.attempts.at(-1);
  if (previous) {
    if (previous.status === 'completed') fail('ATTEMPT_TERMINAL', 'Completed attempt cannot be silently replayed');
    previous.status='interrupted'; previous.ended=previous.ended || now(); previous.reason=previous.reason || resumeInterrupted.reason;
    for (const session of previous.sessions) if(session.status==='intent') {session.status='unavailable';session.unavailable='Launch intent persisted but no completion checkpoint; retained output may be missing or partial.';}
  }
  const number=record.attempts.filter(a=>a.origin==='v8').length+1;
  const id=`attempt-${String(number).padStart(6,'0')}`;
  const attempt={id,origin:'v8',directory:`attempts/${id}`,status:'running',started:now(),ended:null,reason:null,base:null,configuration_digest:null,unrelated_inputs:null,sessions:[],evaluation:'not-started'};
  // Never use an existing directory even if the record was manually rolled back.
  if(fs.existsSync(claims.contained(home,attempt.directory))) fail('ATTEMPT_PATH_EXISTS', `Attempt path already exists: ${attempt.directory}; preserve it for investigation`);
  record.attempts.push(attempt);
  if(previous) record.events.push({kind:'intervention',id:eventId(record,attempt,'resume'),started:attempt.started,ended:attempt.started,intervention:'operator',detail:`Explicit resume after ${previous.id}: ${resumeInterrupted.reason}`.slice(0,4000)});
  return attempt;
}
function intent(record, attempt, name, prompt) {
  if(!/^S[1-9][0-9]*$/.test(name) || attempt.sessions.some(s=>s.name===name)) fail('SESSION_ID_INVALID','Session name must be unique and match S<number>');
  const started=now();
  const session={id:`${attempt.id}:${name}`,name,status:'intent',intent_at:started,ended:null,payload:`${attempt.directory}/logs/${name}.json`,stderr:`${attempt.directory}/logs/${name}.err`,unavailable:null};
  attempt.sessions.push(session);
  record.events.push({kind:'session',id:eventId(record,attempt,name),started,ended:null,prompt});
  return session;
}
function sessionEnd(record, attempt, session, result) {
  if(session.status!=='intent') fail('SESSION_ALREADY_CLOSED','A completed session cannot be overwritten');
  const event=record.events.find(e=>e.id===eventId(record,attempt,session.name));
  if(!event) fail('SESSION_EVENT_MISSING','Launch intent event missing');
  session.ended=result.ended || now();session.status=result.refused?'unavailable':'completed';
  session.unavailable=result.refused?'Driver refused after durable intent; no complete provider usage was captured.':null;
  event.ended=session.ended;
}
function finish(attempt) { attempt.status='completed';attempt.ended=now();attempt.reason=null; }
function gitObjectCommand(cwd, args, input) {
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('GIT_')));
  Object.assign(env,{GIT_CONFIG_SYSTEM:'/dev/null',GIT_CONFIG_GLOBAL:'/dev/null',GIT_CONFIG_NOSYSTEM:'1',GIT_ATTR_NOSYSTEM:'1',GIT_NO_REPLACE_OBJECTS:'1',GIT_TERMINAL_PROMPT:'0'});
  const result=spawnSync('git',['--no-replace-objects','-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false','-c','core.attributesFile=/dev/null',...args],{cwd,env,input,timeout:30000,maxBuffer:17*1024*1024});
  if(result.error||result.status!==0)fail('ORIGINAL_BASE_UNAVAILABLE','Original base object cannot be read/reconstructed safely');
  return result.stdout;
}
function restoreBase(home, previous, destination) {
  if(!/^[a-f0-9]{40}$/.test(previous.base||''))fail('ORIGINAL_BASE_UNAVAILABLE','A recorded SHA1 base is required');
  const source=location(home,previous,'workspace');
  const gitdir=claims.contained(source,'.git');
  if(!fs.existsSync(gitdir)||!fs.lstatSync(gitdir).isDirectory())fail('ORIGINAL_BASE_UNAVAILABLE','Original git object directory is missing');
  const objects=claims.contained(source,'.git/objects');
  const checkObjects=dir=>{for(const entry of fs.readdirSync(dir,{withFileTypes:true})){if(entry.isSymbolicLink())fail('ORIGINAL_BASE_UNAVAILABLE','Original object store contains a symbolic link');if(entry.isDirectory())checkObjects(path.join(dir,entry.name));}};
  checkObjects(objects);
  if(fs.existsSync(path.join(objects,'info/alternates')))fail('ORIGINAL_BASE_UNAVAILABLE','Alternate object stores are not allowed');
  const collected=new Map();let bytes=0;
  function collect(hash,type) {
    if(collected.has(hash))return collected.get(hash).body;
    if(!/^[a-f0-9]{40}$/.test(hash)||collected.size>=10000)fail('ORIGINAL_BASE_UNAVAILABLE','Invalid or excessive original object graph');
    const size=Number(gitObjectCommand(source,['cat-file','-s',hash]).toString().trim());
    if(!Number.isSafeInteger(size)||size<0||size>16*1024*1024||(bytes+=size)>128*1024*1024)fail('ORIGINAL_BASE_UNAVAILABLE','Original object graph exceeds the bounded reconstruction limit');
    if(gitObjectCommand(source,['cat-file','-t',hash]).toString().trim()!==type)fail('ORIGINAL_BASE_UNAVAILABLE','Original object type differs from graph');
    const body=gitObjectCommand(source,['cat-file',type,hash]);
    if(body.length!==size||crypto.createHash('sha1').update(`${type} ${size}\0`).update(body).digest('hex')!==hash)fail('ORIGINAL_BASE_UNAVAILABLE','Original object failed its content hash');
    collected.set(hash,{type,body});
    if(type==='tree') {
      let offset=0;const names=new Set();
      while(offset<body.length){const zero=body.indexOf(0,offset);if(zero<0||zero+21>body.length)fail('ORIGINAL_BASE_UNAVAILABLE','Malformed original tree');
        const header=body.subarray(offset,zero).toString('utf8'),match=header.match(/^(40000|100644|100755|120000) ([^/]+)$/);
        if(!match||['.','..','.git'].includes(match[2])||names.has(match[2]))fail('ORIGINAL_BASE_UNAVAILABLE','Unsafe original tree entry');names.add(match[2]);
        const child=body.subarray(zero+1,zero+21).toString('hex');collect(child,match[1]==='40000'?'tree':'blob');offset=zero+21;
      }
    }
    return body;
  }
  const commit=collect(previous.base,'commit');const match=commit.toString('utf8').match(/^tree ([a-f0-9]{40})\n/);if(!match)fail('ORIGINAL_BASE_UNAVAILABLE','Original commit has no valid tree');collect(match[1],'tree');
  // Only verified base objects enter the sterile repository. No source configuration,
  // hooks, refs, replacements, parents or interrupted commits are copied or fetched.
  fs.mkdirSync(destination,{recursive:true});gitObjectCommand(destination,['init','-q','--object-format=sha1']);
  for(const [hash,{type,body}] of collected){if(gitObjectCommand(destination,['hash-object','-w','-t',type,'--stdin'],body).toString().trim()!==hash)fail('ORIGINAL_BASE_UNAVAILABLE','Destination object hash differs');}
  fs.writeFileSync(path.join(destination,'.git/shallow'),previous.base+'\n');
  gitObjectCommand(destination,['checkout','-q','--detach',previous.base]);
  return previous.base;
}
function validateUnrelated(root, edits) {
  if(edits===null||edits===undefined)return;
  if(typeof edits!=='object'||Array.isArray(edits)||freeze.secretIn(JSON.stringify(edits)))fail('UNRELATED_INPUT_INVALID','Unrelated input recipe must be a non-secret object');
  for(const [relative,edit] of Object.entries(edits)) {
    claims.contained(root,relative);
    if(/(^|\/)(?:\.env(?:\.[^/]*)?|credentials?(?:\.[^/]*)?|secrets?(?:\.[^/]*)?|\.git|\.ssh|\.aws)(\/|$)/i.test(relative))fail('UNRELATED_INPUT_INVALID','Protected environment/credential paths cannot be captured');
    if(!edit||!['append','untracked'].includes(edit.kind)||Object.keys(edit).some(k=>!['kind','text','content'].includes(k))||typeof(edit.kind==='append'?edit.text:edit.content)!=='string')fail('UNRELATED_INPUT_INVALID','Malformed unrelated input recipe');
  }
}
function saveUnrelated(home, attempt, edits) {
  validateUnrelated(home,edits);
  const relative=`${attempt.directory}/unrelated-inputs.json`,file=claims.contained(home,relative),body=JSON.stringify(edits||{});
  fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,body,{flag:'wx',mode:0o600});
  attempt.unrelated_inputs={path:relative,sha256:crypto.createHash('sha256').update(body).digest('hex')};
}
function loadUnrelated(home, attempt) {
  if(!attempt.unrelated_inputs)fail('ORIGINAL_BASE_UNAVAILABLE','Original unrelated-input snapshot is unavailable; do not reconstruct it from altered workspace bytes');
  const raw=fs.readFileSync(claims.contained(home,attempt.unrelated_inputs.path));
  if(freeze.secretIn(raw.toString('utf8')))fail('UNRELATED_INPUT_INVALID','Captured recipe contains secret-looking input; preserve for operator investigation');
  if(crypto.createHash('sha256').update(raw).digest('hex')!==attempt.unrelated_inputs.sha256)fail('ORIGINAL_BASE_UNAVAILABLE','Original unrelated-input snapshot changed');
  const edits=JSON.parse(raw);
  if(!edits||typeof edits!=='object'||Array.isArray(edits))fail('ORIGINAL_BASE_UNAVAILABLE','Malformed original unrelated-input snapshot');
  validateUnrelated(home,edits);
  return edits;
}
module.exports={SCHEMA,eventId,location,resumeTarget,requireResume,begin,intent,sessionEnd,finish,restoreBase,saveUnrelated,loadUnrelated,validateUnrelated};

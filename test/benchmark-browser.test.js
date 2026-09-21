// Offline seam controls. These adapters are test doubles, not browser evidence.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const kit = require('../scripts/delivery-benchmark-v7/evaluator-kit.cjs');
const { create } = require('../scripts/delivery-benchmark-v7/browser.cjs');
const ctx = { candidate: 'a'.repeat(40), candidateDir: '/tmp/fixture-candidate' };
const observe = browser => kit.observed({...ctx,browser}, 'fixture', 'fixture check', '<button>test</button>', {state:'empty'});
assert.equal((await observe(null)).result,'unverified');
for (const value of [undefined, {}, {ok:true}, {ok:'yes',observations:{x:1}}, {ok:true,observations:{}}]) {
  const check = await observe({name:'fixture',version:'1',observe:async()=>value});
  assert.equal(check.result,'error'); assert.equal(check.observed,false);
}
assert.equal((await observe({observe(){throw new Error('launch failure');}})).result,'error');
for(const ok of [true,false]) {
  const check = await observe({name:'fixture',version:'1',observe:async()=>({ok,observations:{fixture:true},detail:'injected fixture'})});
  assert.equal(check.result,ok?'passed':'failed'); assert.equal(check.observed,true);
}
assert.equal((await observe({real:true,observe:()=>({ok:true,observations:{fixture:true}})})).result,'error');
assert.throws(()=>create(),/exact expectedVersion/);
await assert.rejects(create({executable:'/definitely/missing/chrome',expectedVersion:'1.2.3.4',timeoutMs:1000}).probe(),/launch failed/);
console.log('browser seam controls passed (no real-browser claim)');

// Preflight checks actual module load order and version/capability refusal without Chrome.
const fs = require('node:fs');
const path = require('node:path');
const {tempDir,write} = await import('./helpers.js');
const effective = require('../scripts/delivery-benchmark-v7/effective.cjs');
const {prepareBrowser} = require('../scripts/delivery-benchmark-v7/browser-preflight.cjs');
function preflightFixture({factory,probe} = {}) {
  const root=tempDir();
  write(root,'protocol.md','study');write(root,'scripts/delivery-benchmark-v7/helper.cjs','module.exports=1;');
  write(root,'collector.cjs','collector');write(root,'driver.sh','driver');
  write(root,'briefs/one/brief.md','brief');write(root,'briefs/one/evaluator/evaluate.cjs','evaluate');
  write(root,'kit.tgz','fixture kit');
  write(root,'runtime/browser','#!/bin/sh\nexit 99\n');fs.chmodSync(path.join(root,'runtime/browser'),0o755);
  write(root,'version-probe',effective.versionProbeFixture('2.1.273'));fs.chmodSync(path.join(root,'version-probe'),0o755);
  write(root,'browser/index.cjs', `const fs=require('node:fs');const path=require('node:path');fs.writeFileSync(path.join(__dirname,'loaded'),'loaded');module.exports={create:({executable,expectedVersion})=>(${factory || `{real:true,name:'fixture-real-contract',version:'1',observe(){},async probe(){return ${probe || "{version:expectedVersion,executable,protocolVersion:'1.3',nativeInput:true,screenshot:true}"};}}`})};`);
  // The load-effect marker lives outside the pinned closure.
  const source=fs.readFileSync(path.join(root,'browser/index.cjs'),'utf8').replace("path.join(__dirname,'loaded')","path.join(__dirname,'../loaded')");
  fs.writeFileSync(path.join(root,'browser/index.cjs'),source);
  const spec={protocol:'protocol.md',harness:'scripts/delivery-benchmark-v7',briefs:'briefs',collector:'collector.cjs',driver:'driver.sh',caps:{turns_per_session:10,wall_clock_minutes:5},configuration:{values:{model:'sonnet'},env:[]}};
  const input={model:'claude-example-1',tool:{executable:path.join(root,'version-probe'),version:'2.1.273',kind:'version-probe-fixture'},caps:{turns_per_session:10,wall_clock_minutes:5,spend_usd:2},kit:{path:'kit.tgz',commit:'a'.repeat(40)},browser:{entry:'browser/index.cjs',roots:['browser'],runtime:{name:'fixture-browser',version:'1.2.3.4',path:'runtime/browser'}},configuration:{permission_mode:'manual',cwd_kind:'scratch'}};
  const bundle=()=>({root,spec,input,inputRoot:root,manifest:effective.resolve(root,spec,input,{inputRoot:root})});
  return {root,input,bundle};
}
{
  const f=preflightFixture(),bundle=f.bundle();
  assert.equal((await prepareBrowser(bundle)).real,true);
  assert.equal(fs.existsSync(path.join(f.root,'loaded')),true,'configured code actually loaded');
}
{
  const f=preflightFixture(),bundle=f.bundle();
  fs.appendFileSync(path.join(f.root,'runtime/browser'),'# changed\n');
  await assert.rejects(prepareBrowser(bundle),/inputs changed/);
  assert.equal(fs.existsSync(path.join(f.root,'loaded')),false,'changed provenance refuses before require side effect');
}
{
  const f=preflightFixture();f.input.browser=null;
  await assert.rejects(prepareBrowser(f.bundle()),/capability is absent/);
  assert.equal(fs.existsSync(path.join(f.root,'loaded')),false);
}
for(const factory of ['null','false',"{real:false,name:'fake',version:'1',observe(){},probe(){}}"]){
  const f=preflightFixture({factory});await assert.rejects(prepareBrowser(f.bundle()),/real observable adapter/);
}
for(const probe of ['null','false',"{version:'wrong',executable,protocolVersion:'1.3',nativeInput:true,screenshot:true}","{version:expectedVersion,executable,protocolVersion:'1.3',nativeInput:false,screenshot:true}","{version:expectedVersion,executable,protocolVersion:'1.3',nativeInput:true,screenshot:false}"]){
  const f=preflightFixture({probe});await assert.rejects(prepareBrowser(f.bundle()),/probe incomplete/);
}
{
  const f=preflightFixture();const signal=AbortSignal.abort();
  await assert.rejects(prepareBrowser(f.bundle(),{signal}),/aborted/);
  assert.equal(fs.existsSync(path.join(f.root,'loaded')),false);
}
console.log('browser preflight controls passed (inert pinned modules)');
{
  const f=preflightFixture();f.input.browser.runtime.path='runtime';f.input.browser.runtime.executable='runtime/browser';
  assert.equal((await prepareBrowser(f.bundle())).real,true,'directory runtime executable works');
}
{
  const f=preflightFixture();f.input.browser.runtime.path='runtime';
  await assert.rejects(prepareBrowser(f.bundle()),/explicit executable/);
  assert.equal(fs.existsSync(path.join(f.root,'loaded')),false);
}
{
  const f=preflightFixture();f.input.browser.runtime.path='runtime';f.input.browser.runtime.executable='version-probe';
  assert.throws(()=>f.bundle(),/belong to the runtime artifact/);
  assert.equal(fs.existsSync(path.join(f.root,'loaded')),false);
}
{
  const f=preflightFixture();await prepareBrowser(f.bundle());
  write(f.root,'browser/index.cjs','module.exports={create(){return false;}};');
  await assert.rejects(prepareBrowser(f.bundle()),/real observable adapter/,'new pinned module bytes replace any cached factory');
}

// Complete browser bundles retain safe internal version/framework symlinks.
{
  const root=tempDir();
  write(root,'runtime/Versions/1/browser','one');
  write(root,'runtime/Versions/2/browser','two');
  fs.symlinkSync('1',path.join(root,'runtime/Versions/Current'));
  fs.symlinkSync('Versions/Current/browser',path.join(root,'runtime/browser'));
  const first=effective.browserRuntimeTree(root,'runtime');
  assert.equal(first.links['runtime/browser'].target,'Versions/Current/browser');
  assert.equal(first.links['runtime/browser'].resolved,'Versions/1/browser');
  assert.equal(Object.keys(first.files).length,2,'real targets hashed once');
  assert.throws(()=>effective.tree(root,'runtime'),/symbolic link/,'generic tree remains strict');
  write(root,'runtime/Versions/1/browser','changed');
  assert.notEqual(effective.browserRuntimeTree(root,'runtime').digest,first.digest,'target bytes bound');
  const changed=effective.browserRuntimeTree(root,'runtime');
  fs.unlinkSync(path.join(root,'runtime/Versions/Current'));
  fs.symlinkSync('2',path.join(root,'runtime/Versions/Current'));
  assert.notEqual(effective.browserRuntimeTree(root,'runtime').digest,changed.digest,'link identity bound');
  fs.symlinkSync('runtime',path.join(root,'alias'));
  assert.throws(()=>effective.browserRuntimeTree(root,'alias/Versions'),/symbolic link/,'input path ancestors cannot be links');
}
for(const variant of ['escape','absolute','broken','cycle','indirect-escape']){
  const root=tempDir();write(root,'runtime/file','inside');write(root,'outside','outside');
  const target=variant==='escape'?'../outside':variant==='absolute'?path.join(root,'runtime/file'):variant==='broken'?'missing':variant==='cycle'?'link':'other';
  fs.symlinkSync(target,path.join(root,'runtime/link'));
  if(variant==='indirect-escape')fs.symlinkSync('../outside',path.join(root,'runtime/other'));
  assert.throws(()=>effective.browserRuntimeTree(root,'runtime'),/browser runtime link/,variant);
}
console.log('browser runtime symlink provenance controls passed');
{
  const root=tempDir();write(root,'runtime/a/file','a');write(root,'runtime/b/file','b');
  fs.symlinkSync('../b',path.join(root,'runtime/a/link'));
  fs.symlinkSync('../a',path.join(root,'runtime/b/link'));
  assert.throws(()=>effective.browserRuntimeTree(root,'runtime'),/directory cycle/);
}

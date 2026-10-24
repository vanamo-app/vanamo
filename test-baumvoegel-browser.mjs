// Browser-Test: Baumvögel auf „Willkommen“ (Nutzer 24.10.) – Freischalten nach dem Wachsen (Flug in den Konto-Kreis,
// neuer Avatar, Name statt Begrüßung, Zählung im Konto), still nachgetragen für ältere Bäume, ausgebliebener Vogel beim
// nächsten Besuch, Stufe 6 (erst Vogel, dann Eichhörnchen), „Weniger Bewegung“ (RM=1) und die Knöpfe im Baum-Test.
// Supabase ist nachgebildet. Der 3D-Baum braucht WebGL (hier per SwiftShader); ohne Grafikkarte dauert jeder Fall etwas.
// Aufruf: node test-baumvoegel-browser.mjs [1–5]   (RM=1 für „Weniger Bewegung“ in Fall 1)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';

const ids=JSON.parse(fs.readFileSync('dist/sentences.json','utf8')).sentences.map(s=>s.id);
const reviews=n=>Object.fromEntries(ids.slice(0,n).map(id=>[`${id}:fi-de`,{due:Date.now()+86400000,interval:1,repetitions:1,updatedAt:Date.now()-60000}]));
const server=spawn(process.execPath,['server.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);});
const origin='http://localhost:4173';
const browser=await chromium.launch({headless:true,...(process.env.PW_CHROMIUM?{executablePath:process.env.PW_CHROMIUM}:{}),args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
const only=process.argv[2]||'';

async function scenario({learned,tree,avatar='sinitiainen',viewport={width:1280,height:900},theme='vanamo',username='aino'}){
 let meta={username,nickname:'Aino',avatar,tree:{fi:{planted:new Date(Date.now()-20*86400000).toISOString(),start:new Date(Date.now()-20*86400000).toISOString(),...tree}}};
 const puts=[];
 const user=()=>({id:'00000000-0000-4000-8000-00000000000a',user_metadata:meta});
 const context=await browser.newContext({serviceWorkers:'block',locale:'de-DE',viewport,...(process.env.RM?{reducedMotion:'reduce'}:{})});
 await context.addInitScript(({user,rev,theme})=>{
  window.vanamoBaumTest=true;
  try{sessionStorage.setItem('vanamo-intro-seen','1');localStorage.setItem('vanamo-theme',theme);}catch{}
  if(localStorage.getItem('suomi-auth-session-v1'))return;
  localStorage.setItem('suomi-auth-session-v1',JSON.stringify({access_token:'a',refresh_token:'r',user}));
  localStorage.setItem('suomi-learning-v1',JSON.stringify({reviews:rev,favorites:[],daily:{},reports:{},writingRatings:{},verbProgress:{},prefs:{level:1,direction:'fi-de',audioOnly:false,activity:'translate',speed:1}}));
 },{user:user(),rev:reviews(learned),theme});
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===origin)return route.continue();
  if(url.hostname.endsWith('.supabase.co')){
   const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(url.pathname==='/auth/v1/token')return json({access_token:'a',refresh_token:'r',user:user()});
   if(url.pathname==='/auth/v1/user'&&request.method()==='PUT'){const body=JSON.parse(request.postData());puts.push({t:Date.now(),data:body.data});meta={...meta,...body.data};return json(user());}
   if(url.pathname==='/auth/v1/user')return json(user());
   if(url.pathname.startsWith('/rest/v1/learning_state'))return route.fulfill({status:request.method()==='GET'?200:201,contentType:'application/json',body:request.method()==='GET'?'[]':''});
   if(url.pathname.startsWith('/rest/v1/rpc/'))return json({sentence_ids:[],translations:[]});
   if(url.pathname.startsWith('/functions/v1/account-email'))return json({email:'',verified:false,configured:true});
   return json({});
  }
  return route.abort();
 });
 const page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error'||/Baum|Baumvogel/.test(m.text()))errors.push('console: '+m.text().slice(0,200));});
 await page.goto(origin);
 await page.waitForSelector('#home-tree.is-ready',{timeout:120000});
 // Protokoll: wann landet der Vogel, wann steht der Name, wann darf das Eichhörnchen einziehen
 await page.evaluate(()=>{
  window.__log=[];const t0=performance.now(),log=e=>window.__log.push([e,Math.round(performance.now()-t0)]);
  const api=window.__baumApi;
  for(const k of ['grow','squirrelIn']){const f=api[k].bind(api);api[k]=(...a)=>{log(k+':'+JSON.stringify(a));return f(...a);};}
  new MutationObserver(ms=>{for(const m of ms){for(const n of m.addedNodes)if(n.classList?.contains('unlock-name'))log('name+:'+n.textContent);for(const n of m.removedNodes)if(n.classList?.contains('unlock-name'))log('name-');if(m.addedNodes[0]?.classList?.contains?.('unlock-canvas'))log('canvas+');}}).observe(document.body,{childList:true});
  const b=document.getElementById('account-button');
  new MutationObserver(()=>{const img=b.querySelector('.avatar-art img');log('button:'+(b.dataset.unlocking?'unlocking ':'')+(img?img.getAttribute('src').replace(/.*avatars\//,''):b.textContent));}).observe(b,{childList:true,attributes:true,attributeFilter:['data-unlocking']});
 });
 return {context,page,errors,puts,meta:()=>meta};
}
const learnTo=(page,n)=>page.evaluate(rev=>{const s=window.suomiLearningState.snapshot();s.reviews={...s.reviews,...rev};window.suomiLearningState.applyCloud(s);},reviews(n));
const waitLog=(page,re,timeout=90000)=>page.waitForFunction(src=>window.__log.some(([e])=>new RegExp(src).test(e)),re.source,{timeout});
const avatarSrc=page=>page.$eval('#account-button .avatar-art img',i=>i.getAttribute('src'));

try{
 // 1) Gewachsen (Stufe 2 → 3): Seidenschwanz fliegt in den Kreis, wird Avatar, Name statt Begrüßung; im Konto birds 3
 if(!only||only==='1'){
  const s=await scenario({learned:30,tree:{birds:2},avatar:'punatulkku'});const {page}=s;
  await page.waitForTimeout(1500);
  assert.equal(s.puts.length,0,'nichts zu speichern beim Laden');
  await learnTo(page,111);
  if(!process.env.RM)await waitLog(page,/^grow:/);
  if(!process.env.RM)await waitLog(page,/^canvas\+/);
  await waitLog(page,/^name\+:Tilhi/);
  if(process.env.RM)assert.equal(await page.locator('.unlock-canvas').count(),0,'Weniger Bewegung: kein Flug');
  assert.match(await avatarSrc(page),/avatars\/tilhi\.webp/);
  assert.equal(await page.$eval('#account-button',b=>b.dataset.bird),'tilhi');
  assert.equal(await page.$eval('.unlock-name-de',e=>e.textContent),'Seidenschwanz');
  const last=s.puts.at(-1);assert.equal(last.data.avatar,'tilhi');assert.equal(last.data.tree.fi.birds,3);assert.ok(last.data.tree.fi.planted,'übrige Baum-Daten bleiben');
  await waitLog(page,/^name-/,30000);
  assert.equal(await page.$eval('#home-view .intro h1',h=>getComputedStyle(h).opacity),'1','Begrüßung wieder da');
  const log=await page.evaluate(()=>window.__log);console.log('1:',JSON.stringify(log));
  if(!process.env.RM)assert.ok(log.find(([e])=>e.startsWith('grow:'))[0].includes('"holdMoveIn":true'));
  if(process.env.RM)assert.ok(await page.evaluate(()=>!document.querySelector('.unlock-name')),'Name wieder weg');
  assert.ok(log.some(([e])=>e==='squirrelIn:[]'),'Eichhörnchen wird freigegeben');
  // Konto-Auswahl: Seidenschwanz jetzt wählbar
  await page.click('#account-button');await page.click('#account-manage');await page.waitForSelector('#profile-form:visible');
  assert.equal(await page.locator('#profile-form .avatar-choice.is-locked').count(),7);
  assert.equal(await page.locator('#profile-form [data-avatar-choice="tilhi"]').getAttribute('aria-pressed'),'true');
  assert.deepEqual(s.errors,[]);await s.context.close();
 }
 // 2) Baum von vor dieser Funktion (keine Zählung im Konto): Vögel bis zur Stufe still frei, keine Animation
 if(!only||only==='2'){
  const s=await scenario({learned:111,tree:{}});const {page}=s;
  await page.waitForFunction(()=>true);await page.waitForTimeout(4000);
  assert.equal(s.puts.length,1);assert.equal(s.puts[0].data.tree.fi.birds,3);assert.equal(s.puts[0].data.avatar,undefined,'Avatar bleibt');
  assert.equal(await page.locator('.unlock-canvas').count(),0);
  assert.match(await avatarSrc(page),/sinitiainen/);
  assert.deepEqual(s.errors,[]);await s.context.close();
 }
 // 3) Ausgeblieben (Stufe 3, gezählt 2): Seidenschwanz kommt beim Besuch, ohne Wachsen
 if(!only||only==='3'){
  const s=await scenario({learned:111,tree:{birds:2},avatar:'punatulkku'});const {page}=s;
  await waitLog(page,/^name\+:Tilhi/);
  const log=await page.evaluate(()=>window.__log);console.log('3:',JSON.stringify(log));
  assert.ok(!log.some(([e])=>e.startsWith('grow:')),'kein Wachsen');
  assert.equal(s.puts.at(-1).data.avatar,'tilhi');assert.equal(s.puts.at(-1).data.tree.fi.birds,3);
  assert.deepEqual(s.errors,[]);await s.context.close();
 }
 // 4) Stufe 6 (5 → 6): erst der Eisvogel, das Eichhörnchen zieht erst nach dem Namen ein
 if(!only||only==='4'){
  const s=await scenario({learned:523,tree:{birds:5},avatar:'kapytikka'});const {page}=s;
  await page.waitForTimeout(1500);
  await learnTo(page,857);
  await waitLog(page,/^name\+:Kuningaskalastaja/);
  const busyDuring=await page.evaluate(()=>window.__baumApi.busy);
  await waitLog(page,/^name-/,30000);
  await waitLog(page,/^squirrelIn/,10000);
  const log=await page.evaluate(()=>window.__log);console.log('4:',JSON.stringify(log));
  const t=e=>log.find(([x])=>x.startsWith(e))?.[1];
  assert.ok(busyDuring,'während des Vogels wartet der Einzug (Baum beschäftigt)');
  assert.ok(t('squirrelIn')>=t('name-'),'Eichhörnchen erst nach dem Vogel');
  assert.equal(s.puts.at(-1).data.avatar,'kuningaskalastaja');
  assert.deepEqual(s.errors,[]);await s.context.close();
 }
 // 5) Testkonto: „Vogel dieser Stufe“ und „Nächste Stufe wachsen“ zeigen den Vogel nur an (nichts im Konto), „Mein Baum“ stellt zurück
 if(!only||only==='5'){
  const s=await scenario({learned:111,tree:{birds:3},avatar:'peippo',username:'testuser123'});const {page}=s;
  await page.waitForSelector('.baum-test');await page.waitForTimeout(1500);
  const before=s.puts.length;
  await page.click('.baum-test [data-act="bird"]');
  await waitLog(page,/^name\+:Tilhi/);
  assert.match(await avatarSrc(page),/tilhi/);
  await waitLog(page,/^name-/,30000);
  await page.click('.baum-test [data-act="grow"]');
  await waitLog(page,/^name\+:Tuulihaukka/,120000);
  assert.ok(s.puts.slice(before).every(p=>!p.data.avatar&&!(p.data.tree?.fi?.birds>3)),'Test: nichts im Konto');
  await waitLog(page,/^name-/,30000);
  await page.waitForFunction(()=>!document.querySelector('.unlock-name'));
  await page.click('.baum-test [data-act="mine"]');
  assert.match(await avatarSrc(page),/peippo/,'eigener Vogel wieder da');
  assert.deepEqual(s.errors,[]);await s.context.close();
 }
 console.log('PASS: Baumvögel');
}finally{await browser.close();server.kill();}

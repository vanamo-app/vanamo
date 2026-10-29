// Browser-Test: Tagesablauf des Eichhörnchens (Nutzer 26.10.) – Knöpfe im Baum-Test (Testkonto):
// „Eichhörnchen wacht auf (Frühling–Herbst)“: Stufe mindestens 6, nicht Winter; es wacht auf dem Ast auf, streckt sich,
// läuft fort, kommt mit einer Haselnuss zurück, frisst sie und schläft wieder ein (der Baum ist solange „beschäftigt“).
// „Eichhörnchen bunkert Nüsse (Herbst)“: vorher 1–2 Mal mit einer Nuss ins Astloch. Nachts beginnt es nicht.
// Supabase ist nachgebildet; der 3D-Baum braucht WebGL (hier per SwiftShader). Weil SwiftShader nur wenige Bilder je Sekunde
// schafft, spult der Test den Ablauf vor (__eichTagSim). Aufruf: node test-eichhoernchen-browser.mjs
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
try{
 const meta={username:'testuser123',nickname:'Test',avatar:'peippo',tree:{fi:{planted:new Date(Date.now()-20*86400000).toISOString(),start:new Date(Date.now()-20*86400000).toISOString(),birds:6}}};
 const user=()=>({id:'00000000-0000-4000-8000-00000000000b',user_metadata:meta});
 const context=await browser.newContext({serviceWorkers:'block',locale:'de-DE',viewport:{width:1280,height:900}});
 await context.addInitScript(({user,rev})=>{
  window.vanamoBaumTest=true;
  try{sessionStorage.setItem('vanamo-intro-seen','1');localStorage.setItem('vanamo-theme','vanamo');}catch{}
  if(localStorage.getItem('suomi-auth-session-v1'))return;
  localStorage.setItem('suomi-auth-session-v1',JSON.stringify({access_token:'a',refresh_token:'r',user}));
  localStorage.setItem('suomi-learning-v1',JSON.stringify({reviews:rev,favorites:[],daily:{},reports:{},writingRatings:{},verbProgress:{},prefs:{level:1,direction:'fi-de',audioOnly:false,activity:'translate',speed:1}}));
 },{user:user(),rev:reviews(300)});
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());
  if(url.origin===origin)return route.continue();
  if(url.hostname.endsWith('.supabase.co')){
   const json=(body,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(url.pathname==='/auth/v1/token')return json({access_token:'a',refresh_token:'r',user:user()});
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
 page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text().slice(0,200));});
 await page.goto(origin);
 await page.waitForSelector('#home-tree.is-ready',{timeout:120000});
 await page.waitForSelector('.baum-test');await page.waitForTimeout(1500);
 // Klick per Skript: mit SwiftShader rechnet jedes Bild lange, Playwrights Warten auf „ruhiges“ Element läuft sonst ab
 const click=act=>page.evaluate(a=>document.querySelector(`.baum-test [data-act="${a}"]`).click(),act);
 // ganzen Ablauf vorspulen und mitschreiben: Abschnitte, getragene Nuss, ob der Baum beschäftigt ist
 const runAll=()=>page.evaluate(()=>{
  const r={phases:[],nuts:{},busy:true,plan:window.__eichTag?.plan};
  for(let k=0;k<4000;k++){
   const s=window.__eichTagSim(0.1);if(!s)break;
   if(r.phases[r.phases.length-1]!==s.ph)r.phases.push(s.ph);
   if(s.nut)r.nuts[s.nut]=(r.nuts[s.nut]||0)+1;
   if(!window.__baumApi.busy)r.busy=false;
  }
  r.ende=window.__eichTag===null;
  return r;
 });
 // keine Abläufe von selbst dazwischen
 await page.evaluate(()=>{window.__eichTagHold=true;});
 // Frühling bis Herbst: wacht auf, fort, mit Haselnuss zurück, frisst, schläft
 await click('eich-tag');
 await page.waitForFunction(()=>window.__baumApi.stage>=6&&!!window.__eichTag,null,{timeout:60000});
 let st=await page.evaluate(()=>window.__eichTag);
 console.log('wach:',JSON.stringify(st));
 assert.equal(st.ph,'wach','beginnt mit dem Aufwachen');
 assert.ok(!st.plan.some(p=>p.startsWith('loch')),'nicht im Herbst: kein Astloch');
 let r=await runAll();
 console.log('Ablauf:',JSON.stringify(r));
 assert.deepEqual(r.phases,['wach','weg','fort','zurueck','essen'],'Abschnitte in dieser Reihenfolge');
 assert.ok(r.nuts.hasel>0,'trägt eine Haselnuss');
 assert.ok(r.busy,'solange es unterwegs ist, ist der Baum beschäftigt');
 assert.ok(r.ende,'Ablauf zu Ende');
 await page.waitForFunction(()=>window.__sq&&window.__sq.grp.visible,null,{timeout:60000});   // schläft wieder auf dem Ast
 assert.equal(await page.evaluate(()=>window.__baumApi.busy),false,'danach nicht mehr beschäftigt');
 // Herbst: erst Nüsse ins Astloch
 await click('eich-herbst');
 await page.waitForFunction(()=>!!window.__eichTag,null,{timeout:60000});
 r=await runAll();
 console.log('Herbst:',JSON.stringify(r));
 assert.ok(r.phases.includes('loch')&&r.phases.includes('drin')&&r.phases.includes('raus'),'bringt Nüsse ins Astloch');
 assert.equal(r.phases[r.phases.length-1],'essen','zuletzt frisst es auf dem Ast');
 assert.ok(r.ende,'Ablauf zu Ende');
 // Nacht: beginnt nicht
 await page.evaluate(()=>{document.documentElement.dataset.themeMode='dark';});
 await page.waitForTimeout(500);
 await click('eich-tag');
 await page.waitForTimeout(3000);
 assert.equal(await page.evaluate(()=>window.__eichTag),null,'nachts kein Ablauf');
 assert.deepEqual(errors,[]);
 await context.close();
 console.log('PASS: Eichhörnchen');
}finally{await browser.close();server.kill();}

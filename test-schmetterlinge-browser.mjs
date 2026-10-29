// Browser-Test: Tagpfauenauge und Bläulinge (Nutzer 26.10.) – Knöpfe im Baum-Test (Testkonto):
// „Tagpfauenauge (Frühling/Sommer)“: Stufe mindestens 3, Frühling oder Sommer, dann kommt ein Tagpfauenauge (manchmal zwei)
// und setzt sich auf eine Blüte oder an den Stamm. „Pfauenauge am Stamm“: sitzt auf der Rinde. „Bläulinge (Sommer)“:
// Stufe mindestens 2, Sommer, zwei oder drei kommen und setzen sich auf Blüten oder Grashalme. Danach Nacht: alle sofort weg.
// Supabase ist nachgebildet; der 3D-Baum braucht WebGL (hier per SwiftShader). Weil SwiftShader nur wenige Bilder je Sekunde
// schafft, spult der Test die Schmetterlinge beim Warten vor (__pfauSim/__blauSim). Aufruf: node test-schmetterlinge-browser.mjs
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
 const meta={username:'testuser123',nickname:'Test',avatar:'peippo',tree:{fi:{planted:new Date(Date.now()-20*86400000).toISOString(),start:new Date(Date.now()-20*86400000).toISOString(),birds:4}}};
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
 const inView=b=>Math.abs(b.nx)<0.95&&b.ny>-0.95&&b.ny<0.95;
 // warten und dabei vorspulen (art: 'pfau' | 'blau'; was: 'da' = fliegt oder sitzt, 'sitzt', 'stamm' = sitzt am Stamm)
 const until=(art,was,timeout=180000)=>page.waitForFunction(([art,was])=>{
  window[`__${art}Sim`]?.(0.5);
  const l=window[`__${art}`]||[];
  return was==='da'?l.some(b=>b.st==='flug'||b.st==='paar'||b.st==='sitzt'):was==='stamm'?l.some(b=>b.st==='sitzt'&&b.wo==='stamm'):l.some(b=>b.st==='sitzt');
 },[art,was],{polling:300,timeout});
 // Tagpfauenauge: Stufe ≥ 3, kommt herein und setzt sich (Blüte oder Stamm)
 await click('pfau');
 await page.waitForFunction(()=>window.__baumApi.stage>=3,null,{timeout:30000});
 await until('pfau','da');
 await until('pfau','sitzt');
 let st=await page.evaluate(()=>window.__pfau);
 console.log('Tagpfauenauge:',JSON.stringify(st));
 assert.ok(st.length>=1&&st.length<=2,'eins oder zwei');
 for(const b of st)if(b.st==='sitzt'){
  assert.ok(inView(b),'im Bild');
  assert.ok(b.wo==='stamm'||[8,9,10,11,13].includes(b.blume),'auf einer Blüte des Pfauenauges oder am Stamm');
 }
 // am Stamm: das erste fliegt fort, dann kommt eins und setzt sich auf die Rinde
 await click('pfau-stamm');
 await until('pfau','stamm');
 st=await page.evaluate(()=>window.__pfau);
 console.log('am Stamm:',JSON.stringify(st));
 const bark=st.find(b=>b.wo==='stamm');
 assert.ok(inView(bark)&&bark.bild==='figur','sitzt sichtbar auf der Rinde (Flügel als Figur)');
 // Bläulinge: Sommer, zwei oder drei
 await click('blau');
 await until('blau','sitzt');
 st=await page.evaluate(()=>window.__blau);
 console.log('Bläulinge:',JSON.stringify(st));
 assert.ok(st.length>=2&&st.length<=3,'zwei oder drei');
 for(const b of st)if(b.st==='sitzt'){
  assert.ok(inView(b),'im Bild');
  assert.ok([6,7,8,9,10,11,13].includes(b.blume),'auf einer Blüte oder Ähre');
 }
 // Nacht: sofort weg
 await page.evaluate(()=>{document.documentElement.dataset.themeMode='dark';});
 await page.waitForFunction(()=>!window.__pfau&&!window.__blau,null,{timeout:60000});
 assert.deepEqual(errors,[]);
 await context.close();
 console.log('PASS: Schmetterlinge');
}finally{await browser.close();server.kill();}

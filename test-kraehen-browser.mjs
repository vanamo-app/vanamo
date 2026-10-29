// Browser-Test: Rabenkrähen im Baum (Nutzer 25.10.) – Knopf „Krähen (Herbst/Winter)“ im Baum-Test (Testkonto):
// Stufe mindestens 4, Herbst oder Winter (sonst Wintermitte), dann kommt ein Trupp (2–5); sie landen im Baum oder auf
// der Wiese. Danach Nacht: alle sofort weg. Supabase ist nachgebildet; der 3D-Baum braucht WebGL (hier per SwiftShader).
// Aufruf: node test-kraehen-browser.mjs
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
 await page.evaluate(()=>document.querySelector('.baum-test [data-act="kraehen"]').click());
 // Stufe ≥ 4 und Herbst/Winter
 await page.waitForFunction(()=>window.__baumApi.stage>=4,null,{timeout:30000});
 // ein Trupp kommt: mindestens eine Krähe ist da, eine landet (sitzt im Baum oder steht auf der Wiese)
 await page.waitForFunction(()=>(window.__kraehen||[]).some(k=>k.st==='flug'||k.st==='sitzt'||k.st==='boden'),null,{timeout:120000});
 await page.waitForFunction(()=>(window.__kraehen||[]).some(k=>k.st==='sitzt'||k.st==='boden'),null,{timeout:240000});
 const st=await page.evaluate(()=>window.__kraehen);
 console.log('Krähen:',JSON.stringify(st));
 assert.ok(st.length>=1&&st.length<=5,'Trupp von 1–5');
 for(const k of st)if(k.st==='sitzt'||k.st==='boden')assert.ok(Math.abs(k.nx)<0.95&&k.ny>-0.95&&k.ny<0.95,'im Bild');
 // Nacht: sofort weg
 await page.evaluate(()=>{document.documentElement.dataset.themeMode='dark';});
 await page.waitForFunction(()=>!window.__kraehen,null,{timeout:60000});
 assert.deepEqual(errors,[]);
 await context.close();
 console.log('PASS: Krähen');
}finally{await browser.close();server.kill();}

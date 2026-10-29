// Browser-Test: Fledermäuse (Braune Langohren, ab Stufe 5, nachts vom Frühling bis zum Herbst, Nutzer 27.10.) – Testkonto,
// Knopf „Fledermäuse (Frühling–Herbst)“ im Baum-Test: zwei oder drei kommen, jagen um die Krone, ein Nachtfalter erscheint
// und wird gefangen, eine hängt sich kopfüber an einen Ast und frisst ihn (oder frisst im Flug), die Falterflügel fallen,
// zum Schluss fliegen alle davon. Play-Knopf: nachts ab Stufe 5 im Frühling, Sommer und Herbst dabei, tagsüber, im Winter
// und auf Stufe 4 nicht; wird es Tag, fliegen sie davon; nachts kommen sie auch von selbst.
// Supabase ist nachgebildet; der 3D-Baum braucht WebGL (hier per SwiftShader). Weil SwiftShader nur wenige Bilder je Sekunde
// schafft, spult der Test den Ablauf vor (__fmSim). Aufruf: node test-fledermaus-browser.mjs
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
  window.vanamoBaumTest=true;window.__fmHold=true;window.__igelHold=true;window.__igelSchlafHold=true;window.__gluehHold=true;window.__eichTagHold=true;window.__spechtHold=true;
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
 const click=sel=>page.evaluate(s=>document.querySelector(s).click(),sel);
 const night=on=>page.evaluate(n=>{const h=document.documentElement;h.dataset.theme=n?'kaamos':'vanamo';h.dataset.themeMode=n?'dark':'light';window.__baumApi.setNight(n,true);},on);
 // ganzen Besuch vorspulen: Zustände, Haltungen, Falter, Flügel
 const runAll=()=>page.evaluate(()=>{
  const r={n:0,st:[],posen:[],falter:false,gefangen:false,fluegel:false,dauer:0,spanPx:null,ende:false};
  for(let k=0;k<3000;k++){
   const s=window.__fmSim(0.05);if(!s){r.ende=true;break;}
   r.dauer=s.t;if(r.spanPx==null)r.spanPx=s.spanPx;r.n=Math.max(r.n,s.n);
   for(const t of s.tiere){if(!r.st.includes(t.st))r.st.push(t.st);if(t.pose&&!r.posen.includes(t.pose))r.posen.push(t.pose);}
   if(s.falter&&s.falter!=='gefangen')r.falter=true;if(s.falter==='gefangen')r.gefangen=true;
   if(window.__fmBits()>0)r.fluegel=true;
  }
  return r;
 });
 // Test-Knopf (Stufe 6 aus 300 Sätzen, Sommer), nachts
 await night(true);
 let r=null;
 for(let v=0;v<3;v++){                              // Hängeplatz und Fang sind Zufall: höchstens drei Besuche
  await click('.baum-test [data-act="fledermaus"]');
  await page.waitForFunction(()=>window.__baumApi.stage>=5&&!!window.__fm,null,{timeout:60000});
  await page.evaluate(()=>{window.__fmFreeze=true;});
  r=await runAll();
  console.log('Besuch:',JSON.stringify(r));
  await page.evaluate(()=>{window.__fmFreeze=false;});
  if(r.posen.includes('fressen'))break;
 }
 assert.ok(r.n>=2&&r.n<=3,'zwei oder drei');
 assert.ok(r.st.includes('jagd')&&r.st.includes('ab'),'jagen und fliegen davon');
 assert.ok(r.falter&&r.gefangen,'ein Nachtfalter erscheint und wird gefangen');
 assert.ok(r.posen.includes('fressen')&&r.st.includes('haengt')&&r.st.includes('faellt'),'hängt kopfüber, frisst den Falter, lässt sich fallen');
 for(const k of ['los','wach','schauen'])assert.ok(r.posen.includes(k),'Haltung '+k);
 assert.ok(r.fluegel,'die Falterflügel fallen herunter');
 assert.ok(r.ende,'danach sind alle weg');
 assert.ok(r.spanPx>=30,'gut zu sehen (Spannweite mindestens ~34 px)');
 assert.ok(r.dauer>20&&r.dauer<90,'ein Besuch dauert etwa 30–60 s');
 // Play-Knopf: Sommernacht ja; tagsüber, Winter, Stufe 4 nein
 let p=await page.evaluate(()=>window.__play());
 assert.ok(p.passend.includes('fledermaeuse'),'Sommernacht Stufe 6: Fledermäuse beim Play-Knopf');
 for(const d of [10,70]){
  await page.evaluate(d=>window.__baumApi.setDay(d),d);
  assert.ok((await page.evaluate(()=>window.__play())).passend.includes('fledermaeuse'),'nachts am Tag '+d);
 }
 await page.evaluate(()=>window.__baumApi.setDay(96));
 assert.ok(!(await page.evaluate(()=>window.__play())).passend.includes('fledermaeuse'),'Winternacht: nicht');
 assert.equal(await page.evaluate(()=>window.__baumApi.bats()),false,'im Winter kommen sie nicht');
 await page.evaluate(()=>window.__baumApi.setDay(40));
 await night(false);
 assert.ok(!(await page.evaluate(()=>window.__play())).passend.includes('fledermaeuse'),'tagsüber: nicht');
 assert.equal(await page.evaluate(()=>window.__baumApi.bats()),false,'tagsüber kommen sie nicht');
 await night(true);
 await page.evaluate(()=>window.__baumApi.setStage(4));
 await page.waitForFunction(()=>window.__baumApi.stage===4,null,{timeout:30000});
 assert.ok(!(await page.evaluate(()=>window.__play())).passend.includes('fledermaeuse'),'Stufe 4: nicht');
 await page.evaluate(()=>window.__baumApi.setStage(6));
 await page.waitForFunction(()=>window.__baumApi.stage===6,null,{timeout:30000});
 // wird es Tag, während sie da sind: fliegen davon
 assert.equal(await page.evaluate(()=>window.__baumApi.bats()),true);
 await page.evaluate(()=>{window.__fmFreeze=true;window.__fmSim(5);});
 await night(false);
 await page.evaluate(()=>{for(let k=0;k<200&&window.__fm;k++)window.__fmSim(0.05);});
 assert.equal(await page.evaluate(()=>window.__fm),null,'tagsüber weg');
 await page.evaluate(()=>{window.__fmFreeze=false;});
 // von selbst (Sommernacht)
 await night(true);
 await page.evaluate(()=>{window.__fmHold=false;window.__fmNext=0.05;});
 await page.waitForFunction(()=>!!window.__fm,null,{timeout:60000});
 await page.evaluate(()=>{window.__fmHold=true;window.__baumApi.setStage(6);});
 await page.waitForFunction(()=>!window.__fm,null,{timeout:30000});   // setStage: sofort weg
 assert.deepEqual(errors,[]);
 await context.close();
 console.log('PASS: Fledermäuse');
}finally{await browser.close();server.kill();}

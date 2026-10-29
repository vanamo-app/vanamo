// Browser-Test: Buntspecht (ab Stufe 5, Nutzer 28.10.) – Testkonto, Knöpfe im Baum-Test: Höhlenbau Tag 1/3/5 (Hackspuren,
// Mulde, Kopf hinein und Späne heraus), Klettern und Klopfen, Spechtschmiede im Winter (Eichel klemmen, aufhacken, Schalen
// fallen), abends in die Höhle (der Baum wird Nacht), morgens heraus (Tag). Dazu: Einzug beim Wachsen auf Stufe 5 (Beginn
// des Höhlenbaus gemerkt, im Baum-Test nur im Speicher), Play-Knopf tagsüber ab Stufe 5, nachts nicht.
// Supabase ist nachgebildet; der 3D-Baum braucht WebGL (hier per SwiftShader). Weil SwiftShader nur wenige Bilder je Sekunde
// schafft, spult der Test die Besuche vor (__spechtSim). Aufruf: node test-specht-browser.mjs
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
 const user=()=>({id:'00000000-0000-4000-8000-00000000000c',user_metadata:meta});
 const context=await browser.newContext({serviceWorkers:'block',locale:'de-DE',viewport:{width:1280,height:900}});
 await context.addInitScript(({user,rev})=>{
  window.vanamoBaumTest=true;window.__spechtHold=true;window.__fmHold=true;window.__igelHold=true;window.__igelSchlafHold=true;window.__gluehHold=true;window.__eichTagHold=true;
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
 // Besuch starten (Test-Knopf) und ganz vorspulen: Abschnitte, Haltungen, Schnitt am Loch, Späne
 async function visit(act){
  await click(`.baum-test [data-act="${act}"]`);
  await page.waitForFunction(()=>window.__specht&&window.__specht.art,null,{timeout:60000});
  return page.evaluate(()=>{
   const r={art:window.__specht.art,segs:[],posen:[],clip:[],spaene:0,nuss:false,flug:false,dauer:0,ende:null};
   for(let k=0;k<1200;k++){
    const s=window.__spechtSim(0.05);
    if(!s||!s.art){r.ende=s;break;}
    r.dauer=s.t;if(!r.segs.includes(s.seg))r.segs.push(s.seg);if(s.fig&&!r.posen.includes(s.pose))r.posen.push(s.pose);
    if(!r.clip.includes(s.clip))r.clip.push(s.clip);r.spaene=Math.max(r.spaene,s.chips);if(s.nut)r.nuss=true;if(s.fly)r.flug=true;
   }
   return r;
  });
 }
 const hole=()=>page.evaluate(()=>window.__spechtHole());

 // Höhlenbau Tag 1, 3, 5 (Stufe 5 aus 300 Sätzen ist Stufe 6 – der Knopf lässt sie; Fortschritt nur Anzeige)
 let r=await visit('specht-bau1');console.log('Tag 1:',JSON.stringify(r));
 assert.equal(r.art,'bau');assert.ok(r.segs.includes('anflug')&&r.segs.includes('landen')&&r.segs.includes('hacken')&&r.segs.includes('abflug'),'kommt, hackt, fliegt weg');
 assert.ok(r.posen.includes('klopfen')&&r.spaene>=4,'hackt mit Spänen');
 let h=await hole();console.log('Höhle Tag 1:',JSON.stringify(h));assert.ok(h.bau>0.03&&h.bau<0.2,'erste Hackspuren');
 r=await visit('specht-bau5');console.log('Tag 5:',JSON.stringify(r));
 assert.ok(r.segs.includes('kopfrein')&&r.clip.includes(1),'Kopf in die Höhle (Schnitt am Loch)');
 h=await hole();assert.ok(h.bau>0.7&&h.bau<1,'tiefes Loch');
 // Klettern und Klopfen (Sommer)
 r=await visit('specht-futter');console.log('Futter:',JSON.stringify(r));
 assert.equal(r.art,'futter');for(const k of ['klettern','suchen','umschauen','abflug'])assert.ok(r.segs.includes(k),'Abschnitt '+k);
 for(const k of ['ruhig','klopfen','umschauen','hochschauen'])assert.ok(r.posen.includes(k),'Haltung '+k);
 h=await hole();assert.equal(h.bau,1,'Höhle fertig');
 // Spechtschmiede (Winter)
 r=await visit('specht-schmiede');console.log('Schmiede:',JSON.stringify(r));
 assert.equal(r.art,'schmiede');assert.ok(r.segs.includes('klemmen')&&r.segs.includes('hacken')&&r.segs.includes('leer')&&r.nuss,'Eichel klemmen, aufhacken, Hülle weg');
 assert.ok(r.spaene>=5,'Schalen fallen (und bleiben im Schnee liegen)');
 // abends hinein (der Baum wird Nacht), morgens heraus
 r=await visit('specht-abend');console.log('Abend:',JSON.stringify(r));
 assert.equal(r.art,'abend');assert.ok(r.segs.includes('hinein')&&r.clip.includes(1)&&r.ende?.inside===true,'schlüpft in die Höhle');
 assert.ok(await page.evaluate(()=>window.__baumApi.night>0),'Nacht');
 r=await visit('specht-morgen');console.log('Morgen:',JSON.stringify(r));
 assert.equal(r.art,'morgen');assert.ok(r.segs.includes('schauen')&&r.segs.includes('heraus')&&r.clip.includes(2)&&r.ende?.inside===false,'schaut heraus und fliegt los');
 await page.waitForFunction(()=>window.__baumApi.night===0,null,{timeout:10000});
 // Play-Knopf: tagsüber ab Stufe 5 dabei, nachts nicht
 let pl=await page.evaluate(()=>window.__play());console.log('Play tagsüber:',pl.passend.join(', '));
 assert.ok(pl.passend.includes('buntspecht'),'Play-Knopf: Buntspecht tagsüber');
 const night=on=>page.evaluate(n=>{const h=document.documentElement;h.dataset.theme=n?'kaamos':'vanamo';h.dataset.themeMode=n?'dark':'light';window.__baumApi.setNight(n,true);},on);
 await night(true);pl=await page.evaluate(()=>window.__play());console.log('Play nachts:',pl.passend.join(', ')||'–');
 assert.ok(!pl.passend.includes('buntspecht'),'nachts nicht');
 await night(false);
 // Einzug: Stufe 4 → 5 wachsen (ohne Baumvogel-Wartezeit) – Höhlenbau beginnt (im Baum-Test nur im Speicher)
 await click('.baum-test [data-stage="4"]');await page.waitForTimeout(600);
 await page.evaluate(()=>{window.__spechtHold=false;window.__baumApi.grow(5);});
 await page.waitForFunction(()=>window.__specht&&window.__specht.art==='bau',null,{timeout:90000});
 h=await hole();console.log('Einzug:',JSON.stringify(h));assert.ok(h.bau<0.1,'Höhlenbau beginnt');
 assert.equal(await page.evaluate(()=>localStorage.getItem('vanamo-specht')),null,'Baum-Test: nichts gemerkt');
 assert.deepEqual(errors,[],'keine Fehler');
 console.log('ok');
}finally{await browser.close();server.kill();}

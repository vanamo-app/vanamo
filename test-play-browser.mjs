// Browser-Test: Play-Knopf in der großen Baum-Ansicht (Nutzer 26.10.) – Testkonto, Baum-Test-Leiste für Stufe/Jahreszeit:
// Ansicht öffnen (Knopf mit den zwei Pfeilen) → unten in der Mitte ein Play-Knopf. Tagsüber (Stufe 6, Sommer) startet er eine
// passende Animation und ist gesperrt, solange sie läuft; in einer Sommernacht kommen die Glühwürmchen, der Igel oder die Fledermäuse; in einer Winternacht
// ist nichts da: grau, beim Tippen „Heute Nacht ist es still“. Bei „Weniger Bewegung“ gibt es keinen Play-Knopf.
// Supabase ist nachgebildet; der 3D-Baum braucht WebGL (hier per SwiftShader). Aufruf: node test-play-browser.mjs
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
// Tagesablauf-Vorgaben: nichts kommt von selbst dazwischen (Eichhörnchen, Glühwürmchen)
const DAY_SEASON={fruehling:14,sommer:42,herbst:70,winter:98};
const SHOTS=process.env.PLAY_SHOTS;   // Ordner für Bildschirmfotos (zum Ansehen), sonst keine
async function openApp(reducedMotion='no-preference'){
 const meta={username:'testuser123',nickname:'Test',avatar:'peippo',tree:{fi:{planted:new Date(Date.now()-20*86400000).toISOString(),start:new Date(Date.now()-20*86400000).toISOString(),birds:6}}};
 const user=()=>({id:'00000000-0000-4000-8000-00000000000b',user_metadata:meta});
 const context=await browser.newContext({serviceWorkers:'block',locale:'de-DE',viewport:{width:1280,height:900},reducedMotion});
 await context.addInitScript(({user,rev})=>{
  window.vanamoBaumTest=true;window.__eichTagHold=true;window.__gluehHold=true;window.__igelHold=true;window.__fmHold=true;window.__spechtHold=true;
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
 return {context,page,errors};
}
try{
 let {context,page,errors}=await openApp();
 // Klick per Skript: mit SwiftShader rechnet jedes Bild lange, Playwrights Warten auf „ruhiges“ Element läuft sonst ab
 const clickSel=sel=>page.evaluate(s=>document.querySelector(s).click(),sel);
 // Nacht wie mit dem Tag/Nacht-Knopf (Kaamos), der Baum gleich ganz nachts (sonst braucht der Übergang mit SwiftShader lange)
 const night=on=>page.evaluate(n=>{const h=document.documentElement;h.dataset.theme=n?'kaamos':'vanamo';h.dataset.themeMode=n?'dark':'light';window.__baumApi.setNight(n,true);},on);
 // Foto: Baum kurz anhalten (sonst wartet das Foto mit SwiftShader sehr lange auf ein Bild); ein Fehler hier bricht den Test nicht ab
 if(SHOTS)await page.addStyleTag({content:'.tree-view,.tree-view *{transition:none!important}.tree-view-play.is-running::after{animation:none!important;opacity:.85!important}'});   // Übergänge stehen mit SwiftShader sonst auf dem ersten Bild, der Puls hält das Foto auf
 const shot=async name=>{if(!SHOTS)return;try{await page.evaluate(()=>window.__baumApi.pause());await page.waitForTimeout(900);await page.screenshot({path:`${SHOTS}/${name}.png`,timeout:90000});}catch(e){console.log('Foto',name,'fehlt:',e.message.split('\n')[0]);}finally{await page.evaluate(()=>window.__baumApi.resume());}};
 const btn=()=>page.evaluate(()=>{const b=document.querySelector('.tree-view-play');return b&&{hidden:b.hidden,running:b.classList.contains('is-running'),quiet:b.classList.contains('is-quiet'),disabled:b.getAttribute('aria-disabled'),label:b.getAttribute('aria-label')};});
 // Stufe 6, Sommer, tagsüber
 await clickSel('.baum-test [data-stage="6"]');
 await page.evaluate(d=>window.__baumApi.setDay(d),DAY_SEASON.sommer);
 await page.waitForFunction(()=>window.__baumApi.stage===6&&!window.__baumApi.busy,null,{timeout:60000});
 // Ansicht öffnen: Play-Knopf da und bereit
 assert.equal(await page.evaluate(()=>!!document.querySelector('.tree-view-play')),true,'Play-Knopf angelegt');
 await clickSel('.home-tree-expand');
 await page.waitForSelector('.tree-view.is-open',{timeout:30000});
 await page.waitForFunction(()=>{const b=document.querySelector('.tree-view-play');return b&&!b.hidden&&b.getAttribute('aria-disabled')==='false';},null,{timeout:60000});
 let b=await btn();console.log('bereit:',JSON.stringify(b),JSON.stringify(await page.evaluate(()=>window.__play())));
 assert.equal(b.label,'Etwas passieren lassen');
 await shot('play-1-bereit');
 const passend=(await page.evaluate(()=>window.__play())).passend;
 assert.ok(passend.includes('eichhoernchen')&&passend.includes('haeher')&&!passend.includes('gluehwuermchen')&&!passend.includes('kraehen'),'tagsüber im Sommer auf Stufe 6: Häher, Eichhörnchen …, keine Glühwürmchen, keine Krähen');
 // Tippen: etwas passiert, der Knopf ist gesperrt
 await clickSel('.tree-view-play');
 await page.waitForFunction(()=>window.__baumApi.playState.zustand==='laeuft',null,{timeout:20000});
 const st=await page.evaluate(()=>window.__baumApi.playState);console.log('läuft:',JSON.stringify(st));
 assert.ok(passend.includes(st.id),'eine passende Animation läuft');
 await page.waitForFunction(()=>document.querySelector('.tree-view-play').classList.contains('is-running'),null,{timeout:10000});
 assert.equal(await page.evaluate(()=>window.__baumApi.play()),false,'solange sie läuft, startet nichts Neues');
 await shot('play-2-laeuft');
 // Sommernacht: Glühwürmchen, Igel oder Fledermäuse
 await page.evaluate(()=>window.__baumApi.setStage(6));   // bricht Häher/Eichhörnchen ab
 await night(true);
 await page.waitForFunction(()=>{const p=window.__play();return p.passend.slice().sort().join()==='fledermaeuse,gluehwuermchen,igel';},null,{timeout:20000});
 await page.waitForFunction(()=>window.__baumApi.playState.zustand==='bereit',null,{timeout:90000});   // was noch flog, ist weg
 await clickSel('.tree-view-play');
 await page.waitForFunction(()=>{const s=window.__baumApi.playState;return s.zustand==='laeuft'&&['gluehwuermchen','igel','fledermaeuse'].includes(s.id);},null,{timeout:20000});
 const nachtId=await page.evaluate(()=>window.__baumApi.playState.id);console.log('Sommernacht:',nachtId);
 // __fm (Fledermäuse) entsteht erst beim nächsten Bild: der Play-Knopf startet nach fledermausFx.frame() – darauf warten
 assert.ok(await page.waitForFunction(id=>id==='igel'?!!window.__igel:id==='fledermaeuse'?!!window.__fm:!!window.__glueh(),nachtId,{timeout:15000}).then(()=>true,()=>false),'Nacht-Animation läuft');
 if(SHOTS&&nachtId==='gluehwuermchen'){await page.evaluate(()=>{window.__gluehT=9;});await page.waitForTimeout(2500);await shot('play-3-gluehwuermchen');await page.evaluate(()=>{window.__gluehT=null;});}   // Zeit im Tanz festhalten: SwiftShader ist zu langsam
 // Winternacht: nichts da – grau, Meldung beim Tippen
 await page.evaluate(d=>window.__baumApi.setDay(d),DAY_SEASON.winter);
 await page.waitForFunction(()=>window.__glueh()===null&&!window.__igel&&!window.__fm,null,{timeout:60000});   // verglimmen bzw. blendet aus / fliegen davon
 await page.waitForFunction(()=>window.__baumApi.playState.zustand==='still',null,{timeout:30000});
 await page.waitForFunction(()=>document.querySelector('.tree-view-play').classList.contains('is-quiet'),null,{timeout:10000});
 b=await btn();console.log('still:',JSON.stringify(b));
 assert.equal(b.label,'Heute Nacht ist es still');
 await clickSel('.tree-view-play');
 await page.waitForFunction(()=>document.querySelector('.tree-view-msg').classList.contains('is-on'),null,{timeout:5000});
 assert.equal(await page.evaluate(()=>document.querySelector('.tree-view-msg').textContent),'Heute Nacht ist es still');
 if(SHOTS){await page.evaluate(()=>{document.querySelector('.tree-view-msg').style.opacity='1';});await shot('play-4-still');await page.evaluate(()=>{document.querySelector('.tree-view-msg').style.opacity='';});}   // Meldung bleibt fürs Foto stehen
 assert.equal(await page.evaluate(()=>window.__baumApi.playState.zustand),'still','Tippen startet nichts');
 // Schließen: Knopf weg mit der Ansicht
 await night(false);
 await clickSel('.tree-view-close');
 await page.waitForFunction(()=>document.querySelector('.tree-view').hidden,null,{timeout:30000});
 assert.deepEqual(errors,[]);
 await context.close();
 // „Weniger Bewegung“: kein Play-Knopf
 ({context,page,errors}=await openApp('reduce'));
 await page.evaluate(()=>document.querySelector('.home-tree-expand').click());
 await page.waitForSelector('.tree-view.is-open',{timeout:30000});
 await page.waitForTimeout(1200);
 assert.equal(await page.evaluate(()=>document.querySelector('.tree-view-play').hidden),true,'bei „Weniger Bewegung“ kein Play-Knopf');
 assert.equal(await page.evaluate(()=>window.__baumApi.play()),false);
 assert.deepEqual(errors,[]);
 await context.close();
 console.log('PASS: Play-Knopf');
}finally{await browser.close();server.kill();}

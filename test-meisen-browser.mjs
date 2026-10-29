// Browser-Test: Kohlmeisen (Nutzer 28.10.: mehr Haltungen, etwas im Schnabel, Junge im Kasten) – Testkonto, Knöpfe im
// Baum-Test: Nestbau (Moos in den Kasten), Füttern (Raupe; ein Junges bettelt im Flugloch), Ausfliegen (Eltern warten mit
// Raupen, drei Junge flattern nacheinander heraus, werden gefüttert, alle fliegen davon), Sommer (ein Junges wird auf dem
// Ast gefüttert), Winter (aufgeplustert), Haltungen beim Sitzen. Dazu: das Ausfliegen kommt im Zeitfenster von selbst (einmal,
// im Baum-Test nur im Speicher), Play-Knopf tagsüber ab Stufe 3.
// Nutzer 29.10.: beim Füttern bleibt die Meise vor dem Flugloch (nie hinein), und jede Meise auf einem Ast sitzt so, dass
// sie ganz zu sehen ist – nicht im Stamm, nicht dahinter, nicht im Laub (__meisenFrei, auch auf Stufe 4 und 6).
// Supabase ist nachgebildet; der 3D-Baum braucht WebGL (hier per SwiftShader). Weil SwiftShader nur wenige Bilder je Sekunde
// schafft, spult der Test die Besuche vor (__meisenSim). Aufruf: node test-meisen-browser.mjs
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
 const user=()=>({id:'00000000-0000-4000-8000-00000000000d',user_metadata:meta});
 const context=await browser.newContext({serviceWorkers:'block',locale:'de-DE',viewport:{width:1280,height:900}});
 await context.addInitScript(({user,rev})=>{
  window.vanamoBaumTest=true;window.__meisenHold=true;window.__spechtHold=true;window.__fmHold=true;window.__igelHold=true;window.__igelSchlafHold=true;window.__gluehHold=true;window.__eichTagHold=true;
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
 // Besuch vorspulen: Zustände, Bilder, Dinge im Schnabel, Kopf im Flugloch, Ablauf beim Ausfliegen
 const sim=(sek,stopWennWeg=true)=>page.evaluate(({sek,stopWennWeg})=>{
  const r={st:[],bilder:[],moos:false,raupe:false,kopf:[],kopfRaus:false,af:[],jungAst:0,gefuettert:0,rein:false,ende:false,phase:null,dauer:0,sitzt:0,unfrei:[]};
  const alt0=new Map();
  for(let k=0;k<sek/0.05;k++){
   const m=window.__meisenSim(0.05);if(!m)continue;
   r.dauer=+(k*0.05).toFixed(2);r.phase=m.phase;
   for(const [i,b] of [...m.alt,...m.jung].entries()){
    if(!r.st.includes(b.st))r.st.push(b.st);if(b.f&&b.vis&&!r.bilder.includes(b.f))r.bilder.push(b.f);
    if(b.carry==='moos'&&b.item)r.moos=true;if(b.carry==='raupe'&&b.item)r.raupe=true;
    if(b.st==='rein')r.rein=true;
    // Füttern: ein Altvogel mit Junge-Ziel verliert seine Raupe
    if(i<2){const p=alt0.get(i);if(p&&p.carry==='raupe'&&!b.carry&&p.feed>=0)r.gefuettert++;alt0.set(i,{carry:b.carry,feed:b.feed});}
   }
   r.jungAst=Math.max(r.jungAst,m.jung.filter(j=>j.st==='ast').length);
   // alle 0,2 s: sitzt jede Meise auf dem Ast ganz sichtbar (nicht im/hinter dem Stamm, nicht im Laub)?
   if(k%4===0)for(const f of window.__meisenFrei()){r.sitzt++;if(!f.frei&&r.unfrei.length<5)r.unfrei.push((f.jung?'jung ':'alt ')+f.st+' '+r.dauer);}
   if(m.kopf){if(!r.kopf.includes(m.kopf.want))r.kopf.push(m.kopf.want);if(m.kopf.out)r.kopfRaus=true;}
   if(m.af&&!r.af.includes(m.af))r.af.push(m.af);
   if(stopWennWeg&&k>40&&!m.af&&m.alt.every(b=>b.st==='weg')&&m.jung.every(b=>b.st==='weg')){r.ende=true;break;}
  }
  return r;
 },{sek,stopWennWeg});
 const knopf=async act=>{
  await click(`.baum-test [data-act="${act}"]`);
  return page.waitForFunction(()=>{const m=window.__meisen;return !!m&&(!!m.af||m.alt.some(b=>b.st!=='weg')||m.jung.some(b=>b.st!=='weg'));},null,{timeout:60000}).then(()=>true,()=>false);
 };

 // Stufe 5, Ausfliegen-Fenster (Tag 33): kommt von selbst (beim ersten Ansehen) – im Baum-Test nur im Speicher
 await click('.baum-test [data-stage="5"]');await page.waitForTimeout(600);
 await page.evaluate(()=>{const r=document.querySelector('.baum-test input[type=range]');r.value='32';r.dispatchEvent(new Event('input',{bubbles:true}));});
 await page.waitForTimeout(600);
 await page.evaluate(()=>{window.__meisenHold=false;});
 let r=await sim(20,false);console.log('von selbst:',JSON.stringify({af:r.af,dauer:r.dauer}));
 assert.ok(r.af.includes('eltern')||r.af.includes('kopf'),'Ausfliegen beginnt von selbst');
 r=await sim(120);console.log('Ausfliegen (von selbst):',JSON.stringify(r));
 assert.ok(r.ende&&r.af.includes('weg'),'alle fliegen davon');
 assert.deepEqual(r.unfrei,[],'Ausfliegen: alle sitzen sichtbar auf Ästen');
 await page.evaluate(()=>{window.__meisenHold=true;});
 assert.equal(await page.evaluate(()=>window.__meisenSim(1.2).phase),'familie','danach Sommer mit Jungen (Kasten leer)');
 assert.equal(await page.evaluate(()=>localStorage.getItem('vanamo-meisen')),null,'Baum-Test: nichts gemerkt');

 // Nestbau: Moos im Schnabel, hinein, ohne heraus
 assert.ok(await knopf('meise-nest'),'Nestbau-Besuch');
 r=await sim(60);console.log('Nestbau:',JSON.stringify(r));
 assert.ok(r.moos&&r.rein&&r.st.includes('drin')&&r.st.includes('raus')&&r.ende,'bringt Moos in den Kasten');
 assert.ok(!r.raupe&&!r.kopf.length,'keine Raupe, keine Jungen');
 // Füttern: Raupe, Junges bettelt im Flugloch (zwei Besuche: am Loch oder hinein)
 let kopf=[],rein=false,gef=false;
 for(let v=0;v<3;v++){
  assert.ok(await knopf('meise-futter'),'Füttern-Besuch');
  r=await sim(60);console.log('Füttern:',JSON.stringify(r));
  assert.ok(r.raupe&&r.ende,'bringt eine Raupe');kopf.push(...r.kopf);rein||=r.rein;gef||=r.st.includes('fuettert');
  assert.deepEqual(r.unfrei,[],'Füttern: sitzt sichtbar');
 }
 assert.ok(kopf.includes('bettel'),'ein Junges bettelt im Flugloch');
 assert.ok(gef&&!rein,'Füttern: am Flugloch, nie hinein (Nutzer 29.10.)');
 // Ausfliegen (Knopf): Kopf reckt sich heraus, drei Junge auf Ästen, gefüttert, alle davon
 assert.ok(await knopf('meise-aus'),'Ausfliegen');
 r=await sim(130);console.log('Ausfliegen:',JSON.stringify(r));
 for(const p of ['eltern','kopf','flug','satt','sitzen','weg'])assert.ok(r.af.includes(p),'Abschnitt '+p);
 assert.ok(r.kopfRaus,'Junges reckt den Kopf heraus');
 assert.ok(r.jungAst>=2,'Junge sitzen auf Ästen');assert.ok(r.gefuettert>=2,'Junge werden gefüttert');
 assert.ok(r.bilder.includes('jung-sitz')&&(r.bilder.includes('jung-hoch')||r.bilder.includes('jung-tief')),'Ästling sitzt und fliegt');
 assert.ok(r.ende,'alle fliegen davon');
 assert.deepEqual(r.unfrei,[],'Ausfliegen (Knopf): alle sitzen sichtbar');
 // Sommer: ein Junges wird auf dem Ast gefüttert
 assert.ok(await knopf('meise-familie'),'Sommerbesuch');
 r=await sim(60);console.log('Sommer:',JSON.stringify(r));
 assert.ok(r.jungAst>=1&&r.gefuettert>=1&&r.ende,'Junges wird gefüttert');
 assert.ok(!r.st.includes('rein'),'Kasten bleibt leer');
 assert.deepEqual(r.unfrei,[],'Sommer: alle sitzen sichtbar');
 // Haltungen beim Sitzen (Herbst: Äste oder Dach), Winter aufgeplustert
 const posen=new Set();
 await page.evaluate(()=>{const r=document.querySelector('.baum-test input[type=range]');r.value='70';r.dispatchEvent(new Event('input',{bubbles:true}));});
 for(let v=0;v<6&&!(posen.has('umschauen')&&(posen.has('picken')||posen.has('putzen')));v++){
  assert.ok(await knopf('meise'),'Besuch im Herbst');
  r=await sim(60);for(const b of r.bilder)posen.add(b);
  assert.deepEqual(r.unfrei,[],'Herbst: sitzt sichtbar');
 }
 console.log('Haltungen:',[...posen].join(', '));
 assert.ok(posen.has('umschauen')&&(posen.has('picken')||posen.has('putzen')),'neue Haltungen');
 assert.ok(await knopf('meise-winter'),'Winterbesuch');
 r=await sim(60);console.log('Winter:',JSON.stringify(r));
 assert.ok(r.bilder.includes('plustern'),'im Winter aufgeplustert');
 assert.deepEqual(r.unfrei,[],'Winter: sitzt sichtbar');
 // Stufe 4 und 6 (6 im Sommer: dichtes Laub, wenig freie Äste): Ausfliegen und Sommer, alle sichtbar
 for(const st of ['4','6']){
  await click(`.baum-test [data-stage="${st}"]`);await page.waitForTimeout(800);
  await page.evaluate(()=>{const r=document.querySelector('.baum-test input[type=range]');r.value='32';r.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForTimeout(600);
  assert.ok(await knopf('meise-aus'),'Ausfliegen Stufe '+st);
  r=await sim(130);console.log('Ausfliegen Stufe '+st+':',JSON.stringify({af:r.af,jungAst:r.jungAst,gefuettert:r.gefuettert,sitzt:r.sitzt,unfrei:r.unfrei,ende:r.ende}));
  assert.ok(r.ende&&r.af.includes('weg'),'Stufe '+st+': alle fliegen davon');
  assert.deepEqual(r.unfrei,[],'Stufe '+st+': beim Ausfliegen alle sichtbar');
  assert.ok(await knopf('meise-familie'),'Sommer Stufe '+st);
  r=await sim(60);console.log('Sommer Stufe '+st+':',JSON.stringify({gefuettert:r.gefuettert,sitzt:r.sitzt,unfrei:r.unfrei,ende:r.ende}));
  assert.deepEqual(r.unfrei,[],'Stufe '+st+': im Sommer alle sichtbar');
 }
 // Play-Knopf: tagsüber ab Stufe 3 dabei
 const pl=await page.evaluate(()=>window.__play());console.log('Play:',pl.passend.join(', '));
 assert.ok(pl.passend.includes('kohlmeisen'),'Play-Knopf: Kohlmeisen');
 assert.deepEqual(errors,[],'keine Fehler');
 console.log('ok');
}finally{await browser.close();server.kill();}

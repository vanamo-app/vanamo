// Browser-Test: Igel (ab Stufe 4, Nutzer 26./27.10.) – Knöpfe im Baum-Test (Testkonto):
// „Igel (Sommernacht)“: kommt über die Wiese, schnüffelt, frisst einen Wurm und trippelt weiter (Gliederpuppe: die Füße
// rutschen nicht); danach ist er weg. Nachts ist er beim Play-Knopf dabei (Frühling bis Herbst, solange er wach ist),
// tagsüber und im Winter nicht; nachts kommt er auch von selbst. Winterschlaf: „Igel zieht ein (Herbst)“ → kriecht in den
// Laubhaufen, schläft dann bis zum Frühling; „Igel wacht auf (Frühling)“ → kommt heraus; von selbst nur einmal je
// Zeitfenster; der Haufen wächst, liegt, versinkt.
// Supabase ist nachgebildet; der 3D-Baum braucht WebGL (hier per SwiftShader). Weil SwiftShader nur wenige Bilder je Sekunde
// schafft, spult der Test den Ablauf vor (__igelSim). Aufruf: node test-igel-browser.mjs
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
  window.vanamoBaumTest=true;window.__igelHold=true;window.__igelSchlafHold=true;window.__gluehHold=true;window.__eichTagHold=true;window.__fmHold=true;window.__spechtHold=true;
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
 // Nacht wie mit dem Tag/Nacht-Knopf (Kaamos), der Baum gleich ganz nachts
 const night=on=>page.evaluate(n=>{const h=document.documentElement;h.dataset.theme=n?'kaamos':'vanamo';h.dataset.themeMode=n?'dark':'light';window.__baumApi.setNight(n,true);},on);
 const runAll=()=>page.evaluate(()=>{
  const r={abschnitte:[],posen:{},px:null};
  for(let k=0;k<1200;k++){
   const s=window.__igelSim(0.1);if(!s)break;
   if(r.px==null)r.px=s.px;
   const a=s.k;if(a&&r.abschnitte[r.abschnitte.length-1]!==a)r.abschnitte.push(a);   // null: gerade fertig
   r.posen[s.pose]=(r.posen[s.pose]||0)+1;
  }
  r.ende=window.__igel===null;return r;
 });
 // Test-Knopf: Stufe 4, Sommer – und nachts
 await night(true);
 await click('.baum-test [data-act="igel"]');
 await page.waitForFunction(()=>window.__baumApi.stage>=4&&!!window.__igel,null,{timeout:60000});
 let st=await page.evaluate(()=>window.__igel);
 console.log('kommt:',JSON.stringify(st));
 assert.equal(st.k,'lauf','kommt trippelnd');
 assert.ok(st.px>=20,'gut zu sehen (mindestens etwa 24 px lang)');
 let r=await runAll();
 console.log('Ablauf:',JSON.stringify(r));
 for(const k of ['schnueffeln','schnuppern','fressen','fressen2'])assert.ok(r.abschnitte.includes(k),'Abschnitt '+k);
 assert.ok(r.abschnitte.indexOf('fressen')<r.abschnitte.indexOf('fressen2'),'erst der ganze Wurm, dann der Rest');
 assert.equal(r.abschnitte[r.abschnitte.length-1],'lauf','zuletzt trippelt er weg');
 assert.ok(r.posen.lauf>30&&r.posen.stand>3,'läuft und steht (Gliederpuppe)');
 assert.ok(r.ende,'danach weg');
 // Gliederpuppe (Nutzer 27.10.: „gibt es wieder keinen wirklichen gang?“): die Beine laufen versetzt; ein Fuß, der auf der
 // Wiese steht, bleibt quer durchs Bild an seiner Stelle, während der Körper weiterläuft (fein vorgespult)
 const gang=await page.evaluate(()=>{
  window.__baumApi.hedgehog({force:true});
  let prev=null,sf=0,sb=0,n=0,maxA=0,ampMax=0;const ph=new Set(),stehen=new Set();
  for(let k=0;k<2400;k++){
   const s=window.__igelSim(0.025,0.025);if(!s)break;
   ampMax=Math.max(ampMax,s.amp);if(s.pose==='lauf')ph.add(Math.floor(s.ph*8));
   const f=window.__igelFuesse();
   if(prev&&f&&prev.pose==='lauf'&&f.pose==='lauf'&&prev.amp>0.95&&f.amp>0.95){
    const db=Math.abs(f.x-prev.x);
    for(const b of ['nh','nf','fh','ff'])if(prev[b].steht&&f[b].steht){const d=Math.abs(f[b].sx-prev[b].sx);sf+=d;sb+=db;n++;maxA=Math.max(maxA,d/Math.max(1e-6,db));stehen.add(b);}
   }
   prev=f;
  }
  return {phasen:ph.size,ampMax:+ampMax.toFixed(2),schritte:n,beine:[...stehen].sort(),rutschen:+(sf/Math.max(1e-6,sb)).toFixed(4),maxAnteil:+maxA.toFixed(3),weg:window.__igel===null};
 });
 console.log('Gang:',JSON.stringify(gang));
 assert.equal(gang.phasen,8,'alle Beinstellungen kommen vor');
 assert.ok(gang.ampMax>0.95&&gang.schritte>300,'läuft mit vollem Schritt');
 assert.deepEqual(gang.beine,['ff','fh','nf','nh'],'alle vier Füße stehen mal auf');
 assert.ok(gang.rutschen<0.02&&gang.maxAnteil<0.3,'die Füße rutschen nicht (Weg des stehenden Fußes ≪ Weg des Körpers)');
 assert.ok(gang.weg,'danach weg');
 // Play-Knopf: Sommernacht → Igel und Glühwürmchen
 let p=await page.evaluate(()=>window.__play());
 const stufe=await page.evaluate(()=>window.__baumApi.stage);
 assert.deepEqual([...p.passend].sort(),(stufe>=5?['fledermaeuse']:[]).concat(['gluehwuermchen','igel']),'in der Sommernacht: Glühwürmchen und Igel (ab Stufe 5 auch Fledermäuse)');
 // tagsüber und im Winter nicht; im Frühling und Herbst schon (wach)
 await night(false);
 p=await page.evaluate(()=>window.__play());
 assert.ok(!p.passend.includes('igel'),'tagsüber kein Igel');
 assert.equal(await page.evaluate(()=>window.__baumApi.hedgehog()),false,'tagsüber kommt er nicht');
 await night(true);
 await page.evaluate(()=>window.__baumApi.setDay(96));
 assert.equal(await page.evaluate(()=>window.__baumApi.hedgehog()),false,'im Winter schläft er');
 assert.ok(!(await page.evaluate(()=>window.__play())).passend.includes('igel'),'Winternacht: nicht beim Play-Knopf');
 for(const d of [20,70]){
  await page.evaluate(d=>window.__baumApi.setDay(d),d);
  assert.ok((await page.evaluate(()=>window.__play())).passend.includes('igel'),'nachts am Tag '+d+' wach');
 }
 await page.evaluate(()=>window.__baumApi.setDay(42));
 // wird es Tag, während er da ist: rasch weg
 assert.equal(await page.evaluate(()=>window.__baumApi.hedgehog()),true);
 await page.evaluate(()=>window.__igelSim(4));
 await night(false);
 await page.waitForFunction(()=>window.__igel===null,null,{timeout:60000});
 // von selbst (Sommernacht)
 await night(true);
 await page.evaluate(()=>{window.__igelHold=false;window.__igelNext=0.05;});
 await page.waitForFunction(()=>!!window.__igel,null,{timeout:60000});
 await page.evaluate(()=>{window.__igelHold=true;window.__baumApi.setStage(6);});
 await night(false);
 // Laubhaufen: wächst im Herbst, liegt im Winter, versinkt im Frühling, im Sommer keiner
 const haufen=d=>page.evaluate(d=>{window.__baumApi.setDay(d);
  // sichtbar wird erst im nächsten Bild gesetzt – ein paar Bilder abwarten
  return new Promise(r=>{let k=0;const f=()=>(++k>=8?r(window.__haufen()):requestAnimationFrame(f));requestAnimationFrame(f);});},d);
 let h=await haufen(42);assert.equal(h.sichtbar,false,'Sommer: kein Laubhaufen');
 h=await haufen(66);assert.ok(h.sichtbar&&h.a>0.05&&h.a<0.5,'Herbst: wächst');
 h=await haufen(96);assert.ok(h.sichtbar&&h.a===1,'Winter: voll');
 h=await haufen(13);assert.ok(h.sichtbar&&h.s>0.2&&h.s<0.8,'Frühling: versinkt');
 // Winterschlaf: Einzug
 await click('.baum-test [data-act="igel-ein"]');
 await page.waitForFunction(()=>window.__igel&&window.__igel.schlaf==='ein',null,{timeout:60000});
 r=await runAll();console.log('Einzug:',JSON.stringify(r.abschnitte));
 assert.ok(r.abschnitte.includes('schnueffeln')&&r.abschnitte[r.abschnitte.length-1]==='leer','schnüffelt und ist dann im Haufen');
 let sch=await page.evaluate(()=>window.__igelSchlaf());console.log('Schlaf:',JSON.stringify(sch));
 assert.ok(sch.ein&&!sch.wach,'schläft im Haufen');
 await night(true);
 assert.equal(await page.evaluate(()=>window.__baumApi.hedgehog()),false,'schläft: kein Nachtbesuch');
 await night(false);
 // Aufwachen
 await click('.baum-test [data-act="igel-aus"]');
 await page.waitForFunction(()=>window.__igel&&window.__igel.schlaf==='aus',null,{timeout:60000});
 r=await runAll();console.log('Aufwachen:',JSON.stringify(r.abschnitte));
 assert.ok(r.abschnitte[0]==='leer'&&r.abschnitte.includes('schnuppern')&&r.abschnitte[r.abschnitte.length-1]==='lauf','raschelt, kommt heraus, schnuppert, trippelt weg');
 sch=await page.evaluate(()=>window.__igelSchlaf());
 assert.ok(sch.aus&&sch.wach,'wach');
 // von selbst nur einmal: im Fenster (Baum-Test: nur im Speicher) nach dem Einzug nicht noch einmal
 await page.evaluate(()=>{window.__igelSchlafHold=false;window.__baumApi.setDay(80);});
 await page.waitForTimeout(6000);
 assert.equal(await page.evaluate(()=>window.__igel),null,'Einzug nur einmal je Herbst');
 assert.deepEqual(errors,[]);
 await context.close();
 console.log('PASS: Igel');
}finally{await browser.close();server.kill();}

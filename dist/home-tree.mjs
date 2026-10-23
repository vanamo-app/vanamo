// Der Vanamo-Baum auf „Willkommen“ (nur mit Konto).
//
// Aufbau (index.html): #home-tree (Bühne, darin die Leinwand) und #home-tree-progress (Stufe + dünne Linie +
// „noch N neue Sätze“) stehen zwischen Begrüßung und den zwei Knöpfen; der Satz des Tages folgt darunter.
// Der Platz für den Baum ist von Anfang an da (style.css) – das Intro schreibt den Satz des Tages dort hinein.
// Laden in zwei Schritten, damit die Stelle nie leer ist und die Seite nicht hängt:
//  1. sofort ein Platzhalter-Bild (app.js lädt dieses kleine Modul gleich): das Foto vom letzten Besuch, wenn es zu
//     Stufe, Jahreszeit und Farbschema passt – sonst die gemalte Wiese der Stufe (baum/data/platz-*.webp);
//  2. nach dem Intro der 3D-Baum (three.js, vorab gerechnete Daten); er blendet über dem Platzhalter ein.
// Ist der Baum zu sehen, wird er für das nächste Mal fotografiert (nur in diesem Browser).
//
// Scrollen („Milchglas“, Desktop und Handy): Der Baum bleibt stehen (sticky), Knöpfe und Satz des Tages scrollen
// darüber. Er wird dabei etwas kleiner, blasser und weich; beim Hochscrollen wieder groß und klar. Sobald die
// weiche Ebene ihn ganz verdeckt, steht er als Standbild still; darunter läuft er wieder.
// Außerdem steht er still, solange ein anderer Reiter offen oder der Tab im Hintergrund ist.
//
// Baum-Ansicht (Knopf unten rechts am Baum): Die Seite wird zu Milchglas, der Baum groß in der Mitte; dort lässt er
// sich drehen und zoomen (Handy: ziehen / zwei Finger, Desktop: ziehen / Mausrad). Schließen mit X, Esc oder der
// Zurück-Taste. Am Handy geht Drehen und Zoomen nur dort; am Desktop bleibt beides auch ohne Ansicht wie bisher.
//
// Wachstum: nur neu gelernte Sätze zählen (verschiedene Sätze mit mindestens einer Wiederholung), je Sprache ein Baum.
// Pflanzdatum und „Start gesehen“ liegen im Konto (user_metadata.tree.<Sprache>), das Pflanzdatum zusätzlich im Browser.
//
// Start (neuer Baum): Bis der Eichelhäher kommt, ist nur die Wiese zu sehen (ohne Eichel). Er fliegt los, sobald das
// Vogel-Intro vorbei ist und der Baum wirklich zu sehen ist (Reiter „Willkommen“, ganz oben, Tab im Vordergrund),
// nach 1 s Ruhe – auch nachts (einmalige Ausnahme). Gesehen = die Eichel liegt im Gras; steht der Baum vorher still
// (Reiter gewechselt, weggescrollt, Tab im Hintergrund), kommt er beim nächsten Mal noch einmal. Gilt der Start als
// gesehen, ist der Baum gepflanzt (Pflanzdatum = jetzt). Sind schon Sätze gelernt (aus der Gastzeit), wächst er gleich danach.
// „Weniger Bewegung“: die Eichel liegt sofort.
//
// Besuch (ab Stufe 1): Der Eichelhäher kommt ab und zu vorbei (bei etwa jedem dritten Besuch auf „Willkommen“,
// frühestens 8–20 s nach dem Laden, höchstens einmal pro Besuch), landet, versteckt eine Eichel und fliegt weiter.
// Nur tagsüber, nicht bei „Weniger Bewegung“ und nicht, während der Baum wächst oder die Seite gescrollt ist.
import {REVIEW_KINDS} from './review-plan.mjs?v=2';

// Wachstum über den Kurs (Nutzer 23.10.): voll ausgewachsen am Ende von Level 3, anfangs schnell, dann immer langsamer.
// Die Stufen sind Anteile am Kurs der Sprache (Sätze in Level 1–3), damit sie auch für andere Sprachen passen;
// Stufe 1 kommt immer nach den ersten 5 Sätzen. Finnisch (nach der Doppelungs-Prüfung): 2.924 Sätze in Level 1–3 →
// 5 · 30 · 111 · 262 · 523 · 857 · 1.260 · 1.713 · 2.269 · 2.924 (Ende Level 1 ≈ Stufe 4, Ende Level 2 ≈ Stufe 7).
export const COURSE_SIZE={fi:2924};
export const STAGE_SHARE=[0.0103,0.038,0.0897,0.179,0.293,0.431,0.586,0.776,1];   // Stufen 2–10
export const stageThresholds=(size=COURSE_SIZE.fi)=>[0,5,...STAGE_SHARE.map(f=>Math.max(6,Math.round(f*size)))];
export const STAGE_AT=stageThresholds();   // ab so vielen neu gelernten Sätzen gilt die Stufe
export const YEAR_LEN=112;                                            // 4 × 28 Tage, beginnt mit dem Frühling
const START_DAY=5;                                                    // ein neuer Baum ist gleich grün
const GLAS_STILL=.4;                                                  // ab hier deckt die weiche Ebene ganz: Standbild
const PLANTED_KEY='vanamo-baum-gepflanzt';
const SNAP_KEY='vanamo-baum-foto',SNAP_V=6;   // 2: Nachtbeleuchtung (alte Kaamos-Fotos waren taghell) · 3: Schatten der jungen Blättchen korrigiert · 4: durchsichtiger Hintergrund · 5: Zweige im Herbst verholzt · 6: Knicke ohne Loch
const PLATZ_WEIT=[1,2,3,5,7,10];   // gemalte Wiesen gibt es für diese Stufen (werkstatt/platzhalter.mjs)
const SEASONS=['fruehling','sommer','herbst','winter'],SEASON_LEN=28,SWITCH_DAYS=10;

/** Zahl der verschiedenen Sätze, die schon gelernt wurden (Wiederholen zählt nicht extra). */
export function learnedCount(reviews){
 const kinds=new Set(REVIEW_KINDS),ids=new Set();
 for(const [key,r] of Object.entries(reviews||{})){
  const i=key.lastIndexOf(':');if(i<1||!kinds.has(key.slice(i+1)))continue;
  if(Number(r?.repetitions)>0)ids.add(key.slice(0,i));
 }
 return ids.size;
}
/** Stufe 0–10 und Fortschritt bis zur nächsten. */
export function treeStage(n){
 let s=0;while(s<STAGE_AT.length-1&&n>=STAGE_AT[s+1])s++;
 if(s>=STAGE_AT.length-1)return {stage:s,next:null,remaining:0,share:1};
 const from=STAGE_AT[s],to=STAGE_AT[s+1];
 return {stage:s,next:to,remaining:to-n,share:(n-from)/(to-from)};
}
/** Tag im Vanamo-Jahr seit dem Pflanzen. */
export function yearDay(planted,now=Date.now()){
 const days=Math.max(0,(now-planted)/86400000);
 return (START_DAY+days)%YEAR_LEN;
}
const TREE_LANG='fi';   // je Sprache ein Baum (bisher nur Finnisch)
function accountUser(){
 try{return window.suomiAccountUser?.()||JSON.parse(localStorage.getItem('suomi-auth-session-v1')||'null')?.user||null;}catch{return null;}
}
/** Baum-Daten im Konto: { planted, start } (ISO-Zeiten) */
function accountTree(){const t=accountUser()?.user_metadata?.tree;return t&&typeof t==='object'&&t[TREE_LANG]&&typeof t[TREE_LANG]==='object'?t[TREE_LANG]:{};}
function saveAccountTree(patch){
 const all=accountUser()?.user_metadata?.tree,cur=all&&typeof all==='object'?all:{};
 const next={...cur,[TREE_LANG]:{...(cur[TREE_LANG]||{}),...patch}};
 return Promise.resolve(window.suomiAccountData?.({tree:next})).catch(err=>console.warn('Baum: Konto',err));
}
const readLocalPlanted=()=>{try{return Date.parse(localStorage.getItem(PLANTED_KEY)||'');}catch{return NaN;}};
const writeLocalPlanted=v=>{try{localStorage.setItem(PLANTED_KEY,new Date(v).toISOString());}catch{}};
let plantedSent=false,plantedNow=0;
function plantedAt(){
 const a=Date.parse(accountTree().planted||'');
 if(Number.isFinite(a)){if(readLocalPlanted()!==a)writeLocalPlanted(a);return a;}
 if(plantedNow)return plantedNow;   // Start mit dem Eichelhäher steht noch aus: gepflanzt wird erst, wenn die Eichel liegt
 const l=readLocalPlanted(),v=Number.isFinite(l)?l:Date.now();
 writeLocalPlanted(v);
 if(!plantedSent&&accountUser()){plantedSent=true;saveAccountTree({planted:new Date(v).toISOString()});}   // ins Konto übernehmen
 return v;
}
/** Jahreszeit, mit der der Baum an diesem Tag gebaut wird (wie yearState().from in baum.mjs). */
export function seasonOf(day){
 const d=((day%YEAR_LEN)+YEAR_LEN)%YEAR_LEN,x=d/SEASON_LEN,k=Math.round(x),half=SWITCH_DAYS/2/SEASON_LEN;
 return Math.abs(x-k)<half?SEASONS[(k+3)%4]:SEASONS[Math.floor(x)%4];
}
export function progressText(t){
 if(t.next==null)return 'ausgewachsen';
 return `noch ${t.remaining} neue${t.remaining===1?'r Satz':' Sätze'}, dann wächst er`;
}

const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));

export function mountHomeTree({getReviews,waitIntro=Promise.resolve()}){
 const home=document.getElementById('home-view'),box=document.getElementById('home-tree'),stageEl=document.getElementById('home-tree-stage');
 const prog=document.getElementById('home-tree-progress');
 if(!home||!box||!stageEl||!prog)return null;
 const html=document.documentElement;
 const phone=matchMedia('(max-width:700px)'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const coarse=matchMedia('(pointer: coarse)').matches;
 let baum=null,state=treeStage(learnedCount(getReviews())),visible=false,glassP=0,shown=false,pendingGrow=false,scrolling=false,scrollTimer=0;
 // Start mit dem Eichelhäher: nur für einen neuen Baum (im Konto weder gesehen noch gepflanzt). Ein Baum, der schon in
 // diesem Browser stand, gilt als gepflanzt – außer er steht noch ganz am Anfang (Stufe 0).
 const acct0=accountTree();
 let start=!acct0.start&&!acct0.planted&&(state.stage===0||!Number.isFinite(readLocalPlanted()))?'wait':'done',startTimer=0;
 if(start==='wait')plantedNow=Date.now();

 function paintProgress(){
  prog.hidden=false;
  // Solange der Start aussteht, steht der Baum auf Stufe 0 (sind schon Sätze gelernt, wächst er gleich danach)
  const t=start!=='done'&&state.stage>0?{stage:0,share:1,next:STAGE_AT[1],remaining:0}:state;
  document.getElementById('home-tree-level').textContent=String(t.stage);
  document.getElementById('home-tree-fill').style.width=(t.share*100).toFixed(1)+'%';
  document.getElementById('home-tree-note').textContent=t===state?progressText(state):'gleich wächst er';
  box.classList.toggle('is-seed',t.stage===0);
 }
 paintProgress();

 // ---- Platzhalter (sofort)
 const day=yearDay(plantedAt()),sn=seasonOf(day),themeNow=()=>html.dataset.theme||'';
 const ph=document.createElement('img');ph.className='home-tree-ph';ph.alt='';ph.decoding='async';ph.setAttribute('aria-hidden','true');
 ph.onload=()=>ph.classList.add('is-loaded');
 let foto=null;try{foto=JSON.parse(localStorage.getItem(SNAP_KEY)||'null');}catch{}
 if(start==='done'&&foto?.v===SNAP_V&&foto.stage===state.stage&&foto.sn===sn&&foto.theme===themeNow()&&typeof foto.src==='string'){ph.src=foto.src;ph.classList.add('is-foto');}
 else paintPh();
 // Gemalte Wiese passend zu Tag/Nacht (Nachtfassung mit Mondlicht; fehlt sie, die Tagfassung abgedunkelt)
 function paintPh(){
  const seedless=start!=='done',w=seedless?0:PLATZ_WEIT.filter(x=>x<=state.stage).pop(),night=html.dataset.themeMode==='dark';
  // nah = Stufe 0 mit Eichel, leer = Stufe 0 ohne Eichel (bevor der Eichelhäher kommt)
  const url=n=>new URL(`baum/data/platz-${w?'weit'+w:seedless?'leer':'nah'}-${sn}${n?'-nacht':''}.webp?v=2`,import.meta.url).href;   // v=2: neu gerechnet (Schatten)
  ph.classList.remove('is-dimmed');
  ph.onerror=night?()=>{ph.onerror=null;ph.classList.add('is-dimmed');ph.src=url(false);}:null;
  ph.src=url(night);
 }
 box.prepend(ph);
 // Tag/Nacht gewechselt, solange noch der gemalte Platzhalter zu sehen ist
 const phMO=new MutationObserver(()=>{if(!ph.isConnected||shown){phMO.disconnect();return;}ph.classList.remove('is-foto');paintPh();});
 phMO.observe(html,{attributes:true,attributeFilter:['data-theme-mode']});
 // Foto für das nächste Mal: in halber Größe als WebP (etwa 30–80 KB)
 let fotoTimer=0;
 function takeFoto(delay=1500){
  clearTimeout(fotoTimer);
  fotoTimer=setTimeout(()=>{
   if(baum?.busy){takeFoto(2000);return;}   // erst nach Übergang/Besuch (kein Foto mit Häher)
   if(!baum?.capture||!shown||glassP>0||viewOpen||testOn||start!=='done'||!onWelcome()||document.hidden)return;
   // Bild sofort abgreifen (createImageBitmap), Verkleinern und Kodieren laufen danach ohne die Seite aufzuhalten
   const meta={v:SNAP_V,stage:Math.round(baum.stage),sn:seasonOf(yearDay(plantedAt())),theme:themeNow()};
   let shot=null;
   baum.capture(src=>{if(typeof createImageBitmap==='function')shot=createImageBitmap(src,{resizeWidth:Math.max(1,Math.round(src.width/2)),resizeHeight:Math.max(1,Math.round(src.height/2)),resizeQuality:'medium'});});
   shot?.then(bmp=>{
    let blob;
    if(typeof OffscreenCanvas==='function'){const oc=new OffscreenCanvas(bmp.width,bmp.height);oc.getContext('2d').drawImage(bmp,0,0);blob=oc.convertToBlob({type:'image/webp',quality:.82});}
    else{const c=document.createElement('canvas');c.width=bmp.width;c.height=bmp.height;c.getContext('2d').drawImage(bmp,0,0);blob=new Promise(r=>c.toBlob(r,'image/webp',.82));}
    bmp.close?.();return blob;
   }).then(blob=>{
    if(!blob||blob.type!=='image/webp'||blob.size>450000)return;
    const fr=new FileReader();
    fr.onload=()=>{try{localStorage.setItem(SNAP_KEY,JSON.stringify({...meta,src:fr.result,t:Date.now()}));}catch{}};
    fr.readAsDataURL(blob);
   }).catch(()=>{});
  },delay);
 }

 // ---- Scrollen („Milchglas“ auf Desktop und Handy)
 // Der Baum bleibt an seinem Platz stehen (sticky), Knöpfe und Satz des Tages scrollen darüber. Er wird dabei etwas
 // kleiner (Zoom-out) und blasser und geht in Milchglas über – beim Hochscrollen genau umgekehrt.
 // Sparsam: Beim Losscrollen wird der Baum einmal abgezeichnet und in zwei Stufen weichgezeichnet (zwei kleine
 // Leinwände über dem Baum); dorthin wird übergeblendet. Der laufende Baum wird nie weichgezeichnet und steht
 // still, sobald die weiche Ebene ihn ganz verdeckt (GLAS_STILL).
 const onWelcome=()=>home.dataset.homeTab==='welcome'&&!box.hidden&&box.getClientRects().length>0;
 const glass=[4,14].map(r=>{const c=document.createElement('canvas');c.className='home-tree-glass';c.dataset.blur=String(r);c.setAttribute('aria-hidden','true');return c;});
 let snapped=false;
 function snap(){
  if(!baum?.capture)return;
  baum.capture(src=>{
   const w=Math.max(1,Math.round(src.width/2)),h=Math.max(1,Math.round(src.height/2));
   for(const c of glass){
    c.width=w;c.height=h;const ctx=c.getContext('2d'),r=+c.dataset.blur*(w/Math.max(1,stageEl.clientWidth));
    if('filter' in ctx){ctx.filter=`blur(${r.toFixed(1)}px)${r>5?' saturate(.85)':''}`;c.style.filter='';}
    else c.style.filter=`blur(${c.dataset.blur}px)`;   // ältere Browser: einmal per CSS (Standbild, kostet wenig)
    ctx.clearRect(0,0,w,h);ctx.drawImage(src,0,0,w,h);
   }
  });
  snapped=true;
 }
 // Unsichtbare Markierung direkt vor dem Baum: Dort lässt sich jederzeit ablesen, wo er ohne Scrollen stehen würde –
 // ohne „sticky“ kurz abzuschalten. Verschiebt sich oben etwas (Intro, Hinweis, Schrift), rückt er nach.
 const mark=document.createElement('div');mark.className='home-tree-mark';mark.setAttribute('aria-hidden','true');box.before(mark);
 const restTop=()=>Math.round(mark.getBoundingClientRect().bottom+scrollY+(parseFloat(getComputedStyle(box).marginTop)||0));
 function checkTop(){if(onWelcome()&&box.style.top!==restTop()+'px')layout();}
 function layout(){
  if(!onWelcome()){home.style.paddingBottom='';return;}   // die Luft unten gilt nur für „Willkommen“
  // Der Baum bleibt genau dort stehen, wo er ohne Scrollen steht.
  box.style.top=restTop()+'px';
  // Unter dem Inhalt braucht es etwas Luft, damit er ganz über den Baum scrollen kann.
  home.style.paddingBottom='';
  const maxScroll=document.documentElement.scrollHeight-innerHeight;
  let need=box.offsetHeight*.95-maxScroll;
  // Ganz nach unten gescrollt sollen die Knöpfe und der Satz des Tages etwa mittig stehen (nicht unten am Rand):
  // Mitte zwischen den haftenden Reitern (Desktop) bzw. dem oberen Rand (Handy) und dem Fuß der Seite, der ganz unten
  // gescrollt immer mit im Bild ist (Handy: höchstens bis zur Reiterleiste unten).
  const acts=document.getElementById('home-welcome-actions'),daily=document.getElementById('daily-sentence');
  if(acts&&!acts.hidden&&acts.getClientRects().length){
   const last=daily&&!daily.hidden&&daily.getClientRects().length?daily:acts;
   const top=acts.getBoundingClientRect().top+scrollY,bottom=last.getBoundingClientRect().bottom+scrollY;
   const tabs=home.querySelector('.home-tabs'),th=tabs?tabs.offsetHeight:0;
   const foot=document.querySelector('footer');
   const footGap=foot&&foot.getClientRects().length?document.documentElement.scrollHeight-(foot.getBoundingClientRect().top+scrollY):0;
   const aTop=phone.matches?0:th,aBot=Math.min(innerHeight-(phone.matches?th:0),innerHeight-footGap);
   const want=Math.min((top+bottom)/2-(aTop+aBot)/2,top-aTop-24);   // passt der Block nicht, oben anlegen
   need=Math.max(need,want-maxScroll);
  }
  if(need>0)home.style.paddingBottom=Math.ceil(need)+'px';
 }
 function onScroll(){
  if(!onWelcome()||!shown||viewOpen)return;
  if(scrollY<4)checkTop();
  // Handy: Während des Scrollens steht der 3D-Baum still (nur das fertige Bild wird verschoben) – sonst ruckelt die Seite.
  if(coarse){scrolling=true;clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{scrolling=false;run();},160);}
  const h=box.offsetHeight||1;
  glassP=clamp(scrollY/(h*.9));
  if(glassP>0&&!snapped)snap();
  if(glassP===0)snapped=false;               // beim nächsten Losscrollen frisch abzeichnen
  const night=html.dataset.themeMode==='dark';
  glass[0].style.opacity=clamp(glassP/GLAS_STILL).toFixed(3);
  glass[1].style.opacity=clamp((glassP-GLAS_STILL)/(.85-GLAS_STILL)).toFixed(3);
  stageEl.style.transform=glassP>0?`scale(${(1-(phone.matches?.16:.2)*glassP).toFixed(4)})`:'';
  stageEl.style.opacity=glassP>0?(1-(night?.4:.55)*glassP).toFixed(3):'';
  prog.style.opacity=glassP>0?clamp(1-glassP*3).toFixed(3):'';
  expand.style.opacity=glassP>0?clamp(1-glassP*3).toFixed(3):'';expand.classList.toggle('is-off',glassP>.2);
  run();
 }

 // ---- Hineinzoomen mit dem Mausrad (Desktop): In der Mitte des Baums wird der Zeiger zur Lupe. Mausrad nach oben
 // zoomt hinein, nach unten wieder heraus; ist der Baum ganz draußen, scrollt das Mausrad wie gewohnt die Seite.
 // Außerhalb der Mitte und sobald die Seite gescrollt ist (Milchglas), scrollt es immer die Seite.
 const ZONE={x:.5,y:.52,rx:.14,ry:.42};
 const inZone=e=>{const r=stageEl.getBoundingClientRect();if(!r.width)return false;const dx=((e.clientX-r.left)/r.width-ZONE.x)/ZONE.rx,dy=((e.clientY-r.top)/r.height-ZONE.y)/ZONE.ry;return dx*dx+dy*dy<=1;};
 // Touch (Handy): Auf der Seite reagiert der Baum nicht auf Berührung – Wischen scrollt überall. Drehen (ein Finger)
 // und Zoomen (zwei Finger) gibt es in der Baum-Ansicht.
 stageEl.addEventListener('pointerdown',e=>{if(e.pointerType!=='mouse'&&!viewOpen)e.stopPropagation();},{capture:true});
 stageEl.addEventListener('touchstart',e=>{if(!viewOpen)e.stopPropagation();},{capture:true,passive:true});
 stageEl.addEventListener('touchmove',e=>{if(!viewOpen)e.stopPropagation();},{capture:true,passive:true});
 const zoomable=e=>!!baum?.zoomBy&&shown&&glassP===0&&scrollY<1&&onWelcome()&&inZone(e)&&!viewOpen;
 stageEl.addEventListener('mousemove',e=>box.classList.toggle('in-zoom',zoomable(e)),{passive:true});
 stageEl.addEventListener('mouseleave',()=>box.classList.remove('in-zoom'));
 stageEl.addEventListener('wheel',e=>{
  if(viewOpen&&baum?.zoomBy){if(e.ctrlKey)return;e.preventDefault();const d=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?400:1);baum.zoomBy(Math.exp(d*.0012));hintAway();return;}
  if(e.ctrlKey||!zoomable(e))return;                 // Strg + Rad / Touchpad-Zwei-Finger-Zoom: macht der Baum selbst
  const dy=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?400:1);
  if(dy>0&&baum.zoom>=.999)return;                    // ganz draußen und weiter nach unten: die Seite scrollt
  e.preventDefault();
  baum.zoomBy(Math.exp(dy*.0012));
  run();
 },{passive:false});

 // ---- Baum-Ansicht: groß auf Milchglas, drehen und zoomen
 let viewOpen=false,viewBusy=false,viewAnchor=null,viewHistory=false,hintTimer=0,closeAfter=null,opening=false;   // closeAfter: während des Öffnens geschlossen
 const expand=document.createElement('button');expand.type='button';expand.className='home-tree-expand';
 expand.setAttribute('aria-label','Baum groß ansehen');expand.title='Baum groß ansehen';
 expand.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M10 20H4v-6M20 4l-6.5 6.5M4 20l6.5-6.5"/></svg>';
 box.append(expand);
 const view=document.createElement('div');view.className='tree-view';view.hidden=true;
 view.setAttribute('role','dialog');view.setAttribute('aria-modal','true');view.setAttribute('aria-label','Dein Baum');
 view.innerHTML='<div class="tree-view-glass"></div><div class="tree-view-stage"></div><p class="tree-view-label"></p>'+
  '<button type="button" class="tree-view-close" aria-label="Schließen" title="Schließen"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>'+
  '<p class="tree-view-hint"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3M18 3v4h-4M6 21v-4h4"/></svg><span></span></p>';
 document.body.append(view);
 const viewStage=view.querySelector('.tree-view-stage'),viewHint=view.querySelector('.tree-view-hint'),viewClose=view.querySelector('.tree-view-close');
 const touchUI=matchMedia('(pointer: coarse)');
 function hintAway(){clearTimeout(hintTimer);viewHint.classList.add('is-gone');}
 // Ausschnitt in der Ansicht: hochkant weiter weg (ganze Wiese im Bild), quer etwas näher als auf der Seite
 const viewFrame=()=>{const r=viewStage.getBoundingClientRect(),asp=r.width/Math.max(1,r.height);return asp<1?{zoom:1.3,frameY:.14}:{zoom:.95,frameY:.3};};
 const pageFrame={zoom:.86,frameY:.34};
 // Bühne wächst von ihrem Platz auf der Seite in die Ansicht (bzw. zurück): nur verschieben und gleichmäßig skalieren
 function flip(fromRect,el,back){
  const to=el.getBoundingClientRect();if(!fromRect.width||!to.width||reduce.matches)return Promise.resolve();
  const k=fromRect.width/to.width,dx=fromRect.left+fromRect.width/2-(to.left+to.width/2),dy=fromRect.top+fromRect.height/2-(to.top+to.height/2);
  const a=[{transform:`translate(${dx}px,${dy}px) scale(${k})`},{transform:'none'}];
  return el.animate(back?a.reverse():a,{duration:460,easing:'cubic-bezier(.2,.7,.2,1)',fill:back?'forwards':'none'}).finished.catch(()=>{});
 }
 async function openView(){
  if(viewOpen||viewBusy||!baum||!shown)return;viewBusy=true;opening=true;
  const from=stageEl.getBoundingClientRect();
  viewOpen=true;html.classList.add('tree-view-open');
  view.querySelector('.tree-view-label').textContent='Dein Baum · Stufe '+Math.round(baum.stage);
  viewHint.querySelector('span').textContent=touchUI.matches?'Ziehen zum Drehen · zwei Finger zum Zoomen':'Ziehen zum Drehen · Mausrad zum Zoomen';
  viewHint.classList.remove('is-gone');
  view.hidden=false;
  // Bühne (mit der Leinwand) in die Ansicht holen; ihr Platz auf der Seite wird gemerkt
  viewAnchor=document.createComment('baum');stageEl.before(viewAnchor);
  stageEl.style.transform='';stageEl.style.opacity='';for(const g of glass)g.style.visibility='hidden';
  viewStage.append(stageEl);
  stageEl.querySelectorAll('canvas').forEach(c=>{c.style.touchAction='none';});
  baum.setFrame({...viewFrame(),instant:true});
  run();
  requestAnimationFrame(()=>view.classList.add('is-open'));
  if(!viewHistory){try{history.pushState({...(history.state||{}),vanamoTree:true},'');viewHistory=true;}catch{}}
  viewClose.focus({preventScroll:true});
  clearTimeout(hintTimer);hintTimer=setTimeout(hintAway,5000);
  await flip(from,stageEl,false);
  viewBusy=false;opening=false;
  if(closeAfter){const h=closeAfter.fromHistory;closeAfter=null;closeView(h);}
 }
 async function closeView(fromHistory=false){
  if(!viewOpen)return;
  if(viewBusy){if(opening){if(!closeAfter)closeAfter={fromHistory};else closeAfter.fromHistory||=fromHistory;}return;}   // erst fertig öffnen
  // Zurück-Eintrag wieder wegnehmen, wenn mit X/Esc geschlossen wird
  if(!fromHistory&&viewHistory){viewHistory=false;try{history.back();}catch{}}
  if(fromHistory)viewHistory=false;
  viewBusy=true;
  view.classList.remove('is-open');
  if(viewAnchor?.parentNode)await flip(box.getBoundingClientRect(),stageEl,true);
  baum.setFrame({...pageFrame,instant:true});
  if(viewAnchor){viewAnchor.replaceWith(stageEl);viewAnchor=null;}
  stageEl.getAnimations().forEach(a=>a.cancel());
  stageEl.querySelectorAll('canvas').forEach(c=>{c.style.touchAction='pan-y';});
  for(const g of glass)g.style.visibility='';
  view.hidden=true;html.classList.remove('tree-view-open');
  viewOpen=false;viewBusy=false;
  expand.focus({preventScroll:true});
  layout();onScroll();run();
 }
 expand.addEventListener('click',openView);
 viewClose.addEventListener('click',()=>closeView());
 view.addEventListener('pointerdown',e=>{if(e.target.closest('.tree-view-stage'))hintAway();});
 addEventListener('keydown',e=>{if(viewOpen&&e.key==='Escape'){e.preventDefault();closeView();}});
 addEventListener('popstate',()=>{if(viewOpen)closeView(true);});
 // Reiter gewechselt: Ansicht zu
 new MutationObserver(()=>{if(viewOpen&&home.dataset.homeTab!=='welcome')closeView();}).observe(home,{attributes:true,attributeFilter:['data-home-tab']});

 // ---- Test-Ansicht (nur Anzeige): alle Stufen und Jahreszeiten durchschauen, ohne den echten Lernstand zu ändern.
 // Sichtbar nur für das Testkonto (TEST_USERS) – kein Schalter über die Adresse.
 // Solange etwas umgestellt ist, wird kein Foto gespeichert; „Mein Baum“ stellt alles zurück.
 const TEST_USERS=['testuser123'];
 let testOn=false,testShown=null;
 function testAllowed(){
  try{
   const u=JSON.parse(localStorage.getItem('suomi-auth-session-v1')||'null')?.user?.user_metadata?.username;
   return TEST_USERS.includes(String(u||'').trim().toLowerCase());
  }catch{return false;}
 }
 const SEASON_NAMES={fruehling:'Frühling',sommer:'Sommer',herbst:'Herbst',winter:'Winter'};
 const SEASON_MID={fruehling:14,sommer:42,herbst:70,winter:98};
 function mountTest(){
  if(!testAllowed()||!baum)return;
  const el=document.createElement('div');el.className='baum-test';el.dataset.homePanel='welcome';el.setAttribute('role','group');el.setAttribute('aria-label','Baum-Test');
  el.innerHTML='<p class="baum-test-title">Baum-Test <span>nur Anzeige · dein Lernstand bleibt</span></p>'+
   '<div class="baum-test-row" data-row="stage"><span class="baum-test-k">Stufe</span>'+Array.from({length:11},(_,i)=>`<button type="button" data-stage="${i}">${i}</button>`).join('')+'</div>'+
   '<div class="baum-test-row" data-row="season"><span class="baum-test-k">Jahreszeit</span>'+SEASONS.map(s=>`<button type="button" data-season="${s}">${SEASON_NAMES[s]}</button>`).join('')+'</div>'+
   '<div class="baum-test-row"><span class="baum-test-k">Tag</span><input type="range" min="0" max="111" step="1" aria-label="Tag im Vanamo-Jahr"><output></output></div>'+
   '<div class="baum-test-row baum-test-actions"><button type="button" data-act="grow">Nächste Stufe wachsen ▸</button><button type="button" data-act="jay">Eichelhäher (Stufe 0)</button><button type="button" data-act="visit">Häher-Besuch</button><button type="button" data-act="squirrel">Eichhörnchen-Ausflug (Winter)</button><button type="button" data-act="mine">Mein Baum</button></div>';
  prog.after(el);
  const range=el.querySelector('input'),out=el.querySelector('output');
  const shownStage=()=>Math.round(baum.stage);
  function paint(){
   const st=shownStage(),d=testShown?.day??day;
   for(const b of el.querySelectorAll('[data-stage]'))b.setAttribute('aria-pressed',String(+b.dataset.stage===st));
   for(const b of el.querySelectorAll('[data-season]'))b.setAttribute('aria-pressed',String(b.dataset.season===seasonOf(d)));
   range.value=String(Math.round(d));out.textContent=`${Math.round(d)+1} · ${SEASON_NAMES[seasonOf(d)]}`;
   box.classList.toggle('is-seed',st===0);
   document.getElementById('home-tree-level').textContent=String(st)+(testOn?' (Test)':'');
  }
  function set(o){
   testOn=true;testShown={stage:shownStage(),day:testShown?.day??day,...o};clearTimeout(fotoTimer);
   if(o.day!=null)baum.setDay(o.day);
   if(o.stage!=null)baum.setStage(o.stage);
   baum.resume();run();paint();
  }
  el.addEventListener('click',e=>{
   const b=e.target.closest('button');if(!b)return;
   if(b.dataset.stage!=null)set({stage:+b.dataset.stage});
   else if(b.dataset.season)set({day:SEASON_MID[b.dataset.season]});
   else if(b.dataset.act==='grow'){const n=Math.min(10,shownStage()+1);set({});baum.grow(n);setTimeout(paint,400);setTimeout(paint,9000);}
   else if(b.dataset.act==='jay'){set({stage:0});baum.jay();}
   else if(b.dataset.act==='squirrel'){set({stage:Math.max(6,shownStage()),day:SEASON_MID.winter});setTimeout(()=>baum.winterTrip?.(),300);}
   else if(b.dataset.act==='visit'){if(shownStage()<1)set({stage:1});else set({});setTimeout(()=>baum.visit(),50);}
   else if(b.dataset.act==='mine'){testOn=false;testShown=null;baum.setDay(day);baum.setStage(state.stage);paintProgress();paint();run();}
  });
  range.addEventListener('input',()=>set({day:+range.value}));
  paint();
 }

 // ---- Laufen / Stillstehen
 function run(){
  if(!baum)return;
  const go=!document.hidden&&(viewOpen||visible&&!scrolling&&onWelcome()&&!(glassP>=GLAS_STILL));
  if(go)baum.resume();else baum.pause();
  startCheck(go);
  if(start!=='done')return;   // erst die Eichel, dann wachsen
  // Gewachsen, während „Willkommen“ nicht zu sehen war: den Übergang zeigen, sobald der Baum wieder da ist.
  if(go&&pendingGrow){pendingGrow=false;if(reduce.matches)baum.setStage(state.stage);else baum.grow(state.stage);takeFoto(7000);}
 }
 // ---- Start: der Eichelhäher bringt die Eichel (siehe oben)
 function startOk(go){return go&&shown&&!viewOpen&&!testOn&&glassP===0&&scrollY<4;}
 function startCheck(go){
  if(start==='fly'&&!go){baum.seed(false);start='wait';}   // nicht zu sehen: abbrechen, beim nächsten Mal noch einmal
  if(start!=='wait')return;
  if(!startOk(go)){clearTimeout(startTimer);startTimer=0;return;}
  if(reduce.matches){startDone();return;}
  if(!startTimer)startTimer=setTimeout(()=>{
   startTimer=0;
   const go2=!document.hidden&&visible&&!scrolling&&onWelcome()&&!(glassP>=GLAS_STILL);
   if(start!=='wait'||!startOk(go2))return;
   start='fly';
   baum.jay(()=>{if(start==='fly')startDone(true);});
  },1000);
 }
 function startDone(flown=false){
  start='done';clearTimeout(startTimer);
  if(!flown)baum.seed(true);   // „Weniger Bewegung“: Eichel liegt ohne Flug (nach dem Flug fliegt der Häher noch weg)
  const now=Date.now();plantedNow=0;writeLocalPlanted(now);plantedSent=true;
  saveAccountTree({planted:new Date(now).toISOString(),start:new Date(now).toISOString()});
  paintProgress();
  if(state.stage>0){pendingGrow=true;setTimeout(run,700);}   // aus der Gastzeit schon Sätze gelernt: gleich wachsen
  else takeFoto(1500);
 }
 // ---- Besuch des Eichelhähers (siehe oben)
 const VISIT_CHANCE=1/3,VISIT_OK=3000;
 let visitAt=0,visitOkSince=0;
 function planVisit(){visitAt=Math.random()<VISIT_CHANCE?Date.now()+8000+Math.random()*12000:-1;}
 setInterval(()=>{
  if(!baum||visitAt<=0||start!=='done'||state.stage<1)return;
  const ok=baum.running&&!document.hidden&&onWelcome()&&glassP<.2&&!testOn&&!reduce.matches&&html.dataset.themeMode!=='dark'&&!baum.busy;
  if(!ok){visitOkSince=0;return;}
  if(!visitOkSince)visitOkSince=Date.now();
  if(Date.now()<visitAt||Date.now()-visitOkSince<VISIT_OK)return;
  if(baum.visit())visitAt=-1;
 },1000);
 const io=new IntersectionObserver(entries=>{for(const e of entries)visible=e.isIntersecting;run();},{threshold:0});
 io.observe(box);
 document.addEventListener('visibilitychange',run);
 addEventListener('scroll',onScroll,{passive:true});
 let lastW=innerWidth,lastH=innerHeight;
 addEventListener('resize',()=>{if(innerWidth===lastW&&Math.abs(innerHeight-lastH)<150)return;lastW=innerWidth;lastH=innerHeight;layout();onScroll();});
 // Ändert sich oben etwas (Intro fertig, Hinweis ein-/ausgeblendet, Schrift geladen), muss der Stehplatz neu gemessen werden –
 // sonst bleibt der Baum zu weit unten stehen.
 let relayout=0;const queueLayout=()=>{if(relayout)return;relayout=requestAnimationFrame(()=>{relayout=0;checkTop();onScroll();});};
 setInterval(()=>{if(!document.hidden)checkTop();},700);   // fängt auch reine Verschiebungen ab (Abstände, Animationen)
 if(typeof ResizeObserver==='function'){
  const ro=new ResizeObserver(queueLayout);
  const header=document.querySelector('header');if(header)ro.observe(header);
  for(let el=box.previousElementSibling;el;el=el.previousElementSibling)ro.observe(el);
  // Knöpfe und Satz des Tages (kommt später dazu): Luft unten neu berechnen
  let relayout2=0;const ro2=new ResizeObserver(()=>{if(relayout2)return;relayout2=requestAnimationFrame(()=>{relayout2=0;layout();});});
  for(const id of ['home-welcome-actions','daily-sentence']){const el=document.getElementById(id);if(el)ro2.observe(el);}
 }
 document.fonts?.ready?.then(queueLayout);
 // Reiterwechsel (home-tabs.mjs setzt data-home-tab)
 new MutationObserver(()=>{layout();onScroll();run();}).observe(home,{attributes:true,attributeFilter:['data-home-tab']});   // run: anderer Reiter → still (und Start abbrechen)

 // ---- Baum laden
 async function load(){
  await waitIntro;
  const {createBaum}=await import('./baum/baum.mjs?v=16');
  baum=createBaum(stageEl,{page:true,paused:true,stage:start==='done'?state.stage:0,seed:start==='done',day,
   frameY:.34,zoom:.86,maxDpr:coarse?1.5:2,reduceMotion:reduce.matches});
  await baum.ready;
  // zwei Bilder abwarten, dann einblenden
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  if(start==='done'&&baum.stage!==state.stage){baum.setStage(state.stage);pendingGrow=false;}
  stageEl.querySelectorAll('canvas').forEach(c=>{c.style.touchAction='pan-y';});   // OrbitControls sperrt sonst das Scrollen
  stageEl.append(...glass);
  box.classList.add('is-ready');shown=true;
  layout();onScroll();run();
  setTimeout(()=>ph.remove(),2500);   // Platzhalter ist dann ausgeblendet
  takeFoto();
  mountTest();
  planVisit();
  // Farbschema gewechselt: neues Foto (der Hintergrund ist im Foto mit drin; Tag/Nacht blendet ~1,2 s über)
  new MutationObserver(()=>takeFoto(2000)).observe(html,{attributes:true,attributeFilter:['data-theme']});
 }
 const loading=load().catch(err=>{console.warn('Baum',err);box.classList.add('is-failed');});

 return {
  loading,
  /** nach dem Lernen: neue Satzzahl → Fortschritt; ist eine neue Stufe erreicht, wächst der Baum */
  update(){
   const next=treeStage(learnedCount(getReviews()));
   const grew=next.stage>state.stage;state=next;paintProgress();
   if(grew){pendingGrow=true;run();}
   if(grew)takeFoto(9000);   // nach dem Wachsen (Übergang ca. 5 s) neu fotografieren
  },
  get baum(){return baum;},
  get stage(){return state.stage;},
  get shown(){return shown;},
 };
}

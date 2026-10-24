// Vanamo – ein neuer Baumvogel (Nutzer 24.10.).
//
// Mit jeder Baumstufe wird ein Vogel frei (avatars.mjs: stage) und sofort zum Avatar. Ablauf, nachdem der Baum
// gewachsen ist (home-tree.mjs ruft playBirdUnlock):
//  1. Der bisherige Vogel im Konto-Kreis oben rechts verblasst, der Kreis wird leer (wie die leere Logo-Kachel im Intro).
//  2. Aus der Krone fliegt der Logo-Vogel (der Strich-Vogel aus dem Intro, dunkler Rand) in der Hauptfarbe des neuen
//     Vogels im Bogen hinauf zum Kreis; vor dem Kreis bremst er ab.
//  3. Landung wie beim Logo (style.css .brand-mark.is-filling): Funken, die Farbe läuft von der Mitte in den Kreis, der
//     Vogel springt mit Federkurve hinein – zuerst als flache Form in seiner Farbe, dann läuft das Aquarell hinein.
//  4. Sein Name erscheint an der Stelle der Begrüßung (Finnisch, oranger Strich, Deutsch); die Begrüßung verschwimmt
//     so lange und kommt danach zurück.
// „Weniger Bewegung“: kein Flug, der Vogel wird einfach getauscht, der Name blendet nur ein und aus.
// Die Zeichenfläche liegt nur während des Flugs über der Seite.
import {avatarSrc} from './avatars.mjs?v=6';

const T={
 oldFade:450,       // alter Vogel verblasst
 paintDelay:430,    // nach der Landung: flache Form → Aquarell
 paint:560,
 nameDelay:650,     // nach dem Aquarell: Name statt Begrüßung
 nameHold:2700,
 nameOut:750,
};
const clamp=(v,a=0,b=1)=>Math.min(b,Math.max(a,v));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const lerp=(a,b,t)=>a+(b-a)*t;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const now=()=>window.__ut??performance.now();   // Prüfuhr für Standbilder (der Baum hat seine eigene: __vt)
const css=name=>getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

// Wo steht die Krone gerade? Aus dem gerechneten Bild: oberste Zeile mit Baum, breiteste Stelle, Mitte.
export function crownOf(baum,stageEl){
 if(window.__crownFix)return window.__crownFix;   // Prüfskripte: ohne Rechnen
 const r=stageEl.getBoundingClientRect();
 const fallback={x:r.left+r.width*.52,y:r.top+r.height*.42,top:r.top+r.height*.28,w:r.width*.16,h:r.height*.3};
 if(!baum?.capture||!r.width)return fallback;
 let out=fallback;
 try{
  baum.capture(src=>{
   const W=120,H=Math.max(1,Math.round(W*src.height/src.width));
   const c=document.createElement('canvas');c.width=W;c.height=H;
   const g=c.getContext('2d',{willReadFrequently:true});g.drawImage(src,0,0,W,H);
   const d=g.getImageData(0,0,W,H).data,rows=[];
   for(let y=0;y<H;y++){let n=0,sx=0,l=W,rr=0;for(let x=0;x<W;x++){if(d[(y*W+x)*4+3]>60){n++;sx+=x;l=Math.min(l,x);rr=Math.max(rr,x);}}rows.push({n,cx:n?sx/n:0,l,r:rr});}
   let meadow=rows.findIndex(q=>q.n>W*.45);if(meadow<0)meadow=H;
   const top=rows.findIndex((q,i)=>i<meadow&&q.n>=2);if(top<0)return;
   let maxN=0;for(let y=top;y<meadow;y++)maxN=Math.max(maxN,rows[y].n);
   let bottom=top,sx=0,sn=0,l=W,rr=0;
   for(let y=top;y<meadow;y++){const q=rows[y];if(q.n>=maxN*.35){bottom=y;sx+=q.cx*q.n;sn+=q.n;l=Math.min(l,q.l);rr=Math.max(rr,q.r);}}
   const k=r.width/W;
   out={x:r.left+(sx/Math.max(1,sn))*k,y:r.top+((top+bottom)/2)*k,top:r.top+top*k,w:(rr-l)*k,h:(bottom-top)*k};
  });
 }catch{}
 return out;
}

// ---------------------------------------------------------------- Zeichenfläche (Flug, Funken)
function overlay(){
 const cv=document.createElement('canvas');cv.className='unlock-canvas';cv.setAttribute('aria-hidden','true');document.body.append(cv);
 const ctx=cv.getContext('2d');let dpr=1;
 const size=()=>{dpr=Math.min(devicePixelRatio||1,2);cv.width=Math.round(innerWidth*dpr);cv.height=Math.round(innerHeight*dpr);cv.style.width=innerWidth+'px';cv.style.height=innerHeight+'px';};
 size();addEventListener('resize',size);
 let flight=null,sparks=[],raf=0,lastFrame=0,closed=false;
 const loop=()=>{if(!raf&&!closed){lastFrame=now();raf=requestAnimationFrame(frame);}};
 function frame(){
  raf=0;const t=now(),dt=clamp((t-lastFrame)/1000,0,.05);lastFrame=t;
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,innerWidth,innerHeight);
  if(flight)flightFrame(t,dt);
  drawSparks(dt);
  if(flight||sparks.length)loop();
 }
 const bezier=(p0,p1,p2,p3,t)=>{const u=1-t;return {x:u*u*u*p0.x+3*u*u*t*p1.x+3*u*t*t*p2.x+t*t*t*p3.x,y:u*u*u*p0.y+3*u*u*t*p1.y+3*u*t*t*p2.y+t*t*t*p3.y};};
 // Bahn: weiche Kurve aus der Krone hinauf, dann zum Kreis – nach Bogenlänge gleichmäßig (Tabelle), damit das Tempo
 // nur von der Zeitkurve abhängt
 function pathAt(f,s){
  const E=f.target(),S=f.S,dx=E.x-S.x,dy=E.y-S.y,ady=Math.abs(dy);
  const C1={x:S.x+dx*.08,y:S.y-ady*.5-60},C2={x:E.x-dx*.42,y:E.y+ady*.12+46};
  const N=48,len=[0];let prev=S;
  for(let i=1;i<=N;i++){const p=bezier(S,C1,C2,E,i/N);len.push(len[i-1]+Math.hypot(p.x-prev.x,p.y-prev.y));prev=p;}
  const want=s*len[N];let i=1;while(i<N&&len[i]<want)i++;
  const u=(i-1+(want-len[i-1])/Math.max(1e-6,len[i]-len[i-1]))/N;
  const p=bezier(S,C1,C2,E,clamp(u)),q=bezier(S,C1,C2,E,clamp(u+.01));
  return {p,dir:Math.atan2(q.y-p.y,q.x-p.x)};
 }
 // Zeitkurve: losfliegen (nicht aus dem Stand), in der Mitte am schnellsten, vor dem Kreis abbremsen
 const ease=t=>-1*t*t*t+1.4*t*t+.6*t;
 function flightFrame(t,dt){
  const f=flight,tau=clamp((t-f.t0)/f.D);
  const {p,dir}=pathAt(f,ease(tau));
  const wob=6*Math.sin(Math.PI*tau)*Math.sin(2*Math.PI*1.5*tau+.6);   // kleines Schlingern quer zur Bahn
  const x=p.x-Math.sin(dir)*wob,y=p.y+Math.cos(dir)*wob;
  let vx=0,vy=0;if(f.last&&dt>0){vx=(x-f.last.x)/dt;vy=(y-f.last.y)/dt;}f.last={x,y};
  // Flügelschlag: Aufflug kräftig, kurz gleiten, wieder schlagen, vor dem Kreis die Flügel hoch (Bremsen)
  const glide=smooth((tau-.42)/.06)*(1-smooth((tau-.6)/.06));
  const flare=smooth((tau-.86)/.1);
  f.flap+=lerp(26,19,smooth((tau-.2)/.3))*(1-.85*glide)*dt;
  let wing=.3+.7*Math.sin(f.flap);
  wing=lerp(wing,.62,glide);wing=lerp(wing,1,flare);
  const k=lerp(.55,1,smooth(tau/.16))*lerp(1,.68,smooth((tau-.8)/.2));
  const tilt=clamp(Math.atan2(vy,Math.abs(vx)+80),-.55,.55)*(vx<0?-1:1);
  drawBird(x,y,k,wing,tilt,smooth(tau/.1),f.col);
  // im Kreis angekommen: sofort landen (nicht darin schweben)
  const E=f.target();
  if(tau>=1||tau>.82&&Math.hypot(x-E.x,y-E.y)<E.r*.45){const done=f.resolve;flight=null;done({x:E.x,y:E.y});}
 }
 // wie der farbige Vogel im Intro (intro-flock.mjs drawBird): dunkler Rand, darin die Farbe
 function drawBird(x,y,k,wing,tilt,alpha,col){
  const w=12,h=w*.8*wing;
  ctx.save();ctx.translate(x,y);ctx.rotate(tilt);ctx.scale(k,k);ctx.globalAlpha=alpha;
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.beginPath();ctx.moveTo(-w,-h);ctx.quadraticCurveTo(-w*.45,-h*.5-w*.3,0,0);ctx.quadraticCurveTo(w*.45,-h*.5-w*.3,w,-h);
  ctx.lineWidth=5.8;ctx.strokeStyle=css('--line')||'#172c38';ctx.stroke();ctx.lineWidth=2.9;ctx.strokeStyle=col;ctx.stroke();
  ctx.restore();
 }
 function drawSparks(dt){
  for(const p of sparks){
   p.life-=dt/.6;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=260*dt;
   ctx.globalAlpha=Math.max(0,p.life);ctx.strokeStyle=p.c;ctx.lineWidth=2.2;ctx.lineCap='round';
   ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx*.035,p.y-p.vy*.035);ctx.stroke();
  }
  ctx.globalAlpha=1;sparks=sparks.filter(p=>p.life>0);
 }
 return {
  fly(S,target,col){
   const E=target(),D=clamp(Math.hypot(E.x-S.x,E.y-S.y)/300,1.6,2.6)*1000;
   return new Promise(resolve=>{flight={S,target,col,t0:now(),D,flap:Math.random()*6.28,last:null,resolve};loop();});
  },
  burst(x,y,col){
   const line=css('--line')||'#172c38';
   for(let i=0;i<12;i++){const a=i/12*6.28+Math.random()*.4,v=90+Math.random()*120;sparks.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v-60,life:1,c:i%2?line:col});}
   loop();
  },
  async close(){await sleep(700);closed=true;cancelAnimationFrame(raf);removeEventListener('resize',size);cv.remove();},
 };
}

// ---------------------------------------------------------------- Konto-Kreis
function emptyCircle(button){
 const art=button.querySelector('.avatar-art');
 if(!art){   // noch kein Vogel (Anfangsbuchstabe): der Buchstabe verblasst
  return button.animate([{color:getComputedStyle(button).color},{color:'transparent'}],{duration:T.oldFade,easing:'ease-in',fill:'forwards'}).finished.catch(()=>{});
 }
 return art.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.8)'}],{duration:T.oldFade,easing:'ease-in',fill:'forwards'}).finished.catch(()=>{}).then(()=>art.remove());
}
// Wie das Logo: Farbe läuft von der Mitte in den Kreis, der Vogel springt hinein (zuerst als flache Form in seiner Farbe).
async function landIn(button,bird){
 const src=avatarSrc(bird.id);
 button.getAnimations().forEach(a=>a.cancel());
 button.classList.remove('unlock-filled');button.classList.add('is-avatar','has-bird');
 button.innerHTML=`<span class="avatar-art unlock-bg" style="--av-bg:${bird.bg}" aria-hidden="true"></span>`+
  `<span class="unlock-bird" aria-hidden="true"><span class="unlock-sil" style="--sil:${bird.col};--img:url('${src}')"></span>`+
  `<img class="unlock-img" src="${src}" alt="" width="160" height="160" draggable="false"></span>`;
 void button.offsetWidth;
 button.classList.add('unlock-filled');
 button.animate([{transform:'scale(1)'},{transform:'scale(1.2)',offset:.4},{transform:'scale(1)'}],{duration:500,easing:'ease-out'});
 await sleep(T.paintDelay);
 // Aquarell läuft von der Mitte in die Form
 const img=button.querySelector('.unlock-img'),sil=button.querySelector('.unlock-sil');
 await img.decode?.().catch(()=>{});
 const t0=now();
 await new Promise(resolve=>{
  const step=()=>{
   const p=clamp((now()-t0)/T.paint),e=1-Math.pow(1-p,2),r=e*125;
   const m=`radial-gradient(circle at 50% 58%,#000 ${r.toFixed(1)}%,transparent ${(r+22).toFixed(1)}%)`;
   img.style.webkitMaskImage=m;img.style.maskImage=m;img.style.opacity='1';
   sil.style.opacity=String(1-smooth((p-.35)/.65));
   if(p<1)requestAnimationFrame(step);else resolve();
  };
  step();
 });
 finalAvatar(button,bird,img);
 img.animate([{transform:'none'},{transform:'translateY(-9%) rotate(-3deg)',offset:.25},{transform:'scaleY(.96)',offset:.5},{transform:'translateY(-3%) rotate(1deg)',offset:.65},{transform:'none'}],{duration:700,easing:'ease-out'});
}
// Endgültig: dieselbe Darstellung wie avatarArt() – mit demselben, schon geladenen Bild (ein neues würde kurz fehlen)
function finalAvatar(button,bird,img){
 img=img||Object.assign(new Image(160,160),{src:avatarSrc(bird.id),alt:''});
 img.className='';img.removeAttribute('style');img.setAttribute('decoding','async');img.setAttribute('draggable','false');
 const art=document.createElement('span');art.className='avatar-art';art.style.setProperty('--av-bg',bird.bg);art.setAttribute('aria-hidden','true');
 art.append(img);button.replaceChildren(art);button.classList.remove('unlock-filled');
 button.classList.add('is-avatar','has-bird');button.dataset.bird=bird.id;
}

// ---------------------------------------------------------------- Name statt Begrüßung
async function showName(bird,greeting,reduceMotion){
 const visible=greeting&&greeting.getClientRects().length>0&&greeting.getBoundingClientRect().bottom>0;
 if(!visible)return;
 const el=document.createElement('div');el.className='unlock-name';el.setAttribute('role','status');
 const chars=[...bird.fi],n=chars.length;
 el.innerHTML=`<span class="unlock-name-fi" lang="fi">${chars.map((ch,i)=>`<span style="--i:${i}">${ch===' '?'&nbsp;':esc(ch)}</span>`).join('')}</span><span class="unlock-name-line"></span><span class="unlock-name-de">${esc(bird.de)}</span>`;
 el.style.setProperty('--line-delay',(n*55+180)+'ms');
 el.style.setProperty('--de-delay',(n*55+380)+'ms');
 if(reduceMotion)el.classList.add('is-calm');
 greeting.animate([{opacity:1,filter:'blur(0px)'},{opacity:0,filter:'blur(5px)'}],{duration:reduceMotion?200:420,easing:'ease-in',fill:'forwards'});
 await sleep(reduceMotion?200:320);
 document.body.append(el);
 const g=greeting.getBoundingClientRect(),fi=el.querySelector('.unlock-name-fi');
 el.style.left=(g.left+g.width/2+scrollX)+'px';el.style.top=(g.top+g.height/2-fi.offsetHeight/2+scrollY)+'px';
 void el.offsetWidth;el.classList.add('in');
 await sleep(n*55+900+T.nameHold);
 el.classList.add('out');
 await sleep(420);
 const back=greeting.animate([{opacity:0,filter:'blur(5px)'},{opacity:1,filter:'blur(0px)'}],{duration:reduceMotion?200:520,easing:'ease-out',fill:'forwards'});
 await back.finished.catch(()=>{});
 greeting.getAnimations().forEach(a=>a.cancel());
 await sleep(Math.max(0,T.nameOut-940));
 el.remove();
}

/**
 * Den Moment zeigen. bird: Eintrag aus avatars.mjs (mit col). button: #account-button. greeting: die Begrüßung (h1).
 * onLanded(): sobald der Vogel fertig im Kreis sitzt (zum Speichern im Konto). Ergebnis: Promise, erfüllt am Ende.
 */
export async function playBirdUnlock({baum,stageEl,bird,button,greeting,reduceMotion=false,onLanded}){
 if(!bird||!button)return;
 button.dataset.unlocking='1';
 const fly=!reduceMotion&&button.getClientRects().length>0&&button.getBoundingClientRect().width>0&&stageEl?.getClientRects().length>0;
 try{
  if(fly){
   const c=crownOf(baum,stageEl);
   const S={x:c.x+Math.min(40,c.w*.14),y:c.y-c.h*.12};
   const target=()=>{const b=button.getBoundingClientRect();return {x:b.left+b.width/2,y:b.top+b.height/2,r:b.width/2};};
   const o=overlay();
   setTimeout(()=>emptyCircle(button),180);
   const at=await o.fly(S,target,bird.col);
   o.burst(at.x,at.y,bird.col);
   await landIn(button,bird);
   o.close();
  }else{
   // ruhig: alter Vogel aus, neuer ein
   await emptyCircle(button);
   finalAvatar(button,bird);
   button.querySelector('.avatar-art')?.animate([{opacity:0},{opacity:1}],{duration:400,easing:'ease-out'});
  }
 }finally{delete button.dataset.unlocking;}
 try{onLanded?.();}catch(err){console.warn('Baumvogel',err);}
 await sleep(T.nameDelay);
 await showName(bird,greeting,reduceMotion);
}

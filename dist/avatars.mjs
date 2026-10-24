// Vanamo – Vogel-Avatare.
//
// Sechzehn Vögel im Skizzenstil (Tusche und Aquarell), die man als Profilbild wählen kann. Die Bilder liegen als
// freigestellte WebP-Dateien in ./avatars/<kennung>.webp (Vorlagen in branding/avatare-skizze); der runde
// Hintergrund kommt aus CSS (--av-bg), damit er sich dem Farbschema anpasst – in Kaamos ein dunkler Verlauf.
// Bewegt (kurzes Hüpfen, ab und zu ein Wackeln) wird ein Avatar nur, wenn das umgebende Element die Klasse
// „is-live“ trägt oder man darüberfährt – die Regeln stehen in style.css.
// Gespeichert wird nur die Kennung (z. B. „sinitiainen“) im Konto; alles andere kommt aus dieser Datei.
// Die Kennungen stehen auch in der Datenbank (classroom_private.avatar) – neue Vögel dort mit eintragen.
//
// Baumvögel (Nutzer 24.10.): 6 Startvögel sind von Anfang an frei, die übrigen 10 kommen mit den Baumstufen 1–10
// (je Stufe einer, Reihenfolge fest: stage). Wie viele schon frei sind, steht im Konto bei den Baum-Daten
// (user_metadata.tree.<Sprache>.birds = Zahl der freien Baumvögel); home-tree.mjs zählt hoch, bird-unlock.mjs zeigt
// den Moment. Noch gesperrte Vögel erscheinen in der Auswahl als flache Silhouette in ihrer Hauptfarbe (col) mit der
// Stufenzahl. Ein schon gewählter Vogel bleibt immer wählbar, auch wenn er nach dieser Regel noch gesperrt wäre.

const ART_VERSION=1;

export const AVATARS=[
 // Startvögel
 {id:'raystaspaasky',fi:'Räystäspääsky',de:'Mehlschwalbe',bg:'#DCE9F5',stage:0},
 {id:'sinitiainen',fi:'Sinitiainen',de:'Blaumeise',bg:'#E4F0DA',stage:0},
 {id:'harmaalokki',fi:'Harmaalokki',de:'Silbermöwe',bg:'#C4DDEC',stage:0},
 {id:'harakka',fi:'Harakka',de:'Elster',bg:'#E9E7F2',stage:0},
 {id:'punarinta',fi:'Punarinta',de:'Rotkehlchen',bg:'#E7EEDD',stage:0},
 {id:'peippo',fi:'Peippo',de:'Buchfink',bg:'#F2E4DD',stage:0},
 // Baumvögel (col = Hauptfarbe für Silhouette und Flug)
 {id:'viherpeippo',fi:'Viherpeippo',de:'Grünfink',bg:'#EEF3DC',stage:1,col:'#a3a03e'},
 {id:'punatulkku',fi:'Punatulkku',de:'Gimpel',bg:'#F6E3DD',stage:2,col:'#cf5f5c'},
 {id:'tilhi',fi:'Tilhi',de:'Seidenschwanz',bg:'#F6E8DC',stage:3,col:'#b88f72'},
 {id:'tuulihaukka',fi:'Tuulihaukka',de:'Turmfalke',bg:'#F4E6D2',stage:4,col:'#a5532f'},
 {id:'kapytikka',fi:'Käpytikka',de:'Buntspecht',bg:'#E8EEDD',stage:5,col:'#c9301f'},
 {id:'kuningaskalastaja',fi:'Kuningaskalastaja',de:'Eisvogel',bg:'#D7EDE9',stage:6,col:'#2f8db5'},
 {id:'kuukkeli',fi:'Kuukkeli',de:'Unglückshäher',bg:'#E3E8DF',stage:7,col:'#8b7562'},
 {id:'kurki',fi:'Kurki',de:'Kranich',bg:'#D6E8F2',stage:8,col:'#8c9297'},
 {id:'merikotka',fi:'Merikotka',de:'Seeadler',bg:'#D9E4EC',stage:9,col:'#7b5a3c'},
 {id:'tunturipollo',fi:'Tunturipöllö',de:'Schnee-Eule',bg:'#C5D0E2',stage:10,col:'#eef0ea'},
];
const BY_ID=new Map(AVATARS.map(a=>[a.id,a]));
const STARTERS=AVATARS.filter(a=>!a.stage);
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export const isAvatar=id=>BY_ID.has(id);
export const avatarInfo=id=>BY_ID.get(id)||null;
/** Zufälliger Startvogel (neue Konten haben noch keine Baumvögel). */
export const randomAvatar=()=>STARTERS[Math.floor(Math.random()*STARTERS.length)].id;
/** Der Baumvogel einer Stufe (1–10) oder null. */
export const treeBird=stage=>AVATARS.find(a=>a.stage===stage)||null;
const TREE_LANG='fi';   // je Sprache ein Baum (bisher nur Finnisch) – wie in home-tree.mjs
/** Zahl der freien Baumvögel laut Konto (0–10). */
export function birdsUnlocked(user){
 const n=Number(user?.user_metadata?.tree?.[TREE_LANG]?.birds);
 return Number.isFinite(n)?Math.max(0,Math.min(10,Math.floor(n))):0;
}
/** Darf dieser Vogel gewählt werden? Startvögel immer, Baumvögel bis zur freien Stufe, der eigene Vogel immer. */
export function isUnlocked(id,user){
 const a=BY_ID.get(id);if(!a)return false;
 if(!a.stage)return true;
 if(user?.user_metadata?.avatar===id)return true;
 return a.stage<=birdsUnlocked(user);
}

// Spitzname: höchstens 30 Zeichen, ohne Steuerzeichen und ohne Leerraum am Rand.
export const NICKNAME_MAX=30;
export const cleanNickname=value=>Array.from(String(value??'').replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim()).slice(0,NICKNAME_MAX).join('');

// Vogel und Spitzname aus den Kontodaten – beides stammt vom Nutzer und wird deshalb hier geprüft.
export function accountProfile(user){
 const meta=user?.user_metadata||{},username=String(meta.username||'').trim();
 return {username,nickname:cleanNickname(meta.nickname)||username,avatar:isAvatar(meta.avatar)?meta.avatar:''};
}

// Nur die Zeichnung (für Stellen, die den Rahmen selbst liefern, z. B. den Knopf im Kopf).
// Der Pfad wird relativ zu dieser Datei gebildet, damit er auf jeder Seite stimmt.
export const avatarSrc=id=>BY_ID.has(id)?new URL(`./avatars/${id}.webp?v=${ART_VERSION}`,import.meta.url).href:'';
export function avatarArt(id){
 const a=BY_ID.get(id);if(!a)return '';
 return `<span class="avatar-art" style="--av-bg:${a.bg}" aria-hidden="true"><img src="${avatarSrc(id)}" alt="" width="160" height="160" decoding="async" draggable="false"></span>`;
}
export const avatarSVG=avatarArt; // alter Name, falls noch irgendwo verwendet

// Runder Avatar. Ohne gültigen Vogel erscheint der Anfangsbuchstabe von „name“ (über CSS, damit er nicht als Text mitgelesen wird).
export function avatarMarkup(id,{name='',live=false,size=''}={}){
 const cls=`avatar${size?` avatar-${size}`:''}${live?' is-live':''}`;
 if(BY_ID.has(id))return `<span class="${cls}" data-avatar="${id}" aria-hidden="true">${avatarArt(id)}</span>`;
 const initial=(Array.from(String(name||'').trim())[0]||'').toUpperCase();
 return `<span class="${cls} avatar-initial" data-initial="${esc(initial)}" aria-hidden="true"></span>`;
}

// Auswahl: alle Vögel als Knöpfe (erst die Startvögel, dann die Baumvögel nach Stufe), darunter der Name des gewählten
// Vogels (finnisch und in der Oberflächensprache). Baumvögel tragen zusätzlich ihre Silhouette und die Stufenzahl –
// zu sehen nur, solange sie gesperrt sind (Klasse „is-locked“, gesetzt von lock()).
export function avatarPickerMarkup(idPrefix){
 const choice=a=>{
  const lock=a.stage?`<span class="avatar-lock" style="--sil:${a.col};--img:url('${avatarSrc(a.id)}')"></span>`:'';
  const badge=a.stage?`<b class="avatar-stage" aria-hidden="true" data-no-i18n>${a.stage}</b>`:'';
  return `<button type="button" class="avatar-choice" data-avatar-choice="${a.id}"${a.stage?` data-stage="${a.stage}"`:''} aria-pressed="false" aria-label="${esc(a.de)}"><span class="avatar" aria-hidden="true">${avatarArt(a.id)}${lock}</span>${badge}</button>`;
 };
 return `<div class="avatar-picker" data-avatar-picker><div class="avatar-picker-grid" role="group" aria-label="Vogel wählen">${AVATARS.map(choice).join('')}</div><p class="avatar-picker-name" id="${idPrefix}-avatar-name" aria-live="polite"><strong lang="fi" data-no-i18n></strong><span></span><em></em></p></div>`;
}
export function bindAvatarPicker(root,initial){
 const picker=root?.matches?.('[data-avatar-picker]')?root:root?.querySelector?.('[data-avatar-picker]');if(!picker)return {get:()=>'',set(){},lock(){}};
 let current='';
 const locked=button=>button.classList.contains('is-locked');
 const set=id=>{
  current=isAvatar(id)?id:'';
  picker.querySelectorAll('[data-avatar-choice]').forEach(button=>{const on=button.dataset.avatarChoice===current;button.setAttribute('aria-pressed',String(on));button.classList.toggle('selected',on);button.querySelector('.avatar')?.classList.toggle('is-live',on);});
  showName(current);
 };
 // Unter dem Raster steht der Name des gewählten Vogels – beim Überfahren mit der Maus vorübergehend der des überfahrenen.
 // Bei einem gesperrten Vogel steht dahinter, mit welcher Baumstufe er kommt.
 const showName=id=>{const info=BY_ID.get(id),name=picker.querySelector('.avatar-picker-name');
  if(!name)return;
  const button=picker.querySelector(`[data-avatar-choice="${id}"]`),isLocked=!!button&&locked(button);
  name.querySelector('strong').textContent=info?.fi||'';name.querySelector('span').textContent=info?.de||'';
  name.querySelector('em').textContent=isLocked?`ab Baumstufe ${info.stage}`:'';};
 // Gesperrt/frei setzen: allowed(id) → true, wenn der Vogel gewählt werden darf.
 const lock=allowed=>{
  picker.querySelectorAll('[data-avatar-choice]').forEach(button=>{
   const a=BY_ID.get(button.dataset.avatarChoice),off=!!a?.stage&&!allowed?.(a.id);
   button.classList.toggle('is-locked',off);
   if(off){button.setAttribute('aria-disabled','true');button.setAttribute('aria-label',`${a.de} · ab Baumstufe ${a.stage}`);}
   else{button.removeAttribute('aria-disabled');button.setAttribute('aria-label',a?.de||'');}
  });
  showName(current);
 };
 // Vergrößern zum Anschauen: am Desktop beim Überfahren (CSS), am Handy kurz nach dem Antippen (Klasse „is-zoom“).
 // Damit der große Vogel nicht am Rand des Fensters abgeschnitten wird, wächst er am Rand nach innen (--zo = transform-origin).
 const ZOOM=2.3;let pointerType='',zoomTimer=0;
 const scroller=el=>{for(let node=el.parentElement;node&&node!==document.body;node=node.parentElement){const o=getComputedStyle(node).overflowY;if(o==='auto'||o==='scroll'||o==='hidden')return node.getBoundingClientRect();}return {left:0,top:0,right:innerWidth,bottom:innerHeight};};
 const place=button=>{const b=button.getBoundingClientRect(),v=scroller(button),grow=b.width*(ZOOM-1)/2+6;
  const x=b.left-grow<v.left?'0%':b.right+grow>v.right?'100%':'50%',y=b.top-grow<v.top?'0%':b.bottom+grow>v.bottom?'100%':'50%';
  button.style.setProperty('--zo',`${x} ${y}`);};
 const unzoom=()=>{clearTimeout(zoomTimer);picker.querySelectorAll('.avatar-choice.is-zoom').forEach(b=>b.classList.remove('is-zoom'));};
 let peekTimer=0;   // Handy: nach dem Antippen eines gesperrten Vogels kurz dessen Name, dann wieder der gewählte
 picker.addEventListener('pointerover',e=>{const button=e.target.closest?.('[data-avatar-choice]');if(button&&e.pointerType==='mouse'){place(button);showName(button.dataset.avatarChoice);}});
 picker.addEventListener('pointerout',e=>{if(e.pointerType!=='mouse')return;const to=e.relatedTarget?.closest?.('[data-avatar-choice]');if(!to||!picker.contains(to))showName(current);});
 picker.addEventListener('pointerdown',e=>{pointerType=e.pointerType||'';});
 picker.addEventListener('click',e=>{const button=e.target.closest?.('[data-avatar-choice]');if(!button||!picker.contains(button))return;
  const touch=pointerType==='touch'||pointerType==='pen';pointerType='';
  if(locked(button)){   // gesperrt: nicht auswählen, nur zeigen, wann er kommt
   clearTimeout(peekTimer);showName(button.dataset.avatarChoice);peekTimer=setTimeout(()=>showName(current),2200);
   if(touch){unzoom();place(button);button.classList.add('is-zoom');zoomTimer=setTimeout(unzoom,1400);}
   return;
  }
  clearTimeout(peekTimer);set(button.dataset.avatarChoice);
  if(touch){unzoom();place(button);button.classList.add('is-zoom');zoomTimer=setTimeout(unzoom,1400);}
 });
 addEventListener('scroll',unzoom,{capture:true,passive:true});
 set(initial);
 return {get:()=>current,set,lock};
}

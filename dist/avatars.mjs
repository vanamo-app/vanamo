// Vanamo – Vogel-Avatare.
//
// Sechzehn Vögel im Skizzenstil (Tusche und Aquarell), die man als Profilbild wählen kann. Die Bilder liegen als
// freigestellte WebP-Dateien in ./avatars/<kennung>.webp (Vorlagen in branding/avatare-skizze); der runde
// Hintergrund kommt aus CSS (--av-bg), damit er sich dem Farbschema anpasst – in Kaamos ein dunkler Verlauf.
// Bewegt (kurzes Hüpfen, ab und zu ein Wackeln) wird ein Avatar nur, wenn das umgebende Element die Klasse
// „is-live“ trägt oder man darüberfährt – die Regeln stehen in style.css.
// Gespeichert wird nur die Kennung (z. B. „sinitiainen“) im Konto; alles andere kommt aus dieser Datei.
// Die Kennungen stehen auch in der Datenbank (classroom_private.avatar) – neue Vögel dort mit eintragen.

const ART_VERSION=1;

export const AVATARS=[
 {id:'raystaspaasky',fi:'Räystäspääsky',de:'Mehlschwalbe',bg:'#DCE9F5'},
 {id:'punatulkku',fi:'Punatulkku',de:'Gimpel',bg:'#F6E3DD'},
 {id:'sinitiainen',fi:'Sinitiainen',de:'Blaumeise',bg:'#E4F0DA'},
 {id:'harmaalokki',fi:'Harmaalokki',de:'Silbermöwe',bg:'#C4DDEC'},
 {id:'tunturipollo',fi:'Tunturipöllö',de:'Schnee-Eule',bg:'#C5D0E2'},
 {id:'kapytikka',fi:'Käpytikka',de:'Buntspecht',bg:'#E8EEDD'},
 {id:'harakka',fi:'Harakka',de:'Elster',bg:'#E9E7F2'},
 {id:'tilhi',fi:'Tilhi',de:'Seidenschwanz',bg:'#F6E8DC'},
 {id:'viherpeippo',fi:'Viherpeippo',de:'Grünfink',bg:'#EEF3DC'},
 {id:'punarinta',fi:'Punarinta',de:'Rotkehlchen',bg:'#E7EEDD'},
 {id:'kurki',fi:'Kurki',de:'Kranich',bg:'#D6E8F2'},
 {id:'kuukkeli',fi:'Kuukkeli',de:'Unglückshäher',bg:'#E3E8DF'},
 {id:'kuningaskalastaja',fi:'Kuningaskalastaja',de:'Eisvogel',bg:'#D7EDE9'},
 {id:'peippo',fi:'Peippo',de:'Buchfink',bg:'#F2E4DD'},
 {id:'merikotka',fi:'Merikotka',de:'Seeadler',bg:'#D9E4EC'},
 {id:'tuulihaukka',fi:'Tuulihaukka',de:'Turmfalke',bg:'#F4E6D2'},
];
const BY_ID=new Map(AVATARS.map(a=>[a.id,a]));
const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

export const isAvatar=id=>BY_ID.has(id);
export const avatarInfo=id=>BY_ID.get(id)||null;
export const randomAvatar=()=>AVATARS[Math.floor(Math.random()*AVATARS.length)].id;

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

// Auswahl: alle Vögel als Knöpfe, darunter der Name des gewählten Vogels (finnisch und in der Oberflächensprache).
export function avatarPickerMarkup(idPrefix){
 return `<div class="avatar-picker" data-avatar-picker><div class="avatar-picker-grid" role="group" aria-label="Vogel wählen">${AVATARS.map(a=>`<button type="button" class="avatar-choice" data-avatar-choice="${a.id}" aria-pressed="false" aria-label="${esc(a.de)}"><span class="avatar" aria-hidden="true">${avatarArt(a.id)}</span></button>`).join('')}</div><p class="avatar-picker-name" id="${idPrefix}-avatar-name" aria-live="polite"><strong lang="fi" data-no-i18n></strong><span></span></p></div>`;
}
export function bindAvatarPicker(root,initial){
 const picker=root?.matches?.('[data-avatar-picker]')?root:root?.querySelector?.('[data-avatar-picker]');if(!picker)return {get:()=>'',set(){}};
 let current='';
 const set=id=>{
  current=isAvatar(id)?id:'';
  picker.querySelectorAll('[data-avatar-choice]').forEach(button=>{const on=button.dataset.avatarChoice===current;button.setAttribute('aria-pressed',String(on));button.classList.toggle('selected',on);button.querySelector('.avatar')?.classList.toggle('is-live',on);});
  showName(current);
 };
 // Unter dem Raster steht der Name des gewählten Vogels – beim Überfahren mit der Maus vorübergehend der des überfahrenen.
 const showName=id=>{const info=BY_ID.get(id),name=picker.querySelector('.avatar-picker-name');
  if(name){name.querySelector('strong').textContent=info?.fi||'';name.querySelector('span').textContent=info?.de||'';}};
 // Vergrößern zum Anschauen: am Desktop beim Überfahren (CSS), am Handy kurz nach dem Antippen (Klasse „is-zoom“).
 // Damit der große Vogel nicht am Rand des Fensters abgeschnitten wird, wächst er am Rand nach innen (--zo = transform-origin).
 const ZOOM=2.3;let pointerType='',zoomTimer=0;
 const scroller=el=>{for(let node=el.parentElement;node&&node!==document.body;node=node.parentElement){const o=getComputedStyle(node).overflowY;if(o==='auto'||o==='scroll'||o==='hidden')return node.getBoundingClientRect();}return {left:0,top:0,right:innerWidth,bottom:innerHeight};};
 const place=button=>{const b=button.getBoundingClientRect(),v=scroller(button),grow=b.width*(ZOOM-1)/2+6;
  const x=b.left-grow<v.left?'0%':b.right+grow>v.right?'100%':'50%',y=b.top-grow<v.top?'0%':b.bottom+grow>v.bottom?'100%':'50%';
  button.style.setProperty('--zo',`${x} ${y}`);};
 const unzoom=()=>{clearTimeout(zoomTimer);picker.querySelectorAll('.avatar-choice.is-zoom').forEach(b=>b.classList.remove('is-zoom'));};
 picker.addEventListener('pointerover',e=>{const button=e.target.closest?.('[data-avatar-choice]');if(button&&e.pointerType==='mouse'){place(button);showName(button.dataset.avatarChoice);}});
 picker.addEventListener('pointerout',e=>{if(e.pointerType!=='mouse')return;const to=e.relatedTarget?.closest?.('[data-avatar-choice]');if(!to||!picker.contains(to))showName(current);});
 picker.addEventListener('pointerdown',e=>{pointerType=e.pointerType||'';});
 picker.addEventListener('click',e=>{const button=e.target.closest?.('[data-avatar-choice]');if(!button||!picker.contains(button))return;
  set(button.dataset.avatarChoice);
  if(pointerType==='touch'||pointerType==='pen'){unzoom();place(button);button.classList.add('is-zoom');zoomTimer=setTimeout(unzoom,1400);}
  pointerType='';});
 addEventListener('scroll',unzoom,{capture:true,passive:true});
 set(initial);
 return {get:()=>current,set};
}

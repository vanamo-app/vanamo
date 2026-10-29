// Lerntage (streak.mjs): Nach dem ersten abgeschlossenen Block des Tages kommt die Animation, die Pille wird kurz gold,
// danach ist alles wieder wie vorher; eine zweite Runde am selben Tag löst nichts mehr aus. Desktop hell und Handy dunkel.
// Handy: vier frühere Lerntage mit langen Pausen dazwischen – die Zahl zählt sie mit (5 Lerntage), nichts fängt bei 1 an.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {chromium} from 'playwright';
const origin='http://localhost:4173',id='11111111-1111-4111-8111-111111111111';
const server=spawn(process.execPath,['server.mjs'],{stdio:['ignore','pipe','inherit']});
await new Promise(r=>server.stdout.once('data',r));
const json=b=>({status:200,contentType:'application/json',body:JSON.stringify(b)});
let browser;const errors=[];
try{
 browser=await chromium.launch({headless:true,...(process.env.PW_CHROMIUM?{executablePath:process.env.PW_CHROMIUM}:{})});
 for(const [w,h,theme] of [[1280,900,'vanamo'],[390,844,'kaamos']]){
 const c=await browser.newContext({viewport:{width:w,height:h},serviceWorkers:'block',locale:'de-DE'});
 await c.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await c.route('**/auth/v1/**',route=>route.fulfill(json({access_token:'t',refresh_token:'t',user:{id,user_metadata:{username:'stefan'}}})));
 await c.route('**/rest/v1/**',route=>route.fulfill(json([])));
 await c.addInitScript(()=>Object.defineProperty(Navigator.prototype,'webdriver',{get:()=>false}));
 const page=await c.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);
 await page.evaluate(([id,theme])=>{localStorage.setItem('suomi-auth-session-v1',JSON.stringify({access_token:'t',refresh_token:'t',user:{id,user_metadata:{username:'stefan'}}}));localStorage.setItem('vanamo-theme',theme);sessionStorage.setItem('vanamo-user-intro-day',new Date().toLocaleDateString('sv-SE'));
  if(theme==='kaamos')localStorage.setItem('suomi-learning-v1',JSON.stringify({reviews:{},favorites:[],daily:{'2026-01-05':3,'2026-02-11':8,'2026-06-30':2,'2026-09-01':5},reports:{},writingRatings:{},verbProgress:{},prefs:{level:1,direction:'fi-de',audioOnly:false,activity:'verbs',speed:1}}));},[id,theme]);
 await page.reload();
 await page.locator('header>.today.is-account').waitFor();
 const round=async()=>{
  if(!await page.locator('#home-choose').isVisible())await page.locator('[data-home-tab-button="practice"]:visible, #more-exercises > summary:visible').first().click();
  await page.locator('#home-choose').click();
  await page.locator('[data-activity="verbs"]').click();
  await page.locator('[data-verb-count="5"]').click();
  for(let i=0;i<5;i++){await page.locator('#verb-input').fill('falsch');await page.locator('#verb-input').press('Enter');await page.locator('#verb-next').click();}
  await page.locator('#verb-result-title').waitFor();
 };
 await round();
 await page.locator('.streak-veil.on').waitFor({timeout:3000});
 await page.locator('header>.today.streak-gold').waitFor({timeout:8000}); // Vogel erreicht die Pille nach gut 4 s – unter Last etwas später
 assert.equal((await page.locator('header>.today .streak-label').textContent()).trim(),theme==='kaamos'?'Lerntage':'Lerntag');
 assert.equal((await page.locator('header>.today .today-ring .streak-swap').textContent()).trim(),theme==='kaamos'?'5':'1');
 // Die Pille bleibt zwei Sekunden gold; danach ist alles aufgeräumt.
 await page.waitForFunction(()=>!document.querySelector('.streak-veil,.streak-canvas,.streak-caption,.streak-swap'),null,{timeout:6000});
 assert.equal(await page.locator('.streak-veil,.streak-canvas,.streak-caption,.streak-swap').count(),0);
 assert.equal(await page.locator('header>.today.streak-gold').count(),0);
 assert.ok(await page.locator('#today-count').isVisible()&&await page.locator('.today-toggle').isVisible());
 // zweite Runde am selben Tag: keine Animation
 await page.locator('#verb-again').click();
 await page.locator('.back-link[data-view="home"]:visible').first().click().catch(()=>{});
 await round();await page.waitForTimeout(1200);
 assert.equal(await page.locator('.streak-veil').count(),0);
 await c.close();
 }
 assert.deepEqual(errors,[]);console.log('Lerntage: Animation nach der ersten Runde des Tages, goldene Pille mit Lerntagen (auch nach langen Pausen), Aufräumen und keine Wiederholung am selben Tag geprüft.');
}finally{await browser?.close();server.kill();}

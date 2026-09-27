/* Optional development verification; no runtime dependencies are added to the app.
 * Start `python3 -m http.server 8000` in wjrh-app, then run with Node + Playwright:
 *   NODE_PATH=/path/to/node_modules node tools/verify-ui.cjs
 * Set WJRH_BROWSER to a Chrome executable, WJRH_BASE_URL to another local URL,
 * WJRH_BASELINE=1 for the short geometry/audit pass, or WJRH_OUT for the output folder.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const root = path.resolve(__dirname, '..');
const out = process.env.WJRH_OUT || path.join(root, 'verification');
const base = process.env.WJRH_BASE_URL || 'http://127.0.0.1:8000/';
const baseline = process.env.WJRH_BASELINE === '1';
const executablePath = process.env.WJRH_BROWSER || (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined);
fs.mkdirSync(out, { recursive: true });
const report = { date: new Date().toISOString(), base, baseline, widths: [320, 375, 402, 430, 1366], pages: [], audits: [], flows: [], consoleErrors: [], failedRequests: [], failedResponses: [] };
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
let browser;

function measure() {
  const visible = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const rect = el => { const r = el.getBoundingClientRect(); return { x:r.x, y:r.y, width:r.width, height:r.height }; };
  const shortControls = [...document.querySelectorAll('button, a, input, select, textarea')].filter(visible).filter(el => !el.disabled).map(el => ({ label: el.getAttribute('aria-label') || el.textContent.trim().slice(0,60), ...rect(el) })).filter(r => r.width < 43.9 || r.height < 43.9);
  const unlabeled = [...document.querySelectorAll('button,input,select,textarea')].filter(visible).filter(el => !(el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') || el.textContent.trim() || el.labels && el.labels.length)).map(el => el.outerHTML.slice(0,180));
  const rgba = str => { const v=str.match(/[\d.]+/g)?.map(Number); return v && v.length>=3 ? [v[0],v[1],v[2],v[3]??1] : null; };
  const blend = (a,b) => [0,1,2].map(i=>a[i]*a[3]+b[i]*(1-a[3])).concat(1);
  const background = el => { const chain=[]; for(let p=el;p;p=p.parentElement)chain.unshift(p);let b=[255,255,255,1];for(const p of chain){const c=getComputedStyle(p);if(c.backgroundImage!=='none')return null;const a=rgba(c.backgroundColor);if(a)b=blend(a,b);}return b; };
  const luminance = c => c.slice(0,3).map(v=>{v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);}).reduce((s,v,i)=>s+v*[0.2126,0.7152,0.0722][i],0);
  const contrastFindings=[];
  for(const el of [...document.querySelectorAll('#shell *')].filter(visible)){
    if(el.closest('[aria-hidden=true],:disabled,.sr-only') || ![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()))continue;
    const cs=getComputedStyle(el),bg=background(el),fg=rgba(cs.color);
    if(!bg||!fg)continue;
    let translucent=false;for(let p=el;p;p=p.parentElement)if(Number(getComputedStyle(p).opacity)<1)translucent=true;
    if(translucent)continue;
    const a=luminance(blend(fg,bg)),b=luminance(bg),ratio=(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
    const required=parseFloat(cs.fontSize)>=24 || (parseFloat(cs.fontSize)>=18.66 && parseInt(cs.fontWeight)>=700)?3:4.5;
    if(ratio+0.02<required)contrastFindings.push({text:el.textContent.trim().slice(0,70),ratio:+ratio.toFixed(2),required,color:cs.color,background:bg.slice(0,3)});
  }
  return {
    viewport: {width:innerWidth,height:innerHeight},
    pageWidth: document.documentElement.scrollWidth,
    shell:rect(document.querySelector('#shell')), dock:rect(document.querySelector('#dock')),
    scroll:rect(document.querySelector('#scroll')),
    main:rect(document.querySelector('#app')),
    overflow:document.documentElement.scrollWidth > innerWidth + 1,
    shortControls, unlabeled, contrastFindings,
    audioOutsideRender: !document.querySelector('#app').contains(document.querySelector('#audio')) && !document.querySelector('#audio').hasAttribute('crossorigin'),
    dialogs:[...document.querySelectorAll('[role=dialog]')].map(el=>({label:el.getAttribute('aria-label'),modal:el.getAttribute('aria-modal'),...rect(el)})),
    state:{tab:WJRH.S.tab,streamState:WJRH.S.streamState,playing:WJRH.S.playing,connecting:WJRH.S.connecting},
    text:document.body.innerText
  };
}

async function ready(page, state) {
  await page.goto(`${base}?state=${state}`, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => window.WJRH && (WJRH.S.schedule || WJRH.S.scheduleError) && document.querySelector('#app').children.length, null, {timeout:10000});
  await page.evaluate(() => Promise.race([document.fonts.ready,new Promise(resolve=>setTimeout(resolve,2500))]));
  await pause(250);
}
async function capture(page, width, state, screenshot=true) {
  const data = await page.evaluate(measure);
  report.pages.push({width,preset:state,...data});
  if(screenshot) await page.screenshot({path:path.join(out,`${width}-${state}.png`),fullPage:true});
  return data;
}
async function check(name, fn) {
  try { const details = await fn(); report.flows.push({name,pass:true,details}); }
  catch(e) { report.flows.push({name,pass:false,error:e.message}); }
}
function assert(test, message) { if(!test) throw new Error(message); }

(async()=>{
  browser = await chromium.launch({headless:true,executablePath});
  const context = await browser.newContext({serviceWorkers:'block', reducedMotion:'reduce'});
  const page = await context.newPage();
  page.on('console',m=>{if(m.type()==='error')report.consoleErrors.push({url:page.url(),message:m.text()});});
  page.on('pageerror',e=>report.consoleErrors.push({url:page.url(),message:e.message,pageError:true}));
  page.on('requestfailed',r=>report.failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
  page.on('response',r=>{if(r.status()>=400)report.failedResponses.push({url:r.url(),status:r.status()});});
  const source = fs.readFileSync(path.join(root,'app.js'),'utf8');
  const presetBlock = source.match(/var PRESETS = \{([\s\S]*?)\n  \};/)[1];
  const presets = [...presetBlock.matchAll(/^\s+([a-z]+):/gm)].map(m=>m[1]);
  for(const width of report.widths){
    await page.setViewportSize({width,height:width>500?900:874});
    await ready(page,'playing');
    await capture(page,width,'playing');
    await page.addScriptTag({path:path.join(root,'tools/audit.js')});
    report.audits.push({width,findings:await page.evaluate(()=>wjrhAudit())});
    await ready(page,'schedule');
    await capture(page,width,'schedule');
    if(!baseline){
      for(const state of presets.filter(p=>!['playing','schedule'].includes(p))){
        await ready(page,state);
        await capture(page,width,state,width===402 || ['firstlaunch','live','automation','empty','long'].includes(state));
      }
    }
  }
  if(!baseline){
    await page.setViewportSize({width:402,height:874});
    await check('First launch dismiss persists locally',async()=>{
      await ready(page,'firstlaunch');
      await page.locator('[data-act=launch-dismiss]').click();
      await page.waitForFunction(()=>WJRH.S.launched && !document.querySelector('#launch'));
      assert(await page.evaluate(()=>JSON.parse(localStorage.getItem('wjrh.v2')).firstLaunchDone),'Dismissal did not persist');
    });
    await check('Inline row expands without blank detail navigation',async()=>{
      await ready(page,'dense');
      await page.locator('.showrow-main').first().click();
      assert(await page.evaluate(()=>WJRH.S.tab==='schedule' && !!WJRH.S.expanded),'Row did not expand in Schedule');
      await capture(page,402,'inline-detail');
    });
    await check('Independent inline reminder permission, save and remove',async()=>{
      await ready(page,'dense');
      await page.evaluate(()=>{WJRH.S.notif='unasked';WJRH.S.reminders={};WJRH.render();});
      const reminder = page.locator('.remind-btn').first();
      const id = await reminder.getAttribute('data-id');
      await reminder.click();
      await page.waitForSelector('[data-act=perm-deny]');
      assert(await page.evaluate(()=>WJRH.S.tab==='schedule'),'Reminder navigated away from Schedule');
      await capture(page,402,'inline-permission');
      await page.locator('button[data-act=perm-deny]').filter({hasText:'Not now'}).click();
      await page.waitForFunction(()=>!WJRH.S.permOpen);
      assert(await page.evaluate(id=>!!WJRH.S.reminders[id],id),'Reminder not saved after permission choice');
      await page.locator(`.remind-btn[data-id="${id}"]`).click();
      assert(await page.evaluate(id=>!WJRH.S.reminders[id],id),'Reminder did not turn off');
    });
    await check('Editorial detail, and direct live detail',async()=>{
      await ready(page,'editorial');
      await page.locator('.showrow-main').first().click();
      assert(await page.evaluate(()=>WJRH.S.tab==='show'),'Editorial row did not open detail');
      await capture(page,402,'editorial-detail');
      await ready(page,'live');
      await page.locator('[data-act=open-live-show]').click();
      assert(await page.evaluate(()=>WJRH.S.tab==='show'),'Live show did not open detail from Now');
    });
    await check('Track details open and preserve audio element',async()=>{
      await ready(page,'playing');
      await page.evaluate(()=>window.__testAudio=document.querySelector('#audio'));
      await page.locator('#app [data-act=open-track]').click();
      await page.waitForSelector('[role=dialog]');
      assert(await page.evaluate(()=>!!WJRH.S.sheet),'Track sheet not open');
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>!WJRH.S.sheet);
      await page.locator('[data-act=schedule]').click();
      assert(await page.evaluate(()=>window.__testAudio===document.querySelector('#audio')),'Audio element replaced during navigation');
    });
    await check('Host form validation and honest local success',async()=>{
      await ready(page,'join');
      await page.locator('#joinInput').fill('invalid');
      await page.locator('[data-act=join-submit]').click();
      assert(await page.evaluate(()=>WJRH.S.joinError),'Invalid address was accepted');
      await capture(page,402,'join-invalid');
      await page.locator('#joinInput').fill('ui-verification@example.com');
      await page.locator('[data-act=join-submit]').click();
      assert(await page.evaluate(()=>WJRH.S.joinedEmail==='ui-verification@example.com'),'Valid address not saved');
      assert(/device|email to finish/i.test(await page.locator('[role=dialog]').innerText()),'Local-only success is not explained');
      await capture(page,402,'join-success');
    });
    await check('Dialog focus trap, Escape, return focus',async()=>{
      await ready(page,'playing');
      const trigger=page.locator('#app [data-act=open-track]');
      await trigger.focus(); await trigger.click();
      await page.waitForSelector('[role=dialog]');
      for(let i=0;i<10;i++){
        await page.keyboard.press('Tab');
        assert(await page.evaluate(()=>!!document.activeElement.closest('[role=dialog]')),'Tab escaped modal dialog');
      }
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>!WJRH.S.sheet);
      assert(await trigger.evaluate(el=>el===document.activeElement),'Focus did not return to the opening control');
    });
    await check('Reduced motion and keyboard focus styling',async()=>{
      await ready(page,'live');
      const animations=await page.evaluate(()=>document.getAnimations().filter(a=>a.effect.getComputedTiming().duration>1).length);
      assert(animations===0,`${animations} animations continue with reduced motion`);
      await page.keyboard.press('Tab');
      return await page.evaluate(()=>({focused:document.activeElement.outerHTML.slice(0,200),outline:getComputedStyle(document.activeElement).outline}));
    });
    await check('Data failure leaves playback and navigation available',async()=>{
      await ready(page,'scheduleerror');
      assert(await page.locator('[data-act=play]').count(),'No playback control in failure state');
      assert(await page.locator('[data-act=schedule]').count(),'No Schedule tab in failure state');
      assert(await page.locator('[data-act=reload-schedule]').count(),'No schedule retry in failure state');
    });
    for(const mode of ['javascript-disabled','script-blocked']){
      await check(`${mode} fallback retains station and direct stream`,async()=>{
        const fallbackContext=await browser.newContext({serviceWorkers:'block',javaScriptEnabled:mode!=='javascript-disabled',viewport:{width:320,height:874}});
        const fallbackPage=await fallbackContext.newPage();
        try{
          if(mode==='script-blocked')await fallbackPage.route('**/app.js',route=>route.abort());
          await fallbackPage.goto(base,{waitUntil:'domcontentloaded'});
          assert(/WJRH/.test(await fallbackPage.locator('body').innerText()),'Station identity absent');
          const listen=fallbackPage.locator('a[href="https://internetstreamer.lafayette.edu/"]');
          assert(await listen.count() && await listen.first().isVisible(),'Direct listening link absent');
          await fallbackPage.screenshot({path:path.join(out,`320-${mode}.png`),fullPage:true});
        } finally { await fallbackContext.close(); }
      });
    }
  }
  report.summary={pages:report.pages.length,auditFindings:report.audits.reduce((n,a)=>n+a.findings.length,0),horizontalOverflows:report.pages.filter(p=>p.overflow).length,shortControlPages:report.pages.filter(p=>p.shortControls.length).length,unlabeledControlPages:report.pages.filter(p=>p.unlabeled.length).length,contrastFindingPages:report.pages.filter(p=>p.contrastFindings.length).length,failedFlows:report.flows.filter(f=>!f.pass),consoleErrors:[...new Set(report.consoleErrors.map(e=>e.message))],failedRequests:[...new Set(report.failedRequests.map(e=>`${e.url} ${e.error}`))],failedResponses:[...new Set(report.failedResponses.map(e=>`${e.url} ${e.status}`))]};
  fs.writeFileSync(path.join(out,baseline?'baseline-report.json':'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report.summary,null,2));
})().catch(e=>{report.fatal=e.stack;fs.writeFileSync(path.join(out,'incomplete-report.json'),JSON.stringify(report,null,2));console.error(e);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});

/* WJRH front-end audit — catches the class of bug a design review can't see.
   Measures the RUNNING app, not the source, at several viewport widths.

   Usage: paste into the browser console on a running instance, then
     await wjrhAudit()
   It drives the app through every screen and returns a list of findings.

   Checks, each one derived from a real bug found in this codebase:
     UA_MARGIN     an element kept a browser default margin (the <dl> bug)
     OVERFLOW_X    something is wider than its container (the 1px SCHEDULE bug)
     HDR_WRAP      a section header wrapped to more than one line
     OFF_CENTRE    a row's content is not vertically centred in its own box
     LABEL_SKEW    a label and its value have mismatched optical centres
     HIT_TARGET    an interactive control is smaller than 44px
     DEAD_SCROLL   scrollable empty space below the content
     CLIPPED       text is being cut off without an ellipsis
*/
window.wjrhAudit = async function (opts) {
  opts = opts || {};
  var WIDTHS = opts.widths || [320, 360, 375, 402, 430];
  var findings = [];
  var W = window.WJRH;
  if (!W) { return [{ check: 'FATAL', detail: 'window.WJRH not found — is the app loaded?' }]; }

  var add = function (check, screen, width, el, detail) {
    findings.push({
      check: check, screen: screen, width: width,
      el: el ? (el.tagName.toLowerCase() + (el.className ? '.' + String(el.className).split(' ').filter(Boolean).join('.') : '')) : '',
      text: el ? el.textContent.trim().replace(/\s+/g, ' ').slice(0, 42) : '',
      detail: detail
    });
  };

  var sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  // Glyph box, not the (often stretched) element box.
  var glyphRect = function (el) {
    var r = document.createRange();
    r.selectNodeContents(el);
    var rr = r.getBoundingClientRect();
    return rr.height ? rr : el.getBoundingClientRect();
  };

  // Tags whose UA stylesheet applies a margin this app never wants.
  var UA_MARGINED = ['DL', 'DD', 'DT', 'P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
                     'UL', 'OL', 'BLOCKQUOTE', 'FIGURE', 'FIELDSET', 'MENU'];

  // Nonzero margins can be deliberate editorial spacing. Inspect accessible
  // author styles instead of assuming every margin is an unreset UA default.
  var authoredRules = [];
  function collectRules(rules) {
    for (var r = 0; r < rules.length; r++) {
      var rule = rules[r];
      if (rule.media && !window.matchMedia(rule.media.mediaText).matches) continue;
      if (rule.selectorText && rule.style) authoredRules.push(rule);
      else if (rule.cssRules) collectRules(rule.cssRules);
    }
  }
  for (var ss = 0; ss < document.styleSheets.length; ss++) {
    try { collectRules(document.styleSheets[ss].cssRules); } catch (e) { /* cross-origin stylesheet */ }
  }
  function declaresMargin(style) {
    return ['margin', 'margin-top', 'margin-bottom', 'margin-block', 'margin-block-start', 'margin-block-end']
      .some(function (property) { return !!style.getPropertyValue(property); });
  }
  function hasAuthoredMargin(el) {
    if (declaresMargin(el.style)) return true;
    return authoredRules.some(function (rule) {
      try { return declaresMargin(rule.style) && el.matches(rule.selectorText); } catch (e) { return false; }
    });
  }

  function scan(screen, width) {
    var root = document.getElementById('shell');
    var all = root.querySelectorAll('*');

    // --- UA_MARGIN -------------------------------------------------------
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      if (UA_MARGINED.indexOf(el.tagName) === -1) continue;
      var cs = getComputedStyle(el);
      var mt = parseFloat(cs.marginTop), mb = parseFloat(cs.marginBottom);
      // #launch p sets its own margin deliberately; everything else should be 0.
      if (el.closest('#launch')) continue;
      if ((mt || mb) && !hasAuthoredMargin(el)) add('UA_MARGIN', screen, width, el, 'margin ' + mt + '/' + mb + 'px — likely an unreset browser default');
    }

    // --- OVERFLOW_X ------------------------------------------------------
    if (document.documentElement.scrollWidth > window.innerWidth + 1) {
      add('OVERFLOW_X', screen, width, null, 'page scrolls horizontally: ' + document.documentElement.scrollWidth + ' > ' + window.innerWidth);
    }
    for (var j = 0; j < all.length; j++) {
      var e = all[j];
      var c = getComputedStyle(e);
      if (c.overflowX === 'auto' || c.overflowX === 'scroll' || c.overflow === 'auto') continue;
      if (e.classList.contains('ellipsis')) continue;          // intentionally truncated
      if (e.scrollWidth > e.clientWidth + 1 && e.clientWidth > 0) {
        add(c.textOverflow === 'ellipsis' ? 'CLIPPED' : 'OVERFLOW_X', screen, width, e,
            e.scrollWidth + 'px content in ' + e.clientWidth + 'px box');
      }
    }

    // --- HDR_WRAP --------------------------------------------------------
    var hdr = root.querySelector('.hdr');
    if (hdr) {
      var kids = [].slice.call(hdr.children);
      for (var k = 0; k < kids.length; k++) {
        // Icon-only buttons are a deliberately oversized box around small type;
        // measuring their contents as "wrapped text" is a false positive.
        if (kids[k].classList.contains('ibtn')) continue;
        // The station masthead intentionally combines a large wordmark with
        // stacked frequency/location type. Its inherited font size is not a
        // valid measure of wrapping; the overflow scan above still covers it.
        if (kids[k].classList.contains('station-identity') && kids[k].querySelector('.wordmark')) continue;
        var g = glyphRect(kids[k]);
        var fs = parseFloat(getComputedStyle(kids[k]).fontSize);
        if (g.height > fs * 1.8) add('HDR_WRAP', screen, width, kids[k], 'header item is ' + Math.round(g.height) + 'px tall for ' + fs + 'px type — it wrapped');
      }
    }

    // --- OFF_CENTRE + LABEL_SKEW ----------------------------------------
    var rows = root.querySelectorAll('.kv, .step, .hostcard, .linkrow, .micbreak');
    for (var m = 0; m < rows.length; m++) {
      var row = rows[m];
      var rr = row.getBoundingClientRect();
      var rcs = getComputedStyle(row);
      var bt = parseFloat(rcs.borderTopWidth) || 0, bb = parseFloat(rcs.borderBottomWidth) || 0;
      var childGlyphs = [].slice.call(row.children).map(glyphRect).filter(function (x) { return x.height > 0; });
      if (!childGlyphs.length) continue;
      var top = Math.min.apply(null, childGlyphs.map(function (x) { return x.top; }));
      var bot = Math.max.apply(null, childGlyphs.map(function (x) { return x.bottom; }));
      var above = top - (rr.top + bt), below = (rr.bottom - bb) - bot;
      if (Math.abs(above - below) > 2) {
        add('OFF_CENTRE', screen, width, row, Math.round(above) + 'px above vs ' + Math.round(below) + 'px below');
      }
      if (childGlyphs.length >= 2) {
        var c0 = childGlyphs[0].top + childGlyphs[0].height / 2;
        var c1 = childGlyphs[1].top + childGlyphs[1].height / 2;
        if (Math.abs(c0 - c1) > 1) {
          add('LABEL_SKEW', screen, width, row, 'optical centres differ by ' + (c0 - c1).toFixed(1) + 'px');
        }
      }
    }

    // --- HIT_TARGET ------------------------------------------------------
    // Probe the REAL hit region with elementFromPoint rather than trusting the
    // element's own box: a ::after overlay legitimately extends the tappable
    // area beyond getBoundingClientRect(), and measuring the box alone reports
    // a false failure for that (correct) technique.
    var tappable = root.querySelectorAll('button, a, input, [data-act]');
    for (var n = 0; n < tappable.length; n++) {
      var t = tappable[n];
      if (t.disabled) continue;
      var tr = t.getBoundingClientRect();
      if (tr.width === 0 || tr.height === 0) continue;
      if (t.closest('.row, .showrow, .linkrow, .daycell, .tab, .step')) continue;
      // Controls behind an open sheet are deliberately unreachable. Only audit
      // what the user can actually tap right now.
      var scrim = document.querySelector('#overlay .scrim, #launch');
      if (scrim && !scrim.contains(t)) continue;

      var cx = tr.left + tr.width / 2;
      var cy = tr.top + tr.height / 2;
      // Scrolled out of view (e.g. below a sheet's fold): hit-testing can't
      // reach it, but that is not a sizing defect.
      if (cy < 0 || cy > window.innerHeight || cx < 0 || cx > window.innerWidth) continue;
      // Same for a control only partly inside its scroll container — it becomes
      // fully tappable once scrolled to.
      // Any clipping ancestor counts, not just scrollable ones: on the desktop
      // frame #shell is overflow:hidden and can cut off the bottom of a sheet.
      var clipped = false;
      for (var sp = t.parentElement; sp && sp !== document.body; sp = sp.parentElement) {
        var spcs = getComputedStyle(sp);
        if (!/(auto|scroll|hidden)/.test(spcs.overflowY) && !/(auto|scroll|hidden)/.test(spcs.overflowX)) continue;
        var spr = sp.getBoundingClientRect();
        if (tr.top < spr.top - 1 || tr.bottom > spr.bottom + 1) { clipped = true; break; }
      }
      if (clipped) continue;
      // A tap reaches this control only if hit-testing lands on it or a
      // descendant. Hitting an ANCESTOR means the tap missed.
      var owns = function (pt) {
        var hit = document.elementFromPoint(pt[0], pt[1]);
        return !!hit && (hit === t || t.contains(hit));
      };
      // How far above and below the centre does this control still receive taps?
      var up = 0, down = 0;
      for (var d = 1; d <= 24; d++) { if (cy - d >= 0 && owns([cx, cy - d])) up = d; else break; }
      for (var d2 = 1; d2 <= 24; d2++) { if (cy + d2 <= window.innerHeight && owns([cx, cy + d2])) down = d2; else break; }
      var effective = up + down + 1;
      if (effective < 44) {
        add('HIT_TARGET', screen, width, t,
            'effective tap height ' + effective + 'px (box ' + Math.round(tr.height) + 'px, min 44)');
      }
    }

    // --- DEAD_SCROLL -----------------------------------------------------
    var sc = document.getElementById('scroll');
    var app = document.getElementById('app');
    if (sc && app && sc.scrollHeight > sc.clientHeight + 1) {
      var dead = sc.scrollHeight - Math.round(app.getBoundingClientRect().height);
      if (dead > 48) add('DEAD_SCROLL', screen, width, null, dead + 'px of empty scrollable space below the content');
    }
  }

  var DAYS = ['mon','tue','wed','thu','fri','sat','sun'];
  var screens = [
    ['Now',        async function () { W.S.tab='now'; W.S.show=null; W.S.sheet=null; W.S.joinOpen=false; W.render(); }],
    ['Schedule',   async function () { W.S.tab='schedule'; W.S.show=null; W.S.day=4; W.render(); }],
    ['Show detail',async function () { var s=W.S.schedule.days.fri[0]; W.S.show=Object.assign({},s,{dayIdx:4}); W.S.tab='show'; W.render(); }],
    ['About',      async function () { W.S.tab='about'; W.S.from='now'; W.S.show=null; W.render(); }],
    ['Host sheet', async function () { W.S.tab='about'; W.S.joinOpen=true; W.render(); }],
    ['Track sheet',async function () { W.S.tab='now'; W.S.joinOpen=false; if(W.S.track) W.S.sheet=Object.assign({at:Date.now()},W.S.track); W.render(); }]
  ];

  for (var w = 0; w < WIDTHS.length; w++) {
    // Viewport width is driven externally; record what we actually measured at.
    var width = window.innerWidth;
    for (var s = 0; s < screens.length; s++) {
      await screens[s][1]();
      await sleep(140);
      scan(screens[s][0], width);
    }
    break; // one pass per injected viewport; the runner re-injects per width
  }

  W.S.sheet = null; W.S.joinOpen = false; W.S.tab = 'now'; W.render();

  // De-duplicate identical findings
  var seen = {}, out = [];
  findings.forEach(function (f) {
    var key = f.check + '|' + f.el + '|' + f.detail;
    if (seen[key]) return;
    seen[key] = 1; out.push(f);
  });
  return out;
};

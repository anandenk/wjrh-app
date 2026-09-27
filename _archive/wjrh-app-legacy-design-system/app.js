/* WJRH 104.9 FM — listener app
   Vanilla JS, no build step, no dependencies.

   Data sources (all of these already existed before this app; see README):
     stream    https://internetstreamer.lafayette.edu/   (Shoutcast ICY, MP3 128k)
     metadata  https://nowplaying.wjrh.org               (S3/CloudFront JSON, CORS *)
     schedule  schedule.json                             (generated from the station's
                                                          Google Calendar by tools/fetch_schedule.py)
*/
(function () {
  'use strict';

  // ---------------------------------------------------------------- config
  // Everything the station might need to change lives here.
  var CONFIG = {
    streamUrl: 'https://internetstreamer.lafayette.edu/',
    nowPlayingUrl: 'https://nowplaying.wjrh.org',
    scheduleUrl: (window.__WJRH_BASE || '') + 'schedule.json',

    automationName: 'Hoggbot',        // placeholder — confirm with the station
    automationBlurb: 'Rotation library, updated weekly by the music directors. No playlist is logged and there is nothing to be reminded of.',

    boothPhone: '610-330-5316',
    instagram: 'https://www.instagram.com/wjrh_radio/',
    website: 'https://www.wjrh.org/',
    givingUrl: 'https://www.wjrh.org/support/',
    joinEmail: 'wjrh-join@mailman.lafayette.edu',
    joinEndpoint: '',                 // POST target for the interest list; mailto fallback when empty

    pollMs: 15000,                    // now-playing poll while foregrounded
    logHours: 3                       // how much play history to keep on the device
  };

  var ET_TZ = 'America/New_York';
  var DAY_LABELS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  var DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  var DAY_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  var LS = 'wjrh.v2';

  // ---------------------------------------------------------------- utils
  function $(sel) { return document.querySelector(sel); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function loadStore() {
    try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch (e) { return {}; }
  }
  function saveStore(patch) {
    try {
      var next = loadStore();
      for (var k in patch) next[k] = patch[k];
      localStorage.setItem(LS, JSON.stringify(next));
    } catch (e) { /* private mode, blocked storage — the app still works */ }
  }

  // Wall-clock time in Eastern, regardless of where the device is. All slots are
  // ET and the UI labels them ET, so we never convert: a 4PM show is 4PM ET for
  // everyone, which is what listeners of a college station in Easton expect.
  function etNow() {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: ET_TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date());
    var get = function (t) {
      for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parts[i].value;
      return '';
    };
    var wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'));
    var h = parseInt(get('hour'), 10); if (h === 24) h = 0;
    return { weekday: wd < 0 ? 0 : wd, minutes: h * 60 + parseInt(get('minute'), 10) };
  }

  function fmtMin(mins) {
    mins = ((mins % 1440) + 1440) % 1440;
    var h = Math.floor(mins / 60), m = mins % 60;
    var ap = h >= 12 ? 'PM' : 'AM';
    var h12 = h % 12; if (h12 === 0) h12 = 12;
    return h12 + ':' + String(m).padStart(2, '0') + ' ' + ap;
  }

  function fmtClock(ts) {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: ET_TZ, hour: 'numeric', minute: '2-digit', hour12: true
    }).format(new Date(ts));
  }

  // ---------------------------------------------------------------- state
  var store = loadStore();
  var S = {
    tab: 'now',
    from: 'now',
    day: etNow().weekday,
    show: null,              // slot object when viewing show detail
    sheet: null,             // track object for the track sheet
    sheetIsLive: false,
    joinOpen: false,
    permOpen: false,
    pendingRemind: null,
    copied: false,
    launched: !!store.firstLaunchDone,

    playing: false,
    connecting: false,
    streamState: 'live',     // live | buffering | reconnecting | nometa | streamdown | offline

    track: null,             // { title, artist, album }
    schedule: null,
    log: (store.log || []).filter(function (r) {
      return Date.now() - r.at < CONFIG.logHours * 3600e3;
    }),

    reminders: store.reminders || {},
    notif: store.notif || 'unasked',
    joinedEmail: store.joinedEmail || '',
    joinEmail: store.joinedEmail || '',
    joinError: false,

    scheduleError: false,
    metaError: false
  };

  // ---------------------------------------------------------------- schedule
  function slotsFor(dayIdx) {
    if (!S.schedule) return [];
    return S.schedule.days[DAY_KEYS[dayIdx]] || [];
  }

  function liveSlot() {
    var n = etNow();
    var slots = slotsFor(n.weekday);
    for (var i = 0; i < slots.length; i++) {
      var s = slots[i];
      var end = s.endMin > s.startMin ? s.endMin : s.endMin + 1440;
      if (n.minutes >= s.startMin && n.minutes < end) return s;
    }
    return null;
  }

  // The next N slots, today then rolling into following days.
  function upcoming(count) {
    var n = etNow(), out = [], live = liveSlot();
    for (var d = 0; d < 8 && out.length < count; d++) {
      var idx = (n.weekday + d) % 7;
      var slots = slotsFor(idx);
      for (var i = 0; i < slots.length && out.length < count; i++) {
        var s = slots[i];
        if (d === 0 && (s.startMin <= n.minutes || (live && s.id === live.id))) continue;
        out.push({ slot: s, dayIdx: idx, tomorrow: d > 0, dayOffset: d });
      }
    }
    return out;
  }

  // What is on right now: a scheduled show, or the automation between shows.
  function currentShow() {
    var live = liveSlot();
    if (live) {
      return {
        slot: live, isAutomation: false, live: true,
        name: live.show, dj: live.dj,
        untilMin: live.endMin, label: 'ON AIR'
      };
    }
    var next = upcoming(1)[0];
    return {
      slot: null, isAutomation: true, live: false,
      name: CONFIG.automationName, dj: '',
      untilMin: next ? next.slot.startMin : null,
      untilDayOffset: next ? next.dayOffset : 0,
      untilDayIdx: next ? next.dayIdx : null,
      nextName: next ? next.slot.show : null,
      label: 'ON AIR'
    };
  }

  // ---------------------------------------------------------------- data
  function fetchSchedule() {
    return fetch(CONFIG.scheduleUrl, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) { S.schedule = j; S.scheduleError = false; })
      .catch(function () { S.scheduleError = true; });
  }

  // The endpoint URL-encodes its values and sometimes reports the literal string
  // "Null" when a DJ is broadcasting from their own laptop instead of the studio
  // system — wjrh.org documents this too. Treat that as "no metadata".
  function cleanMeta(v) {
    if (v == null) return '';
    var s = String(v);
    try { s = decodeURIComponent(s.replace(/\+/g, ' ')); } catch (e) { /* leave as-is */ }
    s = s.trim();
    if (!s || /^null$/i.test(s) || /^unknown$/i.test(s) || s === '-') return '';
    return s;
  }

  function fetchNowPlaying() {
    return fetch(CONFIG.nowPlayingUrl, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function (j) {
        var np = j.nowplaying || j;
        var title = cleanMeta(np.TITLE || np.title);
        var artist = cleanMeta(np.ARTIST || np.artist);
        // The station's feed carries no album today. The statutory webcasting
        // licence requires album to be displayed alongside title and artist, so
        // the field is plumbed through and shown as soon as the feed provides it.
        var album = cleanMeta(np.ALBUM || np.album);
        S.metaError = false;

        if (!title && !artist) { S.track = null; return; }
        var changed = !S.track || S.track.title !== title || S.track.artist !== artist;
        S.track = { title: title, artist: artist, album: album };
        if (changed) pushLog(title, artist, album);
      })
      .catch(function () { S.metaError = true; });
  }

  // No server stores play history, so the app records what it sees while open.
  // This is the honest stand-in for GET /recent until the backend exists.
  function pushLog(title, artist, album) {
    if (!title && !artist) return;
    var last = S.log[0];
    if (last && last.title === title && last.artist === artist) return;
    S.log.unshift({ title: title, artist: artist, album: album, at: Date.now() });
    S.log = S.log.filter(function (r) { return Date.now() - r.at < CONFIG.logHours * 3600e3; }).slice(0, 60);
    saveStore({ log: S.log });
  }

  function recentHour() {
    var cut = Date.now() - 3600e3;
    return S.log.filter(function (r) { return r.at >= cut; });
  }

  // ---------------------------------------------------------------- audio
  var audio = $('#audio');
  var retries = 0, retryTimer = null;

  function computeState() {
    if (S.forceOffline) return 'offline';
    if (S.forceNoMeta) return 'nometa';
    if (!navigator.onLine) return 'offline';
    if (S.streamState === 'streamdown') return 'streamdown';
    if (S.connecting) return 'buffering';
    if (S.streamState === 'reconnecting') return 'reconnecting';
    if (S.playing && !S.track) return 'nometa';
    return 'live';
  }

  function play() {
    var st = computeState();
    if (st === 'offline' || st === 'streamdown') return;
    // Cache-bust so a resumed session doesn't replay a stale buffer.
    audio.src = CONFIG.streamUrl + (CONFIG.streamUrl.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now();
    S.connecting = true;
    render();
    audio.play().catch(function () {
      S.connecting = false;
      S.streamState = 'reconnecting';
      render();
    });
  }

  function pause() {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    S.playing = false; S.connecting = false; retries = 0;
    clearTimeout(retryTimer);
    if (S.streamState === 'reconnecting') S.streamState = 'live';
    render();
  }

  function togglePlay() { (S.playing || S.connecting) ? pause() : play(); }

  audio.addEventListener('playing', function () {
    S.playing = true; S.connecting = false; retries = 0;
    if (S.streamState !== 'streamdown') S.streamState = 'live';
    render(); updateMediaSession();
  });
  audio.addEventListener('waiting', function () { if (S.playing) { S.connecting = true; render(); } });
  audio.addEventListener('stalled', function () { if (S.playing) { S.streamState = 'reconnecting'; render(); } });
  audio.addEventListener('pause', function () { if (S.playing) { S.playing = false; render(); } });

  audio.addEventListener('error', function () {
    S.connecting = false;
    if (retries < 4) {
      retries++;
      S.streamState = 'reconnecting';
      render();
      clearTimeout(retryTimer);
      retryTimer = setTimeout(play, 1500 * retries);
    } else {
      S.playing = false;
      S.streamState = 'streamdown';
      render();
    }
  });

  window.addEventListener('online', function () { S.streamState = 'live'; render(); refresh(); });
  window.addEventListener('offline', render);

  function updateMediaSession() {
    if (!('mediaSession' in navigator)) return;
    var cur = currentShow();
    var t = S.track;
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: t ? t.title : 'WJRH 104.9 FM',
        artist: t ? t.artist : 'Live from the booth',
        album: (t && t.album) ? t.album : cur.name,
        artwork: [
          { src: (window.__WJRH_BASE || '') + 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: (window.__WJRH_BASE || '') + 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: (window.__WJRH_BASE || '') + 'icon-1024.png', sizes: '1024x1024', type: 'image/png' }
        ]
      });
      navigator.mediaSession.playbackState = S.playing ? 'playing' : 'paused';
      navigator.mediaSession.setActionHandler('play', play);
      navigator.mediaSession.setActionHandler('pause', pause);
      navigator.mediaSession.setActionHandler('stop', pause);
      // It is a live stream: no seeking, no track skipping.
      ['seekbackward', 'seekforward', 'previoustrack', 'nexttrack'].forEach(function (a) {
        try { navigator.mediaSession.setActionHandler(a, null); } catch (e) {}
      });
    } catch (e) { /* older browsers */ }
  }

  // ---------------------------------------------------------------- reminders
  function toggleRemind(slot) {
    var on = !S.reminders[slot.id];
    if (on && S.notif === 'unasked' && 'Notification' in window) {
      S.pendingRemind = slot.id; S.permOpen = true; render(); return;
    }
    setRemind(slot.id, on);
  }

  function setRemind(id, on) {
    if (on) S.reminders[id] = true; else delete S.reminders[id];
    saveStore({ reminders: S.reminders });
    render();
  }

  // Fires only while the app is open. A real scheduled notification needs a push
  // server (or the native app) — see the README's "Known limits".
  function checkReminders() {
    if (S.notif !== 'granted') return;
    var n = etNow();
    Object.keys(S.reminders).forEach(function (id) {
      for (var d = 0; d < 7; d++) {
        var slots = slotsFor(d);
        for (var i = 0; i < slots.length; i++) {
          if (slots[i].id !== id || d !== n.weekday) continue;
          var delta = slots[i].startMin - n.minutes;
          if (delta > 0 && delta <= 10 && !S.reminders['fired:' + id]) {
            S.reminders['fired:' + id] = true;
            saveStore({ reminders: S.reminders });
            try {
              new Notification(slots[i].show + ' starts at ' + fmtMin(slots[i].startMin) + ' ET', {
                body: 'On WJRH 104.9 FM' + (slots[i].dj ? ' with ' + slots[i].dj : ''),
                icon: 'icon-192.png'
              });
            } catch (e) {}
          }
        }
      }
    });
  }

  // ---------------------------------------------------------------- icons
  function playIcon(size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M7 4l13 8-13 8z" fill="currentColor"/></svg>';
  }
  function pauseIcon(size) {
    return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" aria-hidden="true">' +
      '<rect x="5" y="4" width="5" height="16" fill="currentColor"/>' +
      '<rect x="14" y="4" width="5" height="16" fill="currentColor"/></svg>';
  }
  function routeIcon() {
    return '<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M4 9v6h4l5 5V4L8 9H4z" fill="currentColor"/>' +
      '<path d="M16 8.5a4.5 4.5 0 0 1 0 7" stroke="currentColor" stroke-width="2" fill="none"/></svg>';
  }
  function waveBars(on) {
    var h = [16, 30, 22, 36, 26, 14, 32, 20, 28], out = '';
    for (var i = 0; i < 9; i++) {
      out += '<i style="height:' + h[i] + 'px;animation-delay:' + (i * 0.09).toFixed(2) + 's;' +
             'animation-duration:' + (0.7 + (i % 4) * 0.15).toFixed(2) + 's"></i>';
    }
    return '<div class="wave' + (on ? ' on' : '') + '" aria-hidden="true">' + out + '</div>';
  }

  // ---------------------------------------------------------------- clipboard
  var copyTimer = null;

  // navigator.clipboard is undefined on insecure origins; fall back so the
  // button never silently does nothing.
  function legacyCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    } catch (e) { /* nothing more we can do */ }
  }

  // ---------------------------------------------------------------- render
  function sectionOf(tab) {
    if (tab === 'schedule' || tab === 'show') return 'schedule';
    if (tab === 'about') return 'about';
    return 'now';
  }

  function statusLabel(st) {
    return {
      offline: 'NO CONNECTION',
      streamdown: 'STREAM DOWN',
      reconnecting: 'RECONNECTING…',
      buffering: 'CONNECTING…'
    }[st] || (S.playing ? 'LIVE · PLAYING' : 'TAP TO LISTEN LIVE');
  }

  function renderBanner(st) {
    var b = null;
    if (st === 'offline') {
      b = { label: 'NO NETWORK', text: 'Showing the last thing we loaded. Stream will resume when you’re back online.', btn: 'RETRY', act: 'retry' };
    } else if (st === 'streamdown') {
      var next = upcoming(1)[0];
      b = {
        label: 'STREAM DOWN',
        text: 'The stream is down. We’re on it.' + (next
          ? ' Next live show: ' + next.slot.show + ', ' +
            (next.dayOffset ? DAY_LABELS[next.dayIdx] + ' ' : '') + fmtMin(next.slot.startMin) + '.'
          : ''),
        btn: 'RETRY', act: 'retry'
      };
    } else if (st === 'reconnecting') {
      b = { label: 'RECONNECTING', text: 'Lost the stream for a moment. Retrying automatically.', btn: 'RETRY NOW', act: 'retry' };
    } else if (S.scheduleError) {
      b = { label: 'SCHEDULE UNAVAILABLE', text: 'Couldn’t load the schedule. Live audio still works.', btn: 'RETRY', act: 'reload-schedule' };
    }
    if (!b) return '';
    return '<div class="banner"><div style="min-width:0">' +
      '<div class="banner-label">' + esc(b.label) + '</div>' +
      '<div class="banner-text">' + esc(b.text) + '</div></div>' +
      '<button data-act="' + b.act + '">' + esc(b.btn) + '</button></div>';
  }

  function renderNow(st) {
    var cur = currentShow();
    var h = '';

    h += '<header class="hdr">' +
      '<div style="display:flex;align-items:baseline;gap:10px">' +
        '<div class="wordmark">WJRH</div>' +
        '<div class="freq"><span class="dot' + (S.playing ? ' pulsing' : '') + '"></span>104.9 FM</div>' +
      '</div>' +
      '<button class="ibtn" data-act="about" aria-label="About WJRH"><span aria-hidden="true">i</span></button>' +
      '</header>';

    h += renderBanner(st);

    // Show card
    var until = cur.untilMin != null
      ? 'UNTIL ' + (cur.untilDayOffset ? DAY_LABELS[cur.untilDayIdx] + ' ' : '') + fmtMin(cur.untilMin)
      : '';
    h += '<button class="showcard" data-act="open-live-show"' + (cur.isAutomation ? ' data-automation="1"' : '') + '>' +
      '<div class="showcard-meta"><span>' + (st === 'streamdown' ? 'NEXT UP' : esc(cur.label)) + '</span><span>' + esc(until) + '</span></div>' +
      '<div class="showcard-name syne">' + esc(st === 'streamdown' ? (cur.nextName || cur.name) : cur.name) + '</div>' +
      '<div class="showcard-sub">' + (cur.isAutomation
        ? 'Rotation between live shows' + (cur.nextName ? ' · ' + esc(cur.nextName) + ' is next' : '')
        : 'with ' + esc(cur.dj)) + '</div>' +
      '</button>';

    // Track card. With no stream there is nothing playing, whatever the last
    // metadata poll returned, so fall back to the no-info state.
    var noMeta = !S.track || st === 'streamdown' || st === 'offline';
    h += '<button class="trackcard" data-act="open-track"' + (noMeta ? ' disabled' : '') + '>' +
      waveBars(S.playing && !noMeta) +
      '<div class="row-body">' +
        '<div class="label" style="color:' + (noMeta ? 'var(--disabled)' : 'inherit') + '">NOW PLAYING</div>' +
        '<div class="trackcard-title syne ellipsis">' + esc(noMeta ? 'Live from the booth' : S.track.title) + '</div>' +
        '<div class="trackcard-artist ellipsis">' + esc(noMeta ? 'Track info not posted yet' : S.track.artist) + '</div>' +
        (!noMeta && S.track.album ? '<div class="trackcard-album ellipsis">' + esc(S.track.album) + '</div>' : '') +
      '</div></button>';

    // Coming up
    var next3 = upcoming(3);
    h += '<div class="section-head"><span>Coming up</span></div>';
    if (!next3.length) {
      h += '<div class="empty"><strong>Nothing else scheduled</strong><span>' + esc(CONFIG.automationName) + ' runs until the next live show.</span></div>';
    } else {
      next3.forEach(function (u) {
        h += '<button class="row" data-act="open-slot" data-day="' + u.dayIdx + '" data-id="' + esc(u.slot.id) + '">' +
          '<div class="row-time">' + esc(fmtMin(u.slot.startMin)) + (u.tomorrow ? '<br>' + esc(DAY_LABELS[u.dayIdx]) : '') + '</div>' +
          '<div class="row-body"><div class="row-title">' + esc(u.slot.show) + '</div>' +
          '<div class="row-sub">' + esc([u.slot.dj, u.slot.genre].filter(Boolean).join(' · ')) + '</div></div>' +
          '</button>';
      });
    }

    // Last hour
    var rec = recentHour();
    h += '<div class="section-head topped"><span>Last hour</span><span class="count">' + rec.length + ' track' + (rec.length === 1 ? '' : 's') + '</span></div>';
    if (!rec.length) {
      h += '<div class="empty"><strong>Nothing logged yet</strong><span>The play log fills in while you listen. A station-side log would keep history across devices — see the plan.</span></div>';
    } else {
      rec.forEach(function (r, i) {
        h += '<button class="row" data-act="open-log" data-i="' + i + '">' +
          '<div class="row-time">' + esc(fmtClock(r.at)) + '</div>' +
          '<div class="row-body"><div class="row-title">' + esc(r.title) + '</div>' +
          '<div class="row-sub">' + esc(r.artist) + (r.album ? ' · ' + esc(r.album) : '') + '</div></div>' +
          '</button>';
      });
    }
    h += '<div style="border-top:3px solid var(--ink)"></div>';
    return h;
  }

  function renderSchedule() {
    var n = etNow();
    var h = '<header class="hdr">' +
      '<div class="syne sched-title">Schedule ' +
      '<span style="font-family:Manrope,sans-serif;font-weight:700;font-size:11px;letter-spacing:.1em;vertical-align:middle">ET</span></div>' +
      '<button class="ibtn" data-act="about" aria-label="About WJRH"><span aria-hidden="true">i</span></button>' +
      '</header>';

    h += '<div class="daypicker" role="tablist">';
    DAY_LABELS.forEach(function (d, i) {
      h += '<button class="daycell' + (S.day === i ? ' sel' : '') + (i === n.weekday ? ' today' : '') + '" ' +
        'role="tab" aria-selected="' + (S.day === i) + '" data-act="day" data-day="' + i + '">' +
        '<span>' + d.slice(0, 3) + '</span><i></i></button>';
    });
    h += '</div>';

    var slots = slotsFor(S.day);
    var live = liveSlot();
    if (S.scheduleError) {
      h += '<div class="empty"><strong>Schedule unavailable</strong><span>Live audio still works. Pull down to retry.</span></div>';
    } else if (!S.schedule) {
      h += '<div class="empty"><span>Loading…</span></div>';
    } else if (!slots.length) {
      h += '<div class="empty"><strong>No shows scheduled</strong><span>' + esc(CONFIG.automationName) + ' runs all day.</span></div>';
    } else {
      slots.forEach(function (s) {
        var isLive = !!(live && live.id === s.id && S.day === n.weekday);
        var isPast = S.day === n.weekday && s.endMin <= n.minutes;
        var reminded = !!S.reminders[s.id];
        h += '<button class="showrow' + (isPast ? ' past' : '') + (isLive ? ' live' : '') + '" ' +
          'data-act="open-slot" data-day="' + S.day + '" data-id="' + esc(s.id) + '">' +
          '<div class="showrow-time">' + esc(fmtMin(s.startMin)) + '</div>' +
          '<div class="row-body">' +
            '<div class="showrow-name syne">' + esc(s.show) + '</div>' +
            '<div class="showrow-sub">' + esc([s.dj, s.genre].filter(Boolean).join(' · ')) + '</div>' +
          '</div>' +
          '<div class="showrow-chips">' +
            (isLive ? '<div class="chip">ON AIR</div>' : '') +
            (reminded ? '<div class="chip solid">⏰ ' + esc(fmtMin(s.startMin)) + '</div>' : '') +
          '</div></button>';
      });
    }
    return h;
  }

  function renderShow() {
    var s = S.show;
    if (!s) return renderSchedule();
    var n = etNow();
    var live = liveSlot();
    var isLive = !!(live && live.id === s.id && s.dayIdx === n.weekday);
    var isBot = s.isAutomation;
    var back = S.from === 'now' ? 'NOW' : 'SCHEDULE';
    var when = DAY_FULL[s.dayIdx] + ' ' + fmtMin(s.startMin);

    var h = '<header class="hdr">' +
      '<button class="backbtn" data-act="back-show">← ' + back + '</button>' +
      '<div class="label-11">' + esc(when) + '</div></header>';

    h += '<div class="band">' +
      '<div class="status">' + (isLive ? 'ON AIR NOW' : 'SHOW') + '</div>' +
      '<div class="name syne">' + esc(s.show) + '</div>' +
      (s.genre ? '<div class="genre">' + esc(s.genre) + '</div>' : '') +
      '</div>';

    if (isBot) {
      h += '<div class="about-copy">' + esc(CONFIG.automationBlurb) + '</div>';
      return h;
    }

    h += '<div class="hostcard">' +
      '<div class="hostsq">' + esc(s.host && s.host.initials ? s.host.initials : '?') + '</div>' +
      '<div class="row-body"><div class="label">Hosted by</div>' +
      '<div style="font-size:16px;font-weight:700;margin-top:3px">' + esc(s.dj || 'WJRH') + '</div>' +
      (s.host && s.host.bio ? '<div style="font-size:12px;margin-top:2px">' + esc(s.host.bio) + '</div>' : '') +
      '</div></div>';

    if (s.description) h += '<div class="about-copy">' + esc(s.description) + '</div>';

    h += '<dl class="kv"><dt>Airs</dt><dd>' + esc(when) + ' ET' + (s.recurring ? ', weekly' : '') + '</dd></dl>';

    var remOn = !!S.reminders[s.id];
    h += '<div class="btnrow">';
    if (isLive) {
      h += '<button class="btn ' + (S.playing ? 'on' : 'solid') + '" data-act="listen-here">' +
        (S.playing ? 'PLAYING ✓' : S.connecting ? 'CONNECTING…' : 'Listen now') + '</button>';
    }
    h += '<button class="btn' + (remOn ? ' on' : '') + '" data-act="remind" data-id="' + esc(s.id) + '">' +
      (remOn ? 'REMINDER ON ✓' : 'Remind me') + '</button></div>';

    if (remOn) {
      h += '<div class="confirm-line">We’ll nudge you 10 minutes before, ' + esc(when) + ' ET. Saved on this device.</div>';
    }

    // Played so far / last time on air — only the live show has a real log today.
    var rec = isLive ? S.log.slice(0, 5) : [];
    h += '<div class="section-head"><span>' + (isLive ? 'Played so far' : 'Last time on air') + '</span>' +
         '<span class="count">' + (isLive ? 'Today' : '—') + '</span></div>';
    if (!rec.length) {
      h += '<div class="empty"><span>' + (isLive
        ? 'Nothing logged yet this hour.'
        : 'Per-show playlists need a station-side play log. Not available yet.') + '</span></div>';
    } else {
      rec.forEach(function (r, i) {
        h += '<button class="row" data-act="open-log" data-i="' + i + '">' +
          '<div class="row-time">' + esc(fmtClock(r.at)) + '</div>' +
          '<div class="row-body"><div class="row-title">' + esc(r.title) + '</div>' +
          '<div class="row-sub">' + esc(r.artist) + '</div></div></button>';
      });
    }
    h += '<div style="border-top:3px solid var(--ink)"></div>';
    return h;
  }

  function renderAbout() {
    var back = S.from === 'schedule' ? 'SCHEDULE' : 'NOW';
    var h = '<header class="hdr">' +
      '<button class="backbtn" data-act="back-about">← ' + back + '</button>' +
      '<div class="label-11">EST. 1946</div></header>';

    h += '<div class="hero syne">Free<br>form<br>radio<span class="stop">.</span></div>';
    h += '<div class="about-copy">WJRH 104.9 FM broadcasts from Hogg Hall at Lafayette College, Easton PA. Student-managed since 1946. No playlist, no music director: every DJ picks every record.</div>';

    h += '<button class="linkrow" data-act="join"><div>' +
      '<div class="row-title">Host a show</div>' +
      '<div class="row-sub">Students and Lehigh Valley locals. No experience needed.</div>' +
      '</div><div class="open">→</div></button>';

    h += '<a class="linkrow" href="tel:' + esc(CONFIG.boothPhone.replace(/\D/g, '')) + '"><div>' +
      '<div class="row-title">Request a song</div>' +
      '<div class="row-sub">Call the booth · ' + esc(CONFIG.boothPhone) + '</div>' +
      '</div><div class="open">OPEN ↗</div></a>';

    h += '<a class="linkrow" href="' + esc(CONFIG.givingUrl) + '" target="_blank" rel="noopener"><div>' +
      '<div class="row-title">Support the station</div>' +
      '<div class="row-sub">Give through Lafayette College</div>' +
      '</div><div class="open">OPEN ↗</div></a>';

    h += '<a class="linkrow last" href="' + esc(CONFIG.instagram) + '" target="_blank" rel="noopener"><div>' +
      '<div class="row-title">Instagram · wjrh.org</div>' +
      '<div class="row-sub">@wjrh_radio</div>' +
      '</div><div class="open">OPEN ↗</div></a>';

    return h;
  }

  function renderDock(st) {
    var cur = currentShow();
    var disabled = (st === 'offline' || st === 'streamdown');
    var busy = (st === 'buffering' || st === 'reconnecting');
    var title, sub;
    if (st === 'streamdown') {
      title = cur.untilMin != null
        ? (cur.untilDayOffset
            ? 'Back ' + DAY_LABELS[cur.untilDayIdx] + ' ' + fmtMin(cur.untilMin)
            : 'Back at ' + fmtMin(cur.untilMin))
        : 'Back soon';
      sub = cur.nextName || 'WJRH 104.9 FM';
    } else if (S.track) {
      title = S.track.title;
      sub = [S.track.artist, cur.name].filter(Boolean).join(' · ');
    } else {
      title = 'Live from the booth';
      sub = cur.name;
    }

    var btn = function (size) {
      return '<button class="playbtn" data-act="play" ' + (disabled ? 'disabled ' : '') +
        'aria-label="' + (S.playing ? 'Pause' : 'Play') + ' live stream">' +
        (busy ? '<div class="spinner' + (size < 60 ? ' sm' : '') + '"></div>'
              : (S.playing ? pauseIcon(size < 60 ? 18 : 26) : playIcon(size < 60 ? 18 : 26))) +
        '</button>';
    };

    // One player on every section — same card on Now, Schedule, Show and About.
    // Tapping the text opens the track sheet; the play and output buttons sit
    // outside it so they aren't swallowed by that tap target.
    var noTrack = !S.track || st === 'streamdown' || st === 'offline';
    var h = '';
    h += '<div class="player">' + btn(64) +
      '<button class="player-body" data-act="open-track"' + (noTrack ? ' disabled' : '') +
        ' aria-label="Track details">' +
        '<div class="player-status">' + esc(statusLabel(st)) + '</div>' +
        '<div class="player-title syne ellipsis">' + esc(title) + '</div>' +
        '<div class="player-sub ellipsis">' + esc(sub) + '</div>' +
      '</button>' +
      (audio.webkitShowPlaybackTargetPicker
        ? '<button class="outbtn" data-act="route" aria-label="Audio output"><span>' + routeIcon() + '</span></button>' : '') +
      '</div>';

    // About has no tab of its own: the tab it was opened from stays highlighted,
    // so Back is predictable (README, "Information architecture").
    var sec = S.tab === 'about'
      ? (S.from === 'schedule' ? 'schedule' : 'now')
      : sectionOf(S.tab);
    h += '<nav class="tabs">' +
      '<button class="tab' + (sec === 'now' ? ' on' : '') + '" data-act="now" style="color:' + (sec === 'now' ? '#00e0a4' : 'var(--ink)') + '"><span>NOW</span><i style="background:#00e0a4"></i></button>' +
      '<button class="tab' + (sec === 'schedule' ? ' on' : '') + '" data-act="schedule" style="color:' + (sec === 'schedule' ? '#7b61ff' : 'var(--ink)') + '"><span>SCHEDULE</span><i style="background:#7b61ff"></i></button>' +
      '</nav>';
    return h;
  }

  function renderOverlay() {
    if (!S.launched) {
      var cur = currentShow();
      return '<div id="launch">' +
        '<div class="kicker"><span class="dot pulsing" style="background:#00e0a4"></span>104.9 FM · EASTON PA</div>' +
        '<div class="hero syne">Free<br>form<br>radio<span class="stop">.</span></div>' +
        '<p>Lafayette College’s student-run station, on air around the clock: student shows, and rotation between them.' +
        (cur.live ? ' Right now: ' + esc(cur.name) + (cur.dj ? ' with ' + esc(cur.dj) : '') + '.' : '') + '</p>' +
        '<button class="cta" data-act="launch-listen">' + playIcon(20) + '<span>Listen live</span></button>' +
        '<button class="ghost" data-act="launch-dismiss">JUST LOOK AROUND</button>' +
        '<div class="note">We’ll ask about notifications only if you set a show reminder.</div>' +
        '</div>';
    }

    if (S.permOpen) {
      return '<div class="scrim" data-act="perm-deny"><div class="sheet" data-stop="1" role="dialog" aria-label="Allow reminders">' +
        '<div class="sheet-hdr"><div class="label">One-time ask</div></div>' +
        '<div style="padding:18px"><div class="sheet-title syne" style="font-size:26px">Allow reminders?</div>' +
        '<div style="margin-top:10px;font-size:13px;line-height:1.6">We’ll send one notification 10 minutes before a show you’ve saved. Nothing else, ever. You can change this in your browser settings.</div></div>' +
        '<div class="btnrow" style="padding-top:0">' +
        '<button class="btn solid" data-act="perm-allow">Allow</button>' +
        '<button class="btn" data-act="perm-deny">Not now</button></div>' +
        '</div></div>';
    }

    if (S.joinOpen) {
      var done = !!S.joinedEmail;
      var joined = !!CONFIG.joinEndpoint;
      var body = done
        ? '<div class="done-card">' +
            // With no joinEndpoint the address only lives on this device, so
            // the card must not claim they are on the station's list.
            '<div class="label" style="color:var(--dark)">' + (joined ? 'You\u2019re on the list' : 'One more step') + '</div>' +
            '<div class="syne" style="margin-top:6px;font-size:22px;line-height:1;letter-spacing:-.02em">' +
              (joined ? 'See you at the GBM' : 'Email to finish') + '</div>' +
            '<div style="margin-top:8px;font-size:13px;line-height:1.5">' + (joined
              ? 'We sent a confirmation to <b>' + esc(S.joinedEmail) + '</b>. Meeting details go out the first week of the semester.'
              : 'Saved <b>' + esc(S.joinedEmail) + '</b> on this device. This form isn\u2019t connected to the station\u2019s list yet \u2014 send a blank email to <b>' + esc(CONFIG.joinEmail) + '</b> and you\u2019re in.') + '</div>' +
            '<button data-act="join-reset" style="margin-top:12px;font-size:11px;font-weight:700;letter-spacing:.08em;text-decoration:underline;text-underline-offset:3px;cursor:pointer;background:none;border:0;padding:0;font-family:inherit">WRONG EMAIL? EDIT</button>' +
          '</div>'
        : '<div style="padding:18px 18px 0" class="label">Your email</div>' +
          '<div style="padding:8px 18px 0"><input id="joinInput" class="field' + (S.joinError ? ' err' : '') + '" type="email" inputmode="email" autocomplete="email" placeholder="you@lafayette.edu" value="' + esc(S.joinEmail) + '"></div>' +
          (S.joinError ? '<div class="err-msg">Enter a valid email address.</div>' : '') +
          '<div style="padding:14px 18px 6px"><button class="btn solid" style="box-shadow:5px 5px 0 #ff5a1f;font-size:14px;padding:16px" data-act="join-submit">Join the interest list</button></div>' +
          '<div class="fineprint">We only use this to send meeting dates. Your email is kept by the station, not in the app.</div>';

      return '<div class="scrim" data-act="join-close"><div class="sheet" data-stop="1" role="dialog" aria-label="Host a show">' +
        '<div class="sheet-hdr"><div class="label">How to get on air</div>' +
        '<button class="sheet-close" data-act="join-close">CLOSE ✕</button></div>' +
        '<div style="padding:18px 18px 4px" class="sheet-title syne" style="font-size:30px">Host a show</div>' +
        '<div style="padding:6px 18px 14px;font-size:13px;line-height:1.5">Students and Lehigh Valley locals. No experience needed.</div>' +
        '<div class="step"><div class="step-num">01</div><div><div class="row-title">Interest list</div>' +
          '<div style="font-size:13px;line-height:1.5;margin-top:3px">Send a blank email to ' + esc(CONFIG.joinEmail) + '</div></div></div>' +
        '<div class="step"><div class="step-num">02</div><div><div class="row-title">General body meeting</div>' +
          '<div style="font-size:13px;line-height:1.5;margin-top:3px">Week 2 of each semester. Claim a time slot.</div></div></div>' +
        '<div class="step" style="border-bottom:3px solid var(--ink)"><div class="step-num">03</div><div><div class="row-title">Booth time</div>' +
          '<div style="font-size:13px;line-height:1.5;margin-top:3px">Shows start week 3 in Fall, week 2 in Spring and Summer.</div></div></div>' +
        body + '</div></div>';
    }

    if (S.sheet) {
      var t = S.sheet;
      var cur2 = currentShow();
      var q = encodeURIComponent(t.title + ' ' + t.artist);
      return '<div class="scrim" data-act="sheet-close"><div class="sheet" data-stop="1" role="dialog" aria-label="Track">' +
        '<div class="sheet-hdr"><div class="label">' + (S.sheetIsLive ? 'Now playing' : 'Played ' + esc(fmtClock(t.at))) + '</div>' +
        '<button class="sheet-close" data-act="sheet-close">CLOSE ✕</button></div>' +
        '<div style="padding:18px"><div class="sheet-title syne">' + esc(t.title) + '</div>' +
        '<div style="margin-top:6px;font-size:15px">' + esc(t.artist) + '</div>' +
        (t.album ? '<div style="margin-top:3px;font-size:13px;color:#55554f">' + esc(t.album) + '</div>' : '') + '</div>' +
        '<dl class="kv" style="border-top:1px solid var(--ink)"><dt>Played on</dt>' +
        '<dd>' + esc([cur2.name, cur2.dj].filter(Boolean).join(' · ')) + '</dd></dl>' +
        '<div class="btnrow">' +
        '<a class="btn solid" href="https://www.google.com/search?q=' + q + '" target="_blank" rel="noopener">Find this track ↗</a>' +
        '<button class="btn" data-act="copy">' + (S.copied ? 'COPIED ✓' : 'Copy title') + '</button>' +
        '</div></div></div>';
    }
    return '';
  }

  // Identity of whatever the overlay is showing. The entrance animation should
  // fire when a sheet OPENS, not every time render() happens to rebuild the
  // overlay — otherwise the now-playing poll (15s) and the clock tick (30s)
  // make an open sheet slide up again on their own.
  function overlayKey() {
    if (!S.launched) return 'launch';
    if (S.permOpen) return 'perm';
    if (S.joinOpen) return 'join';          // form -> confirmation must not re-animate
    if (S.sheet) return 'sheet:' + (S.sheet.at || 0) + ':' + (S.sheet.title || '');
    return '';
  }

  var lastOverlayKey = '';
  var lastAppHTML = '';
  // Epoch for the looping decorative animations (signal bars, pulsing dot).
  var animEpoch = Date.now();

  // When markup genuinely changes (a new track, a tab switch) the elements are
  // recreated and their CSS animations would restart at frame 0. Re-seed each
  // one with a negative animation-delay equal to the time already elapsed, so
  // a rebuilt element carries on exactly where the old one was. The delay is
  // applied here rather than baked into the HTML, so the markup string stays
  // stable and the diff above still works.
  function syncLoopingAnimations(root) {
    var elapsed = (Date.now() - animEpoch) / 1000;
    var nodes = root.querySelectorAll('.wave.on i, .dot.pulsing');
    for (var i = 0; i < nodes.length; i++) {
      var base = parseFloat(getComputedStyle(nodes[i]).animationDelay) || 0;
      nodes[i].style.animationDelay = (base - elapsed).toFixed(2) + 's';
    }
  }

  var lastDockHTML = '';
  var closingOverlay = false;

  // Play the exit animation, then apply the state change. While it runs the
  // overlay is left alone by render(), otherwise a poll would rebuild it
  // mid-animation and the sheet would vanish instead of sliding out.
  function dismissOverlay(mutate) {
    var ov = $('#overlay');
    var el = ov.querySelector('.scrim') || document.getElementById('launch');
    if (!el || closingOverlay) { mutate(); render(); return; }
    closingOverlay = true;
    el.classList.add('closing');
    setTimeout(function () {
      closingOverlay = false;
      mutate();
      render();
    }, 290);
  }

  var scrollPos = {};
  function render() {
    var st = computeState();
    var sec = sectionOf(S.tab);
    document.body.dataset.section = sec;
    var themeColor = { now: '#efece4', schedule: '#ece9f3', about: '#f3e8dc' }[sec];
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', themeColor);

    var scroller = $('#scroll');
    var key = S.tab + (S.show ? ':' + S.show.id : '');
    var html = S.tab === 'now' ? renderNow(st)
      : S.tab === 'schedule' ? renderSchedule()
      : S.tab === 'show' ? renderShow()
      : renderAbout();
    var dockHtml = renderDock(st);

    // Only touch the DOM when the markup actually changed. Reassigning
    // innerHTML restarts every CSS animation inside it, which made the signal
    // bars and the pulsing FM dot jump back to frame 0 on each poll and each
    // time a sheet opened.
    var rebuilt = false;
    if (html !== lastAppHTML) {
      $('#app').innerHTML = html;
      lastAppHTML = html;
      rebuilt = true;
      syncLoopingAnimations($('#app'));
    }
    if (dockHtml !== lastDockHTML) {
      $('#dock').innerHTML = dockHtml;
      lastDockHTML = dockHtml;
    }

    var ov = $('#overlay');
    var oKey = overlayKey();
    var focused = document.activeElement;
    // Don't rebuild the overlay under someone's cursor while they type — but
    // only while it is still the SAME overlay. The email input keeps focus even
    // once the sheet should be gone, so skipping unconditionally would freeze
    // the overlay open (notably on iOS, where tapping a button may not move
    // focus away from the field).
    var typing = focused && focused.id === 'joinInput' && oKey === lastOverlayKey;
    if (!typing && !closingOverlay) {
      var reopening = oKey !== '' && oKey === lastOverlayKey;
      ov.innerHTML = renderOverlay();
      if (reopening) {
        // One class on the scrim suppresses both the dim fade and the slide.
        var scrimEl = ov.querySelector('.scrim');
        if (scrimEl) scrimEl.classList.add('no-anim');
      }
      lastOverlayKey = oKey;
    }

    if (rebuilt && scrollPos[key] != null) scroller.scrollTop = scrollPos[key];
    scroller.onscroll = function () { scrollPos[key] = scroller.scrollTop; };

    updateMediaSession();
  }

  // ---------------------------------------------------------------- events
  function findSlot(dayIdx, id) {
    var slots = slotsFor(dayIdx);
    for (var i = 0; i < slots.length; i++) if (slots[i].id === id) return slots[i];
    return null;
  }

  function openSlot(dayIdx, id) {
    var slot = findSlot(dayIdx, id);
    if (!slot) return;
    S.show = Object.assign({}, slot, { dayIdx: dayIdx });
    S.from = S.tab;
    S.tab = 'show';
    render();
  }

  document.addEventListener('click', function (e) {
    var stop = e.target.closest('[data-stop]');
    var el = e.target.closest('[data-act]');
    if (!el) return;
    // A click inside a sheet must not fall through to the scrim behind it.
    if (stop && el.closest('[data-stop]') !== stop) return;
    var act = el.dataset.act;

    switch (act) {
      case 'play': togglePlay(); break;
      case 'now': S.tab = 'now'; S.show = null; render(); break;
      case 'schedule': S.tab = 'schedule'; S.show = null; render(); break;
      case 'about': S.from = S.tab; S.tab = 'about'; render(); break;
      case 'back-about': S.tab = S.from === 'schedule' ? 'schedule' : 'now'; S.joinOpen = false; render(); break;
      case 'back-show': S.tab = S.from === 'now' ? 'now' : 'schedule'; S.show = null; render(); break;
      case 'day': S.day = +el.dataset.day; render(); break;
      case 'open-slot': openSlot(+el.dataset.day, el.dataset.id); break;

      case 'open-live-show': {
        if (el.dataset.automation) return;
        var live = liveSlot();
        if (live) openSlot(etNow().weekday, live.id);
        break;
      }

      case 'open-track':
        if (S.track) { S.sheet = Object.assign({ at: Date.now() }, S.track); S.sheetIsLive = true; S.copied = false; render(); }
        break;
      case 'open-log': {
        var r = (S.tab === 'show' ? S.log.slice(0, 5) : recentHour())[+el.dataset.i];
        if (r) { S.sheet = r; S.sheetIsLive = false; S.copied = false; render(); }
        break;
      }
      case 'sheet-close': dismissOverlay(function () { S.sheet = null; }); break;

      case 'copy': {
        var txt = S.sheet.title + ' – ' + S.sheet.artist;
        var btn = el;
        // Swap this one button's label rather than calling render(): rebuilding
        // the overlay would replay the sheet's slide-up animation, twice (now,
        // and again when the label reverts).
        var done = function () {
          S.copied = true;
          btn.textContent = 'COPIED ✓';
          clearTimeout(copyTimer);
          copyTimer = setTimeout(function () {
            S.copied = false;
            if (btn.isConnected) btn.textContent = 'Copy title';
          }, 2000);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(txt).then(done, function () { legacyCopy(txt); done(); });
        } else {
          legacyCopy(txt);
          done();
        }
        break;
      }

      case 'listen-here': if (!S.playing && !S.connecting) play(); break;
      case 'remind': {
        var slot = findSlot(S.show.dayIdx, el.dataset.id);
        if (slot) toggleRemind(slot);
        break;
      }
      case 'perm-allow':
        // requestPermission needs transient user activation, so it fires now,
        // inside the click — not from dismissOverlay's timeout.
        if ('Notification' in window) {
          Notification.requestPermission().then(function (p) {
            S.notif = p === 'granted' ? 'granted' : 'denied';
            saveStore({ notif: S.notif });
            render();
          });
        } else {
          S.notif = 'denied';
          saveStore({ notif: 'denied' });
        }
        dismissOverlay(function () {
          S.permOpen = false;
          if (S.pendingRemind) setRemind(S.pendingRemind, true);
          S.pendingRemind = null;
        });
        break;
      case 'perm-deny':
        S.notif = 'denied';
        saveStore({ notif: 'denied' });
        dismissOverlay(function () {
          S.permOpen = false;
          if (S.pendingRemind) setRemind(S.pendingRemind, true);
          S.pendingRemind = null;
        });
        break;

      case 'join': S.joinOpen = true; render(); break;
      case 'join-close': dismissOverlay(function () { S.joinOpen = false; S.joinError = false; }); break;
      case 'join-reset': S.joinedEmail = ''; saveStore({ joinedEmail: '' }); render(); break;
      case 'join-submit': {
        var input = $('#joinInput');
        var val = input ? input.value.trim() : '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) { S.joinEmail = val; S.joinError = true; render(); break; }
        S.joinError = false; S.joinedEmail = val; S.joinEmail = val;
        saveStore({ joinedEmail: val });
        // Never launch the mail app: the person is filling in a form, not
        // asking to compose an email. With no joinEndpoint set the address is
        // simply kept on the device and the confirmation says so.
        if (CONFIG.joinEndpoint) {
          fetch(CONFIG.joinEndpoint, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: val })
          }).catch(function () {});
        }
        render();
        break;
      }

      case 'launch-listen':
        // Start audio immediately — it must stay inside the user gesture — and
        // let the overlay fade out around it.
        play();
        dismissOverlay(function () { S.launched = true; saveStore({ firstLaunchDone: true }); });
        break;
      case 'launch-dismiss':
        dismissOverlay(function () { S.launched = true; saveStore({ firstLaunchDone: true }); });
        break;

      case 'route':
        try { audio.webkitShowPlaybackTargetPicker(); } catch (err) {}
        break;

      case 'retry':
        S.streamState = 'live'; retries = 0; render(); refresh();
        if (!S.playing) play();
        break;
      case 'reload-schedule': fetchSchedule().then(render); break;
    }
  });

  // Keep the typed value when the overlay re-renders around the input.
  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'joinInput') S.joinEmail = e.target.value;
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target && e.target.id === 'joinInput') {
      e.preventDefault();
      var btn = document.querySelector('[data-act="join-submit"]');
      if (btn) btn.click();
    }
    if (e.key === 'Escape') {
      if (S.sheet) dismissOverlay(function () { S.sheet = null; });
      else if (S.joinOpen) dismissOverlay(function () { S.joinOpen = false; });
    }
  });

  // ---------------------------------------------------------------- loop
  var pollTimer = null;
  function refresh() { return fetchNowPlaying().then(render); }

  function startPolling() {
    stopPolling();
    refresh();
    pollTimer = setInterval(function () {
      refresh();
      checkReminders();
    }, CONFIG.pollMs);
  }
  function stopPolling() { if (pollTimer) clearInterval(pollTimer); pollTimer = null; }

  // Stop polling in the background; when playing, metadata still reaches the
  // lock screen from the last update, and we refresh on return.
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stopPolling(); else startPolling();
  });

  // Re-render on the minute so live/past/upcoming stay honest without polling.
  setInterval(function () { if (!document.hidden) render(); }, 30000);

  // --- design preview hook ------------------------------------------------
  // ?state=<name> forces one screen/state, the way the original prototype's
  // "screen" control did. screenmap.html uses it to show every state at once.
  // It only ever sets local state; nothing here affects normal use.
  var PRESETS = {
    firstlaunch: function () { S.launched = false; },
    now:         function () { S.tab = 'now'; },
    playing:     function () { S.tab = 'now'; S.playing = true; },
    buffering:   function () { S.tab = 'now'; S.connecting = true; },
    nometa:      function () { S.tab = 'now'; S.playing = true; S.track = null; S.forceNoMeta = true; },
    streamdown:  function () { S.tab = 'now'; S.streamState = 'streamdown'; },
    offline:     function () { S.tab = 'now'; S.streamState = 'offline'; S.forceOffline = true; },
    track:       function () { S.tab = 'now'; S.playing = true; S.sheet = Object.assign({ at: Date.now() }, S.track || { title: 'Blue Monday', artist: 'New Order', album: '' }); S.sheetIsLive = true; },
    schedule:    function () { S.tab = 'schedule'; },
    show:        function () { var k = firstSlot(); if (k) { S.show = k; S.tab = 'show'; S.from = 'schedule'; } },
    reminder:    function () { var k = firstSlot(); if (k) { S.show = k; S.tab = 'show'; S.from = 'schedule'; S.reminders[k.id] = true; } },
    permission:  function () { var k = firstSlot(); if (k) { S.show = k; S.tab = 'show'; S.from = 'schedule'; S.permOpen = true; S.pendingRemind = k.id; } },
    about:       function () { S.tab = 'about'; S.from = 'now'; },
    join:        function () { S.tab = 'about'; S.from = 'now'; S.joinOpen = true; S.joinedEmail = ''; },
    joindone:    function () { S.tab = 'about'; S.from = 'now'; S.joinOpen = true; S.joinedEmail = 'you@lafayette.edu'; }
  };

  function firstSlot() {
    if (!S.schedule) return null;
    for (var d = 0; d < 7; d++) {
      var list = S.schedule.days[DAY_KEYS[d]];
      if (list && list.length) return Object.assign({}, list[0], { dayIdx: d });
    }
    return null;
  }

  // A design-system card cannot set a query string, so a global works too.
  function presetName() {
    if (window.__WJRH_PRESET) return window.__WJRH_PRESET;
    var m = /[?&]state=([a-z]+)/.exec(location.search);
    return m ? m[1] : null;
  }

  function applyPreset() {
    var name = presetName();
    if (!name || !PRESETS[name]) return false;
    S.launched = true;                  // presets opt in to first-launch explicitly
    // Previews must render the same every time, with or without a live feed.
    if (!S.track) S.track = { title: 'Blue Monday 1988', artist: 'New Order', album: 'Substance' };
    PRESETS[name]();
    return true;
  }

  fetchSchedule().then(function () {
    S.day = etNow().weekday;
    var previewing = applyPreset();
    render();
    if (!previewing) startPolling();    // frozen state for previews
    else fetchNowPlaying().then(function () { applyPreset(); render(); });
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  window.WJRH = { S: S, CONFIG: CONFIG, render: render };  // debugging handle
})();

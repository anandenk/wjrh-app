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

    automationName: 'Station rotation',
    automationBlurb: 'Music between live shows.',

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
  var previewClock = null;
  var previewDaySlots = null;
  var previewing = false;

  function etNow() {
    if (previewClock) return previewClock;
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: ET_TZ, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date());
    var get = function (t) {
      for (var i = 0; i < parts.length; i++) if (parts[i].type === t) return parts[i].value;
      return '';
    };
    var wd = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'));
    var h = parseInt(get('hour'), 10); if (h === 24) h = 0;
    return { weekday: wd < 0 ? 0 : wd, minutes: h * 60 + parseInt(get('minute'), 10), date: get('year') + '-' + get('month') + '-' + get('day') };
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
    expanded: null,
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
    joinPending: false,
    joinSent: false,

    scheduleError: false,
    metaError: false
  };

  // ---------------------------------------------------------------- schedule
  function slotsFor(dayIdx) {
    if (previewDaySlots && Object.prototype.hasOwnProperty.call(previewDaySlots, dayIdx)) return previewDaySlots[dayIdx];
    if (!S.schedule || !S.schedule.days) return [];
    return S.schedule.days[DAY_KEYS[dayIdx]] || [];
  }

  function liveOccurrence() {
    var n = etNow();
    // Include the previous day so a show crossing midnight stays on air.
    for (var offset = 0; offset >= -1; offset--) {
      var day = (n.weekday + offset + 7) % 7;
      var slots = slotsFor(day);
      for (var i = 0; i < slots.length; i++) {
        var slot = slots[i];
        var start = slot.startMin + offset * 1440;
        var end = slot.endMin + offset * 1440;
        if (slot.endMin <= slot.startMin) end += 1440;
        if (n.minutes >= start && n.minutes < end) {
          return { slot: slot, dayIdx: day, elapsed: n.minutes - start, duration: end - start, remaining: end - n.minutes };
        }
      }
    }
    return null;
  }

  function liveSlot() {
    var occurrence = liveOccurrence();
    return occurrence ? occurrence.slot : null;
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
    var occurrence = liveOccurrence();
    var live = occurrence && occurrence.slot;
    if (live) {
      return {
        slot: live, occurrence: occurrence, isAutomation: false, live: true,
        name: live.show, dj: live.dj,
        untilMin: live.endMin, label: 'ON AIR'
      };
    }
    var next = upcoming(1)[0];
    return {
      slot: null, isAutomation: true, live: false,
      name: S.schedule ? CONFIG.automationName : 'WJRH live radio', dj: '',
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
      .then(function (j) {
        if (!j || !j.days || typeof j.days !== 'object') throw new Error('Invalid schedule');
        S.schedule = j; S.scheduleError = false;
      })
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

        if (!title && !artist) { S.track = null; S.sheetIsLive = false; return; }
        var changed = !S.track || S.track.title !== title || S.track.artist !== artist;
        S.track = { title: title, artist: artist, album: album };
        if (changed) { S.sheetIsLive = false; pushLog(title, artist, album); }
      })
      .catch(function () { S.metaError = true; });
  }

  // No server stores play history, so the app records what it sees while open.
  // This is the honest stand-in for GET /recent until the backend exists.
  function pushLog(title, artist, album) {
    if (!title && !artist) return;
    var last = S.log[0];
    if (last && last.title === title && last.artist === artist) return;
    S.log.unshift(Object.assign({ title: title, artist: artist, album: album, at: Date.now() }, showProvenance()));
    S.log = S.log.filter(function (r) { return Date.now() - r.at < CONFIG.logHours * 3600e3; }).slice(0, 60);
    saveStore({ log: S.log });
  }

  function recentHour() {
    var cut = Date.now() - 3600e3;
    return S.log.filter(function (r) { return r.at >= cut; });
  }

  function showProvenance() {
    if (!S.schedule) return { showId: null, showName: '', showDj: '' };
    var cur = currentShow();
    return { showId: cur.slot ? cur.slot.id : 'rotation', showName: cur.name, showDj: cur.dj || '' };
  }

  function showHistory(slot) {
    var occurrence = liveOccurrence();
    if (!occurrence || occurrence.slot.id !== slot.id) return [];
    var start = Date.now() - occurrence.elapsed * 60000;
    return S.log.filter(function (r) { return r.showId === slot.id && r.at >= start; });
  }

  // ---------------------------------------------------------------- audio
  var audio = $('#audio');
  var retries = 0, retryTimer = null;

  function computeState() {
    if (S.forceOffline) return 'offline';
    if (S.forceNoMeta) return 'nometa';
    if (!navigator.onLine) return 'offline';
    if (S.streamState === 'streamdown') return 'streamdown';
    if (S.streamState === 'reconnecting') return 'reconnecting';
    if (S.connecting) return 'buffering';
    if (S.playing && !S.track) return 'nometa';
    return 'live';
  }

  function play() {
    var st = computeState();
    if (st === 'offline' || st === 'streamdown') return;
    // Cache-bust so a resumed session doesn't replay a stale buffer.
    audio.src = CONFIG.streamUrl + (CONFIG.streamUrl.indexOf('?') < 0 ? '?' : '&') + 't=' + Date.now();
    S.connecting = true;
    S.streamState = retries ? 'reconnecting' : 'live';
    render();
    audio.play().catch(function () {
      S.connecting = false;
      S.streamState = 'streamdown';
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
    if (on && S.notif === 'unasked') {
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
    if (S.notif !== 'granted' || previewing) return;
    var n = etNow();
    Object.keys(S.reminders).forEach(function (id) {
      for (var d = 0; d < 7; d++) {
        var slots = slotsFor(d);
        for (var i = 0; i < slots.length; i++) {
          if (slots[i].id !== id || d !== n.weekday) continue;
          var delta = slots[i].startMin - n.minutes;
          if (delta > 0 && delta <= 10 && S.reminders['fired:' + id] !== n.date) {
            S.reminders['fired:' + id] = n.date;
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
    if (tab === 'show' || tab === 'about') return S.from === 'schedule' ? 'schedule' : 'now';
    return tab === 'schedule' ? 'schedule' : 'now';
  }

  function statusLabel(st) {
    return {
      offline: 'OFFLINE', streamdown: 'STREAM UNAVAILABLE',
      reconnecting: 'RECONNECTING…', buffering: 'CONNECTING…'
    }[st] || (S.playing ? 'LIVE · PLAYING' : 'LISTEN LIVE');
  }

  function renderBanner(st) {
    var b = null;
    if (st === 'offline') {
      b = { label: 'YOU’RE OFFLINE', text: 'Previously loaded information is still here. Reconnect, then tap Retry to listen.', btn: 'Retry', act: 'retry' };
    } else if (st === 'streamdown') {
      b = { label: 'STREAM UNAVAILABLE', text: 'We couldn’t connect to the broadcast. The schedule is still here; try the stream again.', btn: 'Retry', act: 'retry' };
    } else if (st === 'reconnecting') {
      b = { label: 'RECONNECTING', text: 'The audio connection dropped. Waiting for the stream; you can also retry now.', btn: 'Retry', act: 'retry' };
    } else if (S.scheduleError) {
      b = { label: 'SCHEDULE UNAVAILABLE', text: S.schedule ? 'Showing the last schedule we loaded. Try refreshing it.' : 'The schedule couldn’t load. You can still try the live stream.', btn: 'Reload', act: 'reload-schedule' };
    }
    if (!b) return '';
    return '<div class="banner" role="status"><div class="banner-body"><div class="banner-label">' + esc(b.label) + '</div>' +
      '<div class="banner-text">' + esc(b.text) + '</div></div><button data-act="' + b.act + '">' + esc(b.btn) + '</button></div>';
  }

  function durationText(minutes) {
    minutes = Math.max(0, Math.round(minutes));
    var h = Math.floor(minutes / 60), m = minutes % 60;
    return h ? h + 'h' + (m ? ' ' + m + 'm' : '') : m + ' min';
  }

  function countdown(u) { return durationText(u.dayOffset * 1440 + u.slot.startMin - etNow().minutes); }

  function nextLive(promoted) {
    var next = upcoming(1)[0];
    if (!next) return '<div class="next-live' + (promoted ? ' promoted' : '') + '"><span class="next-label">NEXT LIVE SHOW</span><span class="next-name">' + (S.schedule ? 'No upcoming show listed' : 'Schedule unavailable') + '</span><span class="next-when">' + (S.schedule ? 'Check the schedule again soon.' : 'Try reloading the schedule.') + '</span></div>';
    return '<button class="next-live' + (promoted ? ' promoted' : '') + '" data-act="next-schedule" data-day="' + next.dayIdx + '">' +
      '<span class="next-label">NEXT LIVE SHOW <span class="next-countdown">IN ' + esc(countdown(next)) + '</span></span>' +
      '<span class="next-name">' + esc(next.slot.show) + '</span>' +
      '<span class="next-when">' + (next.dayOffset ? esc(DAY_FULL[next.dayIdx]) : 'Today') + ' · ' + esc(fmtMin(next.slot.startMin)) + ' ET <span aria-hidden="true">↗</span></span></button>';
  }

  function renderToday() {
    var n = etNow(), slots = slotsFor(n.weekday);
    if (!S.schedule) return '';
    var description = slots.length ? slots.map(function (s) { return s.show + ' from ' + fmtMin(s.startMin) + ' to ' + fmtMin(s.endMin); }).join('; ') : 'No live shows listed today';
    var h = '<button class="today-strip" data-act="today-schedule" aria-label="Open today’s schedule. ' + esc(description) + '. All times Eastern.">' +
      '<span class="today-heading"><span class="label">TODAY ON WJRH</span><span class="today-summary">' + slots.length + ' live show' + (slots.length === 1 ? '' : 's') + ' <span aria-hidden="true">↗</span></span></span>' +
      '<span class="today-band" aria-hidden="true">';
    slots.forEach(function (slot) {
      var end = slot.endMin > slot.startMin ? slot.endMin : 1440;
      h += '<span class="today-block' + (S.reminders[slot.id] ? ' saved' : '') + '" style="left:' + (slot.startMin / 14.4).toFixed(3) + '%;width:' + ((end - slot.startMin) / 14.4).toFixed(3) + '%"></span>';
    });
    h += '<span class="today-marker" style="left:' + (n.minutes / 14.4).toFixed(3) + '%"></span></span>' +
      '<span class="timeline-scale" aria-hidden="true"><span>12a</span><span>6a</span><span>Noon</span><span>6p</span><span>12a</span></span>' +
      '<span class="today-caption">Live shows marked · all times Eastern</span></button>';
    return h;
  }

  function renderCatchup() {
    var cur = currentShow(), saved = cur.live && S.reminders[cur.slot.id] ? { slot: cur.slot, dayIdx: cur.occurrence.dayIdx, now: true } : null;
    if (!saved) saved = upcoming(20).filter(function (u) { return S.reminders[u.slot.id] && u.dayOffset * 1440 + u.slot.startMin - etNow().minutes <= 60; })[0];
    if (!saved) return '';
    return '<button class="saved-catchup" data-act="next-schedule" data-day="' + saved.dayIdx + '"><span class="label">YOUR SAVED SHOW</span><span>' + esc(saved.slot.show) + (saved.now ? ' is on now.' : ' starts in ' + esc(countdown(saved)) + '.') + '</span><span aria-hidden="true">↗</span></button>';
  }

  function renderNow(st) {
    var cur = currentShow();
    var h = '<header class="hdr masthead"><div class="station-identity"><h1 class="wordmark">WJRH</h1><div class="station-meta">' +
      '<div class="freq"><span class="dot' + (S.playing ? ' pulsing' : '') + '"></span>104.9 FM</div><div class="station-place">LAFAYETTE COLLEGE<br>EASTON, PA</div></div></div>' +
      '<button class="ibtn" data-act="about" aria-label="About WJRH"><span aria-hidden="true">i</span></button></header>';
    h += renderBanner(st) + renderCatchup();
    h += '<div class="now-layout"><section class="broadcast-column" aria-label="The live broadcast">';
    if (cur.live) {
      var occurrence = cur.occurrence;
      h += '<button class="showcard" data-act="open-live-show"><span class="showcard-meta"><span><span class="dot"></span>ON THE AIR</span><span>' + esc(fmtMin(cur.slot.startMin)) + '–' + esc(fmtMin(cur.slot.endMin)) + ' ET</span></span>' +
        '<h2 class="showcard-name syne">' + esc(cur.name) + '</h2><span class="showcard-sub">' + (cur.dj ? 'with ' + esc(cur.dj) : 'Live on WJRH') + ' <span aria-hidden="true">↗</span></span>' +
        '<span class="show-clock" aria-label="Scheduled broadcast: ' + occurrence.remaining + ' minutes remaining in this ' + occurrence.duration + ' minute show."><span class="show-ticks" aria-hidden="true">';
      for (var tick = 0; tick < 12; tick++) h += '<i' + (tick < Math.floor(occurrence.elapsed / occurrence.duration * 12) ? ' class="elapsed"' : '') + '></i>';
      h += '</span><span class="clock-label">' + esc(durationText(occurrence.remaining)) + ' left in the show</span></span></button>';
    } else {
      h += '<div class="showcard automation"><div class="showcard-meta"><span><span class="dot"></span>ON THE AIR</span><span>FREEFORM RADIO</span></div>' +
        '<h2 class="showcard-name syne">' + esc(cur.name) + '</h2><div class="showcard-sub">' + (S.schedule ? esc(CONFIG.automationBlurb) : 'Listen to the live broadcast.') + '</div>' + nextLive(true) + '</div>';
    }
    var unavailable = st === 'streamdown' || st === 'offline';
    var noMeta = !S.track || S.forceNoMeta || unavailable;
    var trackLabel = unavailable ? 'BROADCAST INFORMATION' : S.metaError && S.track ? 'LAST RECEIVED TRACK' : 'NOW PLAYING';
    var title = noMeta ? (unavailable ? 'Waiting for the signal' : 'Live from the booth') : S.track.title || 'Title not posted';
    var artist = noMeta ? (unavailable ? 'Track information will return with the connection.' : 'Track info not posted yet') : S.track.artist || 'Artist not posted';
    h += '<button class="trackcard" data-act="open-track"' + (noMeta ? ' disabled' : '') + ' aria-label="' + esc(noMeta ? title : 'Track details: ' + title + ', ' + artist) + '">' +
      '<span class="trackcard-top"><span class="label">' + trackLabel + '</span>' + waveBars(S.playing && !noMeta && st !== 'buffering' && st !== 'reconnecting') + '</span>' +
      '<span class="row-body"><span class="trackcard-title syne">' + esc(title) + '</span><span class="trackcard-artist">' + esc(artist) + '</span>' +
      '<span class="trackcard-album">' + esc(!noMeta && S.track.album ? S.track.album : 'Album not posted') + '</span></span>' +
      (!noMeta ? '<span class="trackcard-foot">Track details <span aria-hidden="true">↗</span></span>' : '<span class="trackcard-foot">' + (unavailable ? 'Use Retry to reconnect' : 'The broadcast can continue without track details') + '</span>') + '</button></section>';
    h += '<section class="activity-column" aria-label="Around the broadcast">' + renderToday() + (cur.live ? nextLive(false) : '');
    var rec = recentHour();
    h += '<div class="recent-list"><div class="section-head"><h2>Last heard</h2><span class="count">' + rec.length + ' track' + (rec.length === 1 ? '' : 's') + '</span></div><p class="section-note">On this device · last hour</p>';
    if (!rec.length) h += '<div class="empty"><strong>A little history starts here.</strong><span>Tracks appear here as this app receives them. Keep it open to see what you’ve heard.</span></div>';
    else {
      var previousShow;
      rec.forEach(function (r) {
        var show = r.showName || 'Show not recorded';
        if (show !== previousShow) { h += '<div class="log-divider">' + esc(show) + '</div>'; previousShow = show; }
        h += trackRow(r);
      });
    }
    return h + '</div></section></div>';
  }

  function trackRow(r) {
    return '<button class="row" data-act="open-log" data-at="' + r.at + '"><span class="row-time">' + esc(fmtClock(r.at)) + '</span><span class="row-body"><span class="row-title">' + esc(r.title || 'Title not posted') + '</span><span class="row-sub">' + esc(r.artist || 'Artist not posted') + '</span></span><span class="row-arrow" aria-hidden="true">↗</span></button>';
  }

  function editorialBlurb(slot) {
    if (slot.blurb && slot.blurb.trim()) return slot.blurb.trim();
    var description = (slot.description || '').trim(), genre = (slot.genre || '').trim();
    if (!description) return '';
    var lines = description.split(/\n+/), first = lines[0].trim();
    var normal = function (s) { return s.toLowerCase().replace(/\s+/g, ' ').trim(); };
    var g = normal(genre), f = normal(first);
    var shortened = /(?:…|\.{3})$/.test(g);
    var prefix = g.replace(/(?:…|\.{3})$/, '').trim();
    if (g && (f === g || (shortened && f.indexOf(prefix) === 0))) return lines.slice(1).join('\n').trim();
    return description;
  }

  function hasEditorial(slot) { return !!(editorialBlurb(slot) || (slot.host && slot.host.bio && slot.host.bio.trim())); }

  function bellIcon(saved) {
    return '<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/>' + (saved ? '<path d="m8.5 10 2.4 2.4 4.6-5" fill="none" stroke="currentColor" stroke-width="2"/>' : '') + '</svg>';
  }

  function scheduleFreshness() {
    if (!S.schedule || !S.schedule.generatedAt) return '';
    var generated = new Date(S.schedule.generatedAt);
    if (!Number.isFinite(generated.getTime())) return '';
    var stale = Date.now() - generated.getTime() > 14 * 86400e3;
    var date = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: ET_TZ }).format(generated);
    return '<p class="schedule-freshness' + (stale ? ' stale' : '') + '">Schedule updated ' + esc(date) + (stale ? ' · Times may have changed.' : '') + '</p>';
  }

  function renderSchedule() {
    var n = etNow();
    var h = '<header class="hdr"><h1 class="syne sched-title">Schedule <span class="timezone">ET</span></h1><button class="ibtn" data-act="about" aria-label="About WJRH"><span aria-hidden="true">i</span></button></header>';
    h += '<div class="daypicker" role="tablist" aria-label="Day of the week">';
    DAY_LABELS.forEach(function (d, i) {
      var saved = slotsFor(i).some(function (slot) { return !!S.reminders[slot.id]; });
      h += '<button id="day-' + i + '" class="daycell' + (S.day === i ? ' sel' : '') + (i === n.weekday ? ' today' : '') + (saved ? ' has-reminders' : '') + '" role="tab" aria-selected="' + (S.day === i) + '" aria-controls="schedule-day" tabindex="' + (S.day === i ? '0' : '-1') + '" aria-label="' + DAY_FULL[i] + (i === n.weekday ? ', today' : '') + (saved ? ', saved reminders' : '') + '" data-act="day" data-day="' + i + '">' +
        '<span class="day-label">' + d + '</span><span class="day-today" aria-hidden="true">' + (i === n.weekday ? 'TODAY' : '') + '</span><i class="reminder-dot" aria-hidden="true"></i></button>';
    });
    h += '</div><section id="schedule-day" role="tabpanel" aria-labelledby="day-' + S.day + '"><div class="schedule-heading"><h2>' + DAY_FULL[S.day] + '</h2><span>ALL TIMES EASTERN</span></div>';
    var slots = slotsFor(S.day), occurrence = liveOccurrence();
    if (S.scheduleError) h += '<div class="empty"><strong>Schedule couldn’t refresh</strong><span>' + (S.schedule ? 'Previously loaded times are shown below.' : 'You can still try the live stream.') + '</span><button class="btn" data-act="reload-schedule">Reload schedule</button></div>';
    if (!S.schedule && !S.scheduleError) h += '<div class="empty" role="status"><strong>Loading the schedule…</strong><span>Live audio is ready below.</span></div>';
    else if (S.schedule && !slots.length) {
      h += '<div class="empty"><strong>Room for the unexpected.</strong><span>No live shows are listed for ' + DAY_FULL[S.day] + '. Station rotation fills the gaps.</span></div>' + nextLive(false);
    } else {
      slots.forEach(function (slot) {
        var isLive = !!(occurrence && occurrence.slot.id === slot.id && occurrence.dayIdx === S.day);
        var isPast = S.day === n.weekday && slot.endMin > slot.startMin && slot.endMin <= n.minutes;
        var reminded = !!S.reminders[slot.id], editorial = hasEditorial(slot);
        var expanded = S.expanded === slot.id;
        h += '<article class="showrow' + (isPast ? ' past' : '') + (isLive ? ' live' : '') + (expanded ? ' expanded' : '') + '"><button class="showrow-main" data-act="open-slot" data-day="' + S.day + '" data-id="' + esc(slot.id) + '"' + (!editorial ? ' aria-expanded="' + expanded + '" aria-controls="expanded-' + esc(slot.id) + '"' : '') + '>' +
          '<span class="showrow-time">' + esc(fmtMin(slot.startMin)) + '</span><span class="row-body"><span class="showrow-name syne">' + esc(slot.show) + '</span><span class="showrow-sub">' + esc([slot.dj, slot.genre].filter(Boolean).join(' · ')) + '</span>' +
          (isLive ? '<span class="chip">ON AIR</span>' : '') + '</span><span class="expand-mark" aria-hidden="true">' + (editorial ? '↗' : expanded ? '−' : '+') + '</span></button>' +
          '<button class="remind-btn' + (reminded ? ' on' : '') + '" data-act="remind" data-day="' + S.day + '" data-id="' + esc(slot.id) + '" aria-pressed="' + reminded + '" aria-label="' + esc((reminded ? 'Remove reminder for ' : 'Remind me about ') + slot.show) + '">' + bellIcon(reminded) + '</button>';
        if (!editorial) {
          h += '<div id="expanded-' + esc(slot.id) + '" class="showrow-expanded"' + (expanded ? '' : ' hidden') + '><p>' + esc(DAY_FULL[S.day] + ' · ' + fmtMin(slot.startMin) + '–' + fmtMin(slot.endMin)) + ' ET' + (slot.recurring ? ' · Weekly' : '') + '</p>' +
            '<p>' + (slot.dj ? 'Hosted by ' + esc(slot.dj) : 'Live on WJRH') + '</p>' +
            (isLive ? '<button class="btn solid" data-act="listen-here">' + (S.playing ? 'Playing live' : S.connecting ? 'Connecting…' : 'Listen now') + '</button>' : '') + '</div>';
        }
        h += '</article>';
      });
    }
    return h + '</section><p class="schedule-note">' + bellIcon(false) + '<span>Save a show with the bell. Browser reminders work only while this app is open; saved shows stay on this device.</span></p>' + scheduleFreshness();
  }

  function renderShow() {
    var slot = S.show;
    if (!slot) return renderSchedule();
    var occurrence = liveOccurrence(), isLive = !!(occurrence && occurrence.slot.id === slot.id && occurrence.dayIdx === slot.dayIdx);
    var when = DAY_FULL[slot.dayIdx] + ' · ' + fmtMin(slot.startMin) + '–' + fmtMin(slot.endMin) + ' ET';
    var h = '<header class="hdr"><button class="backbtn" data-act="back-show">← ' + (S.from === 'now' ? 'NOW' : 'SCHEDULE') + '</button><span class="label-11">WJRH · 104.9 FM</span></header>' +
      '<div class="band"><div class="status">' + (isLive ? 'ON AIR NOW' : 'THE SHOW') + '</div><h1 class="name syne">' + esc(slot.show) + '</h1>' + (slot.genre ? '<p class="genre">' + esc(slot.genre) + '</p>' : '') + '</div>';
    var blurb = editorialBlurb(slot);
    if (blurb) h += '<p class="about-copy">' + esc(blurb) + '</p>';
    if (slot.host && slot.host.bio && slot.host.bio.trim()) h += '<div class="hostcard"><span class="hostsq" aria-hidden="true">' + esc(slot.host.initials || '') + '</span><div class="row-body"><div class="label">HOSTED BY</div><h2 class="host-name">' + esc(slot.dj || slot.host.name || 'WJRH') + '</h2><p class="host-bio">' + esc(slot.host.bio) + '</p></div></div>';
    else if (slot.dj) h += '<dl class="kv"><dt>Host</dt><dd>' + esc(slot.dj) + '</dd></dl>';
    h += '<dl class="kv"><dt>Airs</dt><dd>' + esc(when) + (slot.recurring ? ' · Weekly' : '') + '</dd></dl><div class="btnrow">';
    if (isLive) h += '<button class="btn solid" data-act="listen-here">' + (S.playing ? 'Playing live' : S.connecting ? 'Connecting…' : 'Listen now') + '</button>';
    var remOn = !!S.reminders[slot.id];
    h += '<button class="btn' + (remOn ? ' on' : '') + '" data-act="remind" data-id="' + esc(slot.id) + '" data-day="' + slot.dayIdx + '" aria-pressed="' + remOn + '">' + bellIcon(remOn) + (remOn ? 'Reminder saved' : 'Remind me') + '</button></div>' +
      '<p class="confirm-line">' + (remOn ? 'Saved on this device. ' : '') + 'Browser reminders work only while this app is open.</p>';
    var rec = isLive ? showHistory(slot) : [];
    if (isLive) {
      h += '<div class="section-head"><h2>Heard during this show</h2></div><p class="section-note">Tracks received on this device</p>';
      if (!rec.length) h += '<div class="empty"><span>No tracks recorded for this show yet.</span></div>';
      else rec.forEach(function (r) { h += trackRow(r); });
    }
    return h;
  }

  function renderAbout() {
    var h = '<header class="hdr"><button class="backbtn" data-act="back-about">← ' + (S.from === 'schedule' ? 'SCHEDULE' : 'NOW') + '</button><span class="label-11">WJRH · 104.9 FM</span></header>' +
      '<div class="about-intro"><p class="label">LAFAYETTE COLLEGE RADIO</p><h1 class="hero syne">Independent.<br>On the air.</h1><p class="about-copy">WJRH is Lafayette College’s student-run freeform radio station in Easton, Pennsylvania. Student shows, discoveries, and music between the shows. Tune in at 104.9 FM or listen here.</p></div>';
    h += '<button class="linkrow" data-act="join"><span><span class="row-title">Host a show</span><span class="row-sub">Find your way into the booth</span></span><span class="open" aria-hidden="true">→</span></button>';
    h += '<a class="linkrow" href="tel:' + esc(CONFIG.boothPhone.replace(/\D/g, '')) + '"><span><span class="row-title">Call the booth</span><span class="row-sub">' + esc(CONFIG.boothPhone) + '</span></span><span class="open" aria-hidden="true">↗</span></a>';
    h += '<a class="linkrow" href="' + esc(CONFIG.givingUrl) + '" target="_blank" rel="noopener"><span><span class="row-title">Support the station</span><span class="row-sub">Give through Lafayette College</span></span><span class="open" aria-hidden="true">↗</span></a>';
    h += '<a class="linkrow" href="' + esc(CONFIG.instagram) + '" target="_blank" rel="noopener"><span><span class="row-title">Find us on Instagram</span><span class="row-sub">@wjrh_radio</span></span><span class="open" aria-hidden="true">↗</span></a>';
    return h + '<a class="linkrow last" href="' + esc(CONFIG.website) + '" target="_blank" rel="noopener"><span><span class="row-title">Visit wjrh.org</span><span class="row-sub">More from the station</span></span><span class="open" aria-hidden="true">↗</span></a>';
  }

  function renderDock(st) {
    var cur = currentShow(), disabled = st === 'offline' || st === 'streamdown', busy = st === 'buffering' || st === 'reconnecting';
    var title = disabled ? (st === 'offline' ? 'You’re offline' : 'Stream unavailable') : S.track ? (S.track.title || 'Title not posted') : 'Live from the booth';
    var sub = disabled ? 'Try the stream again when connected' : S.track ? [S.track.artist || 'Artist not posted', cur.name].filter(Boolean).join(' · ') : cur.name;
    var h = '<div class="player' + (S.tab === 'now' ? ' player-now' : '') + '"><button class="playbtn" data-act="play"' + (disabled ? ' disabled' : '') + ' aria-label="' + (S.playing || S.connecting ? 'Pause' : 'Play') + ' live stream">' +
      (busy ? '<span class="spinner"></span>' : S.playing ? pauseIcon(26) : playIcon(26)) + '</button>';
    if (S.tab === 'now') h += '<div class="player-body"><div class="player-status">' + esc(statusLabel(st)) + '</div><div class="player-station">WJRH 104.9 FM</div></div>';
    else h += '<button class="player-body" data-act="open-track"' + (!S.track || disabled ? ' disabled' : '') + ' aria-label="Track details"><span class="player-status">' + esc(statusLabel(st)) + '</span><span class="player-title syne ellipsis">' + esc(title) + '</span><span class="player-sub ellipsis">' + esc(sub) + '</span></button>';
    if (audio.webkitShowPlaybackTargetPicker) h += '<button class="outbtn" data-act="route" aria-label="Audio output">' + routeIcon() + '</button>';
    h += '</div>';
    var sec = sectionOf(S.tab);
    return h + '<nav class="tabs" aria-label="Main navigation"><button class="tab' + (sec === 'now' ? ' on' : '') + '" data-act="now"' + (sec === 'now' ? ' aria-current="page"' : '') + '><span>NOW</span><i aria-hidden="true"></i></button>' +
      '<button class="tab' + (sec === 'schedule' ? ' on' : '') + '" data-act="schedule"' + (sec === 'schedule' ? ' aria-current="page"' : '') + '><span>SCHEDULE</span><i aria-hidden="true"></i></button></nav>';
  }

  function renderOverlay() {
    if (!S.launched) {
      return '<div class="scrim"><div id="launch" class="sheet launch-sheet" role="dialog" aria-modal="true" aria-labelledby="launch-title" tabindex="-1"><div class="kicker">104.9 FM · EASTON, PA</div><h2 id="launch-title" class="launch-title syne">WJRH</h2>' +
        '<p class="sheet-copy">Lafayette College’s student-run freeform radio. Live shows and music between them, right here.</p><button class="cta" data-act="launch-listen">' + playIcon(20) + '<span>Listen live</span></button>' +
        '<button class="ghost" data-act="launch-dismiss">Just look around</button><p class="note">No account needed. We’ll ask about notifications only when you save a show.</p></div></div>';
    }
    if (S.permOpen) return '<div class="scrim" data-act="perm-deny"><div class="sheet" data-stop="1" role="dialog" aria-modal="true" aria-labelledby="permission-title" tabindex="-1"><div class="sheet-hdr"><span class="label">YOUR SHOW, SAVED</span><button class="sheet-close" data-act="perm-deny" aria-label="Close reminder permissions">Close ×</button></div><div class="sheet-content"><h2 id="permission-title" class="sheet-title syne">A reminder before airtime?</h2><p class="sheet-copy">With permission, this browser can notify you 10 minutes before a saved show, only while this app is open. Your show stays saved on this device either way.</p></div><div class="btnrow"><button class="btn solid" data-act="perm-allow">Allow reminders</button><button class="btn" data-act="perm-deny">Not now</button></div></div></div>';
    if (S.joinOpen) {
      var done = !!S.joinedEmail;
      var body = done ? '<div class="done-card"><span class="label">' + (S.joinSent ? 'SENT TO THE STATION' : 'SAVED ON THIS DEVICE') + '</span><h3 class="sheet-title syne">' + (S.joinSent ? 'Interest received' : 'Email to finish') + '</h3><p class="sheet-copy">' + (S.joinSent ? 'Your address, <b>' + esc(S.joinedEmail) + '</b>, was submitted. Check with the station for next steps.' : '<b>' + esc(S.joinedEmail) + '</b> is saved here. It hasn’t been sent to the station. Email the interest list to ask about hosting a show.') + '</p>' +
        (!S.joinSent ? '<a class="btn solid" href="mailto:' + esc(CONFIG.joinEmail) + '?subject=Interest%20in%20hosting%20a%20show">Open email ↗</a>' : '') + '<button class="btn" data-act="join-reset">Edit email</button></div>' :
        '<div class="form-field"><label class="form-label" for="joinInput">Your email</label><input id="joinInput" class="field' + (S.joinError ? ' err' : '') + '" type="email" inputmode="email" autocomplete="email" placeholder="you@lafayette.edu" value="' + esc(S.joinEmail) + '" aria-invalid="' + !!S.joinError + '" aria-describedby="join-privacy' + (S.joinError ? ' join-error' : '') + '">' +
        (S.joinError ? '<p class="err-msg" id="join-error" role="alert">' + (S.joinError === 'network' ? 'We couldn’t send your address. Try again or email the station.' : 'Enter a valid email address.') + '</p>' : '') + '</div><div class="form-actions"><button class="btn solid" data-act="join-submit"' + (S.joinPending ? ' disabled' : '') + '>' + (S.joinPending ? 'Sending…' : CONFIG.joinEndpoint ? 'Join the interest list' : 'Save email & continue') + '</button></div><p class="fineprint" id="join-privacy">' + (CONFIG.joinEndpoint ? 'Your address is sent to the station and remembered on this device.' : 'Your address is saved only on this device. The next step opens an email to the station; nothing is sent by this form.') + '</p>';
      return '<div class="scrim" data-act="join-close"><div class="sheet" data-stop="1" role="dialog" aria-modal="true" aria-labelledby="join-title" tabindex="-1"><div class="sheet-hdr"><span class="label">YOUR TURN AT THE MIC</span><button class="sheet-close" data-act="join-close">Close ×</button></div><div class="sheet-content"><h2 id="join-title" class="sheet-title syne">Host a show</h2><p class="sheet-copy">Start a conversation with WJRH about getting on air.</p></div>' +
        '<div class="step"><span class="step-num">01</span><div><h3 class="row-title">Introduce yourself</h3><p>Email the interest list at <span class="email-address">' + esc(CONFIG.joinEmail) + '</span>.</p></div></div><div class="step"><span class="step-num">02</span><div><h3 class="row-title">Meet the station</h3><p>Ask about the next meeting and available show times.</p></div></div><div class="step"><span class="step-num">03</span><div><h3 class="row-title">Get into the booth</h3><p>The station can walk you through the next steps.</p></div></div>' + body + '</div></div>';
    }
    if (S.sheet) {
      var track = S.sheet, q = encodeURIComponent([track.title, track.artist].filter(Boolean).join(' '));
      return '<div class="scrim" data-act="sheet-close"><div class="sheet" data-stop="1" role="dialog" aria-modal="true" aria-labelledby="track-title" tabindex="-1"><div class="sheet-hdr"><span class="label">' + (S.sheetIsLive ? 'NOW PLAYING' : 'HEARD ' + esc(fmtClock(track.at))) + '</span><button class="sheet-close" data-act="sheet-close">Close ×</button></div><div class="sheet-content"><h2 id="track-title" class="sheet-title syne">' + esc(track.title || 'Title not posted') + '</h2><p class="track-artist">' + esc(track.artist || 'Artist not posted') + '</p><p class="track-album">' + esc(track.album || 'Album not posted') + '</p></div><dl class="kv"><dt>Heard on</dt><dd>' + esc(track.showName ? [track.showName, track.showDj].filter(Boolean).join(' · ') : 'Show information wasn’t recorded') + '</dd></dl><div class="btnrow"><a class="btn solid" href="https://www.google.com/search?q=' + q + '" target="_blank" rel="noopener">Find this track ↗</a><button class="btn" data-act="copy">' + (S.copied ? 'Copied ✓' : 'Copy title') + '</button></div></div></div>';
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
    }, window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 180);
  }

  var scrollPos = {};
  var lastOverlayHTML = '', lastViewKey = '';
  var overlayReturnFocus = null, lastActionFocus = null;
  var lastJoinError = false, lastJoinDone = false;

  function focusDescriptor(el) {
    if (!el || el === document.body) return null;
    var data = {};
    ['act', 'id', 'day', 'at'].forEach(function (key) { if (el.dataset && el.dataset[key] != null) data[key] = el.dataset[key]; });
    return { id: el.id || '', data: data };
  }

  function focusMatch(descriptor, root) {
    if (!descriptor) return null;
    root = root || document;
    if (descriptor.id) {
      var byId = document.getElementById(descriptor.id);
      if (byId && (root === document || root.contains(byId))) return byId;
    }
    var keys = Object.keys(descriptor.data);
    if (!keys.length) return null;
    var candidates = root.querySelectorAll('[data-act]');
    for (var i = 0; i < candidates.length; i++) {
      if (keys.every(function (key) { return candidates[i].dataset[key] === descriptor.data[key]; })) return candidates[i];
    }
    return null;
  }

  function focusWithoutScroll(el) {
    if (el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
  }

  function dialogControls() {
    var dialog = $('#overlay [role="dialog"]');
    if (!dialog) return [];
    return Array.prototype.filter.call(dialog.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]'), function (el) {
      return el.getClientRects().length > 0;
    });
  }

  function render() {
    var st = computeState(), sec = sectionOf(S.tab);
    document.body.dataset.section = sec;
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', '#f4f0e6');
    var scroller = $('#scroll'), key = S.tab + (S.tab === 'show' && S.show ? ':' + S.show.id : '');
    var focused = document.activeElement, descriptor = focusDescriptor(focused);
    var selection = focused && focused.id === 'joinInput' ? [focused.selectionStart, focused.selectionEnd] : null;
    var oKey = overlayKey(), previousOverlay = lastOverlayKey;
    if (oKey && !previousOverlay) overlayReturnFocus = lastActionFocus || descriptor;
    var html = S.tab === 'now' ? renderNow(st) : S.tab === 'schedule' ? renderSchedule() : S.tab === 'show' ? renderShow() : renderAbout();
    var dockHtml = renderDock(st), rebuilt = false;
    if (html !== lastAppHTML) { $('#app').innerHTML = html; lastAppHTML = html; rebuilt = true; syncLoopingAnimations($('#app')); }
    if (dockHtml !== lastDockHTML) { $('#dock').innerHTML = dockHtml; lastDockHTML = dockHtml; }
    var ov = $('#overlay');
    // Keep the actual input node while typing. Validation and success still render.
    var typing = focused && focused.id === 'joinInput' && oKey === previousOverlay && S.joinError === lastJoinError && !!S.joinedEmail === lastJoinDone;
    var overlayRebuilt = false;
    if (!typing && !closingOverlay) {
      var overlayHTML = renderOverlay();
      if (overlayHTML !== lastOverlayHTML) {
        ov.innerHTML = overlayHTML; lastOverlayHTML = overlayHTML; overlayRebuilt = true;
        var scrim = ov.querySelector('.scrim');
        if (scrim && oKey === previousOverlay) scrim.classList.add('no-anim');
      }
      lastOverlayKey = oKey;
      lastJoinError = S.joinError; lastJoinDone = !!S.joinedEmail;
    }
    var modalOpen = !!ov.querySelector('[role="dialog"]');
    [scroller, $('#dock')].forEach(function (element) {
      element.inert = modalOpen;
      if (modalOpen) element.setAttribute('aria-hidden', 'true'); else element.removeAttribute('aria-hidden');
    });
    if (rebuilt) scroller.scrollTop = scrollPos[key] || 0;
    scroller.onscroll = function () { scrollPos[key] = scroller.scrollTop; };
    if (modalOpen && (overlayRebuilt || !ov.contains(document.activeElement))) {
      var sameControl = oKey === previousOverlay && focusMatch(descriptor, ov);
      focusWithoutScroll(sameControl || dialogControls()[0] || ov.querySelector('[role="dialog"]'));
      if (sameControl && selection && sameControl.id === 'joinInput') {
        try { sameControl.setSelectionRange(selection[0], selection[1]); } catch (e) {}
      }
    } else if (!modalOpen && previousOverlay) {
      focusWithoutScroll(focusMatch(overlayReturnFocus) || $('#dock [data-act="play"]'));
      overlayReturnFocus = null;
    } else if (!modalOpen && focused && !focused.isConnected) {
      var target = key === lastViewKey ? focusMatch(descriptor) : null;
      if (!target && key !== lastViewKey) {
        target = $('#app h1') || $('#app .backbtn');
        if (target && !target.matches('button')) target.tabIndex = -1;
      }
      focusWithoutScroll(target);
    }
    lastViewKey = key;
    var liveRegion = $('#live-region');
    var announcement = statusLabel(st);
    if (liveRegion && liveRegion.textContent !== announcement) liveRegion.textContent = announcement;
    updateMediaSession();
  }

  // ---------------------------------------------------------------- events
  function findSlot(dayIdx, id) {
    var slots = slotsFor(dayIdx);
    for (var i = 0; i < slots.length; i++) if (slots[i].id === id) return slots[i];
    return null;
  }

  function openSlot(dayIdx, id, forceDetail) {
    var slot = findSlot(dayIdx, id);
    if (!slot) return;
    if (!forceDetail && !hasEditorial(slot)) { S.expanded = S.expanded === slot.id ? null : slot.id; render(); return; }
    S.show = Object.assign({}, slot, { dayIdx: dayIdx });
    S.from = sectionOf(S.tab);
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
    lastActionFocus = focusDescriptor(el);

    switch (act) {
      case 'play': togglePlay(); break;
      case 'now': S.tab = 'now'; S.show = null; render(); break;
      case 'schedule': S.tab = 'schedule'; S.show = null; render(); break;
      case 'about': S.from = sectionOf(S.tab); S.tab = 'about'; render(); break;
      case 'back-about': S.tab = S.from === 'schedule' ? 'schedule' : 'now'; S.joinOpen = false; render(); break;
      case 'back-show': S.tab = S.from === 'now' ? 'now' : 'schedule'; S.show = null; render(); break;
      case 'day': S.day = +el.dataset.day; S.expanded = null; render(); break;
      case 'today-schedule': S.day = etNow().weekday; S.tab = 'schedule'; S.show = null; S.expanded = null; render(); break;
      case 'next-schedule': S.day = +el.dataset.day; S.tab = 'schedule'; S.show = null; S.expanded = null; render(); break;
      case 'open-slot': openSlot(+el.dataset.day, el.dataset.id); break;

      case 'open-live-show': {
        var occurrence = liveOccurrence();
        if (occurrence) openSlot(occurrence.dayIdx, occurrence.slot.id, true);
        break;
      }

      case 'open-track':
        if (S.track) { S.sheet = Object.assign({ at: Date.now() }, S.track, showProvenance()); S.sheetIsLive = !S.metaError; S.copied = false; render(); }
        break;
      case 'open-log': {
        var r = S.log.filter(function (record) { return record.at === +el.dataset.at; })[0];
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
        var slot = findSlot(+el.dataset.day, el.dataset.id);
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
          }).catch(function () { S.notif = 'denied'; saveStore({ notif: 'denied' }); render(); });
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
      case 'join-reset': S.joinedEmail = ''; S.joinSent = false; S.joinError = false; saveStore({ joinedEmail: '' }); render(); break;
      case 'join-submit': {
        if (S.joinPending) break;
        var input = $('#joinInput');
        var val = input ? input.value.trim() : '';
        S.joinEmail = val;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val) || (input && !input.validity.valid)) {
          S.joinError = true; render(); focusWithoutScroll($('#joinInput')); break;
        }
        S.joinError = false;
        if (CONFIG.joinEndpoint) {
          S.joinPending = true; render();
          fetch(CONFIG.joinEndpoint, {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: val })
          }).then(function (response) {
            if (!response.ok) throw new Error('Could not submit');
            S.joinedEmail = val; S.joinSent = true; saveStore({ joinedEmail: val });
          }).catch(function () { S.joinError = 'network'; })
            .then(function () { S.joinPending = false; render(); });
        } else {
          S.joinedEmail = val; S.joinSent = false; saveStore({ joinedEmail: val }); render();
        }
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
        S.forceOffline = false; S.forceNoMeta = false; S.streamState = 'live'; retries = 0; clearTimeout(retryTimer);
        if (!previewing) refresh();
        play(); render();
        break;
      case 'reload-schedule': fetchSchedule().then(render); break;
    }
  });

  // Keep the typed value when the overlay re-renders around the input.
  document.addEventListener('input', function (e) {
    if (e.target && e.target.id === 'joinInput') S.joinEmail = e.target.value;
  });
  document.addEventListener('keydown', function (e) {
    var dialog = $('#overlay [role="dialog"]');
    if (e.key === 'Tab' && dialog) {
      var controls = dialogControls(), first = controls[0], last = controls[controls.length - 1];
      if (!controls.length) { e.preventDefault(); focusWithoutScroll(dialog); }
      else if (e.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) { e.preventDefault(); focusWithoutScroll(last); }
      else if (!e.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) { e.preventDefault(); focusWithoutScroll(first); }
    }
    if (e.key === 'Enter' && e.target && e.target.id === 'joinInput') {
      e.preventDefault(); var btn = document.querySelector('[data-act="join-submit"]'); if (btn) btn.click();
    }
    if (e.target && e.target.matches('.daycell') && ['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) !== -1) {
      e.preventDefault();
      S.day = e.key === 'Home' ? 0 : e.key === 'End' ? 6 : (S.day + (e.key === 'ArrowRight' ? 1 : 6)) % 7;
      S.expanded = null; render(); focusWithoutScroll(document.getElementById('day-' + S.day));
    }
    if (e.key === 'Escape') {
      if (!S.launched) dismissOverlay(function () { S.launched = true; saveStore({ firstLaunchDone: true }); });
      else if (S.permOpen) {
        S.notif = 'denied'; saveStore({ notif: 'denied' });
        dismissOverlay(function () { S.permOpen = false; if (S.pendingRemind) setRemind(S.pendingRemind, true); S.pendingRemind = null; });
      } else if (S.sheet) dismissOverlay(function () { S.sheet = null; });
      else if (S.joinOpen) dismissOverlay(function () { S.joinOpen = false; S.joinError = false; });
    }
  });

  // ---------------------------------------------------------------- loop
  var pollTimer = null;
  function refresh() { return fetchNowPlaying().then(render); }

  function startPolling() {
    stopPolling();
    if (previewing) return;
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
  // Explicit ?state= previews use local fixtures and never poll, persist fixture
  // data, or rewrite the generated schedule. Normal visits use only real feeds.
  var PRESETS = {
    firstlaunch: function () { S.launched = false; },
    now: function () { S.tab = 'now'; },
    playing: function () { S.tab = 'now'; S.playing = true; },
    live: function () { previewLive(); S.playing = true; },
    automation: function () { var slot = firstSlot(); if (slot) previewClock = { weekday: slot.dayIdx, minutes: Math.max(0, slot.startMin - 90), date: 'preview' }; },
    buffering: function () { S.tab = 'now'; S.connecting = true; },
    reconnecting: function () { S.tab = 'now'; S.streamState = 'reconnecting'; S.connecting = true; },
    nometa: function () { S.tab = 'now'; S.playing = true; S.track = null; S.forceNoMeta = true; },
    streamdown: function () { S.tab = 'now'; S.streamState = 'streamdown'; },
    offline: function () { S.tab = 'now'; S.forceOffline = true; },
    track: function () { S.sheet = Object.assign({ at: Date.now() }, S.track, showProvenance()); S.sheetIsLive = true; },
    schedule: function () { S.tab = 'schedule'; },
    dense: function () { S.tab = 'schedule'; S.day = densityDay(false); },
    sparse: function () { S.tab = 'schedule'; S.day = densityDay(true); },
    empty: function () { S.tab = 'schedule'; previewDaySlots = {}; previewDaySlots[S.day] = []; },
    scheduleerror: function () { S.tab = 'schedule'; S.schedule = null; S.scheduleError = true; },
    show: function () { var slot = firstSlot(); if (slot) { S.show = slot; S.tab = 'show'; S.from = 'schedule'; } },
    editorial: function () {
      var slot = firstSlot();
      if (!slot) return;
      S.day = slot.dayIdx; S.tab = 'schedule';
      previewDaySlots = {};
      previewDaySlots[S.day] = slotsFor(S.day).map(function (item) {
        return item.id === slot.id ? Object.assign({}, item, { blurb: 'Preview only: a show description supplied by the station will appear here.', host: Object.assign({}, item.host, { bio: 'Preview only: a host biography will appear here when the station supplies one.' }) }) : item;
      });
    },
    long: function () {
      var slot = firstSlot();
      if (!slot) return;
      var original = slotsFor(slot.dayIdx);
      previewDaySlots = {};
      previewDaySlots[slot.dayIdx] = original.map(function (item) {
        return item.id === slot.id ? Object.assign({}, item, { show: 'Preview: a very long show title from the far end of the radio dial', dj: 'A host name and a co-host name that both need room to breathe' }) : item;
      });
      previewLive();
      S.track = { title: 'Preview: a very long track title that still deserves to be read in full', artist: 'Preview artist with a long collaborative artist credit', album: 'Preview album with an equally long name' };
    },
    reminder: function () { var slot = firstSlot(); if (slot) { S.show = slot; S.tab = 'show'; S.from = 'schedule'; S.reminders[slot.id] = true; } },
    permission: function () { var slot = firstSlot(); if (slot) { S.day = slot.dayIdx; S.tab = 'schedule'; S.permOpen = true; S.pendingRemind = slot.id; } },
    about: function () { S.tab = 'about'; S.from = 'now'; },
    join: function () { S.tab = 'about'; S.from = 'now'; S.joinOpen = true; S.joinedEmail = ''; },
    joindone: function () { S.tab = 'about'; S.from = 'now'; S.joinOpen = true; S.joinedEmail = 'you@lafayette.edu'; }
  };

  function firstSlot() {
    for (var d = 0; d < 7; d++) {
      var list = slotsFor(d);
      if (list.length) return Object.assign({}, list[0], { dayIdx: d });
    }
    return null;
  }

  function previewLive() {
    var slot = firstSlot();
    if (slot) previewClock = { weekday: slot.dayIdx, minutes: slot.startMin + 15, date: 'preview' };
    S.tab = 'now';
  }

  function densityDay(sparse) {
    var chosen = 0, size = sparse ? Infinity : -1;
    for (var day = 0; day < 7; day++) {
      var length = slotsFor(day).length;
      if (sparse ? length > 0 && length < size : length > size) { chosen = day; size = length; }
    }
    return chosen;
  }

  function presetName() {
    if (window.__WJRH_PRESET) return window.__WJRH_PRESET;
    var match = /[?&]state=([a-z]+)/.exec(location.search);
    return match ? match[1] : null;
  }

  function applyPreset() {
    var name = presetName();
    if (!name || !PRESETS[name]) return false;
    previewing = true;
    S.launched = true;
    S.log = []; S.reminders = {}; S.notif = 'unasked';
    S.track = { title: 'Blue Monday', artist: 'New Order', album: '' };
    PRESETS[name]();
    document.body.dataset.preview = name;
    return true;
  }

  // Render immediately: schedule latency must not block the play control.
  render();
  fetchSchedule().then(function () {
    S.day = etNow().weekday;
    applyPreset();
    render();
    if (!previewing) startPolling();
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }

  window.WJRH = { S: S, CONFIG: CONFIG, render: render };  // debugging handle
})();

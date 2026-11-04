/* Welcome to Hogwarts - 공통 기능
 * - 영어 읽어주기(TTS), 음성 인식(STT), 정답 판정, 통계 저장, 반짝 효과
 */
(function () {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

  // ---------- 영어 읽어주기 (TTS) ----------
  let enVoice = null;
  function pickVoice() {
    const voices = speechSynthesis.getVoices();
    enVoice =
      voices.find(v => /en-US/i.test(v.lang) && /Google|Samantha|Jenny|Aria/i.test(v.name)) ||
      voices.find(v => /en-US/i.test(v.lang)) ||
      voices.find(v => /^en/i.test(v.lang)) || null;
  }
  if ('speechSynthesis' in window) {
    try { pickVoice(); } catch (e) {}
    speechSynthesis.onvoiceschanged = pickVoice;
  }

  function speak(text, opts = {}) {
    return new Promise(resolve => {
      if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return resolve();
      try { speechSynthesis.cancel(); } catch (e) {}
      const u = new SpeechSynthesisUtterance(text);
      u.lang = opts.lang || 'en-US';
      u.rate = opts.rate || Magic.settings.rate;
      u.pitch = opts.pitch || 1;
      if (enVoice && u.lang.startsWith('en')) u.voice = enVoice;
      // 일부 기기는 읽기가 끝나도 onend가 오지 않아 화면이 멈출 수 있으므로 안전 타이머를 둠
      const guard = setTimeout(resolve, 1500 + text.length * 110 / u.rate);
      u.onend = u.onerror = () => { clearTimeout(guard); resolve(); };
      try { speechSynthesis.speak(u); } catch (e) { clearTimeout(guard); resolve(); }
    });
  }

  // ---------- 음성 인식 (STT) ----------
  let current = null;
  function listen(opts = {}) {
    return new Promise((resolve, reject) => {
      if (!SR) return reject(new Error('unsupported'));
      if (current) try { current.abort(); } catch (e) {}
      if ('speechSynthesis' in window) speechSynthesis.cancel();
      const rec = new SR();
      current = rec;
      rec.lang = opts.lang || 'en-US';
      rec.interimResults = false;
      rec.maxAlternatives = opts.maxAlternatives || 5;
      rec.continuous = false;
      let results = [];
      let settled = false;
      const done = fn => { if (!settled) { settled = true; clearTimeout(timer); current = null; fn(); } };
      const timer = setTimeout(() => { try { rec.stop(); } catch (e) {} }, opts.timeout || 7000);
      rec.onresult = e => {
        for (const res of e.results) for (const alt of res) results.push(alt.transcript.toLowerCase().trim());
      };
      rec.onerror = e => done(() => (e.error === 'no-speech' || e.error === 'aborted') ? resolve([]) : reject(new Error(e.error)));
      rec.onend = () => done(() => resolve(results));
      try { rec.start(); } catch (e) { done(() => reject(e)); }
    });
  }
  function stopListening() { if (current) try { current.stop(); } catch (e) {} }

  // ---------- 정답 판정 ----------
  function normalize(s) {
    return (s || '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  function words(s) { return normalize(s).split(' ').filter(Boolean); }

  // 단어 하나 말하기: 인식 결과(여러 후보) 중 하나라도 정답/허용 발음이 들어 있으면 정답
  function matchWord(transcripts, accepts) {
    const ok = accepts.map(normalize);
    for (const t of transcripts) {
      const n = normalize(t);
      const ws = words(t);
      for (const a of ok) {
        if (a.includes(' ') ? n.includes(a) : ws.includes(a)) return true;
      }
    }
    return false;
  }

  // 문장 말하기: 목표 문장 단어 중 몇 %를 말했는지 (가장 잘 맞는 후보 기준)
  const SMALL = new Set(['the', 'a', 'an', 'is', 'are']);
  function scoreSentence(transcripts, target, mustHave = []) {
    const tw = words(target);
    let best = { score: 0, hit: [], transcript: transcripts[0] || '' };
    for (const t of transcripts) {
      const said = new Set(words(t));
      const hit = tw.map(w => said.has(w));
      // 관사·be동사는 인식이 잘 빠지므로 절반만 반영
      let total = 0, got = 0;
      tw.forEach((w, i) => { const wt = SMALL.has(w) ? 0.5 : 1; total += wt; if (hit[i]) got += wt; });
      const keyOk = mustHave.every(k => said.has(normalize(k)));
      const score = keyOk ? got / total : Math.min(got / total, 0.5);
      if (score > best.score) best = { score, hit, transcript: t };
    }
    best.words = target.split(' ');
    return best;
  }

  // ---------- 통계 (이 기기에만 저장) ----------
  const KEY = 'hogwarts-booth-stats-v1';
  function readStats() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
  }
  function inc(name, by = 1) {
    try {
      const s = readStats();
      s[name] = (s[name] || 0) + by;
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (e) {}
  }
  function resetStats() { try { localStorage.removeItem(KEY); } catch (e) {} }

  // ---------- 설정 ----------
  const SKEY = 'hogwarts-booth-settings-v1';
  let settings = { rate: 0.85 };
  try { Object.assign(settings, JSON.parse(localStorage.getItem(SKEY)) || {}); } catch (e) {}
  function saveSettings() { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch (e) {} }

  // ---------- 효과 ----------
  function sparkle(el, symbols = ['✨', '⭐', '🌟', '💫']) {
    const r = el ? el.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    for (let i = 0; i < 14; i++) {
      const s = document.createElement('div');
      s.className = 'spark';
      s.textContent = symbols[i % symbols.length];
      s.style.left = cx + 'px';
      s.style.top = cy + 'px';
      const ang = Math.random() * Math.PI * 2, dist = 80 + Math.random() * 160;
      s.style.setProperty('--dx', Math.cos(ang) * dist + 'px');
      s.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
      document.body.appendChild(s);
      setTimeout(() => s.remove(), 1000);
    }
  }
  function shake(el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
  function pop(el) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }

  // 효과음 (파일 없이 소리 합성)
  let ctx = null;
  function tone(freqs, dur = 0.12, type = 'sine') {
    try {
      ctx = ctx || new (window.AudioContext || window.webkitAudioContext)();
      freqs.forEach((f, i) => {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.type = type; o.frequency.value = f;
        const t = ctx.currentTime + i * dur;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(ctx.destination);
        o.start(t); o.stop(t + dur + 0.02);
      });
    } catch (e) {}
  }
  const sfx = {
    ok: () => tone([523, 659, 784, 1047], 0.1),
    bad: () => tone([220, 180], 0.18, 'square'),
    alarm: () => tone([880, 440, 880, 440], 0.15, 'sawtooth'),
    magic: () => tone([784, 988, 1175, 1568, 1976], 0.08, 'triangle'),
  };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function toggleFullscreen() {
    // 오래된 브라우저(스탠바이미 등)도 이해할 수 있게 ?. 문법 대신 직접 확인
    const el = document.documentElement;
    if (!document.fullscreenElement) { if (el.requestFullscreen) el.requestFullscreen(); }
    else if (document.exitFullscreen) document.exitFullscreen();
  }

  // 마이크 미지원 브라우저 안내
  // 다른 사이트 안에 끼워진 화면인지 (예: claude.ai 공유 링크) → 이때는 브라우저가 마이크를 막음
  let embedded = false;
  try { embedded = window.self !== window.top; } catch (e) { embedded = true; }

  function micNotice(container) {
    let msg = '';
    if (!SR) msg = '🎤 이 브라우저는 음성 인식을 지원하지 않아요. 휴대폰·태블릿의 <b>크롬(Chrome)</b>으로 열면 마이크가 작동합니다. 지금은 선생님이 <b>✔ 통과</b> 버튼으로 진행해 주세요.';
    else if (embedded) msg = '🎤 공유 링크(claude.ai) 안에서는 마이크가 막혀 있어요. 마이크를 쓰려면 <b>taehha-netizen.github.io/english-booth</b> 주소를 크롬으로 직접 열어 주세요.';
    if (!msg) return;
    const d = document.createElement('div');
    d.className = 'notice';
    d.innerHTML = msg;
    (container || document.body).prepend(d);
  }

  // 음성 인식 오류 코드 → 선생님이 바로 조치할 수 있는 안내
  function micErrorText(err) {
    const code = (err && err.message) || String(err || '');
    const tip = {
      'not-allowed': '마이크 권한이 막혀 있어요. 주소창 왼쪽 자물쇠 → 마이크 <b>허용</b> 후 새로고침해 주세요.' + (embedded ? ' (공유 링크 안에서는 항상 막혀요. github.io 주소로 여세요.)' : ''),
      'service-not-allowed': '이 브라우저에서는 음성 인식 서비스를 쓸 수 없어요. 휴대폰·태블릿의 <b>크롬</b>으로 열어 주세요.',
      'audio-capture': '이 기기에 <b>마이크가 없거나</b> 연결되지 않았어요. 마이크(또는 카메라 마이크)를 연결하거나 다른 기기를 써 주세요.',
      'network': '음성 인식 서버에 연결하지 못했어요. <b>인터넷 연결</b>을 확인해 주세요. 인터넷이 되는데도 계속되면 이 브라우저가 구글 음성 인식을 지원하지 않는 것이니(스탠바이미·TV 등) <b>크롬</b>을 써 주세요.',
      'language-not-supported': '이 브라우저는 영어 음성 인식을 지원하지 않아요. <b>크롬</b>으로 열어 주세요.',
      'unsupported': '이 브라우저는 음성 인식을 지원하지 않아요. <b>크롬</b>으로 열어 주세요.',
    }[code] || '알 수 없는 오류예요.';
    return `🎤 ${tip} <span class="ko">(오류 코드: ${code || '없음'}) · 지금은 ✔ 통과로 진행해 주세요.</span>`;
  }


  // ---------- 호그와트 장식 ----------
  const HOUSES = {
    gryffindor: { name: 'Gryffindor', e: '🦁', trait: 'Brave', ko: '용감한' },
    hufflepuff: { name: 'Hufflepuff', e: '🦡', trait: 'Kind', ko: '친절한' },
    ravenclaw:  { name: 'Ravenclaw',  e: '🦅', trait: 'Smart', ko: '지혜로운' },
    slytherin:  { name: 'Slytherin',  e: '🐍', trait: 'Ambitious', ko: '야망 있는' },
  };

  // 낡고 구겨진 마법의 모자 (눈 주름 + 말하는 입)
  function hatSVG(size = '') {
    return `
    <div class="hat-wrap ${size}" id="hat">
      <svg viewBox="0 0 210 200" aria-label="Sorting Hat">
        <defs>
          <linearGradient id="hatG" x1="0" x2="1">
            <stop offset="0" stop-color="#3d2814"/><stop offset=".45" stop-color="#7a5430"/><stop offset="1" stop-color="#3a2510"/>
          </linearGradient>
          <linearGradient id="brimG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#6e4a28"/><stop offset="1" stop-color="#2e1d0c"/>
          </linearGradient>
        </defs>
        <ellipse cx="105" cy="178" rx="98" ry="18" fill="url(#brimG)"/>
        <path d="M38 172 C52 135 58 110 70 88 C82 66 92 50 112 34 C128 21 150 14 166 22 C176 28 172 40 160 38 C146 36 136 44 132 58 C128 80 140 120 172 172 Z" fill="url(#hatG)"/>
        <path d="M62 120 C80 112 120 112 146 122" stroke="#2a1a0a" stroke-width="3" fill="none" opacity=".6"/>
        <path d="M78 78 C92 72 112 72 128 80" stroke="#2a1a0a" stroke-width="3" fill="none" opacity=".5"/>
        <path d="M118 40 C126 46 130 54 130 62" stroke="#a87a48" stroke-width="2" fill="none" opacity=".6"/>
        <path d="M150 150 l10 -6 M154 158 l10 -6 M158 166 l10 -6" stroke="#c9a46a" stroke-width="2"/>
        <path d="M70 108 Q86 94 100 106" stroke="#1a0f05" stroke-width="6" fill="none" stroke-linecap="round"/>
        <path d="M112 104 Q128 92 142 106" stroke="#1a0f05" stroke-width="6" fill="none" stroke-linecap="round"/>
        <g class="hat-mouth"><path d="M76 141 Q105 124 136 141 Q105 160 76 141 Z" fill="#140a03"/></g>
        <ellipse cx="105" cy="168" rx="72" ry="7" fill="#1e1308" opacity=".6"/>
      </svg>
    </div>`;
  }

  function crest(h, size = '') {
    return `<div class="crest h-${h} ${size}"><span class="animal">${HOUSES[h].e}</span></div>`;
  }

  // 모자가 말할 때 입이 움직임
  function hatSay(text, opts) {
    const hat = document.getElementById('hat');
    if (hat) hat.classList.add('talking');
    return speak(text, opts).then(() => {
      const h = document.getElementById('hat');
      if (h) h.classList.remove('talking');
    });
  }

  function confetti(colors = ['#e8c15a', '#fff1b5', '#b8862a']) {
    for (let i = 0; i < 70; i++) {
      const c = document.createElement('div');
      c.className = 'confetti';
      c.style.left = Math.random() * 100 + 'vw';
      c.style.background = colors[i % colors.length];
      c.style.animationDuration = (2 + Math.random() * 2.5) + 's';
      c.style.animationDelay = Math.random() * .8 + 's';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 5500);
    }
  }

  // 떠다니는 촛불: 모든 페이지에 자동으로 깔림 (가운데 글자 영역은 피해 양옆에 배치)
  function makeCandles() {
    if (document.getElementById('candles')) return;
    const box = document.createElement('div');
    box.className = 'candles'; box.id = 'candles'; box.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 8; i++) {
      const c = document.createElement('div');
      c.className = 'candle';
      const side = i % 2 ? 78 + Math.random() * 19 : 2 + Math.random() * 19;
      c.style.left = side + '%';
      c.style.top = (8 + Math.random() * 60) + '%';
      c.style.setProperty('--d', (4 + Math.random() * 4) + 's');
      c.style.animationDelay = (-Math.random() * 6) + 's';
      c.style.scale = String(.6 + Math.random() * .6);
      box.appendChild(c);
    }
    document.body.prepend(box);
  }
  if (document.body) makeCandles(); else document.addEventListener('DOMContentLoaded', makeCandles);

  window.Magic = {
    canListen: !!SR, speak, listen, stopListening,
    normalize, words, matchWord, scoreSentence,
    readStats, inc, resetStats,
    settings, saveSettings,
    sparkle, shake, pop, sfx, shuffle, toggleFullscreen, micNotice, micErrorText,
    HOUSES, hatSVG, crest, hatSay, confetti,
  };
})();

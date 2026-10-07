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
    pickVoice();
    speechSynthesis.onvoiceschanged = pickVoice;
  }

  function speak(text, opts = {}) {
    return new Promise(resolve => {
      if (!('speechSynthesis' in window)) return resolve();
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = opts.lang || 'en-US';
      u.rate = opts.rate || Magic.settings.rate;
      u.pitch = opts.pitch || 1;
      if (enVoice && u.lang.startsWith('en')) u.voice = enVoice;
      // 일부 기기는 읽기가 끝나도 onend가 오지 않아 화면이 멈출 수 있으므로 안전 타이머를 둠
      const guard = setTimeout(resolve, 1500 + text.length * 110 / u.rate);
      u.onend = u.onerror = () => { clearTimeout(guard); resolve(); };
      speechSynthesis.speak(u);
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
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  // 마이크 미지원 브라우저 안내
  function micNotice(container) {
    if (SR) return;
    const d = document.createElement('div');
    d.className = 'notice';
    d.innerHTML = '🎤 이 브라우저는 음성 인식을 지원하지 않아요. <b>크롬(Chrome)</b>으로 열면 마이크가 작동합니다. 지금은 선생님이 <b>✔ 통과</b> 버튼으로 진행해 주세요.';
    (container || document.body).prepend(d);
  }

  window.Magic = {
    canListen: !!SR, speak, listen, stopListening,
    normalize, words, matchWord, scoreSentence,
    readStats, inc, resetStats,
    settings, saveSettings,
    sparkle, shake, pop, sfx, shuffle, toggleFullscreen, micNotice,
  };
})();

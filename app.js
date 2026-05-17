// G1 Turf Analytics — main app logic
(() => {
  'use strict';

  const D = window.G1_DATA;
  const root = document.getElementById('view-root');
  const navBtns = document.querySelectorAll('.nav-btn');
  const todayLabel = document.getElementById('today-label');
  const themeToggle = document.getElementById('theme-toggle');

  const state = {
    view: 'home',
    raceFilter: 'all',
    horseFilter: 'all',
    selectedRace: null,
    selectedHorse: null,
    today: new Date('2026-05-17T10:00:00+09:00'),
    chart: null,
  };

  // Theme
  const savedTheme = localStorage.getItem('g1-theme');
  if (savedTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  themeToggle.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    if (next === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('g1-theme', next);
    if (state.chart) renderCurrent(); // refresh chart colors
  });

  // Today label
  const fmtDate = (d) => `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  todayLabel.textContent = `${fmtDate(state.today)}（日）`;

  // Nav
  navBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      state.view = btn.dataset.view;
      state.selectedRace = null;
      state.selectedHorse = null;
      navBtns.forEach(b => b.classList.toggle('active', b === btn));
      renderCurrent();
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  });

  function renderCurrent() {
    if (state.chart) { state.chart.destroy(); state.chart = null; }
    switch (state.view) {
      case 'home':    return renderHome();
      case 'races':   return state.selectedRace ? renderRaceDetail() : renderRaces();
      case 'horses':  return state.selectedHorse ? renderHorseDetail() : renderHorses();
      case 'analyze': return renderAnalyze();
      case 'predict': return renderPredict();
    }
  }

  // ---------- Utilities ----------
  function getRaceDate(race, year) {
    return new Date(year, race.month - 1, race.day);
  }
  function nextRace() {
    const y = state.today.getFullYear();
    const upcoming = [];
    for (const r of D.races) {
      const dThisYear = getRaceDate(r, y);
      const dNextYear = getRaceDate(r, y + 1);
      upcoming.push({ ...r, date: dThisYear >= state.today ? dThisYear : dNextYear });
    }
    upcoming.sort((a, b) => a.date - b.date);
    return upcoming[0];
  }
  function pastRaces() {
    const y = state.today.getFullYear();
    return D.races
      .map(r => ({ ...r, date: getRaceDate(r, y) }))
      .filter(r => r.date < state.today)
      .sort((a, b) => b.date - a.date);
  }
  function upcomingRaces(n = 6) {
    const y = state.today.getFullYear();
    const todayMid = new Date(state.today.getFullYear(), state.today.getMonth(), state.today.getDate());
    return D.races
      .map(r => {
        const t = getRaceDate(r, y);
        return { ...r, date: t >= todayMid ? t : getRaceDate(r, y + 1) };
      })
      .sort((a, b) => a.date - b.date)
      .slice(0, n);
  }
  function daysBetween(a, b) {
    return Math.floor((b - a) / (1000 * 60 * 60 * 24));
  }
  function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

  // ---------- Home ----------
  function renderHome() {
    const next = nextRace();
    const upcoming = upcomingRaces(5);
    const totalG1 = D.races.length;
    const heldThisYear = pastRaces().length;

    const diff = daysBetween(state.today, next.date);
    const hh = 24 - state.today.getHours();
    const mm = 60 - state.today.getMinutes();

    root.innerHTML = '';

    const hero = h(`
      <section class="hero">
        <span class="hero-tag">NEXT G1</span>
        <h2>${esc(next.name)}</h2>
        <div class="hero-meta">
          <span>${next.date.getMonth()+1}月${next.date.getDate()}日</span>
          <span>${esc(next.course)}競馬場</span>
          <span>${next.surface} ${next.distance}m</span>
        </div>
        <div class="hero-countdown">
          <div class="countdown-box">
            <div class="countdown-num">${diff}</div>
            <div class="countdown-lbl">日</div>
          </div>
          <div class="countdown-box">
            <div class="countdown-num">${hh}</div>
            <div class="countdown-lbl">時間</div>
          </div>
          <div class="countdown-box">
            <div class="countdown-num">${next.distance}</div>
            <div class="countdown-lbl">m</div>
          </div>
        </div>
      </section>
    `);
    root.appendChild(hero);

    // Today's notable race (if today is a race day)
    const todayRace = D.races.find(r => r.month === state.today.getMonth() + 1 && r.day === state.today.getDate());
    if (todayRace) {
      const c = h(`
        <div class="card" style="background: linear-gradient(135deg, var(--accent-2), #c8941a); color: #1a1f1c; border: 0;">
          <div style="font-size: 11px; font-weight: 800; letter-spacing: 2px;">今日のG1</div>
          <div style="font-size: 22px; font-weight: 800; margin: 4px 0;">${esc(todayRace.name)}</div>
          <div style="font-size: 12px; opacity: 0.85;">${esc(todayRace.course)} ${todayRace.surface}${todayRace.distance}m</div>
        </div>
      `);
      c.addEventListener('click', () => { state.view = 'races'; state.selectedRace = todayRace.id; setActive('races'); renderCurrent(); });
      root.appendChild(c);
    }

    root.appendChild(h(`
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-label">年間G1レース</div>
          <div class="stat-value">${totalG1}<span class="unit">レース</span></div>
          <div class="stat-sub">芝${D.races.filter(r => r.surface === '芝').length} / ダート${D.races.filter(r => r.surface === 'ダート').length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">今年開催済</div>
          <div class="stat-value">${heldThisYear}<span class="unit">レース</span></div>
          <div class="stat-sub">残り ${totalG1 - heldThisYear}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">登録 名馬</div>
          <div class="stat-value">${D.horses.length}<span class="unit">頭</span></div>
          <div class="stat-sub">通算G1勝利 ${D.horses.reduce((s,h)=>s+h.g1Wins,0)}勝</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">登録 騎手</div>
          <div class="stat-value">${D.jockeys.length}<span class="unit">名</span></div>
          <div class="stat-sub">トップ ${D.jockeys[0].name.split('.').pop()}</div>
        </div>
      </div>
    `));

    root.appendChild(h(`<div class="section-row"><h3>近日開催のG1</h3><a data-jump="races">すべて見る →</a></div>`));
    const list = h(`<div class="race-list"></div>`);
    upcoming.slice(0, 4).forEach(r => list.appendChild(raceCard(r, false)));
    root.appendChild(list);

    root.appendChild(h(`<div class="section-row"><h3>名馬ランキング</h3><a data-jump="horses">すべて見る →</a></div>`));
    const horsesTop = [...D.horses].sort((a, b) => b.g1Wins - a.g1Wins).slice(0, 3);
    horsesTop.forEach(hr => root.appendChild(horseCard(hr)));

    root.querySelectorAll('[data-jump]').forEach(el => el.addEventListener('click', () => {
      state.view = el.dataset.jump;
      setActive(el.dataset.jump);
      renderCurrent();
      window.scrollTo({ top: 0, behavior: 'instant' });
    }));
  }

  function setActive(view) {
    navBtns.forEach(b => b.classList.toggle('active', b.dataset.view === view));
  }

  // ---------- Races ----------
  function raceCard(r, isPast) {
    const card = h(`
      <div class="race-card" data-id="${r.id}">
        <div class="race-date">
          <div class="m">${r.date.getMonth()+1}月</div>
          <div class="d">${r.date.getDate()}</div>
        </div>
        <div class="race-info">
          <h3>${esc(r.name)}</h3>
          <div class="race-meta">${esc(r.course)} ・ ${r.surface}${r.distance}m ${r.dir}回り</div>
        </div>
        <div class="race-grade ${isPast ? 'past' : ''}">G1</div>
      </div>
    `);
    card.addEventListener('click', () => {
      state.selectedRace = r.id;
      if (state.view !== 'races') { state.view = 'races'; setActive('races'); }
      renderCurrent();
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    return card;
  }

  function renderRaces() {
    root.innerHTML = '';
    root.appendChild(h(`<h2 class="view-title">G1レース一覧</h2>`));
    root.appendChild(h(`<p class="view-subtitle">JRA年間24のG1レース。タップで詳細表示。</p>`));

    const filters = [
      { key: 'all',  label: 'すべて' },
      { key: 'upcoming', label: '近日' },
      { key: 'past', label: '今年開催済' },
      { key: '芝',   label: '芝' },
      { key: 'ダート', label: 'ダート' },
      { key: 'sprint', label: 'スプリント' },
      { key: 'mile', label: 'マイル' },
      { key: 'middle', label: '中距離' },
      { key: 'long', label: '長距離' },
    ];
    const chipRow = h(`<div class="chip-row"></div>`);
    filters.forEach(f => {
      const c = h(`<button class="chip ${state.raceFilter===f.key?'active':''}">${f.label}</button>`);
      c.addEventListener('click', () => { state.raceFilter = f.key; renderRaces(); });
      chipRow.appendChild(c);
    });
    root.appendChild(chipRow);

    const y = state.today.getFullYear();
    let races = D.races.map(r => {
      const t = getRaceDate(r, y);
      return { ...r, date: t >= state.today ? t : getRaceDate(r, y + 1) };
    });

    if (state.raceFilter === 'past') {
      races = D.races.map(r => ({ ...r, date: getRaceDate(r, y) })).filter(r => r.date < state.today);
    } else if (state.raceFilter === 'upcoming') {
      races = races.filter(r => r.date >= state.today);
    } else if (state.raceFilter === '芝') races = races.filter(r => r.surface === '芝');
    else if (state.raceFilter === 'ダート') races = races.filter(r => r.surface === 'ダート');
    else if (state.raceFilter === 'sprint') races = races.filter(r => r.distance <= 1400);
    else if (state.raceFilter === 'mile') races = races.filter(r => r.distance > 1400 && r.distance <= 1800);
    else if (state.raceFilter === 'middle') races = races.filter(r => r.distance > 1800 && r.distance < 2500);
    else if (state.raceFilter === 'long') races = races.filter(r => r.distance >= 2500);

    races.sort((a, b) => a.date - b.date);

    if (!races.length) {
      root.appendChild(h(`<div class="empty-state"><div class="icon">🏇</div>該当するレースがありません</div>`));
      return;
    }

    const list = h(`<div class="race-list"></div>`);
    races.forEach(r => list.appendChild(raceCard(r, r.date < state.today)));
    root.appendChild(list);
  }

  function renderRaceDetail() {
    const race = D.races.find(r => r.id === state.selectedRace);
    if (!race) { state.selectedRace = null; renderCurrent(); return; }
    const y = state.today.getFullYear();
    const date = getRaceDate(race, y);
    const isPast = date < state.today;
    const past = D.pastResults[race.id] || [];
    const trend = D.trends[race.id];

    root.innerHTML = '';
    const back = h(`<button class="detail-back">← レース一覧に戻る</button>`);
    back.addEventListener('click', () => { state.selectedRace = null; renderCurrent(); });
    root.appendChild(back);

    root.appendChild(h(`
      <div class="hero" style="margin-bottom: 12px;">
        <span class="hero-tag">${race.surface === 'ダート' ? 'DIRT' : 'TURF'} G1</span>
        <h2 style="margin-top: 8px;">${esc(race.name)}</h2>
        <div class="hero-meta">
          <span>${date.getMonth()+1}月${date.getDate()}日</span>
          <span>${esc(race.course)}競馬場</span>
          <span>${race.distance}m ${race.dir}回り</span>
        </div>
        <div class="hero-meta" style="margin-top: 6px; opacity: 0.85;">
          <span>${esc(race.nameEn)}</span>
          <span>創設 ${race.established}</span>
        </div>
      </div>
    `));

    if (trend) {
      root.appendChild(h(`
        <div class="card">
          <p class="card-title">レース傾向</p>
          <p style="font-size: 13px; line-height: 1.6; margin: 0 0 12px;">${esc(trend.keyTrend)}</p>
          <div class="stat-grid" style="margin: 0;">
            <div class="stat-card">
              <div class="stat-label">1番人気勝率</div>
              <div class="stat-value">${trend.favoriteWinRate}<span class="unit">%</span></div>
              <div class="stat-sub">過去10年</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">平均勝ち馬オッズ</div>
              <div class="stat-value">${trend.avgWinOdds}<span class="unit">倍</span></div>
              <div class="stat-sub">過去10年</div>
            </div>
          </div>
        </div>
      `));

      const biasCard = h(`<div class="card"><p class="card-title">脚質別 連対率</p><div class="bar-list"></div></div>`);
      const biasList = biasCard.querySelector('.bar-list');
      const maxBias = Math.max(...Object.values(trend.bias));
      Object.entries(trend.bias).forEach(([k, v]) => {
        biasList.appendChild(h(`
          <div class="bar-row">
            <div class="bar-label">${k}</div>
            <div class="bar-track"><div class="bar-fill" style="width: ${(v / maxBias * 100).toFixed(0)}%"></div></div>
            <div class="bar-val">${v}%</div>
          </div>
        `));
      });
      root.appendChild(biasCard);

      const keyCard = h(`<div class="card"><p class="card-title">注目ポイント</p></div>`);
      trend.keyFactor.forEach(k => {
        keyCard.appendChild(h(`<div style="display:flex; align-items:center; gap:8px; padding:6px 0; font-size:13.5px;"><span style="color: var(--accent-2);">▸</span>${esc(k)}</div>`));
      });
      root.appendChild(keyCard);
    }

    if (past.length) {
      const histCard = h(`<div class="card"><p class="card-title">過去の優勝馬</p></div>`);
      past.forEach(p => {
        const tbl = h(`
          <div style="margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border);">
            <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom: 6px;">
              <strong style="font-size: 14px;">${p.year}年</strong>
              <span style="font-size: 11px; color: var(--text-muted);">勝ちタイム ${p.results[0].time}</span>
            </div>
            <table class="results-table">
              <thead><tr><th>着</th><th>馬名</th><th>騎手</th><th style="text-align:right;">人気</th></tr></thead>
              <tbody>
                ${p.results.map((r, i) => `
                  <tr>
                    <td class="rank rank-${r.rank}">${r.rank}</td>
                    <td><strong>${esc(r.horse)}</strong></td>
                    <td>${esc(r.jockey)}</td>
                    <td style="text-align:right; color: var(--text-muted);">${r.odds.toFixed(1)}倍</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `);
        histCard.appendChild(tbl);
      });
      // first separator removal
      const firstSep = histCard.querySelector('div[style*="border-top"]');
      if (firstSep) firstSep.style.borderTop = '0';
      root.appendChild(histCard);
    } else {
      root.appendChild(h(`<div class="card"><p class="card-title">過去データ</p><div class="empty-state" style="padding: 20px 0;"><div class="icon">📋</div>このレースの履歴データは準備中</div></div>`));
    }
  }

  // ---------- Horses ----------
  function horseCard(h_) {
    const card = h(`
      <div class="horse-card" data-id="${h_.id}">
        <div>
          <h3>${esc(h_.name)}</h3>
          <div class="horse-meta">
            ${esc(h_.sex)} ・ ${h_.born}年生 ・ 父 ${esc(h_.sire)}<br>
            ${h_.starts}戦 ${h_.wins}勝 / 賞金 ${(h_.earnings / 100000000).toFixed(1)}億円
          </div>
          <div class="horse-tags">
            ${h_.tags.slice(0, 3).map(t => `<span class="horse-tag">${esc(t)}</span>`).join('')}
          </div>
        </div>
        <div class="horse-record">
          <div class="big">${h_.g1Wins}</div>
          <div>G1勝</div>
        </div>
      </div>
    `);
    card.addEventListener('click', () => {
      state.selectedHorse = h_.id;
      if (state.view !== 'horses') { state.view = 'horses'; setActive('horses'); }
      renderCurrent();
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
    return card;
  }

  function renderHorses() {
    root.innerHTML = '';
    root.appendChild(h(`<h2 class="view-title">歴代の名馬</h2>`));
    root.appendChild(h(`<p class="view-subtitle">G1で歴史を作った名馬たちの記録</p>`));

    const filters = [
      { key: 'all',     label: 'すべて' },
      { key: 'active',  label: '現役/最近' },
      { key: 'legend',  label: 'レジェンド' },
      { key: '牡',      label: '牡馬' },
      { key: '牝',      label: '牝馬' },
      { key: 'g1_5',    label: 'G1 5勝以上' },
    ];
    const chipRow = h(`<div class="chip-row"></div>`);
    filters.forEach(f => {
      const c = h(`<button class="chip ${state.horseFilter===f.key?'active':''}">${f.label}</button>`);
      c.addEventListener('click', () => { state.horseFilter = f.key; renderHorses(); });
      chipRow.appendChild(c);
    });
    root.appendChild(chipRow);

    let horses = [...D.horses];
    if (state.horseFilter === 'active') horses = horses.filter(x => x.born >= 2018);
    else if (state.horseFilter === 'legend') horses = horses.filter(x => x.born < 2018);
    else if (state.horseFilter === '牡') horses = horses.filter(x => x.sex === '牡');
    else if (state.horseFilter === '牝') horses = horses.filter(x => x.sex === '牝');
    else if (state.horseFilter === 'g1_5') horses = horses.filter(x => x.g1Wins >= 5);

    horses.sort((a, b) => b.g1Wins - a.g1Wins);

    if (!horses.length) {
      root.appendChild(h(`<div class="empty-state"><div class="icon">🐎</div>該当する馬がいません</div>`));
      return;
    }

    horses.forEach(hr => root.appendChild(horseCard(hr)));
  }

  function renderHorseDetail() {
    const horse = D.horses.find(x => x.id === state.selectedHorse);
    if (!horse) { state.selectedHorse = null; renderCurrent(); return; }

    root.innerHTML = '';
    const back = h(`<button class="detail-back">← 名馬一覧に戻る</button>`);
    back.addEventListener('click', () => { state.selectedHorse = null; renderCurrent(); });
    root.appendChild(back);

    root.appendChild(h(`
      <div class="hero" style="margin-bottom: 12px;">
        <span class="hero-tag">LEGEND</span>
        <h2 style="margin-top: 8px;">${esc(horse.name)}</h2>
        <div class="hero-meta">
          <span>${esc(horse.sex)}</span>
          <span>${horse.born}年生</span>
          <span>${esc(horse.nameEn)}</span>
        </div>
        <div class="hero-countdown">
          <div class="countdown-box">
            <div class="countdown-num">${horse.starts}</div>
            <div class="countdown-lbl">出走</div>
          </div>
          <div class="countdown-box">
            <div class="countdown-num">${horse.wins}</div>
            <div class="countdown-lbl">勝利</div>
          </div>
          <div class="countdown-box">
            <div class="countdown-num">${horse.g1Wins}</div>
            <div class="countdown-lbl">G1勝</div>
          </div>
          <div class="countdown-box">
            <div class="countdown-num">${(horse.earnings/100000000).toFixed(1)}</div>
            <div class="countdown-lbl">億円</div>
          </div>
        </div>
      </div>
    `));

    root.appendChild(h(`
      <div class="card">
        <p class="card-title">プロフィール</p>
        <p style="font-size: 13.5px; line-height: 1.7; margin: 0;">${esc(horse.bio)}</p>
        <div class="horse-tags" style="margin-top: 12px;">
          ${horse.tags.map(t => `<span class="horse-tag">${esc(t)}</span>`).join('')}
        </div>
      </div>
    `));

    root.appendChild(h(`
      <div class="card">
        <p class="card-title">能力レーダー</p>
        <div class="chart-wrap"><canvas id="radar"></canvas></div>
      </div>
    `));

    setTimeout(() => {
      const ctx = document.getElementById('radar');
      if (!ctx || !window.Chart) return;
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      const txt = dark ? '#e8efea' : '#1a1f1c';
      const grid = dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
      state.chart = new Chart(ctx, {
        type: 'radar',
        data: {
          labels: ['スピード', 'スタミナ', 'パワー', 'ダート', 'メンタル'],
          datasets: [{
            label: horse.name,
            data: [horse.grades.speed, horse.grades.stamina, horse.grades.power, horse.grades.dirt, horse.grades.mental],
            backgroundColor: 'rgba(212,160,23,0.25)',
            borderColor: '#d4a017',
            borderWidth: 2,
            pointBackgroundColor: '#0a4d2e',
            pointBorderColor: '#fff',
            pointRadius: 4,
          }],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            r: {
              min: 0, max: 100,
              ticks: { display: false, stepSize: 25 },
              grid: { color: grid },
              angleLines: { color: grid },
              pointLabels: { color: txt, font: { size: 12, weight: '600' } },
            },
          },
        },
      });
    }, 60);

    root.appendChild(h(`
      <div class="card">
        <p class="card-title">血統</p>
        <div class="lineage">${esc(horse.name)}
├─ 父: ${esc(horse.sire)}
└─ 母: ${esc(horse.dam)}
   └─ 母父: ${esc(horse.damSire)}</div>
        <p style="font-size: 12px; color: var(--text-muted); margin-top: 12px; margin-bottom: 0;">
          調教師: ${esc(horse.trainer)} ・ 馬主: ${esc(horse.owner)}
        </p>
      </div>
    `));

    const races = h(`<div class="card"><p class="card-title">G1戦績</p></div>`);
    const tbl = h(`<table class="results-table">
      <thead><tr><th>年</th><th>レース</th><th style="text-align:right;">着順</th></tr></thead>
      <tbody></tbody>
    </table>`);
    const tb = tbl.querySelector('tbody');
    horse.races.forEach(r => {
      tb.appendChild(h(`<tr>
        <td style="color: var(--text-muted);">${r.year}</td>
        <td><strong>${esc(r.race)}</strong></td>
        <td class="rank rank-${r.rank}" style="text-align:right;">${r.rank}着</td>
      </tr>`));
    });
    races.appendChild(tbl);
    root.appendChild(races);
  }

  // ---------- Analyze ----------
  function renderAnalyze() {
    root.innerHTML = '';
    root.appendChild(h(`<h2 class="view-title">統計分析</h2>`));
    root.appendChild(h(`<p class="view-subtitle">騎手・種牡馬・脚質・コース傾向データ</p>`));

    // Jockey ranking
    const jcard = h(`<div class="card"><p class="card-title">G1リーディング騎手</p></div>`);
    const jbarMax = Math.max(...D.jockeys.map(j => j.g1Wins));
    const jlist = h(`<div class="bar-list"></div>`);
    D.jockeys.slice().sort((a, b) => b.g1Wins - a.g1Wins).forEach(j => {
      jlist.appendChild(h(`
        <div class="bar-row">
          <div class="bar-label">${j.country} ${esc(j.name)}</div>
          <div class="bar-track"><div class="bar-fill" style="width: ${(j.g1Wins / jbarMax * 100).toFixed(0)}%"></div></div>
          <div class="bar-val">${j.g1Wins}勝</div>
        </div>
      `));
    });
    jcard.appendChild(jlist);
    root.appendChild(jcard);

    // Win rate chart
    root.appendChild(h(`
      <div class="card">
        <p class="card-title">騎手 勝率 vs 連対率</p>
        <div class="chart-wrap"><canvas id="jchart"></canvas></div>
      </div>
    `));

    // Sire stats
    const scard = h(`<div class="card"><p class="card-title">種牡馬 G1産駒勝利数</p></div>`);
    const sbarMax = Math.max(...D.sires.map(s => s.totalG1));
    const slist = h(`<div class="bar-list"></div>`);
    D.sires.slice().sort((a, b) => b.totalG1 - a.totalG1).forEach(s => {
      slist.appendChild(h(`
        <div class="bar-row">
          <div class="bar-label">${esc(s.name)}</div>
          <div class="bar-track"><div class="bar-fill" style="width: ${(s.totalG1 / sbarMax * 100).toFixed(0)}%"></div></div>
          <div class="bar-val">${s.totalG1}勝</div>
        </div>
      `));
    });
    scard.appendChild(slist);
    root.appendChild(scard);

    // Course distribution
    const courses = D.races.reduce((acc, r) => { acc[r.course] = (acc[r.course] || 0) + 1; return acc; }, {});
    root.appendChild(h(`
      <div class="card">
        <p class="card-title">競馬場別 G1開催数</p>
        <div class="chart-wrap"><canvas id="cchart"></canvas></div>
      </div>
    `));

    // Distance distribution
    root.appendChild(h(`
      <div class="card">
        <p class="card-title">距離カテゴリ分布</p>
        <div class="bar-list" id="dist-bars"></div>
      </div>
    `));

    setTimeout(() => {
      const dark = document.documentElement.getAttribute('data-theme') === 'dark';
      const txt = dark ? '#e8efea' : '#1a1f1c';
      const grid = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';

      const jc = document.getElementById('jchart');
      if (jc && window.Chart) {
        new Chart(jc, {
          type: 'bar',
          data: {
            labels: D.jockeys.map(j => j.name),
            datasets: [
              { label: '勝率(%)', data: D.jockeys.map(j => j.winRate), backgroundColor: '#0a4d2e' },
              { label: '連対率(%)', data: D.jockeys.map(j => j.plRate), backgroundColor: '#d4a017' },
            ],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { labels: { color: txt, font: { size: 11 } } } },
            scales: {
              x: { ticks: { color: txt, font: { size: 10 } }, grid: { color: grid } },
              y: { beginAtZero: true, ticks: { color: txt }, grid: { color: grid } },
            },
          },
        });
      }

      const cc = document.getElementById('cchart');
      if (cc && window.Chart) {
        new Chart(cc, {
          type: 'doughnut',
          data: {
            labels: Object.keys(courses),
            datasets: [{
              data: Object.values(courses),
              backgroundColor: ['#0a4d2e', '#d4a017', '#2d8f5a', '#c4302b', '#73916a', '#b8860b', '#1f5c3f'],
              borderWidth: 0,
            }],
          },
          options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { color: txt, font: { size: 11 }, padding: 8 } } },
          },
        });
      }

      const dist = { 'スプリント(≤1400)': 0, 'マイル(1500-1800)': 0, '中距離(1900-2400)': 0, '長距離(2500+)': 0 };
      D.races.forEach(r => {
        if (r.distance <= 1400) dist['スプリント(≤1400)']++;
        else if (r.distance <= 1800) dist['マイル(1500-1800)']++;
        else if (r.distance < 2500) dist['中距離(1900-2400)']++;
        else dist['長距離(2500+)']++;
      });
      const db = document.getElementById('dist-bars');
      if (db) {
        const max = Math.max(...Object.values(dist));
        Object.entries(dist).forEach(([k, v]) => {
          db.appendChild(h(`
            <div class="bar-row">
              <div class="bar-label" style="font-size: 11px;">${k}</div>
              <div class="bar-track"><div class="bar-fill" style="width: ${(v/max*100).toFixed(0)}%"></div></div>
              <div class="bar-val">${v}</div>
            </div>
          `));
        });
      }
    }, 60);
  }

  // ---------- Predict / Race Analyzer ----------
  function loadEntries(raceId) {
    const saved = localStorage.getItem('g1-entries-' + raceId);
    if (saved) {
      try { return JSON.parse(saved); } catch { /* fall through */ }
    }
    const preset = D.entries[raceId];
    return preset ? JSON.parse(JSON.stringify(preset.entries)) : [];
  }
  function saveEntries(raceId, entries) {
    localStorage.setItem('g1-entries-' + raceId, JSON.stringify(entries));
  }
  function resetEntries(raceId) {
    localStorage.removeItem('g1-entries-' + raceId);
  }

  function scoreHorse(horse, race, trend) {
    let score = 50;
    const f = [];

    // 近走 (直近3走平均)
    const recent = horse.recent || [];
    const recentScore = recent.length ? recent.reduce((s, r) => {
      if (r === 1) return s + 15;
      if (r === 2) return s + 10;
      if (r === 3) return s + 6;
      if (r <= 5) return s + 1;
      return s - 6;
    }, 0) / recent.length : 0;
    const recDelta = Math.round(recentScore);
    score += recDelta;
    f.push({ k: '近走', v: recDelta, n: `直近3走: ${recent.join('-') || '不明'}` });

    // 騎手
    const j = D.jockeyMap[horse.jockey];
    const jDelta = j ? Math.round((j.winRate - 12) * 0.7) : 0;
    score += jDelta;
    f.push({ k: '騎手', v: jDelta, n: j ? `${horse.jockey} 勝率${j.winRate}%` : '騎手データなし' });

    // 脚質バイアス
    if (trend && trend.bias[horse.style] != null) {
      const bias = trend.bias[horse.style];
      const sDelta = Math.round((bias - 25) * 0.6);
      score += sDelta;
      f.push({ k: '脚質', v: sDelta, n: `${horse.style} レース連対率${bias}%` });
    }

    // コース適性
    const cDelta = horse.course === 'high' ? 12 : horse.course === 'mid' ? 4 : -7;
    score += cDelta;
    f.push({ k: 'コース', v: cDelta, n: horse.course === 'high' ? '当該コース勝ち鞍' : horse.course === 'mid' ? '連対経験あり' : '苦手 / 未経験' });

    // 斤量補正
    const wDelta = horse.weight >= 58 ? -5 : horse.weight >= 57 ? -2 : horse.weight <= 54 ? 3 : 0;
    if (wDelta !== 0) {
      score += wDelta;
      f.push({ k: '斤量', v: wDelta, n: `${horse.weight}kg` });
    }

    // 枠順 (大外不利、長距離は内有利)
    if (race && horse.post) {
      let pDelta = 0;
      if (horse.post >= 8 && race.distance <= 1600) pDelta -= 2;
      if (horse.post === 1 && race.distance >= 2500) pDelta += 2;
      if (horse.post >= 7 && race.distance >= 3000) pDelta -= 3;
      if (pDelta !== 0) {
        score += pDelta;
        f.push({ k: '枠順', v: pDelta, n: `${horse.post}枠` });
      }
    }

    // 人気 (市場の評価を加味)
    const popDelta = horse.popular <= 1 ? 8 : horse.popular <= 3 ? 4 : horse.popular <= 6 ? 0 : horse.popular <= 10 ? -3 : -6;
    score += popDelta;
    f.push({ k: '人気', v: popDelta, n: `想定${horse.popular}番人気` });

    return { score: Math.max(5, Math.min(98, score)), factors: f };
  }

  function calcAnalysis(entries, race) {
    const trend = D.trends[race.id];
    const scored = entries.map(h => {
      const { score, factors } = scoreHorse(h, race, trend);
      return { ...h, score, factors };
    });
    // softmax-ish 推定確率
    const temp = 8;
    const exps = scored.map(s => Math.exp(s.score / temp));
    const sum = exps.reduce((a, b) => a + b, 0);
    scored.forEach((s, i) => {
      s.prob = exps[i] / sum;
      s.ev = s.odds ? +(s.prob * s.odds - 1).toFixed(2) : null;
    });
    scored.sort((a, b) => b.score - a.score);
    const marks = ['◎', '○', '▲', '△', '☆', '✕'];
    scored.forEach((s, i) => { s.mark = marks[i] || ''; s._rankIdx = i; });
    return scored;
  }

  function suggestBets(ranked) {
    if (ranked.length < 3) return [];
    const [a, b, c, d, e] = ranked;
    const bets = [];
    bets.push({ type: '単勝', combo: `${a.num} ${a.name}`, ev: a.ev, conf: a.score >= 75 ? '強' : a.score >= 65 ? '中' : '弱' });
    bets.push({ type: '複勝', combo: `${a.num} ${a.name}`, ev: a.ev != null ? +(a.ev * 0.55).toFixed(2) : null, conf: '安定' });
    bets.push({ type: '馬連', combo: `${a.num}-${b.num}`, ev: null, conf: a.score - b.score < 8 ? '強' : '中' });
    bets.push({ type: 'ワイド', combo: `${a.num}-${b.num} / ${a.num}-${c.num}`, ev: null, conf: '中' });
    if (d) bets.push({ type: '三連複', combo: `${a.num}-${b.num}-${c.num} / ${a.num}-${b.num}-${d.num}`, ev: null, conf: '中' });
    // 妙味馬
    const value = ranked.slice(2).filter(h => h.ev != null && h.ev > 0.5).sort((a, b) => b.ev - a.ev)[0];
    if (value) {
      bets.push({ type: '穴', combo: `${value.num} ${value.name} (EV ${value.ev.toFixed(2)})`, ev: value.ev, conf: '妙味' });
    }
    return bets;
  }

  // 馬の評価コメントを自動生成 (初心者向け平易な文章)
  function horseComment(horse, rank) {
    const positives = horse.factors.filter(x => x.v > 3).sort((a, b) => b.v - a.v);
    const negatives = horse.factors.filter(x => x.v < -2).sort((a, b) => a.v - b.v);
    const top = positives[0];
    const neg = negatives[0];

    const reasonByKey = {
      '近走': '近走の成績が安定',
      '騎手': 'リーディング上位の騎手が騎乗',
      '脚質': 'このレースで有利な脚質',
      'コース': '当該コースの実績あり',
      '人気': '市場の評価が高い',
      '斤量': '斤量も恵まれる',
      '枠順': '枠順の利あり',
    };
    const negByKey = {
      '近走': '近走振るわず',
      '騎手': '騎手の信頼度がやや低い',
      '脚質': '脚質がレース傾向と合わない',
      'コース': 'コース適性に不安',
      '人気': '人気的に過小評価の可能性',
      '斤量': '斤量がやや厳しい',
      '枠順': '枠順が不利',
    };
    const r = top ? (reasonByKey[top.k] || '能力面で評価') : '評価材料は限定的';
    const n = neg ? (negByKey[neg.k] || '不安要素も') : null;

    if (rank === 0) return `${r}。馬券の軸として推奨できる本命候補。`;
    if (rank === 1) return `${r}。◎の相手として連系で押さえたい対抗一番手。`;
    if (rank === 2) return `${r}。三連系の単穴として面白い存在。`;
    if (horse.ev != null && horse.ev > 0.4 && rank < 8) return `想定オッズに対し能力が見合う穴馬候補。妙味あり。`;
    if (rank < 6) return n ? `${r}な反面、${n}。連下までの押さえなら。` : `押さえの一頭として検討可。`;
    return n ? `${n}で評価は厳しめ。買い対象外でも可。` : `評価は厳しめ。`;
  }

  function renderPredict() {
    root.innerHTML = '';

    // Race selector
    const upcoming = upcomingRaces(10);
    const presetIds = Object.keys(D.entries);
    const orderedIds = [...new Set([...presetIds, ...upcoming.map(r => r.id)])];
    if (!state.predictRaceId) state.predictRaceId = orderedIds[0];
    if (!state.predictSort) state.predictSort = 'popular';

    const race = D.races.find(r => r.id === state.predictRaceId);
    const entries = loadEntries(state.predictRaceId);

    // Title + race header
    root.appendChild(h(`<h2 class="view-title" style="margin-bottom: 4px;">買い目分析</h2>`));
    root.appendChild(h(`<p class="view-subtitle" style="margin-bottom: 12px;">出走馬を分析して、初心者でも選びやすく</p>`));

    // Race selector (compact)
    const raceSel = h(`<div class="card" style="padding: 10px 12px; margin-bottom: 10px;">
      <div class="field" style="margin: 0;">
        <label for="pa-race" style="font-size: 10px; margin-bottom: 2px;">対象レース</label>
        <select id="pa-race" style="padding: 8px 10px; font-size: 13px;">
          ${orderedIds.map(id => {
            const r = D.races.find(x => x.id === id);
            if (!r) return '';
            const preset = D.entries[id] ? ' ⭐プリセット' : '';
            return `<option value="${id}" ${id === state.predictRaceId ? 'selected' : ''}>${esc(r.name)} (${r.month}/${r.day})${preset}</option>`;
          }).join('')}
        </select>
      </div>
    </div>`);
    root.appendChild(raceSel);
    document.getElementById('pa-race').addEventListener('change', e => {
      state.predictRaceId = e.target.value;
      renderPredict();
    });

    if (!entries.length) {
      root.appendChild(h(`<div class="card"><div class="empty-state" style="padding: 24px 8px;"><div class="icon">🐴</div>このレースは出走馬データ未登録です。<br>下の「馬を追加」から登録してください。</div></div>`));
      const addBtn = h(`<button class="btn" style="margin-bottom: 12px;">＋ 馬を追加</button>`);
      addBtn.addEventListener('click', () => addNewHorse(entries));
      root.appendChild(addBtn);
      return;
    }

    // === 自動分析 ===
    const ranked = calcAnalysis(entries, race);

    // === Hero: 推奨買い目 ===
    const top4 = ranked.slice(0, 4);
    const hero = h(`<div class="card pick-hero">
      <div class="pick-hero-head">
        <div>
          <p class="pick-hero-tag">🎯 今日のおすすめ</p>
          <h3 class="pick-hero-title">${esc(race.name)}</h3>
        </div>
        <div class="pick-hero-meta">${race.distance}m<br>${esc(race.surface)}</div>
      </div>
      <div class="pick-grid"></div>
    </div>`);
    const pickGrid = hero.querySelector('.pick-grid');
    const markColors = { '◎': '#d4a017', '○': '#c0c5c8', '▲': '#c8893f', '△': 'rgba(255,255,255,0.5)' };
    const markLabels = { '◎': '本命', '○': '対抗', '▲': '単穴', '△': '連下' };
    top4.forEach(h_ => {
      const c = markColors[h_.mark] || 'rgba(255,255,255,0.4)';
      pickGrid.appendChild(h(`<div class="pick-item">
        <div class="pick-mark" style="color: ${c};">${h_.mark}</div>
        <div class="pick-info">
          <div class="pick-label">${markLabels[h_.mark] || ''}</div>
          <div class="pick-name">${h_.num}. ${esc(h_.name)}</div>
        </div>
      </div>`));
    });
    root.appendChild(hero);

    // === Bet recommendations card ===
    const bets = suggestBets(ranked);
    const betCard = h(`<div class="card">
      <p class="card-title">💰 推奨買い目</p>
      <div class="bet-list"></div>
    </div>`);
    const betList = betCard.querySelector('.bet-list');
    bets.forEach(b => {
      betList.appendChild(h(`<div class="bet-row">
        <div class="bet-type">${esc(b.type)}</div>
        <div class="bet-combo">${esc(b.combo)}</div>
        <div class="bet-conf bet-conf-${esc(b.conf)}">${esc(b.conf)}</div>
      </div>`));
    });
    root.appendChild(betCard);

    // === Legend (初心者向け) ===
    root.appendChild(h(`<div class="legend-card">
      <div class="legend-row"><span class="legend-mark" style="color:#d4a017;">◎</span><span>本命 — 軸にする最有力馬</span></div>
      <div class="legend-row"><span class="legend-mark" style="color:#c0c5c8;">○</span><span>対抗 — 本命の相手</span></div>
      <div class="legend-row"><span class="legend-mark" style="color:#c8893f;">▲</span><span>単穴 — 一発ある一頭</span></div>
      <div class="legend-row"><span class="legend-mark" style="color:#888;">△</span><span>連下 — 三連系で押さえ</span></div>
    </div>`));

    // === Sort tabs ===
    const sortRow = h(`<div class="chip-row" style="margin: 14px 0 8px;">
      <button class="chip ${state.predictSort==='popular'?'active':''}" data-sort="popular">人気順</button>
      <button class="chip ${state.predictSort==='score'?'active':''}" data-sort="score">おすすめ順</button>
      <button class="chip ${state.predictSort==='odds'?'active':''}" data-sort="odds">オッズ順</button>
      <button class="chip ${state.predictSort==='value'?'active':''}" data-sort="value">妙味順</button>
    </div>`);
    sortRow.querySelectorAll('[data-sort]').forEach(b => b.addEventListener('click', () => {
      state.predictSort = b.dataset.sort;
      renderPredict();
    }));
    root.appendChild(sortRow);

    // === Horse cards ===
    const sorted = [...ranked];
    if (state.predictSort === 'popular') sorted.sort((a, b) => a.popular - b.popular);
    else if (state.predictSort === 'odds') sorted.sort((a, b) => (a.odds || 999) - (b.odds || 999));
    else if (state.predictSort === 'value') sorted.sort((a, b) => (b.ev || -999) - (a.ev || -999));
    // 'score' is the default order from ranked

    const listWrap = h(`<div class="horse-grid"></div>`);
    sorted.forEach((h_) => listWrap.appendChild(horseAnalysisCard(h_, entries)));
    root.appendChild(listWrap);

    // === Edit / Add (collapsed) ===
    const editToggle = h(`<button class="btn secondary edit-toggle" style="margin-top: 16px;">⚙️ 詳細編集モード ▾</button>`);
    const editPanel = h(`<div class="card edit-panel" hidden style="margin-top: 8px;">
      <p class="card-title">出走馬の編集</p>
      <p style="font-size: 12px; color: var(--text-muted); margin: 0 0 12px;">各馬をタップして編集。値を変えると自動で再分析されます。</p>
    </div>`);
    entries.forEach((horse, i) => editPanel.appendChild(entryRow(horse, i, entries)));
    const editActions = h(`<div style="display:flex; gap: 8px; margin-top: 12px; flex-wrap: wrap;">
      <button class="btn" id="pa-add" style="flex: 1 1 140px; padding: 10px; font-size: 13px;">＋ 馬を追加</button>
      ${D.entries[state.predictRaceId] ? `<button class="btn secondary" id="pa-reset" style="flex: 1 1 140px; padding: 10px; font-size: 13px;">↻ プリセットに戻す</button>` : ''}
    </div>`);
    editPanel.appendChild(editActions);

    editToggle.addEventListener('click', () => {
      const open = !editPanel.hidden;
      editPanel.hidden = open;
      editToggle.textContent = open ? '⚙️ 詳細編集モード ▾' : '⚙️ 詳細編集モード ▴';
    });
    root.appendChild(editToggle);
    root.appendChild(editPanel);

    editPanel.querySelector('#pa-add').addEventListener('click', () => addNewHorse(entries));
    const resetBtn = editPanel.querySelector('#pa-reset');
    if (resetBtn) resetBtn.addEventListener('click', () => {
      if (confirm('編集をリセットしてプリセットに戻しますか？')) {
        resetEntries(state.predictRaceId);
        renderPredict();
      }
    });

    root.appendChild(h(`<div class="note">⚠️ スコアと買い目は過去のG1傾向に基づく簡易シミュレーションです。実際の馬券購入は自己責任でお願いします。</div>`));
  }

  function addNewHorse(entries) {
    const next = {
      post: Math.min(8, Math.floor(entries.length / 2) + 1),
      num: entries.length + 1,
      name: `馬${entries.length + 1}`,
      sex: '牡', age: 4,
      jockey: D.jockeys[0].name,
      weight: 56,
      popular: entries.length + 1,
      odds: 10,
      style: '差し',
      recent: [3, 5, 3],
      course: 'mid',
    };
    entries.push(next);
    saveEntries(state.predictRaceId, entries);
    renderPredict();
  }

  function horseAnalysisCard(horse, allEntries) {
    const markColor = {
      '◎': 'var(--accent-2)',
      '○': '#9aa1a4',
      '▲': '#c8893f',
      '△': 'var(--text-muted)',
      '☆': '#8a6fb8',
      '✕': 'var(--text-muted)',
    }[horse.mark] || 'var(--text-muted)';
    const markLabel = {
      '◎': '本命', '○': '対抗', '▲': '単穴', '△': '連下', '☆': '注目', '✕': '消し',
    }[horse.mark] || '';

    const comment = horseComment(horse, [...allEntries].sort((a,b) => 0).indexOf(horse));
    // simpler: use the score rank as already in horse
    const rankIdx = horse._rankIdx ?? 99;
    const cmt = horseComment(horse, rankIdx);

    const evBadge = horse.ev != null && horse.ev > 0.3
      ? `<span class="ev-badge">💎 妙味 EV+${horse.ev.toFixed(2)}</span>`
      : '';

    const popClass = horse.popular <= 3 ? 'pop-top' : horse.popular <= 6 ? 'pop-mid' : 'pop-low';

    const card = h(`<div class="horse-analyze">
      <div class="ha-top">
        <div class="ha-mark" style="color: ${markColor};">
          <div class="ha-mark-char">${horse.mark || '−'}</div>
          ${markLabel ? `<div class="ha-mark-label">${markLabel}</div>` : ''}
        </div>
        <div class="ha-body">
          <div class="ha-row1">
            <span class="ha-popular ${popClass}">${horse.popular}番人気</span>
            <span class="ha-num">${horse.num}番</span>
          </div>
          <div class="ha-name">${esc(horse.name)}</div>
          <div class="ha-meta">${esc(horse.sex || '')}${horse.age || ''} ・ ${esc(horse.jockey)} ・ ${horse.weight}kg</div>
        </div>
        <div class="ha-odds">
          ${horse.odds ? `<div class="ha-odds-val">${horse.odds.toFixed(1)}<span class="ha-odds-unit">倍</span></div>` : ''}
          <div class="ha-odds-lbl">想定オッズ</div>
        </div>
      </div>
      <div class="ha-comment">💬 ${esc(cmt)}</div>
      <div class="ha-stats">
        <div class="ha-stat">
          <div class="ha-stat-val">${horse.score}</div>
          <div class="ha-stat-lbl">スコア</div>
        </div>
        <div class="ha-stat">
          <div class="ha-stat-val">${(horse.prob * 100).toFixed(1)}<span class="ha-stat-unit">%</span></div>
          <div class="ha-stat-lbl">推定勝率</div>
        </div>
        <div class="ha-stat">
          <div class="ha-stat-val">${(horse.recent || []).join('-') || '−'}</div>
          <div class="ha-stat-lbl">直近3走</div>
        </div>
      </div>
      ${evBadge}
    </div>`);
    return card;
  }

  function entryRow(horse, idx, allEntries) {
    const row = h(`<div class="entry-row" data-idx="${idx}">
      <div class="entry-head">
        <div class="entry-num">${horse.num}</div>
        <div class="entry-main">
          <div class="entry-name">${esc(horse.name)}</div>
          <div class="entry-meta">${esc(horse.jockey)} ・ ${horse.weight}kg ・ ${esc(horse.style)} ・ 想定${horse.popular}人気</div>
        </div>
        <button class="entry-expand">▾</button>
      </div>
      <div class="entry-edit" hidden>
        <div class="edit-grid">
          <div class="field-mini"><label>馬名</label><input data-k="name" value="${esc(horse.name)}"></div>
          <div class="field-mini"><label>馬番</label><input data-k="num" type="number" min="1" max="18" value="${horse.num}"></div>
          <div class="field-mini"><label>枠</label><input data-k="post" type="number" min="1" max="8" value="${horse.post}"></div>
          <div class="field-mini"><label>斤量(kg)</label><input data-k="weight" type="number" min="50" max="62" step="0.5" value="${horse.weight}"></div>
          <div class="field-mini"><label>騎手</label>
            <select data-k="jockey">
              ${D.jockeys.map(j => `<option ${j.name===horse.jockey?'selected':''}>${esc(j.name)}</option>`).join('')}
              <option ${D.jockeyMap[horse.jockey]?'':'selected'}>${esc(horse.jockey)}</option>
            </select>
          </div>
          <div class="field-mini"><label>脚質</label>
            <select data-k="style">
              ${['逃げ','先行','差し','追込'].map(s => `<option ${s===horse.style?'selected':''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="field-mini"><label>想定人気</label><input data-k="popular" type="number" min="1" max="18" value="${horse.popular}"></div>
          <div class="field-mini"><label>想定オッズ</label><input data-k="odds" type="number" min="1" step="0.1" value="${horse.odds || ''}"></div>
          <div class="field-mini"><label>前走</label><input data-k="r0" type="number" min="1" max="18" value="${horse.recent[0]||3}"></div>
          <div class="field-mini"><label>前々走</label><input data-k="r1" type="number" min="1" max="18" value="${horse.recent[1]||5}"></div>
          <div class="field-mini"><label>3走前</label><input data-k="r2" type="number" min="1" max="18" value="${horse.recent[2]||3}"></div>
          <div class="field-mini"><label>コース適性</label>
            <select data-k="course">
              <option value="high" ${horse.course==='high'?'selected':''}>勝ち鞍あり</option>
              <option value="mid"  ${horse.course==='mid'?'selected':''}>連対経験</option>
              <option value="low"  ${horse.course==='low'?'selected':''}>未経験/苦手</option>
            </select>
          </div>
        </div>
        <button class="btn secondary entry-delete" style="margin-top: 10px; padding: 8px; font-size: 12px; color: var(--danger);">この馬を削除</button>
      </div>
    </div>`);

    const expand = row.querySelector('.entry-expand');
    const edit = row.querySelector('.entry-edit');
    expand.addEventListener('click', () => {
      const open = !edit.hidden;
      edit.hidden = open;
      expand.textContent = open ? '▾' : '▴';
    });

    edit.querySelectorAll('[data-k]').forEach(el => {
      el.addEventListener('change', () => {
        const k = el.dataset.k;
        if (k === 'r0' || k === 'r1' || k === 'r2') {
          const i = parseInt(k.slice(1));
          horse.recent = horse.recent || [3,5,3];
          horse.recent[i] = parseInt(el.value) || 0;
        } else if (k === 'num' || k === 'post' || k === 'popular' || k === 'weight' || k === 'odds') {
          horse[k] = parseFloat(el.value) || 0;
        } else {
          horse[k] = el.value;
        }
        saveEntries(state.predictRaceId, allEntries);
        // refresh header
        row.querySelector('.entry-num').textContent = horse.num;
        row.querySelector('.entry-name').textContent = horse.name;
        row.querySelector('.entry-meta').textContent = `${horse.jockey} ・ ${horse.weight}kg ・ ${horse.style} ・ 想定${horse.popular}人気`;
      });
    });

    row.querySelector('.entry-delete').addEventListener('click', () => {
      if (!confirm(`${horse.name} を削除しますか？`)) return;
      allEntries.splice(idx, 1);
      saveEntries(state.predictRaceId, allEntries);
      renderPredict();
    });

    return row;
  }

  function renderResults(mount, ranked, race) {
    mount.innerHTML = '';

    const bets = suggestBets(ranked);

    // Buy recommendations
    const betCard = h(`<div class="card" style="background: linear-gradient(135deg, var(--accent), #073a23); color: #fff; border: 0;">
      <p style="margin: 0 0 4px; font-size: 11px; opacity: 0.8; letter-spacing: 2px; font-weight: 700;">RECOMMENDED BETS</p>
      <h3 style="margin: 0 0 10px; font-size: 18px;">${esc(race.name)} 推奨買い目</h3>
    </div>`);
    bets.forEach(b => {
      betCard.appendChild(h(`<div style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-top: 1px solid rgba(255,255,255,0.1);">
        <div>
          <div style="font-size: 12px; opacity: 0.75; font-weight: 600;">${esc(b.type)}</div>
          <div style="font-size: 14px; font-weight: 700; margin-top: 2px;">${esc(b.combo)}</div>
        </div>
        <div style="text-align: right;">
          <div style="background: rgba(255,255,255,0.15); padding: 2px 8px; border-radius: 99px; font-size: 11px; font-weight: 700;">${esc(b.conf)}</div>
          ${b.ev != null ? `<div style="font-size: 10px; opacity: 0.7; margin-top: 2px;">EV ${b.ev >= 0 ? '+' : ''}${b.ev.toFixed(2)}</div>` : ''}
        </div>
      </div>`));
    });
    mount.appendChild(betCard);

    // Ranking table
    const rankCard = h(`<div class="card"><p class="card-title">スコアランキング</p></div>`);
    const tbl = h(`<table class="results-table">
      <thead><tr><th>印</th><th>馬</th><th style="text-align:right;">勝率</th><th style="text-align:right;">スコア</th></tr></thead>
      <tbody></tbody>
    </table>`);
    const tb = tbl.querySelector('tbody');
    ranked.forEach((h_, i) => {
      const evBadge = h_.ev != null
        ? `<span style="font-size:10px; padding:1px 6px; border-radius:99px; background: ${h_.ev > 0.3 ? 'var(--accent-soft)' : 'transparent'}; color: ${h_.ev > 0.3 ? 'var(--accent)' : 'var(--text-muted)'}; margin-left:4px; font-weight:700;">EV${h_.ev>=0?'+':''}${h_.ev.toFixed(2)}</span>`
        : '';
      tb.appendChild(h(`<tr>
        <td style="font-size: 20px; font-weight: 800; width: 36px; color: ${i===0?'var(--accent-2)':i===1?'#888':i===2?'#b87333':'var(--text-muted)'};">${h_.mark || '-'}</td>
        <td>
          <div style="font-weight: 700; font-size: 13.5px;">${h_.num}. ${esc(h_.name)}</div>
          <div style="font-size: 10.5px; color: var(--text-muted); margin-top: 2px;">${esc(h_.jockey)} ・ ${h_.weight}kg</div>
        </td>
        <td style="text-align:right; color: var(--text-muted); font-size: 12px; font-variant-numeric: tabular-nums;">${(h_.prob*100).toFixed(1)}%${evBadge}</td>
        <td style="text-align:right; font-weight: 800; font-size: 15px; font-variant-numeric: tabular-nums;">${h_.score}</td>
      </tr>`));
    });
    rankCard.appendChild(tbl);
    mount.appendChild(rankCard);

    // Top 3 breakdown
    const topCard = h(`<div class="card"><p class="card-title">上位3頭 スコア内訳</p></div>`);
    ranked.slice(0, 3).forEach(h_ => {
      const head = h(`<div style="margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border);">
        <div style="display:flex; justify-content:space-between; align-items:baseline;">
          <strong style="font-size: 14px;">${h_.mark} ${esc(h_.name)}</strong>
          <span style="font-size: 12px; color: var(--accent-2); font-weight: 800;">${h_.score}点</span>
        </div>
      </div>`);
      h_.factors.forEach(f => {
        const positive = f.v > 0;
        const zero = f.v === 0;
        const color = zero ? 'var(--text-muted)' : positive ? 'var(--accent)' : 'var(--danger)';
        const sign = f.v > 0 ? '+' : '';
        head.appendChild(h(`<div style="display:flex; justify-content:space-between; font-size: 12px; padding: 3px 0;">
          <span style="color: var(--text-muted);"><strong style="color: var(--text);">${esc(f.k)}</strong> ${esc(f.n)}</span>
          <span style="color: ${color}; font-weight: 700; font-variant-numeric: tabular-nums;">${sign}${f.v}</span>
        </div>`));
      });
      topCard.appendChild(head);
    });
    const firstSep = topCard.querySelector('div[style*="border-top"]');
    if (firstSep) firstSep.style.borderTop = '0';
    mount.appendChild(topCard);
  }

  // Init
  renderCurrent();
})();

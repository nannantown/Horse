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
    return D.races
      .map(r => {
        const t = getRaceDate(r, y);
        return { ...r, date: t >= state.today ? t : getRaceDate(r, y + 1) };
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

  // ---------- Predict ----------
  function renderPredict() {
    root.innerHTML = '';
    root.appendChild(h(`<h2 class="view-title">予想スコア計算</h2>`));
    root.appendChild(h(`<p class="view-subtitle">過去G1傾向に基づく簡易スコアリング</p>`));

    const upcoming = upcomingRaces(8);
    const form = h(`<div class="card"></div>`);

    form.innerHTML = `
      <div class="field">
        <label for="p-race">対象レース</label>
        <select id="p-race">
          ${upcoming.map(r => `<option value="${r.id}">${esc(r.name)} (${r.date.getMonth()+1}/${r.date.getDate()})</option>`).join('')}
        </select>
      </div>
      <div class="field">
        <label for="p-name">馬名 (任意)</label>
        <input id="p-name" type="text" placeholder="例: ドウデュース">
      </div>
      <div class="field">
        <label for="p-popular">予想人気順</label>
        <select id="p-popular">
          <option value="1">1番人気</option>
          <option value="2">2番人気</option>
          <option value="3" selected>3番人気</option>
          <option value="5">4-5番人気</option>
          <option value="9">6-9番人気</option>
          <option value="15">10番人気以下</option>
        </select>
      </div>
      <div class="field">
        <label for="p-style">脚質</label>
        <select id="p-style">
          <option value="逃げ">逃げ</option>
          <option value="先行" selected>先行</option>
          <option value="差し">差し</option>
          <option value="追込">追込</option>
        </select>
      </div>
      <div class="field">
        <label for="p-prev">前走の着順</label>
        <select id="p-prev">
          <option value="1">1着</option>
          <option value="2" selected>2-3着</option>
          <option value="5">4-5着</option>
          <option value="10">6着以下</option>
        </select>
      </div>
      <div class="field">
        <label for="p-course">コース適性</label>
        <select id="p-course">
          <option value="high">そのコースで勝ち鞍あり</option>
          <option value="mid" selected>そのコースで連対経験</option>
          <option value="low">未経験 / 苦手</option>
        </select>
      </div>
      <button class="btn" id="p-calc">スコアを計算する</button>
    `;
    root.appendChild(form);

    const resultMount = h(`<div id="p-result"></div>`);
    root.appendChild(resultMount);

    root.appendChild(h(`
      <div class="note">
        ⚠️ 本機能は過去のG1傾向データに基づく簡易シミュレーションです。実際の馬券購入の参考にはしないでください。
      </div>
    `));

    document.getElementById('p-calc').addEventListener('click', () => {
      const raceId = document.getElementById('p-race').value;
      const horseName = document.getElementById('p-name').value || '対象馬';
      const popular = parseInt(document.getElementById('p-popular').value);
      const style = document.getElementById('p-style').value;
      const prev = parseInt(document.getElementById('p-prev').value);
      const course = document.getElementById('p-course').value;

      const trend = D.trends[raceId];
      let score = 50;
      const factors = [];

      // 人気度
      if (popular === 1) { score += 18; factors.push({ k: '人気', v: '+18', n: '1番人気はベース勝率高' }); }
      else if (popular === 2) { score += 12; factors.push({ k: '人気', v: '+12', n: '2番人気' }); }
      else if (popular === 3) { score += 6;  factors.push({ k: '人気', v: '+6',  n: '3番人気' }); }
      else if (popular === 5) { score += 0;  factors.push({ k: '人気', v: '0',   n: '中位人気' }); }
      else if (popular === 9) { score -= 6;  factors.push({ k: '人気', v: '-6',  n: '下位人気' }); }
      else                    { score -= 12; factors.push({ k: '人気', v: '-12', n: '大穴' }); }

      // 脚質バイアス
      if (trend && trend.bias[style]) {
        const bias = trend.bias[style];
        const avg = 25;
        const delta = Math.round((bias - avg) * 0.8);
        score += delta;
        factors.push({ k: '脚質', v: (delta >= 0 ? '+' : '') + delta, n: `このレースで${style}の連対率${bias}%` });
      }

      // 前走
      const prevDelta = prev === 1 ? 10 : prev === 2 ? 5 : prev === 5 ? -2 : -10;
      score += prevDelta;
      factors.push({ k: '前走', v: (prevDelta >= 0 ? '+' : '') + prevDelta, n: prev === 1 ? '前走勝利は好材料' : prev === 10 ? '前走大敗で不安' : '前走まずまず' });

      // コース適性
      const courseDelta = course === 'high' ? 12 : course === 'mid' ? 4 : -8;
      score += courseDelta;
      factors.push({ k: 'コース', v: (courseDelta >= 0 ? '+' : '') + courseDelta, n: course === 'high' ? '当該コース勝ち鞍' : course === 'low' ? '苦手な可能性' : '一定の適性' });

      score = Math.max(5, Math.min(98, score));

      const grade = score >= 85 ? 'S' : score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 45 ? 'C' : 'D';
      const comment =
        score >= 85 ? '本命候補。馬券の軸に推奨' :
        score >= 75 ? '有力。連系の軸として期待' :
        score >= 60 ? '相手として押さえたい一頭' :
        score >= 45 ? 'ヒモ穴候補。妙味あり' :
        '評価は厳しめ。消し有力';

      resultMount.innerHTML = '';
      const card = h(`
        <div class="score-card">
          <div style="font-size: 12px; opacity: 0.85; margin-bottom: 6px;">${esc(horseName)} の予想スコア</div>
          <div class="score-num">${score}</div>
          <div class="score-label">/ 100</div>
          <div class="score-grade">評価 ${grade}</div>
          <div style="margin-top: 12px; font-size: 13px;">${esc(comment)}</div>
        </div>
      `);
      resultMount.appendChild(card);

      const breakdown = h(`<div class="card"><p class="card-title">スコア内訳</p></div>`);
      factors.forEach(f => {
        const positive = f.v.startsWith('+');
        const zero = f.v === '0';
        breakdown.appendChild(h(`
          <div style="display:flex; justify-content:space-between; align-items:center; padding: 8px 0; border-bottom: 1px solid var(--border); gap: 10px;">
            <div style="flex: 1; min-width: 0;">
              <div style="font-size: 13px; font-weight: 700;">${esc(f.k)}</div>
              <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">${esc(f.n)}</div>
            </div>
            <div style="font-size: 16px; font-weight: 800; color: ${zero ? 'var(--text-muted)' : positive ? 'var(--accent)' : 'var(--danger)'}; flex-shrink: 0;">${f.v}</div>
          </div>
        `));
      });
      const last = breakdown.lastElementChild;
      if (last) last.style.borderBottom = '0';
      resultMount.appendChild(breakdown);

      window.scrollTo({ top: resultMount.offsetTop - 80, behavior: 'smooth' });
    });
  }

  // Init
  renderCurrent();
})();

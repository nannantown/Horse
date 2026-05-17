// G1 Turf Analytics — predict-only edition
(() => {
  'use strict';

  const D = window.G1_DATA;
  const root = document.getElementById('view-root');
  const todayLabel = document.getElementById('today-label');
  const themeToggle = document.getElementById('theme-toggle');

  const state = {
    today: new Date('2026-05-17T10:00:00+09:00'),
    predictRaceId: null,
    predictSort: 'popular',
  };

  // Theme
  if (localStorage.getItem('g1-theme') === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  themeToggle.addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme');
    const next = cur === 'dark' ? 'light' : 'dark';
    if (next === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    localStorage.setItem('g1-theme', next);
  });

  // Today
  const fmtDate = (d) => `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`;
  todayLabel.textContent = `${fmtDate(state.today)}（日）`;

  // ---------- Utilities ----------
  function getRaceDate(race, year) { return new Date(year, race.month - 1, race.day); }

  function upcomingRaces(n = 10) {
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

  function h(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
  function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }

  // ---------- Entries persistence ----------
  // データバージョン: プリセットを更新したらこの番号を上げる(古いlocalStorageを無視)
  const ENTRIES_VERSION = 'v3';
  function entriesKey(raceId) { return `g1-entries-${ENTRIES_VERSION}-${raceId}`; }
  function loadEntries(raceId) {
    const saved = localStorage.getItem(entriesKey(raceId));
    if (saved) { try { return JSON.parse(saved); } catch { /* */ } }
    // Clean up old version keys
    Object.keys(localStorage).filter(k => k.startsWith('g1-entries-') && !k.includes(ENTRIES_VERSION))
      .forEach(k => localStorage.removeItem(k));
    const preset = D.entries[raceId];
    return preset ? JSON.parse(JSON.stringify(preset.entries)) : [];
  }
  function saveEntries(raceId, entries) { localStorage.setItem(entriesKey(raceId), JSON.stringify(entries)); }
  function resetEntries(raceId) { localStorage.removeItem(entriesKey(raceId)); }

  // ---------- Scoring ----------
  function scoreHorse(horse, race, trend) {
    let score = 50;
    const f = [];

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

    const j = D.jockeyMap[horse.jockey];
    const jDelta = j ? Math.round((j.winRate - 12) * 0.7) : 0;
    score += jDelta;
    f.push({ k: '騎手', v: jDelta, n: j ? `${horse.jockey} 勝率${j.winRate}%` : '騎手データなし' });

    if (trend && trend.bias[horse.style] != null) {
      const bias = trend.bias[horse.style];
      const sDelta = Math.round((bias - 25) * 0.6);
      score += sDelta;
      f.push({ k: '脚質', v: sDelta, n: `${horse.style} レース連対率${bias}%` });
    }

    const cDelta = horse.course === 'high' ? 12 : horse.course === 'mid' ? 4 : -7;
    score += cDelta;
    f.push({ k: 'コース', v: cDelta, n: horse.course === 'high' ? '当該コース勝ち鞍' : horse.course === 'mid' ? '連対経験あり' : '苦手 / 未経験' });

    const wDelta = horse.weight >= 58 ? -5 : horse.weight >= 57 ? -2 : horse.weight <= 54 ? 3 : 0;
    if (wDelta !== 0) { score += wDelta; f.push({ k: '斤量', v: wDelta, n: `${horse.weight}kg` }); }

    if (race && horse.post) {
      let pDelta = 0;
      if (horse.post >= 8 && race.distance <= 1600) pDelta -= 2;
      if (horse.post === 1 && race.distance >= 2500) pDelta += 2;
      if (horse.post >= 7 && race.distance >= 3000) pDelta -= 3;
      if (pDelta !== 0) { score += pDelta; f.push({ k: '枠順', v: pDelta, n: `${horse.post}枠` }); }
    }

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
    const [a, b, c, d] = ranked;
    const bets = [];
    bets.push({ type: '単勝', combo: `${a.num} ${a.name}`, ev: a.ev, conf: a.score >= 75 ? '強' : a.score >= 65 ? '中' : '弱' });
    bets.push({ type: '複勝', combo: `${a.num} ${a.name}`, ev: a.ev != null ? +(a.ev * 0.55).toFixed(2) : null, conf: '安定' });
    bets.push({ type: '馬連', combo: `${a.num}-${b.num}`, ev: null, conf: a.score - b.score < 8 ? '強' : '中' });
    bets.push({ type: 'ワイド', combo: `${a.num}-${b.num} / ${a.num}-${c.num}`, ev: null, conf: '中' });
    if (d) bets.push({ type: '三連複', combo: `${a.num}-${b.num}-${c.num} / ${a.num}-${b.num}-${d.num}`, ev: null, conf: '中' });
    const value = ranked.slice(2).filter(h => h.ev != null && h.ev > 0.5).sort((a, b) => b.ev - a.ev)[0];
    if (value) {
      bets.push({ type: '穴', combo: `${value.num} ${value.name} (EV ${value.ev.toFixed(2)})`, ev: value.ev, conf: '妙味' });
    }
    return bets;
  }

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

  // ---------- Main render ----------
  function render() {
    renderInner();
  }

  function renderInner() {
    const outer = document.getElementById('view-root');
    outer.innerHTML = '';
    const root = document.createElement('div'); // eslint-disable-line no-shadow
    root.className = 'view';
    outer.appendChild(root);

    // Lock to Victoria Mile (今日のG1)
    state.predictRaceId = 'vic';
    const race = D.races.find(r => r.id === state.predictRaceId);
    const entries = loadEntries(state.predictRaceId);

    // Title: race name + meta
    root.appendChild(h(`<h2 class="view-title">${esc(race.name)}</h2>`));
    root.appendChild(h(`<p class="view-subtitle">${race.month}月${race.day}日 ・ ${esc(race.course)} ・ ${race.surface}${race.distance}m ・ 全${entries.length}頭</p>`));

    if (!entries.length) {
      root.appendChild(h(`<div class="card"><div class="empty-state" style="padding: 24px 8px;"><div class="icon">🐴</div>このレースは出走馬データ未登録です。</div></div>`));
      return;
    }

    // Data source banner
    const preset = D.entries[state.predictRaceId];
    if (preset && preset.note) {
      root.appendChild(h(`<div class="source-banner">
        <div class="sb-row"><span class="sb-tag sb-verified">確定</span><span>枠順・馬名・性齢・騎手・斤量</span></div>
        <div class="sb-row"><span class="sb-tag sb-estimated">推定</span><span>オッズ・人気・脚質・直近3走（公開予想ベース）</span></div>
        <div class="sb-note">出典: netkeiba / 競馬ラボ / Yahoo!競馬 等</div>
      </div>`));
    }

    const ranked = calcAnalysis(entries, race);

    // Sort segmented control
    const sortRow = h(`<div class="segmented" role="tablist">
      <button class="seg ${state.predictSort==='popular'?'active':''}" data-sort="popular">人気順</button>
      <button class="seg ${state.predictSort==='score'?'active':''}" data-sort="score">おすすめ順</button>
      <button class="seg ${state.predictSort==='odds'?'active':''}" data-sort="odds">オッズ順</button>
      <button class="seg ${state.predictSort==='value'?'active':''}" data-sort="value">妙味順</button>
    </div>`);
    sortRow.querySelectorAll('[data-sort]').forEach(b => b.addEventListener('click', () => {
      state.predictSort = b.dataset.sort;
      render();
    }));
    root.appendChild(sortRow);

    // Horse cards (the main thing)
    const sorted = [...ranked];
    if (state.predictSort === 'popular') sorted.sort((a, b) => a.popular - b.popular);
    else if (state.predictSort === 'odds') sorted.sort((a, b) => (a.odds || 999) - (b.odds || 999));
    else if (state.predictSort === 'value') sorted.sort((a, b) => (b.ev || -999) - (a.ev || -999));

    const listWrap = h(`<div class="horse-grid"></div>`);
    sorted.forEach((h_) => listWrap.appendChild(horseAnalysisCard(h_)));
    root.appendChild(listWrap);

    root.appendChild(h(`<div class="note">⚠️ スコアは公開予想・過去傾向に基づく簡易シミュレーション。馬券購入は自己責任で。</div>`));
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
    render();
  }

  function horseAnalysisCard(horse) {
    const markColor = {
      '◎': 'var(--mark-honmei)', '○': 'var(--mark-taikou)', '▲': 'var(--mark-tanana)',
      '△': 'var(--mark-renka)',  '☆': 'var(--value)',       '✕': 'var(--text-faint)',
    }[horse.mark] || 'var(--text-muted)';
    const markLabel = {
      '◎': '本命', '○': '対抗', '▲': '単穴', '△': '連下', '☆': '注目', '✕': '消し',
    }[horse.mark] || '';

    const cmt = horseComment(horse, horse._rankIdx ?? 99);
    const evBadge = horse.ev != null && horse.ev > 0.3
      ? `<span class="ev-badge">妙味 EV +${horse.ev.toFixed(2)}</span>`
      : '';
    const popClass = horse.popular === 1
      ? 'pop-1'
      : horse.popular <= 3 ? 'pop-top'
      : horse.popular <= 6 ? 'pop-mid'
      : 'pop-low';

    return h(`<div class="horse-analyze" data-mark="${esc(horse.mark || '')}">
      <div class="ha-top">
        <div class="ha-mark" style="color: ${markColor};">
          <div class="ha-mark-char">${horse.mark || '−'}</div>
          ${markLabel ? `<div class="ha-mark-label">${markLabel}</div>` : ''}
        </div>
        <div class="ha-body">
          <div class="ha-row1">
            <span class="ha-popular ${popClass}">${horse.popular}番人気</span>
            <span class="ha-num">${horse.num}番 / ${horse.post}枠</span>
          </div>
          <div class="ha-name">${esc(horse.name)}</div>
          <div class="ha-meta">${esc(horse.sex || '')}${horse.age || ''}<span class="dot">・</span>${esc(horse.jockey)}<span class="dot">・</span>${horse.weight}kg</div>
        </div>
        <div class="ha-odds">
          ${horse.odds ? `<div class="ha-odds-val">${horse.odds.toFixed(1)}<span class="ha-odds-unit">倍</span></div>` : ''}
          <div class="ha-odds-lbl">想定オッズ</div>
        </div>
      </div>
      <div class="ha-comment">${esc(cmt)}</div>
      <div class="ha-stats">
        <div class="ha-stat"><div class="ha-stat-val">${horse.score}</div><div class="ha-stat-lbl">スコア</div></div>
        <div class="ha-stat"><div class="ha-stat-val">${(horse.prob * 100).toFixed(1)}<span class="ha-stat-unit">%</span></div><div class="ha-stat-lbl">推定勝率</div></div>
        <div class="ha-stat"><div class="ha-stat-val">${(horse.recent || []).join('-') || '−'}</div><div class="ha-stat-lbl">直近3走</div></div>
      </div>
      ${evBadge}
    </div>`);
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
          horse.recent = horse.recent || [3, 5, 3];
          horse.recent[i] = parseInt(el.value) || 0;
        } else if (k === 'num' || k === 'post' || k === 'popular' || k === 'weight' || k === 'odds') {
          horse[k] = parseFloat(el.value) || 0;
        } else {
          horse[k] = el.value;
        }
        saveEntries(state.predictRaceId, allEntries);
        row.querySelector('.entry-num').textContent = horse.num;
        row.querySelector('.entry-name').textContent = horse.name;
        row.querySelector('.entry-meta').textContent = `${horse.jockey} ・ ${horse.weight}kg ・ ${horse.style} ・ 想定${horse.popular}人気`;
      });
    });

    row.querySelector('.entry-delete').addEventListener('click', () => {
      if (!confirm(`${horse.name} を削除しますか？`)) return;
      allEntries.splice(idx, 1);
      saveEntries(state.predictRaceId, allEntries);
      render();
    });

    return row;
  }

  render();
})();

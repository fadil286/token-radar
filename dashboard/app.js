/* Token Radar, radar-2 dashboard. No network: every byte shown is in data.js.
   The farm plan and the implied value are the same derivations main.ts
   writes to board.json: category, chains, TVL and age. The detail view
   recomputes the row and says whether it matches the board. */
(function () {
  'use strict';
  var DATA = window.RADAR || null;
  if (!DATA) {
    document.getElementById('rows').innerHTML = '<tr><td colspan="7" class="empty">No data loaded.</td></tr>';
    return;
  }

  var state = { q: '', category: '', chain: '', tab: 'pre', sort: 'rank', dir: 1, selected: null };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmtUsd(n) {
    if (n == null || !isFinite(n)) return '—';
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function fmtPct(n) {
    if (n == null || !isFinite(n)) return '—';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days == null) return '—';
    if (days < 30) return days + 'd';
    if (days < 365) return Math.round(days / 30) + 'mo';
    return (days / 365).toFixed(1) + 'y';
  }
  function money(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    return '$' + Math.round(n).toLocaleString('en-US');
  }
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function capitalFor(p) {
    if (p.tvl_usd >= 5e9) return 250;
    if (p.tvl_usd >= 1e9) return 150;
    if (p.tvl_usd >= 1e8) return 100;
    return 50;
  }
  function holdDaysFor(age) {
    if (age == null) return 30;
    if (age < 180) return 60;
    if (age < 365) return 45;
    return 30;
  }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0)
      return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the loan position open, watching the health factor.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0)
      return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open through one fee cycle.';
    if (c.indexOf('bridge') >= 0)
      return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app, not just hold them.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0)
      return 'Stake $' + capital + " of the chain's staking asset through " + name + ' and keep the receipt token in the same wallet.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('basis') >= 0)
      return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged position, then close it the same week.';
    if (c.indexOf('prediction') >= 0)
      return 'Fund $' + capital + ' and place one market position on ' + name + ', then settle it before the market closes.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('risk') >= 0)
      return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares for the full qualifying window.';
    if (c.indexOf('stable') >= 0)
      return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + ' and hold it in the farming wallet.';
    if (c.indexOf('rwa') >= 0)
      return 'Mint $' + capital + " of the protocol's yield asset on " + chain + ' and hold it; record the mint transaction hash.';
    if (c.indexOf('insurance') >= 0)
      return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy active for the qualifying window.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open for the full window.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p) {
    var chain = chainOf(p);
    var capital = capitalFor(p);
    var hold = holdDaysFor(p.age_days);
    var action = actionFor(p, capital, chain);
    var tvlText = money(p.tvl_usd);
    var steps = [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm for ' + p.name + ' (' + tvlText + ' TVL on ' + chain + '), and keep its seed phrase offline.', cost: 'under $3 of gas for the first transaction', time: '5 minutes' },
      { text: action, cost: '$' + capital + ' of capital and about $' + (capital >= 150 ? 8 : 4) + ' of gas', time: '15 minutes to set up' },
      { text: 'Make one qualifying action each week on ' + chain + ', such as a deposit, a borrow, a swap or a vote in ' + p.name + '.', cost: 'about $2 of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + hold + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: hold + ' days' },
      { text: "Before you withdraw, open " + p.name + "'s own points or rewards page and claim only from the link it publishes; never pay anyone to claim for you.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction hash in a farm log so you can repeat the position or unwind it safely.', cost: 'nothing but the log', time: '5 minutes' }
    ];
    return steps.map(stepText);
  }
  function multipleOf(p) {
    var m = DATA.category_multiples || {};
    if (p.category && Object.prototype.hasOwnProperty.call(m, p.category)) return m[p.category];
    return DATA.model.overall_multiple;
  }
  function impliedOf(row) {
    var growth = row.change_7d == null ? 0 : Math.min(120, Math.max(-60, row.change_7d));
    var growthMult = 1 + (growth / 100) * 0.5;
    var age = row.age_days == null ? 365 : row.age_days;
    var maturity = 0.6 + (Math.min(Math.max(age, 0), 1095) / 1095) * 0.4;
    return Math.max(1, Math.round(row.tvl_usd * multipleOf(row) * growthMult * maturity));
  }

  function initMeta() {
    document.getElementById('meta').textContent = 'Snapshot ' + DATA.as_of + ' · DefiLlama protocol index · ' + DATA.model_version + ' model';
    document.getElementById('headline').textContent = DATA.watchlist_size + ' watchlist protocols, ranked by implied value';
    document.getElementById('lede').textContent = 'The watchlist is the floor: every protocol with at least $50M of TVL and no token on record. The early radar adds ' + DATA.early_size + ' pre-token protocols below that floor. Implied value is a model, not a promise.';
    var mults = Object.keys(DATA.category_multiples || {}).map(function (k) { return k + ' ' + DATA.category_multiples[k]; }).join(' · ');
    document.getElementById('method').innerHTML = 'Model <code>radar-2</code>: implied = TVL × category multiple × growth × maturity. Multiples are live-token mcap/TVL medians in this snapshot: ' + esc(mults) + ' · others ' + DATA.model.overall_multiple + '.';
    var stats = document.getElementById('stats');
    stats.innerHTML =
      '<div><dt>Watchlist covered</dt><dd>' + DATA.watchlist_size + ' / ' + DATA.watchlist_size + '</dd></div>' +
      '<div><dt>Pre-token rows scored</dt><dd>' + DATA.board_size + '</dd></div>' +
      '<div><dt>Early rows below the floor</dt><dd>' + DATA.early_size + '</dd></div>' +
      '<div><dt>Live-token protocols set aside</dt><dd>' + DATA.live_size + '</dd></div>';
    var cats = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var catSel = document.getElementById('cat');
    cats.forEach(function (c) {
      var o = document.createElement('option'); o.value = c; o.textContent = c; catSel.appendChild(o);
    });
    var chains = Array.from(new Set(DATA.rows.reduce(function (a, r) { return a.concat(r.chains || []); }, []))).sort();
    var chainSel = document.getElementById('chain');
    chains.forEach(function (c) {
      var o = document.createElement('option'); o.value = c; o.textContent = c; chainSel.appendChild(o);
    });
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category && (r.category || 'Other') !== state.category) return false;
      if (state.chain && !(r.chains || []).includes(state.chain)) return false;
      if (q) {
        var hay = (r.name + ' ' + (r.category || '') + ' ' + (r.chains || []).join(' ')).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
  }
  function sortedRows(list) {
    var k = state.sort, dir = state.dir;
    return list.slice().sort(function (a, b) {
      var av = a[k], bv = b[k];
      if (k === 'name') return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
      av = av == null ? -Infinity : av; bv = bv == null ? -Infinity : bv;
      return (av - bv) * dir;
    });
  }

  function renderBoard() {
    var list = sortedRows(filteredRows());
    var maxImp = Math.max.apply(null, DATA.rows.map(function (r) { return r.implied_value_usd; }));
    var tbody = document.getElementById('rows');
    document.getElementById('count').textContent = list.length + ' rows shown';
    if (!list.length) { tbody.innerHTML = '<tr><td colspan="7" class="empty">No protocols match these filters.</td></tr>'; return; }
    tbody.innerHTML = list.map(function (r) {
      var pct = r.change_7d == null ? '<span class="num">—</span>' : '<span class="num ' + (r.change_7d < 0 ? 'neg' : 'pos') + '">' + fmtPct(r.change_7d) + '</span>';
      var w = Math.max(2, Math.round((r.implied_value_usd / maxImp) * 100));
      return '<tr data-slug="' + esc(r.slug) + '" class="' + (state.selected === r.slug ? 'sel' : '') + '">' +
        '<td class="num">' + r.rank + '</td>' +
        '<td><div class="pname">' + esc(r.name) + '</div><div class="psub">' + esc(r.category || 'Other') + ' on ' + esc((r.chains || []).slice(0, 2).join(', ') || '—') + '</div></td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td>' + pct + '</td>' +
        '<td class="num">' + fmtAge(r.age_days) + '</td>' +
        '<td class="num"><span class="barTrack"><span class="bar" style="width:' + w + '%"></span></span>' + fmtUsd(r.implied_value_usd) + '</td>' +
        '<td><span class="tag">● no token</span></td></tr>';
    }).join('');
    Array.prototype.forEach.call(tbody.querySelectorAll('tr[data-slug]'), function (tr) {
      tr.addEventListener('click', function () { openDetail(tr.getAttribute('data-slug')); });
      tr.tabIndex = 0;
      tr.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(tr.getAttribute('data-slug')); } });
    });
  }

  function renderLive() {
    var tbody = document.getElementById('liveRows');
    tbody.innerHTML = DATA.live.map(function (r) {
      var ratio = r.mcap_usd && r.tvl_usd ? (r.mcap_usd / r.tvl_usd).toFixed(3) : '—';
      return '<tr><td><div class="pname">' + esc(r.name) + '</div><div class="psub">' + esc(r.category || 'Other') + '</div></td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td><td class="num">' + fmtUsd(r.mcap_usd) + '</td><td class="num">' + ratio + '</td></tr>';
    }).join('');
  }

  function openDetail(slug) {
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === slug) row = r; });
    var box = document.getElementById('detail');
    if (!row) { state.selected = null; box.innerHTML = ''; renderBoard(); return; }
    state.selected = slug;
    if (location.hash !== '#/protocol/' + slug) history.replaceState(null, '', '#/protocol/' + slug);
    var recomputed = impliedOf(row);
    var match = recomputed === row.implied_value_usd;
    var growth = row.change_7d == null ? 0 : Math.min(120, Math.max(-60, row.change_7d));
    var growthMult = 1 + (growth / 100) * 0.5;
    var age = row.age_days == null ? 365 : row.age_days;
    var maturity = 0.6 + (Math.min(Math.max(age, 0), 1095) / 1095) * 0.4;
    var base = Math.round(row.tvl_usd * multipleOf(row));
    var steps = farmSteps(row);
    box.innerHTML =
      '<h2>#' + row.rank + ' ' + esc(row.name) + '</h2>' +
      '<p class="sub">' + esc(row.category || 'Other') + ' on ' + esc((row.chains || []).join(', ') || '—') + ' · TVL ' + fmtUsd(row.tvl_usd) + ' · 7d ' + fmtPct(row.change_7d) + ' · age ' + fmtAge(row.age_days) + ' · no token on record.</p>' +
      '<dl class="modelgrid">' +
      '<div><dt>Implied value</dt><dd>' + fmtUsd(row.implied_value_usd) + '<small>TVL × multiple × growth × maturity</small></dd></div>' +
      '<div><dt>Base (TVL × multiple)</dt><dd>' + fmtUsd(base) + '<small>multiple ' + multipleOf(row) + ' for ' + esc(row.category || 'other') + '</small></dd></div>' +
      '<div><dt>Growth multiplier</dt><dd>' + growthMult.toFixed(4) + '<small>7d ' + fmtPct(row.change_7d) + ' clamped to −60…120%</small></dd></div>' +
      '<div><dt>Maturity multiplier</dt><dd>' + maturity.toFixed(4) + '<small>age ' + fmtAge(row.age_days) + ' of 1,095 days</small></dd></div>' +
      '</dl>' +
      '<p class="sub">Model ' + esc(DATA.model_version) + ': the page recomputes this row as ' + fmtUsd(recomputed) + (match ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.</p>' +
      '<h3>Farm plan</h3><ol class="steps">' + steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<p><button type="button" id="closeDetail">Close details</button></p>';
    document.getElementById('closeDetail').addEventListener('click', function () {
      state.selected = null; history.replaceState(null, '', '#'); box.innerHTML = ''; renderBoard();
    });
    renderBoard();
    box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function readHash() {
    var m = location.hash.match(/^#\/protocol\/(.+)$/);
    if (m) state.selected = decodeURIComponent(m[1]);
  }

  document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; renderBoard(); });
  document.getElementById('cat').addEventListener('change', function (e) { state.category = e.target.value; renderBoard(); });
  document.getElementById('chain').addEventListener('change', function (e) { state.chain = e.target.value; renderBoard(); });
  document.getElementById('showPre').addEventListener('click', function () {
    state.tab = 'pre'; this.classList.add('on'); document.getElementById('showLive').classList.remove('on');
    document.getElementById('boardWrap').style.display = ''; document.getElementById('liveWrap').style.display = '';
  });
  document.getElementById('showLive').addEventListener('click', function () {
    state.tab = 'live'; this.classList.add('on'); document.getElementById('showPre').classList.remove('on');
    document.getElementById('liveWrap').scrollIntoView({ behavior: 'smooth' });
  });
  Array.prototype.forEach.call(document.querySelectorAll('th[data-sort]'), function (th) {
    th.addEventListener('click', function () {
      var k = th.getAttribute('data-sort');
      if (state.sort === k) state.dir = -state.dir; else { state.sort = k; state.dir = k === 'name' ? 1 : -1; }
      renderBoard();
    });
  });
  window.addEventListener('hashchange', function () { readHash(); if (state.selected) openDetail(state.selected); });

  initMeta();
  renderBoard();
  renderLive();
  readHash();
  if (state.selected) openDetail(state.selected);
})();

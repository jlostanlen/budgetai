(() => {
  const $ = s => document.querySelector(s);
  const money = n => new Intl.NumberFormat('fr-FR', {style: 'currency', currency: 'EUR'}).format(n);
  const displayDate = d => /^\d{4}-\d{2}-\d{2}$/.test(d) ? new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', {day: 'numeric', month: 'short', year: 'numeric'}) : d;
  const node = (tag, className, text) => { const el = document.createElement(tag); el.className = className || ''; if (text !== undefined) el.textContent = text; return el; };
  let current, period = '30', sequence = 0;
  function toast(text) { $('#toast').textContent = text; $('#toast').classList.add('show'); setTimeout(() => $('#toast').classList.remove('show'), 2500); }
  function chart() {
    const values = current.charts[period] || [];
    const max = Math.max(1, ...values.map(v => v.amount)) * 1.12;
    const points = values.map((v, i) => `${i * 520 / Math.max(1, values.length - 1)},${160 - v.amount / max * 138}`).join(' ');
    // All interpolated values are numeric calculations, never document text.
    $('#lineChart').innerHTML = `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f7df5" stop-opacity=".42"/><stop offset="1" stop-color="#2f7df5" stop-opacity="0"/></linearGradient></defs><g class="grid"><line x1="0" y1="35" x2="520" y2="35"/><line x1="0" y1="78" x2="520" y2="78"/><line x1="0" y1="120" x2="520" y2="120"/></g><polygon fill="url(#g)" points="0,160 ${points} 520,160"/><polyline fill="none" stroke="#3486ff" stroke-width="4" points="${points}"/>`;
    $('.xlabels').replaceChildren();
    [0, .25, .5, .75, 1].forEach(f => {
      const point = values[Math.round(f * (values.length - 1))];
      $('.xlabels').append(node('span', '', point?.date ? new Date(point.date + 'T12:00:00').toLocaleDateString('fr-FR', {day: 'numeric', month: 'short'}) : 'Démo'));
    });
  }
  function render() {
    AccountFilter.render(current.accounts || [], () => load(current.month));
    $('#monthLabel').textContent = current.label;
    $('#totalAmount').textContent = money(current.total);
    $('#deltaBadge').textContent = current.delta === null ? '—' : `${current.delta <= 0 ? '↓' : '↑'} ${Math.abs(current.delta).toFixed(1).replace('.', ',')} %`;
    $('#deltaBadge').className = current.delta > 0 ? 'bad' : 'good';
    $('#previousText').textContent = current.delta === null ? 'Pas de dépenses le mois précédent' : `vs mois précédent (${money(current.previous)})`;
    $('#dataSource').textContent = current.source === 'demo' ? 'Données de démonstration · Importez un relevé pour commencer.' : 'Données importées · Débits hors virements internes. Crédits séparés : ' + money(current.credits || 0);
    $('.categories h2').textContent = current.source === 'demo' ? 'Répartition moyenne par mois' : 'Répartition du mois';
    $('#categoryList').replaceChildren();
    current.categories.forEach(c => {
      const row = node('div', 'cat'), icon = node('span', 'caticon', c.icon), main = node('span', 'catmain');
      icon.style.background = c.color + '33';
      const bar = node('span', 'progress'), fill = node('i'); fill.style.width = c.percent + '%'; fill.style.background = c.color; bar.append(fill);
      main.append(node('b', '', c.label), bar); row.append(icon, main, node('span', '', c.percent + ' %'), node('strong', '', money(c.amount))); $('#categoryList').append(row);
    });
    $('#transactionList').replaceChildren();
    current.transactions.forEach(t => {
      const row = node('div', 'tx'), label = node('span'); label.append(node('b', '', t.label), node('small', '', displayDate(t.date)));
      row.append(node('span', 'txicon', t.icon), label, node('strong', '', money(t.amount))); $('#transactionList').append(row);
    });
    if (!current.transactions.length) $('#transactionList').append(node('p', 'empty-note', 'Aucune transaction incluse pour ce mois. Importez un relevé ou sélectionnez un autre mois.'));
    $('#evolutionBars').replaceChildren();
    const max = Math.max(1, ...current.evolution.map(e => e.amount));
    current.evolution.forEach(e => { const wrap = node('div'), bar = node('span', 'bar'); bar.style.height = e.amount / max * 100 + '%'; bar.title = money(e.amount); wrap.append(bar, node('small', '', e.label.split(' ')[0].slice(0, 4))); $('#evolutionBars').append(wrap); });
    $('#goalList').replaceChildren();
    current.goals.forEach(g => {
      const row = node('div', 'goal'), label = node('div'), bar = node('div', 'goalbar'), fill = node('i');
      label.append(node('span', '', g.label), node('small', '', money(g.spent) + ' / ' + money(g.limit)));
      fill.style.width = g.percent + '%'; fill.style.background = g.color; bar.append(fill); row.append(label, bar, node('b', '', g.percent + ' %')); $('#goalList').append(row);
    });
    if (!current.goals.length) $('#goalList').append(node('p', 'empty-note', 'Aucun objectif personnel configuré. Les budgets de démonstration ne sont pas appliqués à vos données.'));
    $('#monthMenu').replaceChildren();
    current.months.forEach(m => { const b = node('button', '', m.label); b.onclick = () => { $('#monthMenu').classList.remove('open'); load(m.id); }; $('#monthMenu').append(b); });
    chart();
  }
  async function load(month) {
    const request = ++sequence;
    $('#monthSelect').disabled = true;
    try { const data = await BudgetAPI.overview(month); if (request !== sequence) return; current = data; AccountFilter.setPeriod(data.month); render(); }
    catch { $('#totalAmount').textContent = 'Indisponible'; $('#previousText').textContent = 'Ouvrez le site depuis FastAPI, puis rechargez la page.'; }
    finally { if (request === sequence) $('#monthSelect').disabled = false; }
  }
  $('#monthSelect').onclick = () => $('#monthMenu').classList.toggle('open');
  document.addEventListener('click', e => { if (!e.target.closest('.page-head')) $('#monthMenu').classList.remove('open'); });
  document.querySelectorAll('.periods button').forEach(b => b.onclick = () => { if (!current) return; period = b.dataset.range; document.querySelectorAll('.periods button').forEach(x => x.classList.toggle('active', x === b)); chart(); });
  document.querySelectorAll('.card-title button').forEach(b => b.onclick = e => { e.preventDefault(); toast('Cette fonctionnalité sera ajoutée prochainement.'); });
  document.querySelectorAll('.assistant-card button').forEach(b => b.onclick = () => { location.href = 'assistant.html?question=' + encodeURIComponent(b.textContent); });
  $('#importStatement').onclick = () => { location.href = 'documents.html?import=1'; };
  window.addEventListener('focus', () => load(current?.month));
  load(sessionStorage.getItem('budgetai.month')||undefined);
})();

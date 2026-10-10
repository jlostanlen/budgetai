(() => {
  const $ = s => document.querySelector(s);
  const node = (tag, cls, text) => { const el = document.createElement(tag); el.className = cls || ''; if (text !== undefined) el.textContent = text; return el; };
  const money = cents => new Intl.NumberFormat('fr-FR', {style: 'currency', currency: 'EUR'}).format(cents / 100);
  let reviewDialog,reviewFrame,reviewDocument;
  const presentedReviews=new Set();
  function openReview(doc){
    if(reviewDialog)return;
    presentedReviews.add(doc.id);reviewDocument=doc;
    reviewDialog=document.createElement('dialog');reviewDialog.className='import-review-dialog';reviewDialog.setAttribute('aria-label','Vérification facultative du classement');
    reviewFrame=document.createElement('iframe');reviewFrame.title='Vous pouvez ajuster le classement';reviewFrame.src='expenses.html?review='+encodeURIComponent(doc.id);reviewDialog.append(reviewFrame);
    reviewDialog.onclose=()=>{reviewDialog.remove();reviewDialog=undefined;reviewFrame=undefined;reviewDocument=undefined;};
    document.body.append(reviewDialog);reviewDialog.showModal();
  }
  window.addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==reviewFrame?.contentWindow||event.data?.type!=='budgetai-review-validated'||event.data.documentId!==reviewDocument?.id)return;reviewDialog.close();location.href='index.html';});
  function reviewReady(){if(reviewDialog||uploading||$('#uploadDialog').open||$('#detailDialog').open)return;const doc=documents.find(d=>d.review_pending&&d.status==='ready'&&d.classification_status!=='processing'&&!d.account_required&&!presentedReviews.has(d.id));if(doc)openReview(doc);}
  let documents = [], activeDocument = null, offset = 0, uploading = false, refreshing = false, timer;
  const showError = (selector, message) => { $(selector).textContent = message; $(selector).hidden = !message; };
  const toast = text => { $('#toast').textContent = text; $('#toast').classList.add('show'); setTimeout(() => $('#toast').classList.remove('show'), 3500); };
  async function request(path, options = {}) {
    const response = await fetch('/api/documents' + path, {cache: 'no-store', ...options});
    let data;
    if (response.status === 204) return null;
    try { data = await response.json(); } catch { throw new Error('Backend indisponible. Ouvrez BudgetAI depuis FastAPI.'); }
    if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'La demande est invalide. Vérifiez les données.');
    return data;
  }
  const json = (method, body) => ({method, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
  function action(label, handler, cls = '') {
    const button = node('button', cls, label); button.type = 'button';
    button.onclick = async () => { button.disabled = true; try { await handler(); } catch (e) { showError('#pageError', e.message); } finally { button.disabled = false; } }; return button;
  }
  function openUpload() { showError('#uploadError', ''); $('#uploadProgress').textContent = ''; $('#uploadDialog').showModal(); }
  function renderDocuments() {
    $('#documentTotal').textContent = documents.length;
    $('#includedTotal').textContent = documents.filter(d => d.included && d.status === 'ready').length;
    $('#transactionTotal').textContent = documents.reduce((n, d) => n + d.transaction_count, 0);
    $('#documentList').replaceChildren();
    if (!documents.length) {
      const empty = node('div', 'empty-library'); empty.append(node('span', '', '▤'), node('h3', '', 'Votre premier relevé, votre premier aperçu.'), node('p', '', 'Importez un relevé pour retrouver vos dépenses classées et alimenter votre budget.'));
      empty.append(action('Importer un relevé', openUpload, 'primary-button')); $('#documentList').append(empty);
    }
    documents.forEach(doc => {
      const row = node('article', 'document-row'), body = node('div');
      row.append(node('span', 'file-icon', doc.extension.slice(1).toUpperCase()));
      body.append(node('h3', 'document-name', doc.name), node('p', 'document-meta', `${new Date(doc.created_at).toLocaleDateString('fr-FR')} · ${(doc.size / 1024).toFixed(1)} Ko · ${doc.transaction_count} transaction(s)`));
      if (doc.classification_error) body.append(node('p', 'error-note', doc.classification_error));
      if (doc.status === 'processing' || doc.classification_status === 'processing') {
        const progress = doc.analysis_progress;
        const seconds = Math.max(0, Math.floor(Date.now() / 1000 - (progress?.started_at || Date.parse(doc.created_at) / 1000)));
        const elapsed = seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min ${seconds % 60} s`;
        const panel = node('div', 'analysis-progress'); panel.setAttribute('aria-live', 'polite');
        panel.append(node('strong', '', `Analyse IA · ${elapsed}`), node('p', '', progress?.detail || 'Préparation de l’analyse…'));
        panel.append(node('p', '', 'L’IA classe vos opérations et signale les marchands difficiles à identifier.'));
        panel.append(node('small', '', 'Les recherches peuvent prendre plusieurs minutes. Vous pouvez quitter cette page : l’analyse continue.'));
        body.append(panel);
      }
      if (doc.account_required) {
        const chooser = node('select'); chooser.setAttribute('aria-label', 'Compte bancaire du relevé');
        const fresh = node('option', '', 'Créer un nouveau compte'); fresh.value = ''; chooser.append(fresh);
        (window.documentAccounts || []).forEach(a => { const option = node('option', '', a.label); option.value = a.id; chooser.append(option); });
        const name = node('input'); name.placeholder = 'Nom du nouveau compte'; name.maxLength = 80;
        chooser.onchange = () => { name.hidden = !!chooser.value; };
        body.append(chooser, name, action('Associer au compte', async () => {
          if (!chooser.value && !name.value.trim()) throw new Error('Donnez un nom au compte.');
          await request('/' + doc.id + '/account', json('POST', chooser.value ? {account_id: chooser.value} : {label: name.value.trim()}));
          await refresh();
        }));
      }
      if (doc.account_id) body.append(node('p', 'document-meta', (window.documentAccounts || []).find(a => a.id === doc.account_id)?.label || 'Compte bancaire'));
      if (doc.error) body.append(node('p', 'error-note', doc.error));
      doc.warnings.forEach(text => body.append(node('p', 'warning-note', text)));
      const label = node('label', 'include-option'), checkbox = node('input'); checkbox.type = 'checkbox'; checkbox.checked = doc.included;
      label.append(checkbox, document.createTextNode('Inclure dans les calculs du dashboard'));
      checkbox.onchange = async () => {
        checkbox.disabled = true;
        try { await request('/' + doc.id, json('PATCH', {included: checkbox.checked})); await refresh(); toast('Calculs mis à jour selon les dates des transactions.'); }
        catch (e) { checkbox.checked = !checkbox.checked; showError('#pageError', e.message); }
        finally { checkbox.disabled = false; }
      }; body.append(label);
      const actions = node('div', 'document-actions');
      if (doc.status === 'ready') {if(doc.classification_status!=='processing')actions.append(action('Vérifier le classement',()=>openReview(doc)));actions.append(action('Voir les transactions', () => openDetail(doc.id)));}
      if (doc.status === 'ready' && doc.classification_status !== 'processing') actions.append(action('Reclasser avec l’IA', async () => { await request('/' + doc.id + '/reclassify', {method: 'POST'}); await refresh(); }));
      const link = node('a', '', 'Télécharger l’original'); link.href = '/api/documents/' + doc.id + '/file'; link.download = doc.name; link.onclick=async(event)=>{event.preventDefault();try{const response=await fetch(link.getAttribute('href'),{cache:'no-store'});if(!response.ok)throw new Error('Téléchargement impossible.');const url=URL.createObjectURL(await response.blob());const download=document.createElement('a');download.href=url;download.download=doc.name;document.body.append(download);download.click();download.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}catch(error){alert(error.message);}}; actions.append(link);
      if (doc.status === 'error' && !doc.account_required) actions.append(action('Réessayer le traitement', async () => { await request('/' + doc.id + '/retry', {method: 'POST'}); await refresh(); }));
      if (doc.status !== 'processing' && doc.classification_status !== 'processing') actions.append(action('Supprimer', async () => {
        if (!confirm('Supprimer ce document et les transactions qui ne sont présentes dans aucun autre document ? Les calculs seront mis à jour.')) return;
        await request('/' + doc.id, {method: 'DELETE'}); await refresh(); toast('Document supprimé.');
      }, 'danger'));
      body.append(actions); row.append(body, node('span', 'status-pill ' + doc.status, doc.account_required ? 'Compte à choisir' : {ready: 'Traité', processing: 'Analyse en cours…', error: 'À reprendre'}[doc.status])); $('#documentList').append(row);
    });
  }
  async function refresh() {
    if (refreshing) return;
    refreshing = true; clearTimeout(timer);
    try { const result = await request(''); documents = result.documents; window.documentAccounts = result.accounts || []; renderDocuments(); showError('#pageError', '');reviewReady(); }
    catch (e) { showError('#pageError', e.message); }
    finally { refreshing = false; if (documents.some(d => d.status === 'processing' || d.classification_status === 'processing')) timer = setTimeout(refresh, 2500); }
  }
  async function openDetail(id) {
    activeDocument = id; offset = 0; $('#transactionRows').replaceChildren(); showError('#detailError', ''); $('#moreTransactions').hidden = true;
    if (!$('#detailDialog').open) $('#detailDialog').showModal();
    await loadTransactions();
  }
  async function loadTransactions() {
    const id = activeDocument; $('#moreTransactions').disabled = true;
    try {
      const result = await request('/' + id + '?offset=' + offset);
      if (id !== activeDocument) return;
      $('#detailTitle').textContent = result.document.name;
      $('#detailInfo').textContent = `${result.document.transaction_count} transaction(s) · ${result.document.included ? 'Document inclus dans les calculs' : 'Document hors calculs du dashboard'}`;
      result.transactions.forEach(tx => {
        const row = node('tr'), description = node('td', '', tx.description);
        description.append(node('small', '', tx.merchant || 'Marchand non identifié'));
        if (tx.classification_model) description.append(node('small', '', tx.classification_model));
        if (tx.classification_reason) description.append(node('small', '', tx.classification_reason));
        if (tx.classification_researched) {
          const sources = node('div', 'classification-sources'); sources.append(node('small', '', 'Recherche web effectuée'));
          try { JSON.parse(tx.classification_sources || '[]').forEach(source => {
            const url = new URL(source.url); if (!['https:', 'http:'].includes(url.protocol)) return;
            const link = node('a', '', source.title || url.hostname); link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; sources.append(link);
          }); } catch { /* Never render untrusted source markup. */ }
          description.append(sources);
        }
        if (tx.confidence < .75) description.append(node('small', 'warning-note', 'Catégorie incertaine · À vérifier'));
        if (tx.source_count > 1) description.append(node('small', '', `Présente dans ${tx.source_count} relevés · Comptée une seule fois`));
        const categoryCell = node('td'), select = node('select'); select.setAttribute('aria-label', 'Catégorie de ' + tx.description);
        Object.entries(result.categories).forEach(([key, value]) => { const option = node('option', '', value.label); option.value = key; select.append(option); }); select.value = tx.category; categoryCell.append(select);
        const includeCell = node('td'), label = node('label'), include = node('input'); include.type = 'checkbox'; include.checked = !tx.ignored; include.setAttribute('aria-label', 'Retenir ' + tx.description); label.append(include, document.createTextNode(' Retenir')); includeCell.append(label);
        async function change() {
          select.disabled = include.disabled = true;
          try { await request('/' + id + '/transactions/' + tx.id, json('PATCH', {category: select.value, ignored: !include.checked})); tx.category = select.value; tx.ignored = !include.checked; toast('Transaction mise à jour.'); showError('#detailError', ''); }
          catch (e) { select.value = tx.category; include.checked = !tx.ignored; showError('#detailError', e.message); }
          finally { select.disabled = include.disabled = false; }
        }
        select.onchange = include.onchange = change;
        row.append(node('td', '', new Date(tx.date + 'T12:00:00').toLocaleDateString('fr-FR')), description, node('td', '', money(tx.amount_cents)), categoryCell, includeCell); $('#transactionRows').append(row);
      });
      offset += result.transactions.length; $('#moreTransactions').hidden = !result.has_more;
    } catch (e) { showError('#detailError', e.message); }
    finally { $('#moreTransactions').disabled = false; }
  }
  $('#openUpload').onclick = openUpload;
  $('#refreshDocuments').onclick = refresh;
  $('#moreTransactions').onclick = loadTransactions;
  document.querySelectorAll('.close-dialog').forEach(button => button.onclick = () => { if (!uploading || button.closest('dialog').id !== 'uploadDialog') button.closest('dialog').close(); });
  $('#uploadDialog').addEventListener('cancel', e => { if (uploading) e.preventDefault(); });
  $('#statementFile').onchange = () => { $('#selectedFile').textContent = $('#statementFile').files[0]?.name || 'Choisir un fichier'; };
  $('#uploadForm').onsubmit = async event => {
    event.preventDefault(); if (uploading) return;
    const file = $('#statementFile').files[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showError('#uploadError', 'Maximum 10 Mo par document.'); return; }
    uploading = true; $('#uploadSubmit').disabled = true; showError('#uploadError', ''); $('#uploadProgress').textContent = 'Envoi du fichier…';
    const form = new FormData(); form.append('file', file); form.append('original_name', file.name); form.append('included', document.querySelector('[name=included]:checked').value);
    try {
      await request('', {method: 'POST', body: form}); $('#uploadDialog').close(); $('#uploadForm').reset(); $('#selectedFile').textContent = 'Choisir un fichier';
      await refresh(); toast('Document reçu. L’extraction et la classification sont en cours.');
    } catch (e) { showError('#uploadError', e.message); }
    finally { uploading = false; $('#uploadSubmit').disabled = false; $('#uploadProgress').textContent = '';reviewReady(); }
  };
  document.querySelectorAll('[data-inactive]').forEach(el => el.onclick = e => { e.preventDefault(); toast('Cette fonctionnalité sera ajoutée prochainement.'); });
  $('#detailDialog').addEventListener('close',reviewReady);$('#uploadDialog').addEventListener('close',()=>setTimeout(reviewReady,0));
  window.addEventListener('focus', refresh);
  refresh();
  if (new URLSearchParams(location.search).has('import')) { openUpload(); history.replaceState(null, '', location.pathname); }
})();

(() => {
  const $ = s => document.querySelector(s);
  const node = (tag, text, cls = '') => { const el = document.createElement(tag); el.textContent = text; el.className = cls; return el; };
  const money = value => new Intl.NumberFormat('fr-FR', {style:'currency', currency:'EUR'}).format(value / 100);
  const error = (id, text) => { $(id).textContent = text; $(id).hidden = !text; };
  let data, editing, busy = false, loadId = 0;
  const reviewId=new URLSearchParams(location.search).get('review');
  const reviewQuery=month=>{const query=new URLSearchParams({document_id:reviewId});if(month&&month!=='all')query.set('month',month);return '?'+query;};
  let validating=false;
  if(reviewId){
    document.body.classList.add('review-mode');
    document.querySelector('h1').textContent='Vous pouvez ajuster le classement';
    document.querySelector('.documents-header p').textContent='C’est facultatif : modifiez les catégories, créez vos règles ou validez simplement.';
    const filename=node('p','','privacy-note');filename.id='reviewFilename';document.querySelector('.documents-header').after(filename);
    const footer=document.createElement('footer');footer.className='review-footer';footer.append(node('p','Vos modifications sont enregistrées au fur et à mesure, comme dans Dépenses.','privacy-note'));
    const button=node('button','Valider le classement','primary-button');button.id='validateReview';button.type='button';button.disabled=true;
    button.onclick=async()=>{if(validating||busy||categoryBusy||!data)return;validating=true;button.disabled=true;error('#pageError','');try{const response=await fetch('/api/documents/'+encodeURIComponent(reviewId)+'/review',{method:'POST'});if(!response.ok){const result=await response.json();throw new Error(typeof result.detail==='string'?result.detail:'Impossible de valider. Réessayez.');}const month=data.month==='all'?data.months.find(m=>m!=='all'):data.month;AccountFilter.setPeriod(month);window.parent.postMessage({type:'budgetai-review-validated',documentId:reviewId,month},location.origin);}catch(e){error('#pageError',e.message);validating=false;button.disabled=false;}};
    footer.append(button);document.body.append(footer);
  }
  let groupScope, groupOrder = [], editPosition;
  const groupState = new Map();
  async function request(path = '', options = {}) {
    const r = await fetch('/api/expenses' + path, {cache:'no-store', ...options});
    if (r.status === 204) return;
    let body;
    try { body = await r.json(); } catch { throw new Error('Backend indisponible. Ouvrez BudgetAI depuis FastAPI.'); }
    if (!r.ok) throw new Error(typeof body.detail === 'string' ? body.detail : 'Vérifiez les champs saisis.');
    return body;
  }
  function toast(text) { $('#toast').textContent = text; $('#toast').classList.add('show'); setTimeout(() => $('#toast').classList.remove('show'), 4000); }
  function render() {
    const scope = data.month + '|' + (reviewId?reviewQuery(data.month):AccountFilter.query(data.month));
    if (scope !== groupScope) {groupState.clear();groupOrder=[];groupScope=scope;}
    else document.querySelectorAll('#groups details[data-category]').forEach(el=>groupState.set(el.dataset.category,{open:el.open,left:el.querySelector('.table-scroll')?.scrollLeft||0}));
    const ids = data.categories.map(c=>c.id);
    groupOrder = [...groupOrder.filter(id=>ids.includes(id)), ...ids.filter(id=>!groupOrder.includes(id))];
    if(!reviewId)AccountFilter.render(data.accounts || [], () => load(data.month));
    $('#total').textContent = money(data.expense_cents); $('#count').textContent = data.transaction_count;
    $('#groups').replaceChildren();
    const search = $('#search').value.trim().toLocaleLowerCase('fr');
    const byId=new Map(data.categories.map(c=>[c.id,c]));
    groupOrder.map(id=>byId.get(id)).forEach(group => {
      if (group.id === 'income' && !group.transactions.length) return;
      const rows = group.transactions.filter(t => (t.description + ' ' + t.merchant).toLocaleLowerCase('fr').includes(search));
      if (search && !rows.length) return;
      const details = document.createElement('details'); details.className = 'card expense-group'; details.dataset.category=group.id; details.open=groupState.get(group.id)?.open??rows.length>0;
      const summary = document.createElement('summary'), icon = node('span', group.icon, 'caticon'); icon.style.background = group.color + '22'; icon.style.color = group.color;
      const title = node('span', group.label); title.append(node('small', `${rows.length} opération(s)`));
      summary.append(icon, title, node('strong', money(group.expense_cents)));
      const rename=node('button','Renommer','secondary-button');rename.type='button';rename.setAttribute('aria-label','Renommer la catégorie '+group.label);
      rename.onclick=event=>{event.preventDefault();event.stopPropagation();renamingCategory=group;categoryFromEdit=false;$('#categoryForm').reset();error('#categoryError','');$('#categoryDialog h2').textContent='Renommer la catégorie';$('#createCategory').textContent='Enregistrer';$('#categoryName').value=group.label;$('#categoryDialog').showModal();$('#categoryName').focus();};
      summary.append(rename); details.append(summary);
      if (!rows.length) details.append(node('p', 'Aucune opération dans cette catégorie.', 'empty-note'));
      else {
        const scroll = node('div', '', 'table-scroll'), table = document.createElement('table'), head = document.createElement('thead'), tr = document.createElement('tr');
        ['Date', 'Intitulé de la transaction', 'Montant', ''].forEach(t => tr.append(node('th', t))); head.append(tr); table.append(head);
        const body = document.createElement('tbody');
        rows.forEach(tx => {
          const row = document.createElement('tr'), label = node('td', tx.description);
          label.append(node('small', {manual:'Catégorie choisie manuellement', rule:'Règle personnelle', openai:'Classée par IA'}[tx.classification_source] || ''));
          if (!tx.included) label.append(node('small', 'Hors calculs', 'warning-note'));
          if (tx.confidence < .75) label.append(node('small', 'Catégorie à vérifier', 'warning-note'));
          const cell = document.createElement('td'), button = node('button', 'Modifier', 'secondary-button'); button.setAttribute('aria-label', 'Modifier ' + tx.description); button.onclick = () => openEdit(tx); cell.append(button);
          row.append(node('td', new Date(tx.date + 'T12:00:00').toLocaleDateString('fr-FR')), label, node('td', money(tx.amount_cents)), cell); body.append(row);
        }); table.append(body); scroll.append(table); details.append(scroll);
      }
      $('#groups').append(details);const tableScroll=details.querySelector('.table-scroll');if(tableScroll)tableScroll.scrollLeft=groupState.get(group.id)?.left||0;
    });
    if (!$('#groups').children.length) $('#groups').append(node('p', 'Aucune transaction correspondante.', 'empty-note'));
    $('#rules').replaceChildren();
    if (!data.rules.length) $('#rules').append(node('p', 'Choisissez « Modifier » sur une transaction pour créer votre première règle.', 'privacy-note'));
    data.rules.forEach(rule => {
      const item = node('div', '', 'rule-item'); item.append(node('strong', rule.name), node('small', `${rule.direction === 'debit' ? 'Débit' : 'Crédit'} · ${rule.amount_cents === null ? 'Tous montants' : money(rule.amount_cents)} → ${data.categories.find(c => c.id === rule.category).label}`));
      const button = node('button', 'Supprimer la règle', 'secondary-button'); button.onclick = async () => {
        if (!confirm('Supprimer cette règle pour les prochains classements ? Les catégories déjà attribuées seront conservées.')) return;
        button.disabled = true;
        try { await request('/rules/' + rule.id, {method:'DELETE'}); await load(data.month); toast('Règle supprimée. Catégories existantes conservées.'); }
        catch (e) { error('#pageError', e.message); } finally { button.disabled = false; }
      }; item.append(button); $('#rules').append(item);
    });
  }
  async function load(month) {
    const id = ++loadId;
    try {
      const result = await request(reviewId?reviewQuery(month):AccountFilter.query(month)); if (id !== loadId) return;
      data = result;if(reviewId){$('#reviewFilename').textContent=data.review_document?.name||'Relevé importé';document.querySelector('.document-summary article span').textContent='Dépenses du relevé';} if(!reviewId)AccountFilter.setPeriod(data.month); $('#month').replaceChildren(); data.months.forEach(m => { const option = node('option', m==='all'?'Toutes les périodes':new Date(m + '-01T12:00:00').toLocaleDateString('fr-FR', {month:'long', year:'numeric'})); option.value = m; $('#month').append(option); }); $('#month').value = data.month;
      render(); error('#pageError', '');if(reviewId&&!validating)$('#validateReview').disabled=false;
    } catch (e) { error('#pageError', e.message); }
  }
  function ruleFields() {
    $('#ruleFields').hidden = !$('#remember').checked; $('#ruleName').required = $('#remember').checked;
    $('#amountField').hidden = !$('#matchAmount').checked; $('#ruleAmount').required = $('#remember').checked && $('#matchAmount').checked;
  }
  function openEdit(tx) {
    editPosition={x:window.scrollX,y:window.scrollY};
    editing = tx; $('#editForm').reset(); error('#editError', ''); $('#editDescription').textContent = tx.description; $('#editAmount').textContent = money(tx.amount_cents);
    $('#category').replaceChildren(); data.categories.forEach(c => { const o = node('option', c.label); o.value = c.id; $('#category').append(o); }); $('#category').value = tx.category;
    $('#ruleName').value = tx.description.slice(0, 200); $('#ruleAmount').value = (Math.abs(tx.amount_cents) / 100).toFixed(2);
    $('#ruleDirection').textContent = `Cette règle concerne uniquement les ${tx.amount_cents < 0 ? 'débits' : 'crédits'}.`; ruleFields(); $('#editDialog').showModal();
  }
  $('#editForm').onsubmit = async event => {
    event.preventDefault(); if (busy) return; busy = true; $('#save').disabled = true; error('#editError', '');
    const body = {category:$('#category').value};
    if ($('#remember').checked) body.rule = {name:$('#ruleName').value.trim(), amount_cents:$('#matchAmount').checked ? Math.round(Number($('#ruleAmount').value) * 100) : null, direction:editing.amount_cents < 0 ? 'debit' : 'credit'};
    try { await request('/' + editing.id, {method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)}); $('#editDialog').close(); await load(data.month); if(editPosition)window.scrollTo({left:editPosition.x,top:editPosition.y,behavior:'instant'}); toast(body.rule ? 'Catégorie enregistrée et règle appliquée aux opérations correspondantes.' : 'Catégorie mise à jour.'); }
    catch (e) { error('#editError', e.message); } finally { busy = false; $('#save').disabled = false; }
  };
  $('#month').onchange = () => load($('#month').value); $('#search').oninput = () => data && render();
  $('#remember').onchange = $('#matchAmount').onchange = ruleFields;
  $('.close-dialog').onclick = () => { if (!busy) $('#editDialog').close(); };
  $('#editDialog').addEventListener('cancel', e => { if (busy) e.preventDefault(); });
  document.querySelectorAll('[data-inactive]').forEach(el => el.onclick = e => { e.preventDefault(); toast('Cette fonctionnalité sera ajoutée prochainement.'); });
  let categoryBusy = false, categoryFromEdit = false, renamingCategory;
  function openCategory(fromEdit) {
    renamingCategory=undefined;$('#categoryDialog h2').textContent='Nouvelle catégorie';$('#createCategory').textContent='Créer';
    categoryFromEdit = fromEdit; $('#categoryForm').reset(); error('#categoryError', '');
    $('#categoryDialog').showModal(); $('#categoryName').focus();
  }
  $('#newCategory').onclick = () => openCategory(false);
  $('#newCategoryInEdit').onclick = () => openCategory(true);
  $('#closeCategory').onclick = () => { if (!categoryBusy) $('#categoryDialog').close(); };
  $('#categoryDialog').addEventListener('cancel', e => { if (categoryBusy) e.preventDefault(); });
  $('#categoryForm').onsubmit = async event => {
    event.preventDefault(); if (categoryBusy) return;
    categoryBusy = true; $('#createCategory').disabled = true; error('#categoryError', '');
    try {
      const category = await request('/categories'+(renamingCategory?'/'+encodeURIComponent(renamingCategory.id):''), {method:renamingCategory?'PATCH':'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({label:$('#categoryName').value.trim()})});
      if (categoryFromEdit) {
        const option = node('option', category.label); option.value = category.id;
        $('#category').append(option); $('#category').value = category.id;
      }
      $('#categoryDialog').close(); await load(data?.month); toast(renamingCategory?'Catégorie renommée.':'Catégorie créée.');
    } catch (e) { error('#categoryError', e.message); }
    finally { categoryBusy = false; $('#createCategory').disabled = false; }
  };
  load(reviewId?undefined:sessionStorage.getItem('budgetai.month')||undefined);
})();

(() => {
  let selected;
  try { selected=JSON.parse(sessionStorage.getItem('budgetai.accounts')||'null'); } catch { selected=null; }
  if(!Array.isArray(selected)||!selected.length)selected=null;
  let accounts=[],refresh=()=>{},dialog,body,title,close,footer,apply,count,overview,draft=[],search='',editing,busy=false;
  const el=(tag,text,cls)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;};
  const ids=()=>accounts.map(account=>account.id);
  const validDraft=()=>ids().filter(id=>draft.includes(id));
  const bank=()=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d','M3 9h18M3 20h18M5 9v8m5-8v8m4-8v8m5-8v8M2 6.5 12 2l10 4.5V9H2Z');svg.append(path);return svg;};
  const summary=()=>{
    const chosen=accounts.filter(account=>selected===null||selected.includes(account.id));
    if(!accounts.length)return ['Aucun compte','Importez un relevé pour commencer'];
    if(chosen.length===1)return [chosen[0].label,accounts.length===1?'Votre compte bancaire':`1 compte sur ${accounts.length}`];
    const all=chosen.length===accounts.length;
    return [all?'Tous les comptes':`${chosen.length} comptes sélectionnés`,all?`Vue globale · ${chosen.length} comptes`:chosen.map(account=>account.label).join(' · ')];
  };
  function trigger(){
    const container=document.getElementById('accountFilter');if(!container)return;
    let button=container.querySelector('.account-trigger');
    if(!button){button=el('button',undefined,'account-trigger');button.type='button';button.onclick=open;const icon=el('span',undefined,'account-icon');icon.append(bank());const text=el('span',undefined,'account-trigger-copy');text.append(el('span','COMPTES BANCAIRES','account-eyebrow'),el('strong','','account-trigger-title'),el('span','','account-detail'));button.append(icon,text,el('span','⌄','account-arrow'));container.replaceChildren(button);}
    const [name,detail]=summary();button.querySelector('strong').textContent=name;button.querySelector('.account-detail').textContent=detail;button.disabled=!accounts.length;button.setAttribute('aria-label','Choisir les comptes, '+name);
  }
  function updateChoices(){
    if(!dialog||editing)return;
    const chosen=validDraft(),all=accounts.length>0&&chosen.length===accounts.length;
    overview.classList.toggle('is-selected',all);overview.setAttribute('aria-pressed',String(all));
    dialog.querySelectorAll('.account-item').forEach(row=>{const checked=chosen.includes(row.dataset.id);row.classList.toggle('is-selected',checked);row.querySelector('input').checked=checked;row.querySelector('.account-detail').textContent=checked?'Inclus dans les résultats':'Hors de la sélection';});
    count.textContent=`${chosen.length} / ${accounts.length}`;
    footer.querySelector('p').textContent=chosen.length?`${chosen.length} compte${chosen.length>1?'s':''} sélectionné${chosen.length>1?'s':''}`:'Sélectionnez au moins un compte.';
    apply.disabled=!chosen.length;
  }
  function rows(container){
    container.replaceChildren();
    const matches=accounts.filter(account=>account.label.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
    matches.forEach(account=>{
      const row=el('div',undefined,'account-item');row.dataset.id=account.id;
      const choice=el('label',undefined,'account-choice'),input=el('input');input.type='checkbox';input.setAttribute('aria-label',account.label);
      input.onchange=()=>{draft=input.checked?[...draft.filter(id=>id!==account.id),account.id]:draft.filter(id=>id!==account.id);updateChoices();};
      const text=el('span',undefined,'account-row-copy');text.append(el('strong',account.label),el('span','','account-detail'));choice.append(input,text);
      const rename=el('button','Renommer','account-rename');rename.type='button';rename.setAttribute('aria-label','Renommer '+account.label);rename.onclick=()=>renameView(account);
      row.append(choice,rename);container.append(row);
    });
    if(!matches.length)container.append(el('p','Aucun compte ne correspond à votre recherche.','account-empty'));
    updateChoices();
  }
  function mainView(){
    editing=undefined;busy=false;title.textContent='Choisir les comptes';close.textContent='×';close.setAttribute('aria-label','Fermer le choix des comptes');close.onclick=()=>dialog.close();
    body.replaceChildren(el('p','Les montants et les dépenses suivent votre sélection.','account-intro'));
    overview=el('button',undefined,'account-overview');overview.type='button';overview.setAttribute('aria-label','Sélectionner tous les comptes');const text=el('span');text.append(el('strong','Tous les comptes'),el('span','Une vue globale de votre budget','account-detail'));overview.append(text,el('span','✓','account-overview-check'));overview.onclick=()=>{draft=ids();updateChoices();};body.append(overview);
    const heading=el('div',undefined,'account-section');count=el('span','','account-count');heading.append(el('span','VOS COMPTES','account-eyebrow'),count);body.append(heading);
    const list=el('div',undefined,'account-list');
    if(accounts.length>5){const input=el('input',undefined,'account-search');input.type='search';input.placeholder='Rechercher un compte…';input.setAttribute('aria-label','Rechercher un compte');input.value=search;input.oninput=()=>{search=input.value;rows(list);};body.append(input);}
    body.append(list);rows(list);
    apply.textContent='Afficher les résultats';apply.onclick=()=>{const chosen=validDraft();if(!chosen.length)return;selected=chosen.length===accounts.length?null:chosen;sessionStorage.setItem('budgetai.accounts',JSON.stringify(selected));dialog.close();trigger();refresh();};updateChoices();
  }
  function renameView(account){
    editing=account;title.textContent='Renommer le compte';close.textContent='‹';close.setAttribute('aria-label','Revenir au choix des comptes');close.onclick=()=>{if(!busy)mainView();};
    body.replaceChildren();const icon=el('div',undefined,'account-icon account-rename-icon');icon.append(bank());
    const intro=el('p','Donnez un nom facile à reconnaître à ce compte.','account-intro'),label=el('label',undefined,'account-name-label'),input=el('input',undefined,'account-search');input.value=account.label;input.maxLength=80;input.required=true;input.setAttribute('aria-label','Nom du compte');label.append(el('span','Nom du compte'),input);
    const error=el('p','','account-error');error.setAttribute('role','alert');body.append(icon,intro,label,el('p','Le changement de nom conserve vos relevés, vos opérations et votre sélection.','account-detail'),error);
    footer.querySelector('p').textContent='Le nom est partagé sur le web et le mobile.';apply.textContent='Enregistrer le nom';apply.disabled=false;
    input.oninput=()=>{apply.disabled=!input.value.trim();};
    const save=async()=>{
      if(busy||!input.value.trim())return;busy=true;apply.disabled=true;close.disabled=true;input.disabled=true;apply.textContent='Enregistrement…';error.textContent='';
      try{const response=await fetch('/api/accounts/'+encodeURIComponent(account.id),{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({label:input.value.trim()})});const result=await response.json();if(!response.ok)throw new Error(typeof result.detail==='string'?result.detail:'Impossible d’enregistrer le nom. Réessayez.');accounts=accounts.map(value=>value.id===account.id?{...value,label:result.label}:value);busy=false;close.disabled=false;mainView();trigger();refresh();}
      catch(e){error.textContent=e.message;busy=false;apply.disabled=!input.value.trim();close.disabled=false;input.disabled=false;apply.textContent='Enregistrer le nom';}
    };
    apply.onclick=save;input.onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();void save();}};input.focus();input.select();
  }
  function open(){
    if(dialog||!accounts.length)return;draft=selected===null?ids():ids().filter(id=>selected.includes(id));search='';
    dialog=el('dialog',undefined,'account-dialog');dialog.setAttribute('aria-labelledby','account-picker-title');
    const header=el('div',undefined,'account-dialog-header'),copy=el('div');title=el('h2','Choisir les comptes');title.id='account-picker-title';copy.append(el('span','VOTRE BUDGET','account-eyebrow'),title);close=el('button','×','account-close');close.type='button';header.append(copy,close);
    body=el('div',undefined,'account-dialog-body');footer=el('div',undefined,'account-dialog-footer');const feedback=el('p');feedback.setAttribute('aria-live','polite');apply=el('button','Afficher les résultats','account-apply');apply.type='button';footer.append(feedback,apply);dialog.append(header,body,footer);
    dialog.oncancel=event=>{if(busy)event.preventDefault();};dialog.onclick=event=>{if(event.target!==dialog||busy)return;const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();};
    dialog.onclose=()=>{dialog.remove();dialog=undefined;editing=undefined;document.querySelector('#accountFilter button')?.focus({preventScroll:true});};
    document.body.append(dialog);mainView();dialog.showModal();
  }
  window.AccountFilter={
    context(){return {month:sessionStorage.getItem('budgetai.month')||new Date().toLocaleDateString('sv-SE').slice(0,7),account_ids:selected};},
    setPeriod(month){sessionStorage.setItem('budgetai.month',month);},
    query(month){const query=new URLSearchParams();if(month)query.set('month',month);if(selected)selected.forEach(id=>query.append('account_id',id));return '?'+query;},
    render(next,reload){
      accounts=next;refresh=reload;
      if(!document.getElementById('account-picker-styles')){const link=el('link');link.id='account-picker-styles';link.rel='stylesheet';link.href='assets/css/accounts.css';document.head.append(link);}
      let container=document.getElementById('accountFilter');if(!container){container=el('div');container.id='accountFilter';const anchor=document.querySelector('.page-head')||document.querySelector('main header')||document.querySelector('main');anchor.after(container);}
      trigger();if(dialog&&!editing){
        const top=body.scrollTop,active=document.activeElement;
        const focusLabel=dialog.contains(active)?active?.getAttribute('aria-label'):null;
        mainView();body.scrollTop=top;
        if(focusLabel){const candidate=[...dialog.querySelectorAll('[aria-label]')].find(node=>node.getAttribute('aria-label')===focusLabel);candidate?.focus({preventScroll:true});}
      }
    }
  };
})();

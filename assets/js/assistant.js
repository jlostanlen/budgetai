(() => {
  const $ = selector => document.querySelector(selector);
  let conversations = [], activeId = null, busy = false, failedQuestion = null;
  let toastTimer;
  const input = $('#chatInput');
  const toast = message => {
    $('#toast').textContent = message;
    $('#toast').classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3500);
  };
  let nextOffset=null,historyLoading=false;
  async function loadHistory(append=false){
    if(historyLoading)return;historyLoading=true;
    try{const page=await AssistantAPI.conversations(append?nextOffset:0);const existing=current();conversations=append?[...conversations,...page.conversations]:page.conversations;
      if(existing&&conversations.some(c=>c.id===existing.id))conversations=conversations.map(c=>c.id===existing.id?existing:c);
      nextOffset=page.next_offset;render();
    }catch(error){toast(error.message);}finally{historyLoading=false;}
  }
  function current() { return conversations.find(c => c.id === activeId); }
  function clearError() { failedQuestion = null; $('#chatError').hidden = true; }
  function updateSend() { $('#sendMessage').disabled = busy || !input.value.trim(); }
  function renderHistory() {
    const list = $('#historyList'); list.replaceChildren();
    if (!conversations.length) {
      const empty = document.createElement('p'); empty.className = 'history-empty';
      empty.textContent = 'Votre première discussion apparaîtra ici.'; list.append(empty);
    }
    conversations.forEach(c => {
      const row = document.createElement('div'); row.className = 'history-entry' + (c.id === activeId ? ' active' : '');
      const button = document.createElement('button'); button.type = 'button';
      button.textContent = c.title || c.messages[0]?.content || 'Nouvelle discussion'; button.title = button.textContent; button.disabled = busy;
      if (c.id === activeId) button.setAttribute('aria-current', 'true');
      button.onclick = async () => {if(busy)return;try{const chat=await AssistantAPI.conversation(c.id);conversations=conversations.map(item=>item.id===chat.id?chat:item);activeId=c.id;input.value='';clearError();render();}catch(error){toast(error.message);}};
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'delete-discussion'; remove.textContent = '×';
      remove.setAttribute('aria-label', 'Supprimer cette discussion'); remove.disabled = busy;
      remove.onclick = async () => {try{await AssistantAPI.remove(c.id);conversations=conversations.filter(item=>item.id!==c.id);if(activeId===c.id)activeId=null;clearError();render();}catch(error){toast(error.message);}};
      row.append(button, remove); list.append(row);
    });
    if(nextOffset!==null){const more=document.createElement('button');more.type='button';more.textContent='Discussions plus anciennes';more.onclick=()=>loadHistory(true);list.append(more);}
  }
  function appendMessage(message) {
    const row = document.createElement('article'); row.className = `message ${message.role}`;
    if (message.role === 'assistant') {
      const avatar = document.createElement('span'); avatar.className = 'message-avatar'; avatar.setAttribute('aria-hidden', 'true');
      const icon = document.createElement('i'); icon.className = 'chat-icon'; avatar.append(icon); row.append(avatar);
    }
    const body = document.createElement('div'); body.className = 'message-body';
    const label = document.createElement('span'); label.className = 'message-label'; label.textContent = message.role === 'user' ? 'Vous' : 'BudgetAI · ' + (message.source || 'Source de cet échange non enregistrée');
    const content = document.createElement('div'); content.className = 'message-content';
    // Text nodes only: model output, history and user input are never executable HTML.
    content.textContent = message.content;
    body.append(label, content); row.append(body); $('#conversation').append(row);
  }
  function scrollBottom() { $('#chatScroll').scrollTop = $('#chatScroll').scrollHeight; }
  function render() {
    renderHistory(); $('#conversation').replaceChildren();
    const messages = current()?.messages || [];
    $('#welcome').hidden = messages.length > 0;
    messages.forEach(appendMessage); updateSend(); scrollBottom();
  }
  async function checkStatus() {
    try {
      const status = await AssistantAPI.status();
      const real = status.data_source === 'imported';
      document.querySelectorAll('.source-pill').forEach(el => el.textContent = real ? 'Transactions importées' : 'Données de démonstration');
      $('.demo-badge').textContent = real ? 'VOS DONNÉES' : 'DÉMO';
      $('#sourceState').textContent = real ? 'Transactions extraites et stockées' : 'Données de démonstration';
      $('#sourceDescription').textContent = real ? 'L’assistant consulte vos transactions enregistrées, sans relire les fichiers. Les documents exclus des calculs restent consultables sur demande.' : 'Aucun import pour le moment : les réponses utilisent les exemples du dashboard.';
      const context=AccountFilter.context();
      const accounts=(status.accounts||[]).filter(a=>context.account_ids===null||context.account_ids.includes(a.id));
      const period=new Date(context.month+'-01T12:00:00').toLocaleDateString('fr-FR',{month:'long',year:'numeric'});
      $('#sourceDescription').textContent += ' Sélection actuelle : '+period+' · '+(accounts.map(a=>a.label).join(' · ')||'Aucun compte')+'. Catégories à jour.';
      $('#documentCount').textContent = (status.document_count || 0) + ' fichier(s)';
      $('.model-tag').textContent = status.model === 'gpt-5.6-luna' ? 'GPT 5.6 Luna' : status.model;
      $('#connectionStatus').textContent = status.configured ? '' : 'Assistant à configurer : ajoutez votre clé API dans backend/.env, puis redémarrez le serveur.';
    } catch {
      $('#connectionStatus').textContent = 'Backend indisponible. Ouvrez BudgetAI depuis le serveur FastAPI pour utiliser le chat.';
    }
  }
  async function send(question) {
    question = question.trim();
    if (busy || !question) return;
    const messages = current()?.messages || [];
    if (messages.length >= 1000) {
      toast('Cette discussion est longue. Ouvrez une nouvelle discussion pour continuer.'); return;
    }
    clearError(); busy = true; updateSend(); input.disabled = true; $('#newConversation').disabled = true;
    renderHistory(); $('#welcome').hidden = true; appendMessage({role: 'user', content: question});
    input.value = ''; $('#thinking').hidden = false; scrollBottom();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 180000);
    try {
      const result = await AssistantAPI.ask([{role: 'user', content: question}], controller.signal, activeId);
      if(!result.conversation?.id)throw new Error('La discussion n’a pas pu être enregistrée. Réessayez.');
      activeId=result.conversation.id;conversations=[result.conversation,...conversations.filter(c=>c.id!==activeId)];
      $('#connectionStatus').textContent = '';
    } catch (error) {
      failedQuestion = question; input.value = question;
      $('#errorText').textContent = error.name === 'AbortError' ? 'Le délai de réponse est dépassé. Vous pouvez réessayer.' : error instanceof TypeError ? 'Connexion impossible au serveur. Vérifiez votre connexion et réessayez.' : error.message;
      $('#chatError').hidden = false;
    } finally {
      clearTimeout(timeout); busy = false; input.disabled = false; $('#newConversation').disabled = false; $('#thinking').hidden = true;
      render(); input.focus();
    }
  }
  $('#chatForm').onsubmit = event => { event.preventDefault(); send(input.value); };
  input.oninput = updateSend;
  input.onkeydown = event => {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) { event.preventDefault(); send(input.value); }
  };
  $('#retry').onclick = () => send(input.value.trim() || failedQuestion || '');
  $('#newConversation').onclick = () => { activeId = null; input.value = ''; clearError(); render(); input.focus(); };
  document.querySelectorAll('[data-question]').forEach(button => button.onclick = () => { input.value = button.dataset.question; updateSend(); input.focus(); });
  document.querySelectorAll('[data-inactive]').forEach(link => link.onclick = event => { event.preventDefault(); toast('Cette fonctionnalité sera ajoutée prochainement.'); });
  render(); checkStatus();void loadHistory();
  window.addEventListener('focus',()=>{checkStatus();if(!busy)void loadHistory();});
  const question = new URLSearchParams(location.search).get('question');
  if (question) { activeId = null; input.value = question.slice(0, 4000); render(); input.focus(); history.replaceState(null, '', location.pathname); }
})();

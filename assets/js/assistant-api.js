/* Financial values are calculated by the server; the browser supplies only view filters. */
window.AssistantAPI = {
  async conversations(offset=0) {
    const response=await fetch('/api/assistant/conversations?offset='+offset,{signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('Impossible de charger les discussions. Réessayez.');
    return response.json();
  },
  async conversation(id) {
    const response=await fetch('/api/assistant/conversations/'+encodeURIComponent(id),{signal:AbortSignal.timeout(10000)});
    if(!response.ok)throw new Error('Impossible d’ouvrir cette discussion. Actualisez l’historique.');
    return response.json();
  },
  async remove(id) {
    const response=await fetch('/api/assistant/conversations/'+encodeURIComponent(id),{method:'DELETE'});
    if(!response.ok)throw new Error('Impossible de supprimer la discussion. Réessayez.');
  },
  async status() {
    const response = await fetch('/api/assistant/status', {signal: AbortSignal.timeout(8000)});
    if (!response.ok) throw new Error('Backend indisponible. Lancez BudgetAI avec FastAPI pour utiliser le chat.');
    return response.json();
  },
  async ask(messages, signal, conversationId) {
    const response = await fetch('/api/assistant/chat', {
      method: 'POST', headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({messages,conversation_id:conversationId||null,context:AccountFilter.context()}), signal,
    });
    let result;
    try { result = await response.json(); } catch { throw new Error('Le serveur ne répond pas correctement. Vérifiez que FastAPI est démarré.'); }
    if (!response.ok) {
      throw new Error(typeof result.detail === 'string' ? result.detail : 'La conversation est trop longue ou invalide. Commencez une nouvelle discussion.');
    }
    if (typeof result.answer !== 'string' || !result.answer.trim()) throw new Error('La réponse est vide. Vous pouvez réessayer.');
    return result;
  },
};

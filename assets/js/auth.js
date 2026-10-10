(() => {
  const $ = id => document.getElementById(id);
  const fragment = new URLSearchParams(location.hash.slice(1));
  const reset = fragment.get('reset'), verify = fragment.get('verify');
  history.replaceState(null, '', location.pathname);
  let mode = reset ? 'reset-password' : 'login';
  let busy = false;
  async function call(path, body) {
    const response = await fetch('/api/auth/' + path, {method: body === undefined ? 'GET' : 'POST', headers: {'Content-Type':'application/json'}, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin'});
    if (response.status === 204) return;
    const result = await response.json();
    if (!response.ok) throw new Error(typeof result.detail === 'string' ? result.detail : 'Vérifie les champs saisis.');
    return result;
  }
  function render() {
    $('title').textContent = mode === 'register' ? 'Créer mon compte' : mode === 'forgot-password' ? 'Retrouver mon compte' : mode === 'reset-password' ? 'Nouveau mot de passe' : 'Me connecter';
    $('submit').textContent = mode === 'register' ? 'Créer mon compte' : mode === 'forgot-password' ? 'Envoyer le lien' : mode === 'reset-password' ? 'Enregistrer' : 'Me connecter';
    $('emailLabel').hidden = mode === 'reset-password'; $('email').required = mode !== 'reset-password';
    $('passwordLabel').hidden = mode === 'forgot-password'; $('password').required = mode !== 'forgot-password';
    $('password').autocomplete = mode === 'login' ? 'current-password' : 'new-password';
    $('consentLabel').hidden = mode !== 'register'; $('forgot').hidden = mode !== 'login';
    $('switch').hidden = mode === 'reset-password'; $('switch').textContent = mode === 'login' ? 'Créer un compte' : 'J’ai déjà un compte';
  }
  async function action(callback) {
    if (busy) return; busy=true; $('error').textContent=''; document.querySelectorAll('button').forEach(b=>b.disabled=true);
    try {await callback();} catch(error) {$('error').textContent=error.message;} finally {busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}
  }
  async function check() {
    const user = await call('me');
    if (user.verified) {BudgetAISession.clearData();location.replace('index.html');return;}
    $('title').textContent='Confirme ton adresse'; $('authForm').hidden=true; $('pending').hidden=false; $('switch').hidden=true; $('forgot').hidden=true;
  }
  $('authForm').addEventListener('submit', event=>{event.preventDefault();void action(async()=>{
    const result = await call(mode, mode === 'reset-password' ? {token:reset,password:$('password').value} : {email:$('email').value.trim(),password:$('password').value,ai_consent:$('consent').checked});
    $('password').value='';
    if (mode === 'register' || mode === 'login') {BudgetAISession.clearData();await check();}
    else {$('message').textContent=result.message;if(mode==='reset-password'){mode='login';render();}}
  });});
  $('switch').onclick=()=>{mode=mode==='login'?'register':'login';$('error').textContent='';$('message').textContent='';render();};
  $('forgot').onclick=()=>{mode='forgot-password';render();};
  $('check').onclick=()=>void action(check);
  $('resend').onclick=()=>void action(async()=>{$('message').textContent=(await call('resend-verification',{})).message;});
  $('logout').onclick=()=>void action(async()=>{await call('logout',{});BudgetAISession.clearData();location.reload();});
  render();
  if(verify) void action(async()=>{$('message').textContent=(await call('verify-email',{token:verify})).message;try{await check();}catch{/* Login is available after confirming on another device. */}});
  else if(!reset) void check().catch(()=>{});
})();

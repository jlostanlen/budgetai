(async()=>{
 const $=id=>document.getElementById(id);
 async function call(path,method='GET',body){const response=await fetch('/api/auth/'+path,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});if(response.status===204)return;const result=await response.json();if(!response.ok)throw new Error(typeof result.detail==='string'?result.detail:'Vérifie les champs.');return result;}
 async function refresh(){const user=await call('me');$('email').textContent=user.email;$('consentState').textContent=user.ai_consent?'Transmission autorisée.':'Transmission désactivée.';$('consent').textContent=user.ai_consent?'Retirer mon autorisation':'J’autorise la transmission à l’IA';$('consent').dataset.enabled=String(user.ai_consent);}
 let busy=false;async function run(action){if(busy)return;busy=true;$('error').textContent='';document.querySelectorAll('button').forEach(b=>b.disabled=true);try{await action();}catch(e){$('error').textContent=e.message;}finally{busy=false;document.querySelectorAll('button').forEach(b=>b.disabled=false);}}
 $('consent').onclick=()=>void run(async()=>{await call('ai-consent',$('consent').dataset.enabled==='true'?'DELETE':'POST',{});await refresh();});
 $('logout').onclick=()=>void run(async()=>{await call('logout','POST',{});BudgetAISession.clearData();location.replace('auth.html');});
 $('delete').onclick=()=>{if(!$('password').value){$('error').textContent='Saisis ton mot de passe.';return;}if(confirm('Supprimer ton compte et toutes tes données ? Cette action est définitive.'))void run(async()=>{await call('account','DELETE',{password:$('password').value});BudgetAISession.clearData();location.replace('auth.html');});};
 await run(refresh);
})();

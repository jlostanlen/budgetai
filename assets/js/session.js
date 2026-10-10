(() => {
 const originalFetch=window.fetch.bind(window);
 const pages=location.origin==='https://jlostanlen.github.io'&&location.pathname.startsWith('/budgetai/');
 const apiOrigin='https://budgetai.152-228-129-204.sslip.io';
 const key='budgetai.session';
 const authPage=location.pathname.endsWith('/auth.html');
 function clearData(){const token=pages?sessionStorage.getItem(key):null;sessionStorage.clear();if(token)sessionStorage.setItem(key,token);}
 window.BudgetAISession={clearData};
 window.fetch=async(input,options={})=>{
  const path=typeof input==='string'?input:null;
  const api=path?.startsWith('/api/');
  if(pages&&api){
   const headers=new Headers(options.headers);
   const token=sessionStorage.getItem(key);
   if(token)headers.set('Authorization','Bearer '+token);
   options={...options,headers,credentials:'omit'};
   input=apiOrigin+path;
  }
  const response=await originalFetch(input,options);
  if(pages&&api&&response.ok&&(path==='/api/auth/login'||path==='/api/auth/register')){
   const result=await response.clone().json();
   sessionStorage.clear();
   if(result.token)sessionStorage.setItem(key,result.token);
  }
  if(pages&&api&&response.ok&&(path==='/api/auth/logout'||path==='/api/auth/account'&&options.method==='DELETE'))sessionStorage.clear();
  if(response.status===401&&api&&!authPage){sessionStorage.clear();location.replace('auth.html');}
  return response;
 };
 if(pages&&!authPage&&!sessionStorage.getItem(key))location.replace('auth.html');
 window.addEventListener('pageshow',event=>{if(event.persisted)location.reload();});
 document.addEventListener('DOMContentLoaded',()=>{document.querySelectorAll('.profile').forEach(link=>link.href='account.html');});
})();

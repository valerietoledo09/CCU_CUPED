// Supabase browser client. Only public anon/publishable keys belong in configuration.
export class CloudConflictError extends Error {
 constructor(){super('The shared calendar changed elsewhere. Load the latest calendar before saving again.');this.name='CloudConflictError';}
}
export function validateCloudConfig(config){
 if(!config||typeof config.url!=='string'||typeof config.key!=='string')throw new Error('Enter a Supabase project URL and public publishable or anon key.');
 let url;try{url=new URL(config.url);}catch{throw new Error('Enter a valid HTTPS Supabase project URL.');}
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||(url.pathname!=='/'&&url.pathname!==''))throw new Error('Use the HTTPS project origin without a path, query, or credentials.');
 const key=config.key.trim();let isAnon=false;
 if(key.startsWith('eyJ')){try{const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));isAnon=payload.role==='anon';}catch{}}
 if(!(key.startsWith('sb_publishable_')&&key.length>20)&&!isAnon)throw new Error('Use the public publishable or anon key. Secret and service-role keys must never be used in this website.');
 const planId=config.planId||null;
 if(planId&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(planId))throw new Error('Invalid shared calendar ID.');
 return {url:url.origin,key,planId};
}
export class CloudCalendar {
 constructor(config,fetcher=globalThis.fetch){this.config=validateCloudConfig(config);this.fetcher=fetcher;this._session=null;this._refreshing=null;this.onSession=null;}
 get session(){return this._session?structuredClone(this._session):null;}
 restoreSession(session){
  if(!session){this._session=null;return;}
  if(session.project_url!==this.config.url||typeof session.access_token!=='string'||typeof session.refresh_token!=='string'||!Number.isFinite(session.expires_at))throw new Error('This sign-in session belongs to a different project or is invalid. Sign in again.');
  this._session=structuredClone(session);
 }
 _setSession(data){
  this._session=data?{access_token:data.access_token,refresh_token:data.refresh_token,expires_at:data.expires_at||Math.floor(Date.now()/1000)+(data.expires_in||3600),user:data.user||null,project_url:this.config.url}:null;
  this.onSession?.(this.session);
 }
 async _request(path,{method='GET',body,authenticated=false,headers={}}={}){
  if(!path.startsWith('/auth/v1/')&&!path.startsWith('/rest/v1/'))throw new Error('Unsupported calendar API path.');
  if(authenticated)await this._ensureSession();
  const requestHeaders={apikey:this.config.key,...headers};
  if(body!==undefined)requestHeaders['Content-Type']='application/json';
  if(authenticated)requestHeaders.Authorization='Bearer '+this._session.access_token;
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
  let response,text;try{response=await this.fetcher.call(globalThis,this.config.url+path,{method,headers:requestHeaders,body:body===undefined?undefined:JSON.stringify(body),redirect:'error',credentials:'omit',cache:'no-store',signal:controller.signal});text=await response.text();}catch{throw new Error('Could not reach the shared calendar. Check your connection and project URL.');}finally{clearTimeout(timeout);}
  let result=null;
  if(text){try{result=JSON.parse(text);}catch{if(response.ok)throw new Error('The shared calendar returned an unexpected response.');}}
  if(!response.ok){
   if(response.status===401)throw new Error('Sign in again to edit the shared calendar.');
   if(response.status===403)throw new Error('This account cannot edit this calendar. Sign in with the calendar owner account.');
   if(response.status===404)throw new Error('The shared calendar was not found. Check the connection and database setup.');
   // Do not echo request values, server debug fields, tokens, or passwords.
   throw new Error(result?.error_description||result?.msg||result?.message||'The shared calendar request failed.');
  }
  return result;
 }
 async signIn(email,password){
  const data=await this._request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
  if(!data?.access_token||!data?.refresh_token)throw new Error('Sign-in did not return a valid session.');
  this._setSession(data);
  try{await this.getUser();}catch(error){this._setSession(null);throw error;}
  return this.session;
 }
 async _ensureSession(){
  if(!this._session)throw new Error('Sign in with the calendar owner account to save changes.');
  if(this._session.expires_at>Math.floor(Date.now()/1000)+30)return;
  if(!this._refreshing)this._refreshing=(async()=>{
   try{
    const data=await this._request('/auth/v1/token?grant_type=refresh_token',{method:'POST',body:{refresh_token:this._session.refresh_token}});
    if(!data?.access_token||!data?.refresh_token)throw new Error('Your sign-in expired. Sign in again.');
    this._setSession(data);
   }catch(error){this._setSession(null);throw error;}finally{this._refreshing=null;}
  })();
  await this._refreshing;
 }
 async getUser(){
  const data=await this._request('/auth/v1/user',{authenticated:true});
  if(!data?.id)throw new Error('Could not verify the calendar owner account.');
  this._session.user=data;return structuredClone(data);
 }
 async signOut(){try{if(this._session)await this._request('/auth/v1/logout?scope=local',{method:'POST',authenticated:true});}finally{this._setSession(null);}}
 _planPath(extra=''){
  if(!this.config.planId)throw new Error('Connect to a shared calendar first.');
  return '/rest/v1/plans?id=eq.'+encodeURIComponent(this.config.planId)+extra;
 }
 _row(rows){
  const row=Array.isArray(rows)?rows[0]:null;
  if(!row||!Number.isInteger(row.revision)||!row.state||typeof row.state!=='object')throw new Error('The shared calendar is missing or has an invalid format.');
  return row;
 }
 async load(){return this._row(await this._request(this._planPath('&select=id,owner_id,state,revision,updated_at')));}
 async loadIfChanged(knownRevision){
  if(!Number.isInteger(knownRevision))return this.load();
  const rows=await this._request(this._planPath('&select=id,revision'));
  if(!Array.isArray(rows)||!rows[0]||!Number.isInteger(rows[0].revision))throw Error('The shared calendar is missing or has an invalid format.');
  if(rows[0].revision===knownRevision)return null;
  return this.load();
 }
 async createPlan(state){
  const user=await this.getUser();
  const id=this.config.planId||crypto.randomUUID();
  const rows=await this._request('/rest/v1/plans',{method:'POST',authenticated:true,headers:{Prefer:'return=representation'},body:{id,owner_id:user.id,state,revision:1}});
  const row=this._row(rows);this.config.planId=id;return row;
 }
 async save(state,expectedRevision){
  if(!Number.isInteger(expectedRevision)||expectedRevision<1)throw new Error('Load the shared calendar before saving.');
  const user=await this.getUser();
  const rows=await this._request(this._planPath('&revision=eq.'+expectedRevision+'&owner_id=eq.'+encodeURIComponent(user.id)),{method:'PATCH',authenticated:true,headers:{Prefer:'return=representation'},body:{state,revision:expectedRevision+1,updated_at:new Date().toISOString()}});
  if(Array.isArray(rows)&&rows.length===0)throw new CloudConflictError();
  return this._row(rows);
 }
}

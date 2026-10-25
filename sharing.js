import {validState} from './model.js';
export async function shareUrl(base,state,week){
 const url=new URL(base);url.pathname=url.pathname.replace(/[^/]*$/, '')+'view.html';url.search='';
 const data=JSON.stringify({state,week});
 if(typeof CompressionStream==='undefined')url.hash=new URLSearchParams({plan:data}).toString();
 else{
  const compressed=await new Response(new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
  const packed=btoa(String.fromCharCode(...new Uint8Array(compressed))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  url.hash='packed='+packed;
 }
 return url.href;
}
export async function readSharedPlan(hash){
 const params=new URLSearchParams(hash.replace(/^#/, ''));let raw=params.get('plan');
 const packed=params.get('packed');
 if(packed){
  const bytes=Uint8Array.from(atob(packed.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  raw=await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
 }
 if(!raw)return null;
 const parsed=JSON.parse(raw);
 if(!validState(parsed.state)||!/^\d{4}-\d{2}-\d{2}$/.test(parsed.week))throw Error('Invalid shared plan');
 return parsed;
}

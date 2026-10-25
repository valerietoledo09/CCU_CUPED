import {validState} from './model.js';
export function shareUrl(base,state,week){
 const url=new URL(base);url.search='?view=1';url.hash=new URLSearchParams({plan:JSON.stringify({state,week})}).toString();return url.href;
}
export function readSharedPlan(hash){
 const raw=new URLSearchParams(hash.replace(/^#/, '')).get('plan');
 if(!raw)return null;
 const parsed=JSON.parse(raw);
 if(!validState(parsed.state)||!/^\d{4}-\d{2}-\d{2}$/.test(parsed.week))throw Error('Invalid shared plan');
 return parsed;
}

import {isValidTeamPhoto} from './team-photo.js';
export const publicSettingsCache='cuped-public-website-settings-v1';
export const websiteDefaults={
 portalTitle:'Choose your CUPED school',
 schoolName:'Coral Reef Senior High School',
 tabTitle:'CUPED intern website',
 homeHeading:'Your CCU Schedule, Simplified.',
 subtitle:'Making everything easier for you! At the hands of everyone, all in one place.',
 announcement:'Let’s promote EdFed and meet that quota! If you have any questions, just ask your lead intern or Ms. Mirabal in Room 305.',
 sidebarMessage:'Cuda Credit Union',
 primaryColor:'#245b46',
 backgroundColor:'#f7f8f4',
 font:'DM Sans'
};
const limits={portalTitle:100,schoolName:120,tabTitle:80,homeHeading:140,subtitle:300,announcement:1000,sidebarMessage:100};
export function normalizeWebsiteSettings(value={}){
 const settings={...websiteDefaults};
 for(const [key,max] of Object.entries(limits))if(typeof value?.[key]==='string'&&(value[key].trim()||['subtitle','announcement','sidebarMessage'].includes(key)))settings[key]=value[key].trim().slice(0,max);
 for(const key of ['primaryColor','backgroundColor'])if(typeof value?.[key]==='string'&&/^#[0-9a-f]{6}$/i.test(value[key]))settings[key]=value[key];
 if(['DM Sans','Arial','Georgia'].includes(value?.font))settings.font=value.font;
 settings.logo=value?.logo&&isValidTeamPhoto(value.logo)?value.logo:null;
 return settings;
}
export function colorContrast(a,b){
 function luminance(hex){const c=hex.slice(1).match(/../g).map(s=>parseInt(s,16)/255).map(v=>v<=.04045?v/12.92:Math.pow((v+.055)/1.055,2.4));return .2126*c[0]+.7152*c[1]+.0722*c[2];}
 const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
export function validateWebsiteSettings(settings){
 if(colorContrast(settings.primaryColor,'#ffffff')<4.5)throw Error('Choose a darker primary color so white button text stays readable.');
 if(colorContrast(settings.backgroundColor,'#243b35')<4.5)throw Error('Choose a lighter page background so the text stays readable.');
 return settings;
}
export function schoolHomeUrl(){return new URL('index.html',location.href).href;}
export function normalizeSchoolDirectory(value,settings=websiteDefaults){
 const home=schoolHomeUrl(),schools=[{id:'coral-reef',name:settings.schoolName,url:home,current:true}];
 const ids=new Set(['coral-reef']);
 for(const entry of Array.isArray(value)?value:[]){
  if(entry?.id==='coral-reef')continue;
  if(!entry||typeof entry.name!=='string'||!entry.name.trim()||typeof entry.url!=='string')throw Error('Each school link needs a name and website address.');
  const url=new URL(entry.url.trim());
  if(url.protocol!=='https:'||url.username||url.password)throw Error('School websites must use HTTPS and cannot include sign-in credentials.');
  const current=new URL(home);
  if(url.origin===current.origin)throw Error('Another school needs a separate website with its own calendar and access. Do not point it at this school’s site.');
  const id=typeof entry.id==='string'&&/^[a-z0-9-]{1,80}$/i.test(entry.id)?entry.id:crypto.randomUUID();
  if(ids.has(id))throw Error('School links must have different IDs.');
  ids.add(id);schools.push({id,name:entry.name.trim().slice(0,120),url:url.href,current:false});
 }
 if(schools.length>30)throw Error('Keep the school directory to 30 entries or fewer.');
 return schools;
}
export function publicWebsiteData(state={}){
 const settings=normalizeWebsiteSettings(state.siteSettings);
 let schools;try{schools=normalizeSchoolDirectory(state.schoolDirectory,settings);}catch{schools=normalizeSchoolDirectory([],settings);}
 return {siteSettings:settings,schoolDirectory:schools};
}
export function cacheWebsiteData(state){
 try{const data=publicWebsiteData(state);data.siteSettings.logo=null;localStorage.setItem(publicSettingsCache,JSON.stringify(data));}catch{}
}
export function applyWebsiteSettings(state={}){
 const s=normalizeWebsiteSettings(state.siteSettings);
 document.documentElement.style.setProperty('--green',s.primaryColor);
 document.documentElement.style.setProperty('--paper',s.backgroundColor);
 const font=s.font==='Georgia'?'Georgia, serif':s.font==='Arial'?'Arial, sans-serif':'"DM Sans", Arial, sans-serif';
 document.documentElement.style.setProperty('--body-font',font);
 document.documentElement.style.setProperty('--heading-font',s.font==='DM Sans'?'Manrope, Arial, sans-serif':font);
 document.title=s.tabTitle;
 const icon=document.querySelector('link[rel="icon"]');if(icon){icon.href=s.logo?s.logo.dataUrl:'assets/cuped-logo.png?v=1';icon.type=s.logo?s.logo.dataUrl.slice(5,s.logo.dataUrl.indexOf(';')):'image/png';}
 for(const image of document.querySelectorAll('.cuped-logo,.signin-logo,.portal-logo')){image.src=s.logo?s.logo.dataUrl:'assets/cuped-logo.png';image.alt='CUPED — '+s.schoolName;}
 const title=document.querySelector('#title');
 if(title&&document.querySelector('[data-tab="schedule"]')?.classList.contains('active'))title.textContent=s.homeHeading;
 const subtitle=document.querySelector('#subtitle');if(subtitle){subtitle.textContent=s.subtitle;subtitle.hidden=!s.subtitle;}
 const announcement=document.querySelector('#calendar-announcement');if(announcement){announcement.textContent=s.announcement;announcement.hidden=!s.announcement;}
 const sidebar=document.querySelector('#sidebar-message');if(sidebar)sidebar.textContent=s.sidebarMessage;
 const brand=document.querySelector('.brand .tiny');if(brand)brand.textContent=s.schoolName+' · CUPED';
 return s;
}

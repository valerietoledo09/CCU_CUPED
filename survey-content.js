export const defaultGoogleFormUrl='https://docs.google.com/forms/d/e/1FAIpQLSd7KX4psh0Q_r6KtN0GF7PCgdAeDsDpffVU1ioZ3if5gaObHg/viewform?usp=header';
export const feedbackEmail='0643122@students.dadeschools.net';
export const feedbackQuestions=[
 ['clarity','How clearly did the interns explain the information?'],
 ['engagement','How well did the interns engage your students?'],
 ['preparation','How prepared and organized were the interns?'],
 ['professionalism','How professional and respectful were the interns?'],
 ['pacing','How appropriate were the pace and use of class time?'],
 ['usefulness','How useful and relevant was the presentation for your students?']
];
export const ratingLabels={'1':'Needs significant improvement','2':'Needs some improvement','3':'Satisfactory','4':'Very good','5':'Excellent',na:'Not observed / not applicable'};
export function buildFeedback(values){
 const lines=[];let answered=false;
 for(const [key,question] of feedbackQuestions){const value=String(values[key]||'');if(value&&!Object.hasOwn(ratingLabels,value))throw Error('Choose a listed rating.');if(value)answered=true;lines.push(`${question}\n${value?(value==='na'?ratingLabels[value]:value+'/5 — '+ratingLabels[value]):'Not answered'}`);}
 const worked=String(values.worked||'').trim().slice(0,600),improve=String(values.improve||'').trim().slice(0,600),future=String(values.future||'');
 if(future&&!['Yes','Maybe','Not right now'].includes(future))throw Error('Choose a listed follow-up preference.');
 if(!answered&&!worked&&!improve&&!future)throw Error('Please answer at least one question before preparing your email.');
 const teacher=String(values.teacher||'').trim().slice(0,160)||'Not provided',date=String(values.date||'').slice(0,10)||'Not provided';
 return {subject:'CUPED presentation feedback',body:`CUPED TEACHER FEEDBACK\nTeacher: ${teacher}\nPresentation date: ${date}\n\n${lines.join('\n\n')}\n\nWhat worked well?\n${worked||'Not answered'}\n\nWhat should we improve for next time?\n${improve||'Not answered'}\n\nWould you be open to a future classroom visit?\n${future||'Not answered'}\n\nThis feedback was prepared by the teacher for email delivery.`};
}
export function feedbackSurveyUrl(base,visit){
 const url=new URL('survey.html',base);url.search='';url.hash=visit?new URLSearchParams({teacher:visit.teacher,date:visit.date}).toString():'';return url.href;
}
export function surveyInvitation(visit,url){
 let google=false;try{normalizeGoogleFormLink(url);google=true;}catch{}
 return {subject:'Thank you — quick CUPED presentation feedback',body:`Hello ${visit?.teacher||'Teacher'},\n\nThank you for welcoming our CCU CUPED interns${visit?.date?' on '+visit.date:''}. We would appreciate about two minutes of feedback to help us improve future presentations.\n\nTeacher feedback survey:\n${url}\n\n${google?'You can skip any question. Submit your feedback directly in the Google Form; your name and email are optional. Please avoid including student personal information.':'You can skip any question. At the end, review your answers and send them through your email app to me. Your response comes from your email account and is not anonymous.'} If you prefer, simply reply with what worked well and one thing we could improve.\n\nThank you for your time and support,\nValerie Gutierrez\nCCU CUPED Project Lead`};
}
export function normalizeGoogleFormLink(value){
 const url=new URL(String(value).trim());
 if(url.protocol!=='https:')throw Error('Use the secure Google Form respondent link.');
 if(url.username||url.password)throw Error('Use a plain Google Form respondent link.');
 const short=url.hostname==='forms.gle'&&url.pathname.length>1;
 const full=url.hostname==='docs.google.com'&&/^\/forms\/(?:u\/\d+\/)?d\/(?:e\/)?[^/]+\/viewform\/?$/.test(url.pathname);
 if(!short&&!full)throw Error('Paste the teacher/respondent link (forms.gle or a Google Forms viewform URL), not an editor or response-sheet link.');
 return url.href;
}

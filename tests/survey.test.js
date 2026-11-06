import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildFeedback,feedbackQuestions,feedbackSurveyUrl,surveyInvitation} from '../survey-content.js';
import {setupOwnerResources} from '../owner-resources.js';
test('feedback requires an actual response, preserves optional blanks and rejects invented ratings',()=>{
 assert.throws(()=>buildFeedback({teacher:'Teacher',date:'2026-11-06'}),/at least one/);
 assert.throws(()=>buildFeedback({clarity:'6'}),/listed rating/);
 const feedback=buildFeedback({clarity:'4',improve:'Speak more slowly',future:'Maybe'});
 assert.match(feedback.body,/4\/5 — Very good/);assert.match(feedback.body,/Speak more slowly/);assert.match(feedback.body,/Not answered/);
 assert.equal(feedbackQuestions.length,6);
});
test('survey invitation uses teacher and date fragments without sending responses to the host',()=>{
 const visit={teacher:'Teacher A',date:'2026-11-06'};
 const url=new URL(feedbackSurveyUrl('https://example.org/index.html?owner=1',visit));
 assert.equal(url.pathname,'/survey.html');assert.equal(url.search,'');assert.equal(new URLSearchParams(url.hash.slice(1)).get('teacher'),'Teacher A');
 const invitation=surveyInvitation(visit,url.href);assert.match(invitation.body,/2026-11-06/);assert.match(invitation.body,/not anonymous/);assert.match(invitation.body,/email app/);
});
test('owner resource tools do not initialize for students or unverified sessions',()=>{
 assert.equal(setupOwnerResources(),null);assert.equal(setupOwnerResources({authorized:true,isAuthorized:()=>false}),null);
});
import {normalizeGoogleFormLink} from '../survey-content.js';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
test('only teacher-facing Google Form links can be used in invitations',()=>{
 assert.equal(normalizeGoogleFormLink('https://forms.gle/Example123'),'https://forms.gle/Example123');
 assert.match(normalizeGoogleFormLink('https://docs.google.com/forms/d/e/example/viewform'),/viewform$/);
 for(const url of ['https://docs.google.com/forms/d/example/edit','https://docs.google.com/spreadsheets/d/example/edit','https://evil.example/forms/d/example/viewform','http://forms.gle/example'])assert.throws(()=>normalizeGoogleFormLink(url));
 const invite=surveyInvitation({teacher:'Teacher',date:'2026-11-06'},'https://forms.gle/Example123');assert.match(invite.body,/Submit your feedback directly in the Google Form/);assert.doesNotMatch(invite.body,/send them through your email app/);
});
test('Google Form builder can resume without duplicating questions or response files',async()=>{
 const source=await readFile(new URL('../assets/create-cuped-google-form.gs',import.meta.url),'utf8');
 const props=new Map(),items=[],settings={},logs=[];let forms=0,sheets=0,destination=null;
 const form={getId:()=> 'form',getItems:()=>items,getDestinationId:()=>destination,setDestination(type,id){destination=id;},getPublishedUrl:()=> 'https://forms.gle/example',getEditUrl:()=> 'https://docs.google.com/forms/d/example/edit'};
 for(const key of ['setDescription','setCollectEmail','setLimitOneResponsePerUser','setPublishingSummary','setShowLinkToRespondAgain','setConfirmationMessage','setPublished','setAcceptingResponses'])form[key]=value=>{settings[key]=value;return form;};
 function add(){const item={title:'',getTitle(){return this.title;},setTitle(title){this.title=title;return this;}};for(const key of ['setRequired','setIncludesYear','setHelpText','setValidation','setChoiceValues'])item[key]=()=>item;items.push(item);return item;}
 for(const key of ['addTextItem','addDateItem','addMultipleChoiceItem','addParagraphTextItem'])form[key]=add;
 const sheet={getId:()=> 'sheet',getUrl:()=> 'https://docs.google.com/spreadsheets/d/example/edit'};
 const validation={requireTextIsEmail(){return this;},build(){return {};}};
 const context={PropertiesService:{getScriptProperties:()=>({getProperty:key=>props.get(key),setProperty:(key,value)=>props.set(key,value)})},FormApp:{create:()=>{forms++;return form;},openById:()=>form,createTextValidation:()=>validation,DestinationType:{SPREADSHEET:'sheet'}},SpreadsheetApp:{create:()=>{sheets++;return sheet;},openById:()=>sheet},Logger:{log:value=>logs.push(value)}};
 vm.createContext(context);vm.runInContext(source,context);context.createCupedTeacherFeedback();context.createCupedTeacherFeedback();
 assert.equal(forms,1);assert.equal(sheets,1);assert.equal(items.length,12);assert.equal(new Set(items.map(item=>item.title)).size,12);
 assert.equal(settings.setCollectEmail,false);assert.equal(settings.setPublishingSummary,false);assert.equal(settings.setPublished,true);assert.equal(destination,'sheet');assert.ok(logs.some(line=>line.startsWith('TEACHER SURVEY LINK:')));
});

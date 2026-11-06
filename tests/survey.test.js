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

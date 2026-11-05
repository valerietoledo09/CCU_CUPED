import {test} from 'node:test';
import assert from 'node:assert/strict';
import {cleanPrivateTeacher,setupPrivateTeachers,PRIVATE_TEACHERS_KEY} from '../private-teachers.js';
test('student and unverified sessions cannot access private teacher storage or DOM',()=>{
 const previous=globalThis.localStorage;globalThis.localStorage={getItem(){throw Error('Storage accessed');}};
 try{assert.equal(setupPrivateTeachers(),null);assert.equal(setupPrivateTeachers({authorized:true,isAuthorized:()=>false}),null);assert.equal(setupPrivateTeachers({authorized:false,isAuthorized:()=>true}),null);}finally{globalThis.localStorage=previous;}
});
test('private records retain only the minimal fields, separate from calendar state',()=>{
 assert.deepEqual(cleanPrivateTeacher({name:' Test Teacher ',date:'2026-11-04',notes:'Declined',email:'excluded@example.org',screenshot:'excluded'}),{name:'Test Teacher',date:'2026-11-04',notes:'Declined'});
 assert.throws(()=>cleanPrivateTeacher({name:''}));assert.throws(()=>cleanPrivateTeacher({name:'T',date:'bad'}));
 assert.notEqual(PRIVATE_TEACHERS_KEY,'cuped-planner-v1');
});

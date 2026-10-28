import {test} from 'node:test';
import assert from 'node:assert/strict';
import {MAX_TEAM_PHOTO_BYTES, isValidTeamPhoto, fileToTeamPhoto} from '../team-photo.js';
const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jMosAAAAASUVORK5CYII=';
const bytes = Uint8Array.from(atob(png), char => char.charCodeAt(0));
const photo = () => ({dataUrl: 'data:image/png;base64,' + png, alt: 'CCU CUPED team photo'});

test('older plans may omit a photo or explicitly clear it; valid photos preserve their original bytes', async () => {
 assert.ok(isValidTeamPhoto(undefined));assert.ok(isValidTeamPhoto(null));assert.ok(isValidTeamPhoto(photo()));
 const result = await fileToTeamPhoto(new File([bytes], 'team.png', {type:'image/png'}));
 assert.deepEqual(result, photo());
});

test('untrusted shared-photo values reject non-image URLs, SVG, malformed encoding, and unsupported shapes', () => {
 for (const value of [false, '', [], {}, {dataUrl: photo().dataUrl}, {...photo(),alt:''}, {...photo(),alt:'a'.repeat(301)},
  {...photo(),dataUrl:'https://example.com/team.png'}, {...photo(),dataUrl:'javascript:alert(1)'},
  {...photo(),dataUrl:'data:image/svg+xml;base64,'+btoa('<svg/>')},
  {...photo(),dataUrl:'data:image/png;base64,@@@='}, {...photo(),dataUrl:'data:image/png;base64,AAAA'},
  {...photo(),dataUrl:'data:image/jpeg;base64,'+png}, {...photo(),dataUrl:'data:image/png;base64,'+png+'\n'}]) assert.equal(isValidTeamPhoto(value), false);
});

test('files reject incorrect MIME signatures, unsupported image types, empty payloads and oversized input', async () => {
 await assert.rejects(()=>fileToTeamPhoto(new File([bytes],'wrong.jpg',{type:'image/jpeg'})),/image type/);
 await assert.rejects(()=>fileToTeamPhoto(new File(['<svg/>'],'team.svg',{type:'image/svg+xml'})),/JPG/);
 await assert.rejects(()=>fileToTeamPhoto(new File([],'empty.png',{type:'image/png'})),/Choose/);
 let read=false;
 await assert.rejects(()=>fileToTeamPhoto({size:MAX_TEAM_PHOTO_BYTES+1,type:'image/png',arrayBuffer(){read=true;throw Error('must not read');}}),/2 MB/);
 assert.equal(read,false);
 const oversized = new Uint8Array(MAX_TEAM_PHOTO_BYTES+1);oversized.set(bytes.subarray(0,8));
 assert.equal(isValidTeamPhoto({...photo(),dataUrl:'data:image/png;base64,'+Buffer.from(oversized).toString('base64')}),false);
});

test('browser decoding validates the file while leaving original photo bytes unchanged', async () => {
 const originalImage=globalThis.Image;
 try {
  let decoded;
  globalThis.Image=class {naturalWidth=1;naturalHeight=1;set src(value){decoded=value;queueMicrotask(()=>this.onload());}};
  assert.deepEqual(await fileToTeamPhoto(new File([bytes],'team.png',{type:'image/png'})), photo());
  assert.equal(decoded,photo().dataUrl);
  globalThis.Image=class {set src(value){queueMicrotask(()=>this.onerror());}};
  await assert.rejects(()=>fileToTeamPhoto(new File([bytes],'broken.png',{type:'image/png'})),/could not be opened/);
 } finally { if(originalImage===undefined)delete globalThis.Image;else globalThis.Image=originalImage; }
});

test('a photo at the size limit encodes safely without truncation or argument-count errors', async () => {
 const large = new Uint8Array(MAX_TEAM_PHOTO_BYTES);large.set([255,216,255]);large[large.length-1]=73;
 const result = await fileToTeamPhoto(new File([large],'team.jpg',{type:'image/jpeg'}));
 assert.ok(isValidTeamPhoto(result));
 assert.equal(result.dataUrl,'data:image/jpeg;base64,'+Buffer.from(large).toString('base64'));
});

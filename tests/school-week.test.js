import {test} from 'node:test';
import assert from 'node:assert/strict';
import {defaultSchoolWeek} from '../school-week.js';
const dateString=date=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
test('weekdays show current school week and weekends show next school week',()=>{
 for(const [instant,expected] of [
  ['2026-10-30T18:00:00Z','2026-10-26'],
  ['2026-10-31T16:00:00Z','2026-11-02'],
  ['2026-11-01T18:00:00Z','2026-11-02'],
  ['2026-11-02T16:00:00Z','2026-11-02'],
  ['2026-11-06T16:00:00Z','2026-11-02'],
  ['2026-11-07T16:00:00Z','2026-11-09'],
  ['2027-01-02T17:00:00Z','2027-01-04']
 ])assert.equal(dateString(defaultSchoolWeek(new Date(instant))),expected,instant);
});
test('rollover uses Miami midnight rather than UTC midnight and handles daylight saving',()=>{
 assert.equal(dateString(defaultSchoolWeek(new Date('2026-10-31T02:00:00Z'))),'2026-10-26');
 assert.equal(dateString(defaultSchoolWeek(new Date('2026-10-31T04:00:00Z'))),'2026-11-02');
 assert.equal(dateString(defaultSchoolWeek(new Date('2027-03-14T07:00:00Z'))),'2027-03-15');
});

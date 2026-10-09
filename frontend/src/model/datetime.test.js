import test from 'node:test';import assert from 'node:assert/strict';import {dateTimeText,dateTimeLabel,dateText,shortDate} from './portfolio.js';
test('Серийные18часовSheets сохраняют18часовМосквы',()=>{assert.equal(dateTimeText(46308.75),'2026-10-13T18:00:00+03:00');assert.equal(dateTimeLabel(46308.75),'13.10.2026 18:00');assert.equal(dateTimeLabel('2026-10-13T18:00:00+03:00'),'13.10.2026 18:00');});
test('Дата стадии сохраняет календарный день',()=>{assert.equal(dateText(46308.75),'2026-10-13');assert.equal(shortDate(46308.75),'13.10.2026');assert.equal(dateTimeLabel('2026-10-13'),'13.10.2026');});


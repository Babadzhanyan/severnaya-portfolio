import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import oldConfig from './fixtures/source_config_v18.json' with {type:'json'};
import config from '../data/live-config.js';
import {projectResponse} from '../data/projector.js';
import {filterPortfolio,isHistorical,googleLink,layerSummary} from './portfolio.js';
const previous=JSON.parse(readFileSync(new URL('./fixtures/ownership_fixture_v15.json',import.meta.url)));
const ideas=JSON.parse(readFileSync(new URL('../../public/review/new-100-ideas.json',import.meta.url)));
const baseline=projectResponse(previous,'2026-10-09T05:00:00Z',oldConfig);
const byKey=Object.fromEntries(oldConfig.blocks.map(b=>[b.key,b]));
const next=structuredClone(previous);
next.table.rows=Array.from({length:config.blocks.at(-1).feedLast},()=>({c:Array.from({length:config.transportColumns},()=>({v:'z:'}))}));
for(const block of config.blocks){const prior=byKey[block.key];for(let n=0;n<=prior.feedLast-prior.feedFirst;n++)next.table.rows[block.feedFirst-1+n]=structuredClone(previous.table.rows[prior.feedFirst-1+n]);}
const blocks=Object.fromEntries(config.blocks.map(b=>[b.key,b]));
for(const [n,idea] of ideas.entries()){
 const index=200+n,row=next.table.rows[blocks.initiatives.feedFirst-1+index];
 const values={0:idea.code,1:idea.title,2:idea.team,3:idea.owner,4:'L0 Входящие предложения',5:'Обсудить',13:idea.process,18:'Участки проверки: '+idea.process_detail+' / Результат: '+idea.result,44:'Паспортные метаданные: '+JSON.stringify({primary:false,assessment:{proposal:idea},fields:{}})};
 for(const [column,value] of Object.entries(values))row.c[Number(column)]={v:'s:'+value};
 next.table.rows[blocks.digitalLayers.feedFirst-1+index].c[0]={v:'s:'+idea.level};
 next.table.rows[blocks.priorityInputs.feedFirst-1+index].c[4]={v:'s:Уточнить'};
 next.table.rows[blocks.priorityInputs.feedFirst-1+index].c[5]={v:'s:Требуется подтверждение охвата'};
}
test('Расширенный источник сохраняет все200 карточек и передаёт ровно100 новых',()=>{
 const data=projectResponse(next,'2026-10-09T05:00:00Z');assert.equal(data.initiatives.length,300);assert.equal(data.schema.columns.length,58);
 assert.deepEqual(data.initiatives.slice(0,200),baseline.initiatives);assert.equal(new Set(data.initiatives.map(i=>i.code)).size,300);
 assert.equal(filterPortfolio(data,{scope:'ideas'}).length,128);assert.equal(data.initiatives.filter(isHistorical).length,53);
 for(const i of data.initiatives.slice(200)){assert.equal(i.stage,'L0 Входящие предложения');assert.equal(i._source_sheet_id,807030037);assert.equal(i._source_row,Number(i.code.slice(3))-182);assert.equal(i.priority_annual_ebitda,null);assert.equal(i.provenance.assessment.proposal.agreed_effect_mrub_year,0);}
 assert.ok(googleLink(data.initiatives.at(-1)).includes('B130'));assert.deepEqual(layerSummary(data.initiatives.slice(200)).map(r=>r.count),[15,20,20,20,15,10]);
});
test('Потерянная последняя карточка и обрезанная порция останавливают неполное чтение',()=>{
 const short=structuredClone(next);short.table.rows[blocks.initiatives.feedFirst-1+299].c[0]={v:'z:'};assert.throws(()=>projectResponse(short),/полный состав/);
 const truncated=structuredClone(next);truncated.table.rows.pop();assert.throws(()=>projectResponse(truncated),/полный состав/);
});

test('Новые идеи сохраняют 13 действующих групп участка и подробности охвата',()=>{
 const data=projectResponse(next,'2026-10-09T05:00:00Z');
 const canonical=new Set(baseline.initiatives.map(i=>String(i.process||'').split(' / ')[0]));
 assert.equal(new Set(ideas.map(i=>i.process)).size,13);
 for(const i of data.initiatives.slice(200)){assert.ok(canonical.has(i.process));assert.ok(i.provenance.assessment.proposal.process_detail);assert.ok(i.scope.includes(i.provenance.assessment.proposal.process_detail));assert.ok(i.scope.includes(i.provenance.assessment.proposal.result));}
});

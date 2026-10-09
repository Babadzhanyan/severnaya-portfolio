import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {projectResponse} from '../data/projector.js';
import config from '../data/live-config.js';
import {facetedOptions,filterPortfolio,group,fieldSource,googleLink,isNewIdea,color,cleanSourceDisplay} from './portfolio.js';

async function readFixture(){
  const path=new URL('./fixtures/ownership_fixture_v15.json',import.meta.url);
  if(fs.existsSync(path))return JSON.parse(fs.readFileSync(path,'utf8'));
  const url=new URL(`https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/gviz/tq`);
  url.searchParams.set('gid',config.feedSheetId);url.searchParams.set('range',config.feedRange);
  url.searchParams.set('headers','0');url.searchParams.set('tqx','out:json;responseHandler:ownershipFixture');
  const response=await fetch(url,{signal:AbortSignal.timeout(30000)});
  assert.equal(response.ok,true,'Google передаёт текущий проверочный источник');
  const text=await response.text(),start=text.indexOf('ownershipFixture('),end=text.lastIndexOf(')');
  assert.ok(start>=0&&end>start,'Google передаёт типизированный ответ');
  return JSON.parse(text.slice(start+'ownershipFixture('.length,end));
}
const fixture=await readFixture();
const original=projectResponse(fixture);
function scenario({groupName='Автоматика',employee='Калашников Алексей',team='Автоматика: Мулюха Дмитрий / Проектный офис: Калашников Алексей'}={}){
  const input=structuredClone(fixture),block=config.blocks.find(b=>b.key==='initiatives');
  const row=input.table.rows.slice(block.feedFirst-1,block.feedLast).find(r=>r.c[0]?.v==='s:ИТ-177');
  row.c[2]=groupName===null?{v:'z:'}:{v:'s:'+groupName};
  row.c[3]={v:'s:'+employee};row.c[37]={v:'s:'+team};
  const data=projectResponse(input),card=data.initiatives.find(i=>i.code==='ИТ-177');
  return {data,card,input};
}
test('Команда внедрения сохраняет межфункциональное назначение из Google',()=>{
  const {card}=scenario();
  assert.equal(card.it_group,'Автоматика');
  assert.equal(card.initiative_lead,'Калашников Алексей');
  assert.equal(card.staff_department,'Проектный офис');
  assert.equal(card.staff_curator,'Петров Дмитрий');
  assert.equal(card.curator,'Мулюха Дмитрий');
  assert.equal(card.team,'Автоматика: Мулюха Дмитрий / Проектный офис: Калашников Алексей');
  assert.equal(fieldSource(card,'curator'),'Команда ИТ / куратор команды внедрения');
});
test('Выбранная неизвестная команда сохраняет запрос своего куратора',()=>{
  const {card}=scenario({groupName:'Совместная команда'});
  assert.equal(card.it_group,'Совместная команда');
  assert.equal(card.staff_department,'Проектный офис');
  assert.equal(card.curator,'Требуется куратор');
});
test('Пустая команда использует штатное подразделение сотрудника',()=>{
  const {card}=scenario({groupName:null});
  assert.equal(card.it_group,'Проектный офис');
  assert.equal(card.curator,'Петров Дмитрий');
});
test('Команда сохраняет своего куратора при уточняемом сотруднике',()=>{
  const {card}=scenario({employee:'Требуется назначение'});
  assert.equal(card.it_group,'Автоматика');
  assert.equal(card.curator,'Мулюха Дмитрий');
  assert.equal(card.staff_department,null);
  assert.equal(card.staff_curator,null);
});
test('Назначение сохраняет200кодов, исходных заказчиков, уровни и финансовые поля',()=>{
  const {data}=scenario();
  assert.equal(data.initiatives.length,200);
  const retained=['code','_source_row','title','customer','digital_layer','stage','annual_effect','gross_2027','net_2027','one_off_2027','run_2027','sources'];
  for(const before of original.initiatives){
    const after=data.initiatives.find(i=>i.code===before.code);
    for(const key of retained)assert.deepEqual(after[key],before[key],before.code+' / '+key);
  }
  assert.equal(data.initiatives.filter(i=>i.provenance.fields.customer.origin==='primary').length,99);
});
test('Связанные фильтры читают команду внедрения и выбранного сотрудника',()=>{
  const {card,data}=scenario();const one={...data,initiatives:[card]};
  assert.equal(group(card),'Автоматика');
  assert.deepEqual(facetedOptions(one,{group:'Автоматика'},'person'),['Калашников Алексей']);
  assert.equal(filterPortfolio(one,{group:'Автоматика',person:'Калашников Алексей',layer:card.digital_layer}).length,1);
  assert.equal(filterPortfolio(one,{group:'Проектный офис'}).length,0);
});
test('Основной реестр и новые идеи образуют два самостоятельных состава',()=>{
  assert.equal(filterPortfolio(original,{scope:'primary'}).length,172);
  assert.equal(filterPortfolio(original,{scope:'ideas'}).length,28);
  assert.equal(filterPortfolio(original,{scope:'all'}).length,200);
  assert.ok(filterPortfolio(original,{scope:'primary'}).every(i=>i.provenance.origin==='primary'));
  assert.ok(filterPortfolio(original,{scope:'ideas'}).every(i=>i.provenance.origin==='addition'));
});
function withLocation(code,{metadataLocation,configuredLocation,legacyContract=false},run){
  const input=structuredClone(fixture),block=config.blocks.find(b=>b.key==='initiatives');
  const offset=input.table.rows.slice(block.feedFirst-1,block.feedLast).findIndex(r=>r.c[0]?.v==='s:'+code);
  const row=input.table.rows[block.feedFirst-1+offset],virtualRow=String(block.firstSourceRow+offset);
  const raw=row.c[44].v.slice(2),match=raw.match(/Паспортные метаданные: (\{[^\n]+\})/),metadata=JSON.parse(match[1]);
  metadata.source_location=metadataLocation;row.c[44]={v:'s:'+raw.replace(match[1],JSON.stringify(metadata))};
  const previous=config.recordLocations,previousPolicy=config.sourcePartitionPolicy;config.sourcePartitionPolicy=undefined;
  config.recordLocations=legacyContract?undefined:{...previous};
  if(config.recordLocations){delete config.recordLocations[virtualRow];if(configuredLocation)config.recordLocations[virtualRow]=configuredLocation;}
  try{return run(input,virtualRow);}finally{config.recordLocations=previous;config.sourcePartitionPolicy=previousPolicy;}
}
test('Ссылка новой идеи использует её фактический лист и строку',()=>{
  withLocation('ИТ-177',{metadataLocation:{sheet_id:807030037,sheet:'Новые идеи',row:8},legacyContract:true},input=>{
    const card=projectResponse(input).initiatives.find(i=>i.code==='ИТ-177');
    assert.equal(card._source_sheet_id,807030037);assert.equal(card._source_row,8);
    const link=new URL(googleLink(card,'title')),hash=new URLSearchParams(link.hash.slice(1));
    assert.equal(hash.get('gid'),'807030037');assert.equal(hash.get('range'),'C8');
  });
});
test('Возврат идеи в основной реестр сохраняет новую физическую строку',()=>{
  withLocation('ИТ-177',{metadataLocation:{sheet_id:807030037,sheet:'Новые идеи',row:8}},(input,virtualRow)=>{
    const card=projectResponse(input).initiatives.find(i=>i.code==='ИТ-177');
    assert.equal(card._source_sheet_id,config.masterSheetId);
    assert.equal(card._source_row,Number(virtualRow)-4);
    assert.equal(new URLSearchParams(new URL(googleLink(card,'title')).hash.slice(1)).get('gid'),String(config.masterSheetId));
    const included={...card,collection:'projects'};
    assert.equal(included.provenance.origin,'addition');
    assert.equal(isNewIdea(included),false);
    assert.equal(filterPortfolio({initiatives:[included]},{scope:'primary'}).length,1);
    assert.equal(filterPortfolio({initiatives:[included]},{scope:'ideas'}).length,0);
    assert.equal(color(included,'title'),'addition');
  });
});
test('Старый объект различает источник и идею до появления физического состава',()=>{
  assert.equal(isNewIdea({provenance:{origin:'addition'}}),true);
  assert.equal(isNewIdea({provenance:{origin:'primary'}}),false);
  assert.equal(isNewIdea({collection:'ideas',provenance:{origin:'primary'}}),true);
  assert.equal(isNewIdea({collection:'projects',provenance:{origin:'addition'}}),false);
});
test('Текущая конфигурация строки имеет приоритет над архивной координатой',()=>{
  withLocation('ИТ-177',{metadataLocation:{sheet_id:123,sheet:'Архив',row:99},configuredLocation:{sheetId:807030037,sheetName:'Новые идеи',row:3}},input=>{
    const card=projectResponse(input).initiatives.find(i=>i.code==='ИТ-177');
    assert.equal(card._source_sheet_id,807030037);assert.equal(card._source_row,3);
    assert.equal(card._source_sheet,'Новые идеи');
  });
});
test('Первичная инициатива сохраняет привязку основного реестра',()=>{
  withLocation('ИТ-001',{metadataLocation:{sheet_id:config.masterSheetId,sheet:'Реестр инициатив',row:3},configuredLocation:{sheetId:807030037,sheetName:'Новые идеи',row:3}},input=>{
    assert.throws(()=>projectResponse(input),/Первичная инициатива ИТ-001/);
 });
});
test('200 источников сохраняют исходные даты и значения в обычном тексте',()=>{
 let dates=0,restored=0;
 for(const i of original.initiatives){
  const raw=i.sources,visible=cleanSourceDisplay(raw);
  assert.doesNotMatch(visible,/(?:\{\s*"|\[\s*\{|Паспортные метаданные|План первичных источников)/,i.code);
  assert.equal(i.sources,raw,i.code+' / архив данных сохраняется');
  for(const line of raw.split(/\r?\n/)){
   const start=line.search(/\{\s*"/);if(start<0)continue;
   let record;try{record=JSON.parse(line.slice(start));}catch{continue;}
   if(Object.hasOwn(record,'год')){
    assert.ok(visible.includes('Исходные сроки '+record['год']),i.code+' / год');
    for(const key of ['начало','план','факт'])if(record[key]!==null&&record[key]!==undefined&&String(record[key]).trim())assert.ok(visible.includes(key+' '+record[key]),i.code+' / '+key);
    dates++;
   }
   if(Object.hasOwn(record,'restored_source_value')||Object.hasOwn(record,'value')&&typeof record.source==='string'){
    const restoredValue=record.restored_source_value??record.value;
    assert.ok(visible.includes('Исходное значение: '+restoredValue),i.code+' / исходное значение');
    assert.ok(visible.includes('Источник: '+record.source),i.code+' / координата');restored++;
   }
  }
  const coordinates=raw.split(/\r?\n/).filter(line=>/^Проекты 202[567]\.xlsx,/.test(line));
  for(const line of coordinates)assert.ok(visible.includes(line),i.code+' / исходный файл');
 }
 assert.equal(original.initiatives.length,200);assert.ok(dates>200);assert.ok(restored>0,'Архив содержит восстановленные значения');assert.equal(original.initiatives.filter(i=>i.provenance.fields.customer.origin==='primary').length,99,'99 исходных заказчиков сохраняются независимо от дополнительных архивных записей');
});

test('Положение идеи вычисляется по живому диапазону и сохраняется при сортировке',()=>{const input=structuredClone(fixture),block=config.blocks.find(b=>b.key==='initiatives');const rows=input.table.rows.slice(block.feedFirst-1,block.feedLast);const offset=rows.findIndex(r=>r.c[0]?.v==='s:ИТ-177');const first=172,other=173;[rows[first].c,rows[other].c]=[rows[other].c,rows[first].c];const previous=config.sourcePartitionPolicy;config.sourcePartitionPolicy='ranges';try{const data=projectResponse(input);for(const v of [first,other]){const code=rows[v].c[0].v.slice(2),card=data.initiatives.find(i=>i.code===code);assert.equal(card._source_sheet_id,807030037);assert.equal(card._source_row,3+v-first);}}finally{config.sourcePartitionPolicy=previous;}});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {businessFunctions,businessFunctionFor,companyKpis,itRequirements,levelKpis,metricShare,metricValue,operationalKpis,transformationBaselines} from './transformation-kpis.js';
const source=JSON.parse(fs.readFileSync(new URL('../../../backend/data/production_native_input.json',import.meta.url),'utf8'));
const annual={period:'Сопоставимый год',sales:{quantity_kg:200,revenue:30000,price:999},sources:{sales:'Факт продаж',price:'Чистая выручка / кг'}};
const data={productionInput:source,annualActualInput:annual,initiatives:[]};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8*Math.max(1,Math.abs(b)));

test('КПЭ читают физическую базу, период и цену продаж из общего источника',()=>{
 const b=transformationBaselines(data);close(b.hatch.value,source.baseline.hatch_rate*100);close(b.fcr.value,source.baseline.fcr);close(b.yield.value,source.baseline.slaughter_yield*100);
 assert.equal(b.hatch.period,source.baseline.period);assert.equal(b.hatch.scope,'Бройлер');assert.equal(b.price.value,150);assert.equal(b.sold.value,200);assert.equal(b.price.period,'Сопоставимый год');assert.equal(b.price.origin,'formula');
});
test('Сравнительные доли и одобренный план сохраняют отдельный смысл от факта',()=>{
 const rows=companyKpis({...data,ledger:[{code:'ИТ-001',confirmation:'Подтверждено',annual_potential:10}],initiatives:[{code:'ИТ-001'}]});
 assert.equal(rows.find(m=>m.id==='profit').base.value,null);assert.equal(rows.find(m=>m.id==='processing').base.value,null);assert.equal(rows.length,4);
});
test('Изменение источника обновляет КПЭ, сценарные ручки сохраняют базу',()=>{
 const input=structuredClone(data);input.annualActualInput.sales.revenue=32000;input.productionInput.changes.hatch_pp=10;
 assert.equal(transformationBaselines(input).price.value,160);close(transformationBaselines(input).hatch.value,source.baseline.hatch_rate*100);
 assert.equal(annual.sales.revenue,30000);assert.equal(source.changes.hatch_pp,0);
});
test('Проценты и процентные пункты формируют разные цели пилота',()=>{
 const hatch=operationalKpis(data,'hatch');close(hatch[0].goal.value-hatch[0].base.value,.5);close(hatch[1].goal.value-hatch[1].base.value,-.1);
 const grow=operationalKpis(data,'grow');close(grow[0].goal.value,grow[0].base.value*.99);close(grow[1].goal.value-grow[1].base.value,-.5);
 assert.equal(hatch[0].goal.change,'+0,5 п.п.');assert.equal(grow[0].goal.change,'-1%');assert.equal(metricValue(50,'%'),'50%');
});
test('Пограничная цель показывает фактическое изменение в пределах доли',()=>{
 const d=structuredClone(data);d.productionInput.baseline.hatch_rate=.998;d.productionInput.baseline.chick_reject_rate=0;
 const rows=operationalKpis(d,'hatch');assert.equal(rows[0].goal.value,100);assert.equal(rows[0].goal.change,'+0,2 п.п.');assert.equal(rows[1].goal.value,0);assert.equal(rows[1].goal.change,'0 п.п.');
});
test('Пустая база и нулевой знаменатель сохраняют статус замера',()=>{
 assert.equal(metricShare(0,0),null);assert.equal(metricShare(0,10),0);assert.equal(metricShare(11,10),null);assert.equal(metricShare(null,10),null);
 const b=transformationBaselines({annualActualInput:{...annual,sales:{quantity_kg:0,revenue:0}}});assert.equal(b.price.value,null);assert.equal(b.hatch.value,null);assert.equal(metricValue(null,'%'),'Требуется замер');
});
test('Коды технологий сохраняются, Ц0 использует общие требования качества',()=>{
 assert.deepEqual(levelKpis.map(l=>l.code),['Ц0','Ц1','Ц2','Ц3','Ц4','Ц5']);assert.ok(levelKpis.every(l=>l.drivers.length===2));assert.equal(itRequirements.length,5);
 assert.equal(levelKpis[0].drivers[0],itRequirements[0]);assert.equal(levelKpis[0].drivers[1],itRequirements[1]);assert.ok(itRequirements.every(m=>m.base.value===null));
 assert.match(levelKpis[5].drivers[1].name,/прогноза/);assert.match(levelKpis[5].note,/машинного зрения/);
});
test('Восемь функций имеют по два показателя с ролями и действиями',()=>{
 for(const f of businessFunctions){const rows=operationalKpis(data,f.id);assert.equal(rows.length,2);assert.ok(rows.every(m=>m.owner&&m.action&&m.formula&&m.guardrail));assert.ok(rows.every(m=>m.goal.status==='proposed'&&m.goal.origin==='addition'));}
 assert.equal(businessFunctionFor('Выращивание / Войсковицы'),'grow');assert.equal(businessFunctionFor('Выращивание / Северная'),'grow');assert.equal(businessFunctionFor('Кормоцех'),'feed');assert.equal(businessFunctionFor('Инкубатор'),'hatch');assert.equal(businessFunctionFor('Склад'),'sales');
 assert.match(operationalKpis(data,'deep')[1].formula,/маржа альтернативного маршрута/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {isHistorical,fmt} from '../model/portfolio.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const result=await build({configFile:false,root,logLevel:'silent',plugins:[react()],build:{write:false,lib:{entry:resolve(root,'src/components/Calculator.jsx'),formats:['es']},rollupOptions:{external:['react','react/jsx-runtime']}}});
const output=(Array.isArray(result)?result[0]:result).output.find(o=>o.type==='chunk').code.replace(/from ["'](react(?:\/jsx-runtime)?)["']/g,(_,key)=>'from '+JSON.stringify(pathToFileURL(resolve(root,'node_modules/react/'+(key==='react'?'index.js':'jsx-runtime.js'))).href)).replace(/import ["']react["'];/g,'import '+JSON.stringify(pathToFileURL(resolve(root,'node_modules/react/index.js')).href)+';');
globalThis.window={PMO_RUNTIME:{}};
const {default:Calculator,ProductionFields,InitiativeEstimate,scenarioChanges,CalculatorPrint,mechanismParameters}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
const data=JSON.parse(readFileSync(resolve(root,'src/components/fixtures/initiative_estimates_v18.json'),'utf8'));
test('Оценки всех рабочих инициатив сохраняют источник годовой прибыли и состав ресурсов',()=>{
 const current=data.initiatives.filter(i=>!isHistorical(i));assert.equal(current.length,147);
 assert.ok(Math.abs(current.reduce((s,i)=>s+i.priority_annual_ebitda,0)-55.013791)<1e-8);
 for(const card of current){const html=renderToStaticMarkup(React.createElement(InitiativeEstimate,{data,card}));assert.match(html,/Предварительная оценка/);assert.ok(html.includes(fmt(card.priority_annual_ebitda)));assert.ok(html.includes(fmt(card.total_hours,0)));assert.ok(html.includes(fmt(card.priority_duration_months)));assert.doesNotMatch(html,/<details|EBIT|амортизац|NaN|Infinity|undefined/);}
});
test('Выбор кодов включает историю и идеи, неизвестные ставки сохраняют пропуск',()=>{
 const card={code:'ИТ-999',title:'Тестовая инициатива',collection:'ideas',priority_annual_ebitda:null,total_hours:null,priority_hour_rate:null};
 const html=renderToStaticMarkup(React.createElement(InitiativeEstimate,{data,card,cards:data.initiatives}));assert.equal((html.match(/<option/g)||[]).length,200);assert.match(html,/Требуется расчёт/);assert.doesNotMatch(html,/>0 ч</);
 const done=data.initiatives.find(isHistorical),history=renderToStaticMarkup(React.createElement(InitiativeEstimate,{data,card:done}));assert.match(history,/История/);assert.doesNotMatch(history,/Фонд оплаты труда/);
});
test('Свод изменённых параметров различает цену, физические доли и ставки расходов',()=>{
 const input={changes:{mortality_pp:-.2},routes:[{name:'Разделка',baseline_share:.3,target_share:.35}],products:[{name:'Филе',kind:'sale',baseline_price:200,target_price:210}],costs:[{name:'Корм',unit:'руб / кг',baseline_rate:20,target_rate:19}],baseline_fixed_expenses:1000000,target_fixed_expenses:1100000};const copy=structuredClone(input),rows=scenarioChanges(input,null);
 assert.ok(rows.some(([name,value,unit])=>name==='Падёж'&&value===-.2&&unit==='п.п.'));assert.ok(rows.some(([name,value])=>name==='Разделка'&&Math.abs(value-5)<1e-8));assert.ok(rows.some(([name,value])=>name==='Филе'&&value===10));assert.ok(rows.some(([name,value])=>name==='Корм'&&value===-1));assert.ok(rows.some(([name,value])=>name==='Постоянные расходы'&&value===.1));assert.deepEqual(input,copy);
});

test('Печатный результат рычага сохраняет выбранную карточку и состав изменения',()=>{
 const initiative={code:'ИТ-129',title:'Ключи подписи'},input={period:'2027',months:12,baseline:10,target:9,additional_opex:0},result={physical_change:10,hours_released:null,period_gross_benefit:20,period_delta_ebitda:20,annual_delta_ebitda:20,one_off_cash_release:null,expected_risk_reduction:null,requirements:[]};
 const html=renderToStaticMarkup(React.createElement(CalculatorPrint,{mechanism:true,title:'Экономия ресурса',input,result,resultInitiative:initiative}));
 assert.match(html,/ИТ-129 \/ Ключи подписи/);assert.match(html,/База 10 \/ цель 9/);assert.match(html,/Изменение операционной прибыли/);assert.match(html,/Финансовое согласование: требуется подтверждение/);assert.doesNotMatch(html,/История \/|Фонд оплаты труда|EBIT|амортизац/);
});
test('Печатный механизм сохраняет объём, тариф и денежную долю времени',()=>{const input={kind:'hours',quantity:3000,baseline:4,target:2,rate:700,monetization:.5,additional_opex:0,period:'2027',months:12};const html=renderToStaticMarkup(React.createElement(CalculatorPrint,{mechanism:true,title:'Освобождение времени',input,resultInitiative:{code:'ИТ-116',title:'База знаний'}}));assert.match(html,/Объём: 3\s*000 операций/);assert.match(html,/тариф: 700 руб \/ ч/);assert.match(html,/доля времени с денежной экономией: 50%/);assert.match(html,/База 4 \/ цель 2 мин \/ операцию/);});


test('Единая форма содержит три предметные группы, один выбор инициативы и одну карточку',()=>{
 const cards=Array.from({length:300},(_,index)=>({code:'ИТ-'+String(index+1).padStart(3,'0'),title:'Инициатива '+(index+1),priority_annual_ebitda:1}));
 const html=renderToStaticMarkup(React.createElement(Calculator,{data:{initiatives:cards},list:cards,selectedCode:cards[0].code}));
 assert.equal((html.match(/<option/g)||[]).length,300);assert.equal((html.match(/class="calculator-case-tabs"/g)||[]).length,1);assert.equal((html.match(/aria-pressed=/g)||[]).length,3);assert.equal((html.match(/class="calculator-result-card"/g)||[]).length,1);
 assert.match(html,/Выпуск и структура/);assert.match(html,/Средняя цена/);assert.match(html,/Расходы и ресурсы/);assert.match(html,/Условия результата/);assert.doesNotMatch(html,/Годовая цена|Отдельный рычаг|Оценки инициатив|Пример расчёта|factor-editor|<details|NaN|undefined/);
});
test('Семь операционных строк показывают базу, изменение и цель с объяснениями единиц',()=>{
 const input={baseline:{eggs_set:72924750,hatch_rate:.863941556193199,chick_reject_rate:.010003377314396,mortality_rate:.114820735816656,live_kg:140052766,live_heads:57795460,fcr:1.58894726599462,slaughter_yield:.80363011316749},changes:{hatch_pp:.5,fcr_pct:-1}};
 const html=renderToStaticMarkup(React.createElement(ProductionFields,{input}));
 assert.equal((html.match(/type="number"/g)||[]).length,7);assert.equal((html.match(/aria-describedby=/g)||[]).length,7);assert.match(html,/86,39%/);assert.match(html,/86,89%/);assert.match(html,/1,589 кг \/ кг/);assert.match(html,/1,573 кг \/ кг/);assert.match(html,/Корм на 1 кг живого веса/);assert.match(html,/Цыплята, выведенные из 100 заложенных яиц/);assert.doesNotMatch(html,/NaN|Infinity|undefined/);
});
test('Дополнительные расходы сохраняют знак и переносятся в выбранный печатный паспорт',()=>{
 const rows=scenarioChanges({},null,{otherMillion:-.8,itMillion:.2});assert.deepEqual(rows,[['Прочие операционные изменения',-.8,'млн руб'],['Сопровождение ИТ',.2,'млн руб']]);
 const html=renderToStaticMarkup(React.createElement(CalculatorPrint,{resultInitiative:{code:'ИТ-086',title:'Конверсия корма'},input:{baseline:{period:'Январь–июнь 2026'}},scenarioChanges:rows}));
 assert.match(html,/ИТ-086 \/ Конверсия корма/);assert.match(html,/Прочие операционные изменения -0,8 млн руб/);assert.match(html,/Сопровождение ИТ 0,2 млн руб/);assert.match(html,/Январь–июнь 2026/);
});

test('Карточка времени сохраняет тариф и денежную долю, капитал сохраняет самостоятельный поток',()=>{
 const rows=mechanismParameters({kind:'hours',quantity:3000,baseline:4,target:2,rate:700,monetization:.5,additional_opex:0});
 assert.ok(rows.some(([name,value,unit])=>name==='Цена ресурса'&&value===700&&unit==='руб / ч'));
 assert.ok(rows.some(([name,value,unit])=>name==='Доля времени с денежной экономией'&&value===50&&unit==='%'));
 const capital=mechanismParameters({kind:'working_capital',quantity:100000,baseline:30,target:20,additional_opex:0});
 assert.deepEqual(capital,[['База показателя',30,'дней'],['Цель показателя',20,'дней'],['Объём',100000,'руб / день']]);
});

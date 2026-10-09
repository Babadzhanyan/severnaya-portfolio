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
const {InitiativeEstimate,scenarioChanges,CalculatorPrint}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
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

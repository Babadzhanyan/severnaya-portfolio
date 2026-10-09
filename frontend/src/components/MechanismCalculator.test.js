import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {mechanismCase} from '../model/mechanisms.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const built=await build({configFile:false,root,logLevel:'silent',plugins:[react()],build:{write:false,lib:{entry:resolve(root,'src/components/MechanismCalculator.jsx'),formats:['es']},rollupOptions:{external:['react','react/jsx-runtime']}}});
const output=(Array.isArray(built)?built[0]:built).output.find(o=>o.type==='chunk').code.replace(/from ["'](react(?:\/jsx-runtime)?)["']/g,(_,key)=>'from '+JSON.stringify(pathToFileURL(resolve(root,'node_modules/react/'+(key==='react'?'index.js':'jsx-runtime.js'))).href));
const {default:MechanismCalculator,mechanismResultText,mechanismUnits,budgetComplement}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
const cards=JSON.parse(readFileSync(resolve(root,'src/components/fixtures/initiative_estimates_v18.json'))).initiatives;
const input={kind:'resource',quantity:1000000,baseline:2,target:1.9,rate:20,additional_opex:20000,months:12,period:'2027'};
test('Результат одного рычага переносится с любым кодом, операционными параметрами и единицами прибыли',()=>{
 const result=mechanismCase(input),before=JSON.stringify({input,result});
 assert.equal(cards.length,200);
 for(const card of cards){const text=mechanismResultText(input,result,'Кормление',card,'кг','кг / кг');assert.ok(text.startsWith(card.code+' / '));assert.match(text,/Объём: 1\s000\s000 кг/);assert.match(text,/База показателя: 2 кг \/ кг/);assert.match(text,/Цель показателя: 1,9 кг \/ кг/);assert.match(text,/Прирост операционной прибыли за период: 1,98 млн руб/);assert.match(text,/Годовой темп: 1,98 млн руб \/ год/);assert.match(text,/Предварительная оценка \/ требуется согласование/);assert.doesNotMatch(text,/EBIT|амортизац|Подтверждено/);}
 assert.equal(JSON.stringify({input,result}),before);assert.equal(result.financial_approval,false);
});
test('Перенос сохраняет ноль и отрицательный эффект, капитал отражается отдельным результатом',()=>{
 const card=cards[0];
 for(const [target,value] of [[2,'0'],[2.1,'-2']]){const changed={...input,target,additional_opex:0},result=mechanismCase(changed),text=mechanismResultText(changed,result,'Кормление',card,'кг','кг / кг');assert.ok(text.includes('Прирост операционной прибыли за период: '+value+' млн руб'));assert.equal(result.approved_delta_ebitda,null);}
 const unknown=mechanismCase({...input,rate:null});assert.equal(mechanismResultText(input,unknown,'Кормление',card,'кг','кг / кг'),null);
 const capital={kind:'working_capital',quantity:1e6,baseline:5,target:3,months:12},result=mechanismCase(capital),units=mechanismUnits(capital);assert.equal(result.one_off_cash_release,2e6);assert.equal(units.quantityUnit,'руб / день');assert.equal(units.metricUnit,'дней');const text=mechanismResultText(capital,result,'Склад',card,units.quantityUnit,units.metricUnit);assert.match(text,/Объём: 1\s000\s000 руб \/ день/);assert.match(text,/Разовое высвобождение оборотного капитала: 2 млн руб/);assert.doesNotMatch(text,/операционной прибыли|Годовой темп/);
});


test('Встроенная форма расходов показывает один выбор вида результата и компактные параметры',()=>{
 const html=renderToStaticMarkup(React.createElement(MechanismCalculator,{data:{},embedded:true}));
 assert.equal((html.match(/<select/g)||[]).length,1);assert.equal((html.match(/<option/g)||[]).length,5);assert.equal((html.match(/type="number"/g)||[]).length,4);assert.match(html,/Покупаемые расходы за период/);assert.match(html,/Снижение расходов/);assert.doesNotMatch(html,/Участок и рычаг|Способ расчёта|Результат инициативы|Скопировать для паспорта|амортизац|<details|NaN|undefined/);
});
test('Часы и риск переносят операционный результат отдельно от прибыли',()=>{
 const hours={kind:'hours',quantity:1000,baseline:10,target:5,rate:null,monetization:null,additional_opex:0,period:'2027',months:12},time=mechanismCase(hours),timeUnits=mechanismUnits(hours),timeText=mechanismResultText(hours,time,'Освобождение времени',cards[0],timeUnits.quantityUnit,timeUnits.metricUnit);
 assert.match(timeText,/Освобождённое время: 83,33 ч/);assert.doesNotMatch(timeText,/операционной прибыли|Годовой темп/);
 const input={kind:'risk',quantity:1e6,baseline:10,target:5,months:12},risk=mechanismCase(input),text=mechanismResultText(input,risk,'Риск',cards[0],'руб','%');assert.match(text,/Снижение ожидаемого риска: 0,05 млн руб/);assert.doesNotMatch(text,/операционной прибыли|Годовой темп/);
});

test('Очищенная экономия бюджета сохраняет ожидание, явные ноль и процент дают разные денежные результаты',()=>{
 const budget={kind:'budget',quantity:1e6,baseline:100,additional_opex:0,period:'2027',months:12};
 const pending=budgetComplement(null);
 assert.equal(pending,null);
 assert.equal(budgetComplement(pending),null);
 assert.throws(()=>mechanismCase({...budget,target:pending}));
 const unchanged=mechanismCase({...budget,target:budgetComplement(0)});
 assert.equal(unchanged.period_delta_ebitda,0);
 const saved=mechanismCase({...budget,target:budgetComplement(10),additional_opex:5e4});
 assert.equal(saved.period_delta_ebitda,5e4);
 assert.equal(budgetComplement(budgetComplement(10)),10);
});

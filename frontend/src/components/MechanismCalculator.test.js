import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import {mechanismCase} from '../model/mechanisms.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const built=await build({configFile:false,root,logLevel:'silent',plugins:[react()],build:{write:false,lib:{entry:resolve(root,'src/components/MechanismCalculator.jsx'),formats:['es']},rollupOptions:{external:['react','react/jsx-runtime']}}});
const output=(Array.isArray(built)?built[0]:built).output.find(o=>o.type==='chunk').code.replace(/from ["'](react(?:\/jsx-runtime)?)["']/g,(_,key)=>'from '+JSON.stringify(pathToFileURL(resolve(root,'node_modules/react/'+(key==='react'?'index.js':'jsx-runtime.js'))).href));
const {mechanismResultText}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
const cards=JSON.parse(readFileSync(resolve(root,'src/components/fixtures/initiative_estimates_v18.json'))).initiatives;
const input={kind:'resource',quantity:1000000,baseline:2,target:1.9,rate:20,additional_opex:20000,months:12,period:'2027'};
test('Результат одного рычага переносится с любым кодом, операционными параметрами и единицами прибыли',()=>{
 const result=mechanismCase(input),before=JSON.stringify({input,result});
 assert.equal(cards.length,200);
 for(const card of cards){const text=mechanismResultText(input,result,'Кормление',card,'кг','кг / кг');assert.ok(text.startsWith(card.code+' / '));assert.match(text,/Объём: 1\s000\s000 кг/);assert.match(text,/База показателя: 2 кг \/ кг/);assert.match(text,/Цель показателя: 1,9 кг \/ кг/);assert.match(text,/Прирост операционной прибыли за период: 1,98 млн руб/);assert.match(text,/Годовой темп: 1,98 млн руб \/ год/);assert.match(text,/Предварительная оценка \/ требуется согласование/);assert.doesNotMatch(text,/EBIT|амортизац|Подтверждено/);}
 assert.equal(JSON.stringify({input,result}),before);assert.equal(result.financial_approval,false);
});
test('Перенос сохраняет ноль и отрицательный эффект, неизвестный результат и капитал ожидают денежного расчёта',()=>{
 const card=cards[0];
 for(const [target,value] of [[2,'0'],[2.1,'-2']]){const changed={...input,target,additional_opex:0},result=mechanismCase(changed),text=mechanismResultText(changed,result,'Кормление',card,'кг','кг / кг');assert.ok(text.includes('Прирост операционной прибыли за период: '+value+' млн руб'));assert.equal(result.approved_delta_ebitda,null);}
 const unknown=mechanismCase({...input,rate:null});assert.equal(mechanismResultText(input,unknown,'Кормление',card,'кг','кг / кг'),null);
 const capital={kind:'working_capital',quantity:1e6,baseline:5,target:3,months:12},result=mechanismCase(capital);assert.equal(result.one_off_cash_release,2e6);assert.equal(mechanismResultText(capital,result,'Склад',card,'руб','дней'),null);
});

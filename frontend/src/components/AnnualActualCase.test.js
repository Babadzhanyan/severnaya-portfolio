import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
const root=fileURLToPath(new URL('../../',import.meta.url));
const result=await build({configFile:false,root,logLevel:'silent',plugins:[react()],build:{write:false,lib:{entry:resolve(root,'src/components/AnnualActualCase.jsx'),formats:['es']},rollupOptions:{external:['react','react/jsx-runtime']}}});
const output=(Array.isArray(result)?result[0]:result).output.find(o=>o.type==='chunk').code.replace(/from ["'](react(?:\/jsx-runtime)?)["']/g,(_,key)=>'from '+JSON.stringify(pathToFileURL(resolve(root,'node_modules/react/'+(key==='react'?'index.js':'jsx-runtime.js'))).href)).replace(/import ["']react["'];/g,'import '+JSON.stringify(pathToFileURL(resolve(root,'node_modules/react/index.js')).href)+';');
const {default:AnnualActualCase,annualPriceEstimate,annualResultText}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
// Точные наблюдаемые продажи и выпуск: годовой калькулятор / май 2025–апрель 2026
const actualCase={'период':'Май 2025–апрель 2026','наблюдаемые_продажи':{'продажи_кг':208515884.605,'выручка_продаж_руб':33096006892.8734,'полная_себестоимость_по_исходным_ставкам_руб':28521137434.91859,'управленческая_маржа_отчёта_продаж_руб':4506123646.75},'производственный_управленческий_контур':{'выпуск_кг':208338693.182,'выручка_на_выпуске_руб':32861615339.99,'цена_выпуска_руб_кг':157.73169562546326,'полная_себестоимость_выпуска_руб':28270261758.829998,'управленческая_маржа_руб':4527601848.860003}};
test('Годовая цена использует продажи того же периода',()=>{const r=annualPriceEstimate(actualCase,{price_change_percent:1,unchanged_expenses:true});assert.ok(Math.abs(r.period_delta_ebitda-330960068.928734)<1e-5);assert.equal(r.period_delta_ebit,null);assert.equal(r.absolute_baseline_ebitda,null);assert.equal(r.absolute_target_ebitda,null);assert.equal(r.approved_delta_ebitda,null);assert.equal(r.financial_approval,false);});
test('Явный ноль и отрицательная амортизация сохраняют знак',()=>{for(const da of [0,-5,5]){const r=annualPriceEstimate(actualCase,{price_change_percent:1,unchanged_expenses:true,additional_depreciation:da});assert.ok(Math.abs(r.period_delta_ebit-(330960068.928734-da))<1e-5);assert.equal(r.approved_delta_ebit,null);}});
test('Амортизация другого периода сохраняет ожидание EBIT',()=>{const r=annualPriceEstimate(actualCase,{price_change_percent:1,unchanged_expenses:true,additional_depreciation:0,depreciation_period:'Январь–июнь 2026'});assert.equal(r.period_delta_ebit,null);assert.ok(r.period_delta_ebitda>0);});
test('Неподтверждённое сохранение расходов блокирует оценку',()=>{const r=annualPriceEstimate(actualCase,{price_change_percent:1,other_expenses_unchanged:false});assert.equal(r.period_delta_ebitda,null);assert.equal(r.period_delta_ebit,null);});
test('Форма показывает операционные параметры и итог прибыли',()=>{const html=renderToStaticMarkup(React.createElement(AnnualActualCase,{actualCase,scenario:{price_change_percent:1,unchanged_expenses:true}}));assert.match(html,/Годовое изменение чистой цены/);assert.match(html,/208,52 млн кг/);assert.match(html,/33\s096,01 млн руб/);assert.match(html,/Прирост операционной прибыли/);assert.match(html,/Скопировать для паспорта/);assert.match(html,/Требуется подтверждение/);assert.doesNotMatch(html,/<details|EBIT|амортизац|NaN|Infinity|undefined/);});
test('Числовые границы удерживают корректный результат',()=>{for(const value of [NaN,Infinity,true,-101,1001])assert.ok(annualPriceEstimate(actualCase,{price_change_percent:value}).error);assert.ok(annualPriceEstimate(actualCase,{additional_depreciation:Infinity}).error);});

test('Живой компактный источник сохраняет расчёт и управляемый сценарий',()=>{const compact={period:actualCase['период'],sales:{quantity_kg:208515884.605,revenue:33096006892.8734,price:158.72175376743357},production:{quantity_kg:208338693.182,revenue:32861615339.99,cogs:28270261758.829998,logistics:63751732.3,management_margin:4527601848.860003},scenario:{price_change_pct:1,additional_cash_expenses:0,unchanged_expenses:true,additional_depreciation:0},financial_approval:false};const r=annualPriceEstimate(compact);assert.ok(Math.abs(r.period_delta_ebit-330960068.928734)<1e-5);assert.equal(r.financial_approval,false);const changed=annualPriceEstimate(compact,{price_change_pct:2});assert.ok(Math.abs(changed.period_delta_ebitda-661920137.857468)<1e-5);assert.equal(annualPriceEstimate(compact,{unchanged_expenses:false}).period_delta_ebitda,null);});

test('Копирование требует числовой прирост прибыли',()=>{const html=renderToStaticMarkup(React.createElement(AnnualActualCase,{actualCase,scenario:{price_change_percent:1,unchanged_expenses:false}}));assert.match(html,/<button disabled="">Скопировать для паспорта/);});

test('Перенос годовой оценки включает выбранный код, параметры и отдельный статус согласования',()=>{
 const initiative={code:'ИТ-086',title:'Конверсия корма (весы, источник Д.2)'},scenario={price_change_pct:1,additional_cash_expenses:2e6,unchanged_expenses:true};
 const result=annualPriceEstimate(actualCase,scenario),text=annualResultText(result,scenario,initiative);
 assert.match(text,/^ИТ-086 \/ Конверсия корма \(весы\)/);assert.match(text,/Цена: 1%/);assert.match(text,/Расходы: 2 млн руб/);assert.match(text,/Прирост операционной прибыли: 328,96 млн руб \/ год/);assert.match(text,/Предварительная оценка \/ требуется согласование/);assert.doesNotMatch(text,/EBIT|Д\.2|Подтверждено/);assert.equal(result.financial_approval,false);
 assert.match(renderToStaticMarkup(React.createElement(AnnualActualCase,{actualCase,scenario,initiative})),/>ИТ-086</);
});
test('Годовое копирование различает неизвестный, нулевой и отрицательный результат',()=>{
 const initiative={code:'ИТ-002',title:'Тестовая идея'};
 for(const percent of [0,-1]){const scenario={price_change_pct:percent,unchanged_expenses:true},result=annualPriceEstimate(actualCase,scenario),text=annualResultText(result,scenario,initiative);assert.match(text,/^ИТ-002/);assert.match(text,percent===0?/прибыли: 0 млн руб/:/прибыли: -330,96 млн руб/);assert.equal(result.approved_delta_ebitda,null);}
 assert.equal(annualResultText(annualPriceEstimate(actualCase,{unchanged_expenses:false}),{},initiative),null);
});

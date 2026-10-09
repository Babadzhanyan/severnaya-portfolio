import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {productionCase} from '../model/production.js';
import example from '../data/production-example.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const result=await build({configFile:false,root,logLevel:'silent',plugins:[react()],build:{write:false,lib:{entry:resolve(root,'src/components/EffectVisuals.jsx'),formats:['es']},rollupOptions:{external:['react']}}});
const output=(Array.isArray(result)?result[0]:result).output.find(o=>o.type==='chunk').code.replace(/from ["']react["']/g,'from '+JSON.stringify(pathToFileURL(resolve(root,'node_modules/react/index.js')).href));
const {bridgeGeometry,CalculationFlow,EffectBridge,SessionJourney,InitiativeEffect}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));

test('Мост сохраняет порядок и знак, скрывает накопление при пропусках и расхождении',()=>{
  const value={bridge:[{code:'yield',name:'Выход',rub:1e6},{code:'mix',name:'Структура',rub:2e5},{code:'price',name:'Цена',rub:3e5},{code:'variable_cost',name:'Переменные расходы',rub:-18e5},{code:'fixed_cost',name:'Постоянные расходы',rub:0}],period_delta_ebitda:-3e5};
  const copy=structuredClone(value),g=bridgeGeometry(value);
  assert.deepEqual(g.bars.map(b=>[b.start,b.end]),[[0,1e6],[1e6,12e5],[12e5,15e5],[15e5,-3e5],[-3e5,-3e5]]);
  assert.ok(g.bars.every(b=>b.height>=0));
  assert.equal(g.total,-3e5);
  assert.equal(bridgeGeometry({...value,period_delta_ebitda:0}),null);
  const rows=value.bridge;
  for(const invalid of [rows.slice(0,4),[rows[0],rows[1],rows[1],rows[3],rows[4]],[rows[0],rows[2],rows[1],rows[3],rows[4]],[...rows,{code:'extra',rub:0}],rows.map(r=>r.code==='price'?{...r,rub:null}:r),rows.map(r=>r.code==='price'?{...r,rub:Infinity}:r)])assert.equal(bridgeGeometry({...value,bridge:invalid}),null);
  const zero=bridgeGeometry({bridge:rows.map(r=>({...r,rub:0})),period_delta_ebitda:0});
  assert.equal(zero.bars.length,5);
  assert.ok(zero.bars.every(b=>b.height===0));
  const pending=renderToStaticMarkup(React.createElement(EffectBridge,{result:{...value,period_delta_ebitda:0}}));
  assert.doesNotMatch(pending,/ev-waterfall/);
  assert.match(pending,/Сверьте денежные составляющие с изменением операционной прибыли/);
  assert.match(pending,/\+1 млн руб/);
  assert.match(pending,/−1,8 млн руб/);
  assert.deepEqual(value,copy);
});

test('Производственная схема сохраняет наблюдаемый корм, физические объёмы и пропущенные деньги',()=>{
  const input=structuredClone(example);
  input.baseline.feed_kg=222000000;
  input.products.forEach(p=>{if(p.kind==='sale')p.baseline_price=null;});
  input.costs_complete=false;
  const copy=structuredClone(input),calculated=productionCase(input);
  const html=renderToStaticMarkup(React.createElement(CalculationFlow,{input,result:calculated}));
  assert.match(html,/Наблюдаемый расход корма/);
  assert.match(html,/Годное мясо/);
  assert.match(html,/млн кг/);
  assert.match(html,/Заполните цены/);
  assert.match(html,/Заполните ставки/);
  assert.doesNotMatch(html,/NaN|Infinity/);
  const bridge=renderToStaticMarkup(React.createElement(EffectBridge,{result:calculated}));
  assert.doesNotMatch(bridge,/ev-waterfall/);
  assert.match(bridge,/Физические объёмы/);
  delete input.baseline.feed_kg;
  assert.match(renderToStaticMarkup(React.createElement(CalculationFlow,{input,result:productionCase(input)})),/Расчётный расход корма/);
  input.baseline.feed_kg=copy.baseline.feed_kg;
  assert.deepEqual(input,copy);
});

test('Встречи показывают переданные даты и результаты, суммы инициатив сохраняют млн руб',()=>{
  const sessions=Array.from({length:4},(_,k)=>({date:(k+1)+' октября',output:'Результат '+(k+1)}));
  const html=renderToStaticMarkup(React.createElement(SessionJourney,{sessions,selectedIndex:2,onSelect:()=>{}}));
  assert.equal((html.match(/<li /g)||[]).length,4);
  assert.equal((html.match(/aria-pressed="true"/g)||[]).length,1);
  assert.match(html,/Результат 4/);
  const money=renderToStaticMarkup(React.createElement(InitiativeEffect,{lever:{annual_ebitda:10,ebitda_2027:6,cash_2027:-2}}));
  assert.match(money,/>10<small>/);
  assert.match(money,/>6<small>/);
  assert.match(money,/>-2<small>/);
});

test('Малая дельта различает округлённые объёмы, EBITDA называет текущий пробел модели',()=>{
  const result={baseline:{eggs_set:1000000,feed_kg:1000000,revenue:1000000},target:{eggs_set:1000123.4567,feed_kg:990123.4567,revenue:1004567.89,variable_expenses:20,fixed_expenses:10,ebitda:null},confirmation_fields:['Календарь запасов']};
  const copy=structuredClone(result),html=renderToStaticMarkup(React.createElement(CalculationFlow,{result}));
  assert.match(html,/Δ \+123 шт/);
  assert.match(html,/Δ −9,88 тыс\. кг/);
  assert.match(html,/Δ \+0,00457 млн руб/);
  assert.match(html,/Согласуйте календарь запасов/);
  assert.doesNotMatch(html,/Δ \+0 млн руб/);
  const rates={...result,target:{...result.target,variable_expenses:null},confirmation_fields:['Состав и ставки расходов']};
  assert.match(renderToStaticMarkup(React.createElement(CalculationFlow,{result:rates})),/Заполните ставки расходов/);
  const prices={...rates,target:{...rates.target,revenue:null}};
  assert.match(renderToStaticMarkup(React.createElement(CalculationFlow,{result:prices})),/Заполните цены продукции/);
  assert.deepEqual(result,copy);
});

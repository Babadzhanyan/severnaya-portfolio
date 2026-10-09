import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {productionCase} from './production.js';
import {applyProductionOpex,deferProductionOpex} from './calculator-session.js';

test('Ожидание расходов сохраняет физику и закрывает все денежные подтверждения',()=>{const result={baseline:{live_kg:100},target:{live_kg:110,ebitda:40},period_delta_ebitda:10,approved_delta_ebitda:10,annual_run_rate_delta:20,bridge_sum:10,bridge_residual:0};const before=structuredClone(result),pending=deferProductionOpex(result);assert.equal(pending.target.live_kg,110);assert.equal(pending.baseline.live_kg,100);assert.equal(pending.target.ebitda,null);assert.equal(pending.target.extra_opex_delta,null);assert.equal(pending.period_delta_ebitda,null);assert.equal(pending.approved_delta_ebitda,null);assert.equal(pending.annual_run_rate_delta,null);assert.equal(pending.bridge_sum,null);assert.deepEqual(result,before);});

const load=name=>JSON.parse(fs.readFileSync(new URL(`../../../backend/data/${name}`,import.meta.url),'utf8'));
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-6*Math.max(1,Math.abs(b)),`${a} / ${b}`);

test('Ожидание расходов согласует внутренний статус прибыли после амортизации и список подтверждений',()=>{
 const result=productionCase({...load('production_example.json'),additional_depreciation:0});
 const pending=deferProductionOpex(result);
 assert.equal(pending.period_delta_ebit,null);
 assert.equal(pending.ebit_status,'Требуется расчёт');
 assert.ok(pending.ebit_confirmation_fields.includes('Финансовое согласование дополнительных расходов'));
});

test('Дополнительные расходы продолжают исходный мост и одинаково меняют прибыль за период и годовой темп',()=>{
 const source=productionCase({...load('production_example.json'),additional_depreciation:100000}),copy=structuredClone(source);
 const result=applyProductionOpex(source,{otherMillion:2,itMillion:.5}),extra=2500000;
 near(result.period_delta_ebitda,source.period_delta_ebitda-extra);
 near(result.target.ebitda,source.target.ebitda-extra);
 near(result.target.revenue-result.target.variable_expenses-result.target.fixed_expenses-result.target.extra_opex_delta,result.target.ebitda);
 near(result.target.ebitda-result.baseline.ebitda,result.period_delta_ebitda);
 near(result.annual_run_rate_delta,result.period_delta_ebitda*12/result.months);
 near(result.period_delta_ebit,source.period_delta_ebit-extra);
 near(result.annual_run_rate_delta_ebit,result.period_delta_ebit*12/result.months);
 assert.deepEqual(result.bridge.slice(0,5),source.bridge);
 assert.deepEqual(result.bridge[5],{code:'extra_opex',name:'Дополнительные операционные расходы',rub:-extra});
 near(result.bridge_sum,source.bridge_sum-extra);
 near(result.bridge_residual,source.bridge_residual);
 assert.equal(result.extra_opex_delta,extra);
 assert.equal(result.target.extra_opex_delta,extra);
 assert.deepEqual(result.extra_opex_inputs,{otherMillion:2,itMillion:.5});
 assert.equal(result.target.variable_expenses,source.target.variable_expenses);
 assert.equal(result.target.fixed_expenses,source.target.fixed_expenses);
 assert.equal(result.estimate_basis,'absolute_states_plus_additional_opex');
 assert.deepEqual(source,copy);
});

test('Экономия прочих расходов имеет отрицательный знак и увеличивает прибыль',()=>{
 const source=productionCase(load('production_example.json'));
 const result=applyProductionOpex(source,{otherMillion:-2,itMillion:.5});
 near(result.period_delta_ebitda,source.period_delta_ebitda+1500000);
 assert.equal(result.extra_opex_delta,-1500000);
 assert.equal(result.bridge.at(-1).rub,1500000);
 assert.equal(result.period_delta_ebit,null);
});

test('Неизвестные расходы сохраняют пропуски даже при известной дополнительной поправке',()=>{
 const source=productionCase(load('production_native_input.json'));
 const result=applyProductionOpex(source,{otherMillion:2,itMillion:1});
 for(const key of ['period_delta_ebitda','annual_run_rate_delta','period_delta_ebit','annual_run_rate_delta_ebit','bridge_sum','bridge_residual'])assert.equal(result[key],null);
 assert.equal(result.target.ebitda,null);
 assert.equal(result.baseline.ebitda,null);
 assert.equal(result.estimate_basis,'requires_inputs');
 assert.equal(result.target.meat_kg,source.target.meat_kg);
 assert.deepEqual(result.incremental_assumptions,source.incremental_assumptions);
 assert.equal(Object.hasOwn(result,'costs_complete'),false);
});

test('Оценка прироста при неизвестных абсолютных расходах сохраняет отдельную денежную поправку',()=>{
 const input=load('production_native_input.json');
 input.changes={};
 for(const p of input.products)if(p.kind==='sale'&&p.baseline_price!==null)p.target_price=p.baseline_price*1.01;
 input.incremental_assumptions=Object.fromEntries(['unknown_rates_unchanged','unknown_fixed_expenses_unchanged','unlisted_expenses_unchanged','price_linked_expenses_unchanged'].map(key=>[key,true]));
 const source=productionCase(input),result=applyProductionOpex(source,{itMillion:.1});
 assert.equal(result.baseline.ebitda,null);
 assert.equal(result.target.ebitda,null);
 near(result.period_delta_ebitda,source.period_delta_ebitda-100000);
 near(result.bridge_sum,result.period_delta_ebitda);
 near(result.bridge_residual,0);
 assert.equal(result.estimate_basis,'driver_variance_plus_additional_opex');
});

test('Нулевые поля сохраняют прежнее согласование и структуру моста',()=>{
 const source=productionCase(load('production_example.json'));
 source.approved_delta_ebitda=source.period_delta_ebitda;
 source.status='Подтверждено';
 const result=applyProductionOpex(source);
 assert.deepEqual(result.bridge,source.bridge);
 assert.equal(result.approved_delta_ebitda,source.approved_delta_ebitda);
 assert.equal(result.status,'Подтверждено');
 assert.equal(result.extra_opex_delta,0);
 assert.equal(result.estimate_basis,source.estimate_basis);
 assert.equal(applyProductionOpex(null),null);
});

test('Ненулевые персональные статьи сбрасывают одобрение даже при взаимной компенсации',()=>{
 const source=productionCase(load('production_example.json'));
 for(const key of ['approved_delta_ebitda','approved_annual_run_rate_delta','approved_delta_ebit','approved_annual_run_rate_delta_ebit'])source[key]=10;
 source.financial_approval=true;
 source.status='Подтверждено';
 const result=applyProductionOpex(source,{otherMillion:-1,itMillion:1});
 for(const key of ['approved_delta_ebitda','approved_annual_run_rate_delta','approved_delta_ebit','approved_annual_run_rate_delta_ebit'])assert.equal(result[key],null);
 assert.equal(result.financial_approval,false);
 assert.equal(result.status,'На согласовании');
 assert.ok(result.confirmation_fields.includes('Дополнительные операционные расходы'));
 near(result.period_delta_ebitda,source.period_delta_ebitda);
 assert.equal(result.bridge.at(-1).rub,0);
});

test('Расходы требуют заполненные числа и допустимый период',()=>{
 for(const value of [null,NaN,Infinity,-Infinity,'1',true]){
  assert.throws(()=>applyProductionOpex(null,{otherMillion:value}),/расходы/i);
  assert.throws(()=>applyProductionOpex(null,{itMillion:value}),/расходы/i);
 }
 assert.throws(()=>applyProductionOpex(null,{itMillion:-1}),/расходы/i);
 assert.throws(()=>applyProductionOpex(null,{otherMillion:Number.MAX_VALUE}),/диапазон/);
 for(const months of [null,0,13,1.5])assert.throws(()=>applyProductionOpex({months},{itMillion:1}),/Период/);
});

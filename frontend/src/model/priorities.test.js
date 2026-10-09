import test from 'node:test';import assert from 'node:assert/strict';
import {priorityMetrics,priorityProjection} from './priorities.js';
import {finances} from './portfolio.js';
import ideas from './fixtures/ideas_priority_inputs_v25.json' with {type:'json'};
import review from '../data/ideas-review.json' with {type:'json'};
const i={code:'ИТ-001',priority_annual_ebitda:12,priority_annual_depreciation:2,priority_hour_rate:2000,priority_duration_months:6,total_hours:'500 ч',one_off_2027:3,run_2027:1,legal_required:'Да',legal_basis:'Норма с предельным сроком',finance_status:'Подтверждено'};
test('Операционная прибыль и ресурсы сохраняют годовую оценку и стоимость внедрения',()=>{const m=priorityMetrics(i);assert.equal(m.ebit,12);assert.equal(m.resourceCost,5);assert.equal(m.duration,6);assert.equal(m.complete,true);assert.equal(m.status,'Расчётная оценка');});
test('График использует операционную прибыль при пустой и заполненной амортизации',()=>{for(const value of [undefined,null,0,2,-2]){const m=priorityMetrics({...i,priority_annual_depreciation:value});assert.equal(m.ebit,12);assert.equal(m.complete,true);assert.doesNotMatch(m.missing.join(' / '),/амортизац/i);}});
test('Каждая неизвестная ось сохраняет пропуск, оборудование пустым отличается от0',()=>{assert.equal(priorityMetrics({...i,one_off_2027:null}).resourceCost,null);assert.equal(priorityMetrics({...i,one_off_2027:0}).resourceCost,2);assert.equal(priorityMetrics({...i,priority_duration_months:null}).complete,false);});
test('Пустой эффект получает понятную метку операционной прибыли',()=>{const m=priorityMetrics({...i,priority_annual_ebitda:null});assert.ok(m.missing.includes('Операционная прибыль после затрат ИТ'));assert.doesNotMatch(m.missing.join(' / '),/EBIT/);assert.equal(m.ebitda,null);assert.equal(m.complete,false);});
test('Обязательство сохраняет отдельный признак и исходное основание',()=>{const m=priorityMetrics(i);assert.equal(m.legal,'required');assert.equal(m.legalBasis,i.legal_basis);assert.equal(priorityMetrics({...i,legal_required:'Уточнить'}).legal,'unknown');});
test('Законодательный приоритет требует основание применимости',()=>{const m=priorityMetrics({...i,legal_basis:null});assert.equal(m.complete,false);assert.ok(m.missing.includes('Основание и срок обязательства'));});
test('Историческая точка остаётся в диаграмме и получает отметку выполненного проекта',()=>{assert.equal(priorityMetrics({...i,execution_fact:{state:'completed',audited:true,scope_complete:true}}).historical,true);});
test('Поворот меняет позицию точки, 2D сохраняет числовую модель',()=>{const m=priorityMetrics(i),a=priorityProjection([m],{yaw:0,pitch:0}),b=priorityProjection([m],{yaw:45,pitch:20}),flat=priorityProjection([m],{mode:'2d'});assert.notEqual(a.points[0].x,b.points[0].x);assert.equal(flat.points[0].ebit,m.ebit);assert.ok(Number.isFinite(flat.points[0].x));});

test('Сопровождение входит в ресурс отдельно, пропуск сохраняет неизвестную стоимость',()=>{assert.equal(priorityMetrics({...i,run_2027:null}).resourceCost,null);assert.equal(priorityMetrics({...i,run_2027:0}).resourceCost,4);assert.equal(priorityMetrics(i).grossPayroll,1);});

test('Неизвестная операционная прибыль сохраняет пропуск независимо от амортизации',()=>{const m=priorityMetrics({...i,priority_annual_ebitda:null,priority_annual_depreciation:-2});assert.equal(m.ebit,null);assert.equal(m.complete,false);});

test('Состав оборудования сохраняет предварительный статус численной оценки',()=>{const i={code:'ИТ-050',priority_annual_ebitda:1,priority_hour_rate:1000,total_hours:10,one_off_2027:0,run_2027:0,priority_duration_months:1,provenance:{assessment:{requires_capital_scope_confirmation:true}}};const r=priorityMetrics(i);assert.equal(r.complete,true);assert.equal(r.capitalScopePending,true);assert.equal(r.status,'Предварительная оценка');assert.deepEqual(r.missing,[]);});

test('Все100 новых идей получают точки и сохраняют финансовое согласование',()=>{
 assert.equal(ideas.length,100);assert.deepEqual(new Set(ideas.map(i=>i.code)),new Set(review.ideas.map(i=>i.code)));
 assert.ok(ideas.every(i=>i.priority_annual_depreciation===undefined));
 const metrics=ideas.map(priorityMetrics),points=priorityProjection(metrics.filter(i=>i.complete)).points;
 assert.equal(points.length,100);assert.ok(points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.depth)));
 assert.ok(points.every(p=>p.status==='Предварительная оценка'));
 for(const p of points)assert.equal(p.capitalScopePending,ideas.find(i=>i.code===p.code).provenance.assessment.requires_capital_scope_confirmation);
 const approved=finances({initiatives:ideas,ledger:[]},ideas);assert.equal(approved.confirmedCount,0);assert.equal(approved.annual,null);
});

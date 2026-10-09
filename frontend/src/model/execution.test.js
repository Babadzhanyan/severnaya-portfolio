import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeExecutionFact} from './execution.js';
import {actualFinishLabel,isCompleted,isHistorical,filterPortfolio,stageSummary,stageCode,deadlineStatus,gateProof,gateEvidence,detailedPlanAllowed,finances,hours,plannedEndLabel,stageDeadlineDate,stageDeadlineLabel} from './portfolio.js';
import {passportGaps} from './user-journey.js';

const fact=(state,extra={})=>normalizeExecutionFact({version:1,state,audited:true,scope_complete:state==='completed',actual_finish:null,actual_finish_precision:null,sources:[{file:'Проекты 2026.xlsx',sheet:'Проекты',row:17,status_cell:'E17',finish_cell:'J17',comment_cell:'K17'}],...extra});
const card=(code,state,extra={})=>({code,stage:['completed','in_progress'].includes(state)?'L4 Реализация':state==='cancelled'?'Уточнить':'L1 Идея',decision:'Обсудить',collection:'projects',initiative_lead:'Калашников Алексей',title:'Исходное полное название',execution_fact:fact(state),...extra});
const data=initiatives=>({initiatives,decisions:[],actuals:[],ledger:[],previousSnapshot:[]});

test('Аудит завершения требует полный состав и точность реальной даты',()=>{
 assert.throws(()=>normalizeExecutionFact({state:'completed',audited:false,scope_complete:true}),/Факт исполнения/);
 assert.throws(()=>normalizeExecutionFact({state:'completed',audited:true,scope_complete:false}),/полного состава/);
 assert.throws(()=>fact('completed',{actual_finish:'2026-02-31',actual_finish_precision:'day'}),/точности/);
 assert.throws(()=>fact('completed',{actual_finish_precision:'month'}),/точности/);
 assert.equal(isCompleted(card('ИТ-001','completed')),true);
 assert.equal(isCompleted({execution_fact:{state:'completed',audited:false,scope_complete:true}}),false);
});
test('Месячная дата источника показывает месяц и год при любой позиционной границе',()=>{
 const i=card('ИТ-106','completed',{execution_fact:fact('completed',{actual_finish:'2026-09-30',actual_finish_precision:'month',actual_finish_raw:'09.2026',actual_finish_label:'сентябрь 2026'})});
 assert.match(actualFinishLabel(i),/сентябр.*2026/);
 assert.doesNotMatch(actualFinishLabel(i),/30|31/);
 assert.equal(fact('completed',{actual_finish:'2026-09',actual_finish_precision:'month'}).actual_finish,'2026-09-01');
 const status=deadlineStatus(data([i]),i,'2026-10-08');
 assert.equal(status.actual,true);assert.equal(status.actualLabel,actualFinishLabel(i));
});
test('Точная дата сохраняет день, фактическая месячная дата сохраняет исходный текст',()=>{
 const i=card('ИТ-001','completed',{execution_fact:fact('completed',{actual_finish:'2026-09-21',actual_finish_precision:'day',actual_finish_raw:'21.09.2026'})});
 assert.equal(actualFinishLabel(i),'21 сентября 2026');
 assert.equal(i.execution_fact.actual_finish_raw,'21.09.2026');
});
test('Факт исполнения сохраняет L4 и отдельный рабочий статус',()=>{
 const i=card('ИТ-001','completed');assert.equal(stageCode(i),'L4');assert.equal(isHistorical(i),true);
 assert.equal(deadlineStatus(data([i]),i,'2026-10-08').text,'Выполнено');
 assert.equal(gateProof(data([i]),i,3),null);
 assert.equal(gateEvidence(data([i]),i,4).historical,true);
 assert.equal(gateEvidence(data([i]),i,5),null);
 assert.equal(finances(data([i]),[i]).annual,null);
});
test('Проверенный исходный запуск закрывает прежние этапы текущей работы',()=>{
 const i=card('ИТ-002','in_progress',{due_l1:'2025-01-01',due_l2:'2025-02-01',due_l3:'2025-03-01',due_l4:'2026-12-01'});
 assert.equal(gateEvidence(data([i]),i,3).historical,true);
 assert.equal(deadlineStatus(data([i]),i,'2026-10-08').code,'proof');
 assert.equal(deadlineStatus(data([i]),i,'2026-10-08').text,'В работе / требуется приёмка');
 assert.equal(detailedPlanAllowed(data([i]),i),false);
});
test('История исключает предварительные часы и подробные фазы2027',()=>{
 const i=card('ИТ-001','completed',{total_hours:600,decision:'В работу'}),d=data([i]);
 d.decisions=[{code:i.code,type:'Запуск',date:'2026-10-08',approved_by:'Белов Сергей Александрович',document:'Протокол №1 о запуске проекта',readiness:'Подтверждено'}];
 assert.equal(hours(i),null);assert.equal(i.total_hours,600);assert.equal(detailedPlanAllowed(d,i),false);assert.deepEqual(passportGaps(i),[]);
});
test('Плановый месяц sourceI определяетL4 и точность статуса срока',()=>{
 const i=card('ИТ-002','in_progress',{due_l4:'2027-12-31',execution_fact:fact('in_progress',{planned_end:{value:'2026-09',precision:'month',raw:'09.2026',label:'Сентябрь 2026',source:'Проекты 2026.xlsx / Описание!I21'}})});
 assert.equal(stageDeadlineDate(i,4),'2026-09-30');assert.match(plannedEndLabel(i),/сентябр.*2026/);assert.doesNotMatch(stageDeadlineLabel(i,4),/30|31/);
 const status=deadlineStatus(data([i]),i,'2026-10-08');assert.equal(status.code,'overdue');assert.equal(status.gate,4);assert.equal(status.dueLabel,plannedEndLabel(i));
 assert.equal(stageDeadlineDate(i,1),'');
 const empty={...i,execution_fact:fact('in_progress',{planned_end:null})};assert.equal(stageDeadlineDate(empty,4),'');assert.equal(stageDeadlineLabel(empty,4),'Требуется срок');
});
test('Заявленная дата при противоречииE/J сохраняет текущую работу',()=>{
 const i=card('ИТ-034','in_progress',{execution_fact:fact('in_progress',{date_conflict:true,actual_finish:'2026-09',actual_finish_precision:'month',actual_finish_raw:'9.202600',actual_finish_basis:'source_reported_requires_reconciliation'})});
 assert.equal(i.execution_fact.date_conflict,true);assert.equal(i.execution_fact.actual_finish_raw,'9.202600');assert.equal(stageCode(i),'L4');assert.equal(isCompleted(i),false);assert.equal(isHistorical(i),false);assert.match(actualFinishLabel(i),/сентябр.*2026/);assert.equal(finances(data([i]),[i]).annual,null);
});
test('Рабочая воронка содержит142карточки, история53 и вся коллекция195',()=>{
 let serial=0;const rows=[];for(const [state,count] of [['completed',52],['in_progress',50],['planned',62],['paused',7],['cancelled',1]])for(let k=0;k<count;k++)rows.push(card('ИТ-'+String(++serial).padStart(3,'0'),state));
 for(let k=0;k<23;k++)rows.push({code:'ИТ-'+String(++serial).padStart(3,'0'),collection:'ideas',stage:'L0 Входящие предложения',decision:'Обсудить',initiative_lead:'Крылович Сергей'});
 const d=data(rows),active=filterPortfolio(d,{scope:'working'});
 assert.equal(active.length,142);assert.equal(filterPortfolio(d,{scope:'history'}).length,53);assert.equal(filterPortfolio(d,{scope:'primary'}).length,172);assert.equal(filterPortfolio(d,{scope:'ideas'}).length,23);assert.equal(filterPortfolio(d,{scope:'all'}).length,195);
 assert.deepEqual(stageSummary(d,active).filter(r=>r.count).map(r=>[r.code,r.count]),[['L0',23],['L1',69],['L4',50]]);
 assert.equal(active.some(isHistorical),false);
});
test('Прямой состав идей открывает все входящие предложения при сохранённом сотруднике',()=>{
 const rows=[card('ИТ-001','planned'),{code:'ИТ-177',collection:'ideas',stage:'L0 Входящие предложения',decision:'Обсудить',initiative_lead:'Крылович Сергей'}],d=data(rows);
 assert.equal(filterPortfolio(d,{scope:'ideas',person:'Калашников Алексей'}).length,0);
 assert.deepEqual(filterPortfolio(d,{scope:'ideas'}).map(i=>i.code),['ИТ-177']);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {passportGaps,passportCheckLevel} from './user-journey.js';

const visibleComposition={title:'Дашборды производства',problem:'Разрозненные определения показателей',solution:'Единые дашборды',scope:'Сбор данных и публикация показателей',initiative_lead:'Калашников Алексей',curator:'Петров Дмитрий',collection:'projects'};
const assessment={customer:'Заказчик определён',benefit_owner:'Владелец результата определён',digital_layer:'Ц3 Учёт и цифровые процессы'};

test('L1 проверяет только видимый состав, скрытые роли и измерения собираются на L2',()=>{
 const card={...visibleComposition,stage:'L1 Идея',customer:null,benefit_owner:null,digital_layer:null,baseline:null,metric:null,baseline_source:null,target:null,target_date:null,updated_at:null,updated_by:null,action_due:null};
 const before=structuredClone(card);
 assert.deepEqual(passportGaps(card),[]);
 assert.equal(passportCheckLevel(card),1);
 assert.deepEqual(card,before);
});

test('Проверка L1 показывает название, корректную стадию, состав, ответственного и автоматического куратора',()=>{
 const card={...visibleComposition,stage:'L1 Идея'};
 for(const [field,label] of [['title','Название'],['problem','Проблема'],['solution','Решение'],['scope','Состав работ'],['initiative_lead','Ответственный'],['curator','Куратор']])assert.deepEqual(passportGaps({...card,[field]:'  '}),[label]);
 assert.deepEqual(passportGaps({...card,stage:'Уточнить'}),['Стадия']);
 assert.deepEqual(passportGaps({...card,problem:'Требуется проблема'}),['Проблема']);
});

test('L2 собирает бизнес-владельцев, уровень, показатель, базу, источник, цель и дату',()=>{
 const card={...visibleComposition,stage:'L2 Оценка'};
 assert.deepEqual(passportGaps(card),['Заказчик / инициатор','Владелец эффекта','Уровень трансформации','Показатель успеха','База показателя','Источник базы','Цель показателя','Дата достижения цели']);
 assert.deepEqual(passportGaps({...card,...assessment}),['Показатель успеха','База показателя','Источник базы','Цель показателя','Дата достижения цели']);
 assert.deepEqual(passportGaps({...card,...assessment,metric:'Доля операций',baseline:0,baseline_source:'Отчёт периода',target:0,target_date:'2027-06-30'}),[]);
});

test('L0 проверяет общий видимый состав, срок анализа остаётся в планировании',()=>{
 const card={...visibleComposition,collection:'ideas',stage:'L0 Входящие предложения',action_due:null};
 assert.deepEqual(passportGaps(card),[]);
 assert.equal(passportCheckLevel(card),0);
 for(const [field,label] of [['title','Название'],['problem','Проблема'],['solution','Решение'],['scope','Состав работ'],['initiative_lead','Ответственный'],['curator','Куратор']])assert.deepEqual(passportGaps({...card,[field]:null}),[label]);
});

test('История и выполненные работы сохраняют статус и проходят отдельную проверку факта',()=>{
 for(const state of ['completed','cancelled']){
  const card={code:'ИТ-104',stage:'L4 Реализация',execution_fact:{state,audited:true,scope_complete:true}},before=structuredClone(card);
  assert.deepEqual(passportGaps(card),[]);assert.equal(passportCheckLevel(card),3);assert.deepEqual(card,before);
 }
});

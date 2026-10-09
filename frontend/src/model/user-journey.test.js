import test from 'node:test';
import assert from 'node:assert/strict';
import {passportGaps} from './user-journey.js';

const composition={problem:'Задача подтверждена владельцем',solution:'Решение описано',scope:'Результат определён',customer:'Заказчик определён',benefit_owner:'Владелец эффекта определён',digital_layer:'Ц3 Учёт и цифровые процессы',initiative_lead:'Калашников Алексей',baseline:null,metric:null,baseline_source:null,target:null,target_date:null,collection:'projects'};

test('L1 проверяет состав и владельцев при пустой измерительной базе',()=>{
 assert.deepEqual(passportGaps({...composition,stage:'L1 Идея'}),[]);
 assert.deepEqual(passportGaps({...composition,stage:'L1 Идея',initiative_lead:'  '}),['Ответственный за паспорт']);
});

test('L2 требует показатель, базу, источник, цель и дату',()=>{
 assert.deepEqual(passportGaps({...composition,stage:'L2 Оценка'}),['Показатель успеха','База показателя','Источник базы','Цель показателя','Дата достижения цели']);
 assert.deepEqual(passportGaps({...composition,stage:'L2 Оценка',metric:'Доля операций',baseline:0,baseline_source:'Отчёт периода',target:0,target_date:'2027-06-30'}),[]);
});

test('L0 требует предмет и срок анализа, сохраняя расчёт на следующем этапе',()=>{
 assert.deepEqual(passportGaps({collection:'ideas',stage:'L0 Входящие предложения',problem:'Предмет указан',scope:'Проверка целесообразности',initiative_lead:'Крылович Сергей',action_due:'2026-10-13'}),[]);
 assert.deepEqual(passportGaps({collection:'ideas',stage:'L0 Входящие предложения',problem:'Предмет указан',scope:'Проверка целесообразности',initiative_lead:'Крылович Сергей'}),['Срок анализа']);
});

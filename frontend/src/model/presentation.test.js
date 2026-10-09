import test from 'node:test';
import assert from 'node:assert/strict';
import {processGroup,initiativeTitle,filterPortfolio,facetedOptions} from './portfolio.js';

test('Общий передел сохраняет проекты площадок и связанные фильтры',()=>{
 const data={initiatives:[
  {code:'ИТ-001',process:'Выращивание / Северная',it_group:'Автоматика',initiative_lead:'Первый'},
  {code:'ИТ-002',process:'Выращивание / Войсковицы',it_group:'Данные',initiative_lead:'Второй'},
  {code:'ИТ-003',process:'Выращивание',it_group:'Данные',initiative_lead:'Второй'},
  {code:'ИТ-004',process:'Склад и отгрузка / Северная',it_group:'Данные',initiative_lead:'Второй'}
 ]};
 assert.equal(processGroup(data.initiatives[0]),'Выращивание');
 assert.deepEqual(filterPortfolio(data,{process:'Выращивание'}).map(i=>i.code).sort(),['ИТ-001','ИТ-002','ИТ-003']);
 assert.deepEqual(filterPortfolio(data,{process:'Выращивание',group:'Данные'}).map(i=>i.code).sort(),['ИТ-002','ИТ-003']);
 assert.deepEqual(facetedOptions(data,{},'process'),['Выращивание','Склад и отгрузка']);
 assert.equal(data.initiatives[0].process,'Выращивание / Северная');
});

test('Публичное название сохраняет предмет и исходную строку',()=>{
 const card={title:'Конверсия корма и индекс EPEF по корпусу (весы и микроклимат, источник Д.2)'};
 assert.equal(initiativeTitle(card),'Конверсия корма и индекс EPEF по корпусу (весы и микроклимат)');
 assert.ok(card.title.includes('источник Д.2'));
 assert.equal(initiativeTitle('Учёт выработки (источник Д.3)'),'Учёт выработки');
});

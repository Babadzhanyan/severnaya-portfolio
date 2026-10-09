import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {productionNodes,productionLinks,parentMeatLink,mainStages,supportFunctions,allPlantNodes,primaryPlantNode,matches,plantCoverage} from './plant.js';
import {normalizeManifest} from '../data/production-assets.js';
import {projectResponse as rawProjectResponse} from '../data/projector.js';
import config from './fixtures/source_config_v18.json' with {type:'json'};
const projectResponse=(response)=>rawProjectResponse(response,undefined,config);
const actual=projectResponse(JSON.parse(fs.readFileSync(new URL('./fixtures/ownership_fixture_v15.json',import.meta.url),'utf8'))).initiatives;
test('Карта сохраняет13 производственных узлов,17 связей и15 служб образца',()=>{
  assert.equal(productionNodes.length,13);assert.equal(productionLinks.length,17);assert.equal(supportFunctions.length,15);
  const ids=new Set(productionNodes.map(n=>n.id));
  for(const[from,to]of productionLinks){assert.ok(ids.has(from));assert.ok(ids.has(to));}
  assert.deepEqual(new Set(mainStages.flatMap(n=>n.children)),ids);
});
test('Службы получают связь из процесса и предметного названия; общий остаток сохраняет код',()=>{
  const list=[{code:'ИТ-001',title:'Учёт рабочего времени: табелирование',process:'Корпоративные сервисы'},{code:'ИТ-002',title:'Программа финансов',process:'Корпоративные сервисы'},{code:'ИТ-003',title:'Ремонт компьютеров',process:'Сквозные ИТ-сервисы'},{code:'ИТ-004',title:'Электроснабжение',process:'Вспомогательные производства'}];
  assert.equal(matches(supportFunctions.find(n=>n.id==='personnel'),list)[0].code,'ИТ-001');
  assert.equal(matches(supportFunctions.find(n=>n.id==='repair'),list).length,0);
  assert.equal(plantCoverage(list).linked,3);assert.deepEqual(plantCoverage(list).unassigned.map(i=>i.code),['ИТ-003']);
});
test('Предметные названия находят родительское стадо и ремонт; персональные данные сохраняют общий контур',()=>{
  const list=[{code:'ИТ-193',title:'Формы производства – родительские птицефабрики',process:'Корпоративные сервисы'},{code:'ИТ-064',title:'Система управления ремонтами и обслуживанием на всей фабрике',process:'Сквозные ИТ-сервисы'},{code:'ИТ-125',title:'Внутренний аудит обработки персональных данных',process:'Корпоративные сервисы'}];
  assert.equal(matches(productionNodes.find(n=>n.id==='parents'),list)[0].code,'ИТ-193');
  assert.equal(matches(supportFunctions.find(n=>n.id==='repair'),list)[0].code,'ИТ-064');
  assert.equal(matches(supportFunctions.find(n=>n.id==='personnel'),list).length,0);
});
test('Предмет названия связывает один код с основным участком и укрупнённым этапом',()=>{
  const list=[{code:'ИТ-001',title:'Автоматизация разделки',process:'Разделка и упаковка',additional_business_stages:['Глубокая переработка']},{code:'ИТ-002',title:'Учёт выработки убоя',process:'Убой',additional_business_stages:['Глубокая переработка']}];
  assert.deepEqual(matches(mainStages.find(n=>n.id==='processing'),list).map(i=>i.code),['ИТ-001','ИТ-002']);
  assert.equal(matches(productionNodes.find(n=>n.id==='deep'),list).length,0);
  assert.deepEqual(list[0].additional_business_stages,['Глубокая переработка']);
});
test('Проверенные предметные инициативы получают один основной участок; общие системы сохраняют общий список',()=>{
  const expected={'ИТ-177':'other','ИТ-179':'other','ИТ-002':'procurement','ИТ-034':null,'ИТ-104':null,'ИТ-038':null,'ИТ-064':'repair'};
  for(const[code,node]of Object.entries(expected)){
    const card=actual.find(i=>i.code===code);assert.ok(card,code);
    assert.equal(primaryPlantNode(card),node,code);
    assert.deepEqual(allPlantNodes.filter(n=>matches(n,[card]).length).map(n=>n.id),node?[node]:[],code);
  }
});
test('Кириллические границы различают источник, сточные воды, котлы, отлов и участок ММО',()=>{
  assert.equal(primaryPlantNode({title:'Учёт источников данных',process:'Сквозные ИТ-сервисы'}),null);
  assert.equal(primaryPlantNode({title:'Мониторинг сточных вод',process:'Сквозные ИТ-сервисы'}),'wastewater');
  assert.equal(primaryPlantNode({title:'Управление котлов 5 и 6',process:'Сквозные ИТ-сервисы'}),'boiler');
  assert.equal(primaryPlantNode({title:'Система отлова птицы',process:'Сквозные ИТ-сервисы'}),'fleet');
  assert.equal(primaryPlantNode({title:'Участок ММО',process:'Сквозные ИТ-сервисы'}),'other');
  assert.equal(primaryPlantNode({title:'Проверка Аммония',process:'Сквозные ИТ-сервисы'}),null);
});
test('Предметные границы отделяют бухгалтерские книги и корпоративные данные от продаж и склада',()=>{
  const expected={'ИТ-027':'accounting','ИТ-167':null,'ИТ-130':null,'ИТ-131':null,'ИТ-107':null,'ИТ-090':null,'ИТ-076':'wastewater'};
  for(const[code,node]of Object.entries(expected))assert.equal(primaryPlantNode(actual.find(i=>i.code===code)),node,code);
  assert.equal(primaryPlantNode({title:'Склад готовой продукции',process:'Склад и отгрузка'}),'stock');
  assert.equal(primaryPlantNode({title:'Центральный склад запчастей',process:'Склад и отгрузка'}),'warehouse');
  assert.equal(primaryPlantNode({title:'Единая система ERP производства и склада',process:'Убой',additional_business_stages:['Склад и отгрузка']}),null);
  assert.equal(primaryPlantNode({title:'Сквозная система',process:'Разделка и упаковка'}),null);
});
test('Все200 карточек сохраняются в основном участке или общем списке; каждый код имеет одну привязку',()=>{
  const before=structuredClone(actual),mapped=allPlantNodes.flatMap(n=>matches(n,actual)),coverage=plantCoverage(actual);
  assert.equal(actual.length,200);assert.equal(new Set(actual.map(i=>i.code)).size,200);
  assert.equal(new Set(mapped.map(i=>i.code)).size,mapped.length);
  assert.equal(coverage.linked,mapped.length);assert.equal(coverage.linked+coverage.unassigned.length,200);
  for(const card of actual){
    assert.ok(allPlantNodes.filter(n=>matches(n,[card]).length).length<=1,card.code);
    assert.ok(mainStages.filter(n=>matches(n,[card]).length).length<=1,card.code);
  }
  assert.deepEqual(actual,before);
});
test('Реестр изображений принимает локальные файлы и отклоняет внешние адреса и переходы по папкам',()=>{
  const files=normalizeManifest({assets:[{id:'good',path:'assets/production-ai/feed.webp'},{id:'external',path:'https://example.org/image.webp'},{id:'relative',path:'../image.webp'},{id:'scheme',path:'data:image/png;base64,example'},{id:'root',path:'/other/image.png'}]});
  assert.deepEqual(files,{good:'feed.webp'});
});
test('Стрелки основных маршрутов и родительского мяса проходят вне изображений и подписей',()=>{
  for(const path of [...productionLinks.map(l=>l[2]),parentMeatLink]){
    const tokens=path.match(/[MHV]|\d+/g);let x=0,y=0;
    for(let k=0;k<tokens.length;){const cmd=tokens[k++];if(cmd==='M'){x=Number(tokens[k++]);y=Number(tokens[k++]);continue;}
      const nx=cmd==='H'?Number(tokens[k++]):x,ny=cmd==='V'?Number(tokens[k++]):y;
      for(const n of productionNodes){const overlap=cmd==='H'?y>n.y&&y<n.y+240&&Math.max(x,nx)>n.x&&Math.min(x,nx)<n.x+180:x>n.x&&x<n.x+180&&Math.max(y,ny)>n.y&&Math.min(y,ny)<n.y+240;assert.equal(overlap,false,`${path} пересекает ${n.id}`);}
      x=nx;y=ny;
    }
  }
});

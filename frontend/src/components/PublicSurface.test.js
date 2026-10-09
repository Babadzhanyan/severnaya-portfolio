import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const root=fileURLToPath(new URL('../../',import.meta.url));
async function component(file,named='default'){
 const result=await build({configFile:false,root,logLevel:'silent',plugins:[react()],build:{write:false,lib:{entry:resolve(root,'src/components/'+file+'.jsx'),formats:['es']},rollupOptions:{external:['react','react/jsx-runtime']}}});
 const code=(Array.isArray(result)?result[0]:result).output.find(o=>o.type==='chunk').code.replace(/["']react(?:\/jsx-runtime)?["']/g,name=>JSON.stringify(pathToFileURL(resolve(root,'node_modules/react/'+(name.includes('/')?'jsx-runtime.js':'index.js'))).href));
 return (await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64')))[named];
}
const [SessionPlan,Passport,LegalObligations,InitiativeCollection,IdeasReview]=await Promise.all([component('SessionPlan'),component('Passport'),component('LegalObligations'),component('UserJourney','InitiativeCollection'),component('IdeasReview')]);
const render=(Component,props)=>renderToStaticMarkup(React.createElement(Component,props));

test('Публичный план показывает четыре встречи и исключает черновики организатора',async()=>{
 const html=render(SessionPlan,{data:{initiatives:[]}}),json=JSON.parse(await readFile(resolve(root,'src/data/programme_public_v18.json'),'utf8'));
 assert.equal(json.sessions.length,4);
 assert.equal((html.match(/class="session-card"/g)||[]).length,4);
 assert.match(html,/До 13 октября, 18:00/);assert.match(html,/До 14 октября, 18:00/);
 assert.equal((html.match(/<video /g)||[]).length,3);
 assert.doesNotMatch(html,/<details|<summary|Костя|Готовые сообщения|Порядок первой встречи|EBIT|амортизац/);
 assert.equal(json.messages,undefined);assert.equal(json.instructions,undefined);
 assert.equal(json.first_agenda,undefined);assert.equal(json.sessions[0].kostya,undefined);
 for(const s of json.sessions)assert.equal(html.split(s.output).length-1,1,"Результат встречи показан один раз");
});

test('Паспорт использует одну карточку и сохраняет основное действие редактирования',()=>{
 const i={code:'ИТ-001',title:'Проект проверки (весы и микроклимат, источник Д.2)',stage:'L1 Идея',problem:'Проблема',scope:'Состав работ',solution:'Решение',success:'Критерий',metric:'Операционный показатель',baseline:1,target:2,priority_annual_ebitda:.25,digital_layer:'Ц3 Учёт и цифровые процессы',initiative_lead:'Исполнитель',it_group:'Разработка',curator:'Куратор',process:'Выращивание / Войсковицы',collection:'projects',provenance:{origin:'primary'}};
 const html=render(Passport,{data:{initiatives:[i],plan:[],asOf:'2026-10-09',ledger:[],actuals:[],decisions:[]},i,list:[i]});
 assert.match(html,/Проект проверки/);assert.match(html,/весы и микроклимат/);assert.doesNotMatch(html,/источник Д\.2|Войсковицы/);assert.match(html,/Проблема/);assert.match(html,/Операционный показатель/);
 assert.match(html,/Годовой прирост операционной прибыли, млн руб/);assert.match(html,/0,25/);
 assert.equal((html.match(/class="passport-core passport-canvas"/g)||[]).length,1);
 assert.match(html,/Открыть в таблице/);
 assert.doesNotMatch(html,/<details|<summary|Источник поля|Исходное название и архив|Годовой прирост EBIT|амортизац|EBITDA/);
});

test('Открытые требования сохраняют применимость и все связанные коды',()=>{
 const law={id:'law-1',title:'Требование проверки',reference:'Официальный идентификатор',enterprise_mandatory:true,urls:[{title:'Официальный акт',url:'https://example.com/law'},{title:'Запрещённая ссылка',url:'javascript:alert(1)'}],deadlines:[{date:'1 января 2027',label:'Исполнение требования'}]};
 const list=['ИТ-001','ИТ-002'].map(code=>({code,provenance:{legal_obligations:[law]}}));
 const html=render(LegalObligations,{list,onOpen:()=>{}});
 assert.equal((html.match(/data-law="law-1"/g)||[]).length,1);
 assert.match(html,/ИТ-001/);assert.match(html,/ИТ-002/);assert.match(html,/Обязанность компании/);assert.match(html,/1 января 2027/);
 assert.match(html,/https:\/\/example.com\/law/);assert.doesNotMatch(html,/<details|<summary|javascript:/);
});


test('Компактный список сохраняет длинное название, код и отдельные действия',()=>{
 const title='Производственный проект с длинным названием, полным составом работ и исходным уточнением';
 const card={code:'ИТ-038',title,stage:'L1 Идея',initiative_lead:'Ответственный',provenance:{origin:'primary'}};
 const opened=[],props={list:[card],all:true,onOpen:code=>opened.push(code)};
 const html=render(InitiativeCollection,props);
 assert.equal((html.match(/data-code="ИТ-038"/g)||[]).length,1);
 assert.match(html,new RegExp(title));
 assert.match(html,/<div class="collection-content"><h2>/);
 assert.match(html,/<div class="collection-actions"><button aria-label="ИТ-038 \/ открыть паспорт"/);
 assert.match(html,/aria-label="ИТ-038 \/ открыть в таблице"/);
 const nodes=node=>!node?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
 const button=nodes(InitiativeCollection(props)).find(n=>n.type==='button');
 button.props.onClick();assert.deepEqual(opened,['ИТ-038']);
});

test('История показывает завершённое внедрение вместе с последующим сопровождением',()=>{
 const card={code:'ИТ-104',title:'Дашборды этапа 1',stage:'L4 Реализация',initiative_lead:'Петров Дмитрий',execution_fact:{state:'completed',scope_complete:true,audited:true,work_status:'Сопровождение'}};
 const html=render(InitiativeCollection,{list:[card],all:true,onOpen:()=>{}});
 assert.match(html,/Выполнено \/ Петров Дмитрий \/ Сопровождение/);assert.doesNotMatch(html,/>L4 \/ Петров Дмитрий/);assert.equal(card.stage,'L4 Реализация');assert.equal(card.execution_fact.work_status,'Сопровождение');
});

test('Единый раздел переключает идеи и открытые результаты ревью',()=>{
 const idea={code:'ИТ-312',title:'Проверка обмена',stage:'L0 Входящие предложения',initiative_lead:'Лебедев Андрей',collection:'ideas'};
 const data={initiatives:[idea]},review=React.createElement(IdeasReview,{data,onOpen:()=>{},compact:true});
 const list=render(InitiativeCollection,{list:[idea],children:review,onOpen:()=>{},section:'ideas',onSection:()=>{}});
 assert.match(list,/Содержание новых идей/);assert.match(list,/Идеи \/ 1/);assert.match(list,/Результаты ревью/);assert.match(list,/collection-item/);assert.doesNotMatch(list,/review-levels/);
 const result=render(InitiativeCollection,{list:[idea],children:review,onOpen:()=>{},section:'review',onSection:()=>{}});
 assert.match(result,/Новые идеи \/ 1/);assert.match(result,/review-levels/);assert.match(result,/Правовая сверка связывает 28/);assert.match(result,/Внутренние обязательства/);assert.doesNotMatch(result,/<details|<summary|collection-item/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {digitalLayers} from '../model/portfolio.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const result=await build({configFile:false,root,logLevel:'silent',plugins:[react()],build:{write:false,lib:{entry:resolve(root,'src/components/Pyramid.jsx'),formats:['es']},rollupOptions:{external:['react','react/jsx-runtime']}}});
const output=(Array.isArray(result)?result[0]:result).output.find(o=>o.type==='chunk').code.replace(/["']react(?:\/jsx-runtime)?["']/g,name=>JSON.stringify(pathToFileURL(resolve(root,'node_modules/react/'+(name.includes('/')?'jsx-runtime.js':'index.js'))).href));
const {default:Pyramid,PyramidSvg}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'));
const items=[digitalLayers[0],digitalLayers[0],digitalLayers[3]].map((l,k)=>({code:'check-'+k,digital_layer:l.code+' '+l.name,it_group:'Команда проверки',initiative_lead:'Участник проверки',stage:'L0',decision:'В работу'}));
const render=props=>renderToStaticMarkup(React.createElement(PyramidSvg,props));

test('Шесть уровней считают текущие карточки, форма сохраняет фиксированные пропорции',()=>{
  const populated=render({items,onLayer:()=>{}}),empty=render({items:[],onLayer:()=>{}});
  assert.equal((populated.match(/class="dp-row /g)||[]).length,7);
  assert.match(populated,/Ц0 Устойчивый ИТ-контур \/ количество инициатив: 2/);
  assert.match(populated,/Ц3 Учёт и цифровые процессы \/ количество инициатив: 1/);
  assert.deepEqual(populated.match(/--dp-width:[^";]+/g),empty.match(/--dp-width:[^";]+/g));
  assert.equal((empty.match(/disabled=""/g)||[]).length,6);
});

test('Нативные кнопки сохраняют выбор уровня и переход к расчёту',()=>{
  const level=digitalLayers[3],value=level.code+' '+level.name,chosen=[];
  const wrapper=PyramidSvg({items,selected:value,onLayer:v=>chosen.push(v),onResult:()=>chosen.push('calculator')});
  const tree=wrapper.type(wrapper.props);
  const buttons=node=>!node?[]:Array.isArray(node)?node.flatMap(buttons):[...(node.type==='button'?[node]:[]),...buttons(node.props?.children)];
  const controls=buttons(tree),selection=controls.find(b=>b.props['aria-label'].startsWith('Ц3'));
  assert.equal(selection.props['aria-pressed'],true);
  assert.equal(selection.props.disabled,false);
  selection.props.onClick();controls[0].props.onClick();
  assert.deepEqual(chosen,[value,'calculator']);
  assert.match(render({items,selected:value,onLayer:()=>{}}),/Выбран/);
});

test('Пирамида связывает продукты и бизнесрезультат с одной иерархией инициатив',()=>{
  const data={initiatives:items,ledger:[]},html=renderToStaticMarkup(React.createElement(Pyramid,{data,list:items,contextList:items,onView:()=>{},onTeamLayer:()=>{}}));
  assert.match(html,/INNOVA \/ SKOV \/ FarmOnline/);
  assert.match(html,/1С \/ учёт/);
  assert.match(html,/Собственные приложения/);
  assert.match(html,/Повышение выхода годной продукции/);
  assert.match(html,/инженерные службы получают оперативное управление/);
  assert.match(html,/Согласованных конечных эффектов: 0/);
  assert.match(html,/Требуется оценка/);
  assert.match(html,/Иерархия инициатив по уровням трансформации/);
  assert.equal((html.match(/class="transformation-initiative"/g)||[]).length,items.length);
  assert.doesNotMatch(html,/<table|team-layer-matrix|transformation-meaning|Годовой потенциал до затрат|→|data-icon="arrow"/);
});

test('Иерархия сохраняет уровень, команду, ответственного и прямые переходы',()=>{
  const level=digitalLayers[3],selected=level.code+' '+level.name,actions=[];
  const props={data:{initiatives:items,ledger:[]},list:items.filter(i=>i.digital_layer===selected),contextList:items,filter:{layer:selected},onOpen:code=>actions.push(['passport',code]),onTeamLayer:(layer,team)=>actions.push(['team',layer,team])};
  const html=renderToStaticMarkup(React.createElement(Pyramid,props));
  assert.match(html,/Ц0 Устойчивый ИТ-контур \/ количество инициатив: 2/);
  assert.match(html,/data-layer="Ц3"/);
  assert.equal((html.match(/class="transformation-initiative"/g)||[]).length,1);
  assert.match(html,/data-team="Команда проверки"/);
  assert.match(html,/data-owner="Участник проверки"/);
  assert.match(html,/текущие проекты и идеи: 1/);
  assert.doesNotMatch(html,/<details|<summary/);
  assert.doesNotMatch(html,/1 текущих|1 инициатив|2 инициатив<\/span>/);
  assert.match(html,/aria-label="check-2[^"]*открыть паспорт/);
  assert.match(html,/Выбрать команду/);
});

test('Годовая оценка использует чистый результат текущих карточек и сохраняет историю',()=>{
  const cards=items.map((i,k)=>({...i,title:'Инициатива '+k,annual_effect:900,priority_annual_ebitda:[-.3,.8,100][k],...(k===2?{execution_fact:{audited:true,state:'completed',scope_complete:true}}:{})}));
  const html=renderToStaticMarkup(React.createElement(Pyramid,{data:{initiatives:cards,ledger:[]},list:cards,onOpen:()=>{}}));
  assert.match(html,/текущие проекты и идеи: 2 \/ история: 1/);
  assert.match(html,/Предварительный годовой прирост операционной прибыли, млн руб<\/span><strong>0,5<\/strong>/);
  assert.match(html,/Согласованных конечных эффектов: 0/);
  assert.doesNotMatch(html,/EBIT|амортизац/);
  assert.match(html,/История \/ Выполнено/);
  assert.equal((html.match(/Оценка прибыли, млн руб \/ год/g)||[]).length,2);
  assert.doesNotMatch(html,/>900<|>100<|до затрат/);
});

test('Печатный состав раскрывает команды и владельцев, неопределённый уровень сохраняет карточку',()=>{
  const cards=[...items,{...items[0],code:'check-unknown',digital_layer:null}];
  const html=renderToStaticMarkup(React.createElement(Pyramid,{data:{initiatives:cards,ledger:[]},list:cards}));
  assert.match(html,/data-layer="unassigned"/);
  assert.match(html,/Уточнить уровень/);
  assert.equal((html.match(/class="transformation-initiative"/g)||[]).length,cards.length);
  assert.doesNotMatch(html,/<details|<summary/);
  assert.equal((html.match(/class="transformation-print-title"/g)||[]).length,cards.length);
  assert.doesNotMatch(html,/transformation-passport-link|Выбрать команду/);
});


test('Публичный список показывает двадцать инициатив, печатный состав сохраняет все двести',()=>{
 const cards=Array.from({length:200},(_,k)=>({...items[k%items.length],code:'ИТ-'+String(k+1).padStart(3,'0'),title:'Инициатива '+(k+1),priority_annual_ebitda:k/100}));
 const props={data:{initiatives:cards,ledger:[]},list:cards};
 const publicHtml=renderToStaticMarkup(React.createElement(Pyramid,{...props,onOpen:()=>{}}));
 const printHtml=renderToStaticMarkup(React.createElement(Pyramid,props));
 assert.equal((publicHtml.match(/class="transformation-initiative"/g)||[]).length,20);
 assert.match(publicHtml,/1–20 из 200/);
 assert.equal(new Set([...printHtml.matchAll(/data-code="(ИТ-\d{3})"/g)].map(m=>m[1])).size,200);
 assert.doesNotMatch(publicHtml,/<details|<summary|EBIT|амортизац/);
});

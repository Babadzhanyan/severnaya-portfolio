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

test('Внутренняя схема обозначает продукты, бизнесэффект и команды получают отдельные блоки',()=>{
  const data={initiatives:items,ledger:[]},html=renderToStaticMarkup(React.createElement(Pyramid,{data,list:items,contextList:items,onView:()=>{},onTeamLayer:()=>{}}));
  assert.match(html,/По внутренней схеме: INNOVA \/ SKOV \/ FarmOnline/);
  assert.match(html,/1С \/ учёт/);
  assert.match(html,/Собственные приложения/);
  assert.match(html,/Направление: повышение эффективности/);
  assert.match(html,/инженерные службы получают оперативное управление/);
  assert.match(html,/Согласованных конечных эффектов: 0/);
  assert.match(html,/Требуется согласование/);
  assert.match(html,/team-layer-matrix/);
  assert.match(html,/Область изменения каждого уровня/);
});

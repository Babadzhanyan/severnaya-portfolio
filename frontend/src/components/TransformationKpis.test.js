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
async function component(file){const result=await build({configFile:false,root,logLevel:'silent',plugins:[react()],build:{write:false,lib:{entry:resolve(root,'src/components/'+file+'.jsx'),formats:['es']},rollupOptions:{external:['react','react/jsx-runtime']}}});const code=(Array.isArray(result)?result[0]:result).output.find(o=>o.type==='chunk').code.replace(/["']react(?:\/jsx-runtime)?["']/g,name=>JSON.stringify(pathToFileURL(resolve(root,'node_modules/react/'+(name.includes('/')?'jsx-runtime.js':'index.js'))).href));return (await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).default;}
const Kpis=await component('TransformationKpis'),Pyramid=await component('Pyramid');
const input=JSON.parse(await readFile(resolve(root,'../backend/data/production_native_input.json'),'utf8'));
const data={productionInput:input,annualActualInput:{period:'Май 2025–апрель 2026',sales:{quantity_kg:208515884.605,revenue:33096006892.8734},sources:{sales:'Факт',price:'Чистая выручка / кг'}},initiatives:[],ledger:[]};
const render=props=>renderToStaticMarkup(React.createElement(Kpis,{data,...props}));
test('Экран показывает четыре результата, три группы и шесть уровней с двумя драйверами',()=>{
 const html=render({});assert.equal((html.match(/data-outcome=/g)||[]).length,4);assert.equal((html.match(/role="tab"/g)||[]).length,3);assert.equal((html.match(/показать КПЭ и инициативы/g)||[]).length,6);assert.equal((html.match(/data-metric=/g)||[]).length,2);
 assert.match(html,/158,72 руб \/ кг/);assert.match(html,/208,52 млн кг/);assert.doesNotMatch(html,/141,59|EBIT|амортизац|Гипотеза|<details|источник Д/);assert.equal((html.match(/tabindex="0"/g)||[]).length,2);
});
test('Выбранный уровень связан с фильтром, Ц5 отделяет прогноз от других моделей',()=>{
 const html=render({filter:{layer:'Ц5 Аналитика и ИИ'},contextList:[{digital_layer:'Ц5 Аналитика и ИИ'}]});assert.match(html,/Инициатив: 1/);assert.match(html,/Качество прогноза/);assert.match(html,/машинного зрения/);assert.doesNotMatch(html,/data-metric="automatic-valid"/);
});
test('Качество ИТ показывает пять общих требований и подписанные цели',()=>{
 const html=render({initialSelection:{section:'quality'}});assert.equal((html.match(/data-metric=/g)||[]).length,5);assert.match(html,/Предлагаемая цель/);assert.match(html,/99,9%/);assert.match(html,/Восстановить рабочую операцию/);assert.match(html,/aria-selected="true"/);assert.equal((html.match(/role="columnheader"/g)||[]).length,4);
});
test('Участок объединяет площадки и выбирает операционные показатели функции',()=>{
 const html=render({initialSelection:{section:'business'},filter:{process:'Выращивание / Войсковицы'}});assert.match(html,/data-metric="fcr"/);assert.match(html,/data-metric="mortality"/);assert.match(html,/11,48%/);assert.match(html,/Январь–июнь 2026/);assert.doesNotMatch(html,/Войсковицы/);assert.match(html,/option value="grow" selected/);
});
test('Печать сохраняет выбранную группу КПЭ и подразделение',()=>{
 const html=renderToStaticMarkup(React.createElement(Pyramid,{data,list:[],contextList:[],initialKpiSelection:{section:'business',functionId:'deep',level:'Ц4'}}));assert.match(html,/data-metric="deep-share"/);assert.match(html,/data-metric="deep-margin"/);assert.doesNotMatch(html,/data-metric="automatic-valid"/);assert.match(html,/маржа альтернативного маршрута/);
});
test('Пустой источник показывает замер, цели сохраняют статус предложения',()=>{
 const html=renderToStaticMarkup(React.createElement(Kpis,{data:{},initialSelection:{section:'business',functionId:'hatch'}}));assert.match(html,/Требуется замер/);assert.match(html,/Зафиксировать базу/);assert.doesNotMatch(html,/NaN|undefined|Infinity/);assert.match(html,/class="kpi-goal addition"/);
});

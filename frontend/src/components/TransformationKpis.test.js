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
test('Одна пирамида связывает четыре результата с пятнадцатью уникальными КПЭ',()=>{
 const html=render({});assert.equal((html.match(/data-outcome=/g)||[]).length,4);assert.equal((html.match(/role="tab"/g)||[]).length,2);assert.equal((html.match(/data-pyramid-level=/g)||[]).length,6);assert.equal((html.match(/data-metric=/g)||[]).length,15);
 assert.equal((html.match(/class="digital-pyramid /g)||[]).length,1);const metricIds=[...html.matchAll(/data-metric="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(metricIds).size,15);assert.doesNotMatch(html,/kpi-level-controls|kpi-outcomes|dp-purpose/);
 assert.match(html,/158,72 руб \/ кг/);assert.match(html,/208,52 млн кг/);assert.doesNotMatch(html,/141,59|EBIT|амортизац|Гипотеза|<details|источник Д/);assert.equal((html.match(/tabindex="0"/g)||[]).length,2);
});
test('Фильтр выделяет ступень и сохраняет КПЭ всех шести уровней',()=>{
 const html=render({filter:{layer:'Ц5 Аналитика и ИИ'},contextList:[{digital_layer:'Ц5 Аналитика и ИИ'}]});assert.match(html,/Ц5 Аналитика и искусственный интеллект \/ количество инициатив: 1/);assert.match(html,/Качество прогноза/);assert.match(html,/машинного зрения/);assert.match(html,/data-metric="automatic-valid"/);assert.equal((html.match(/data-metric=/g)||[]).length,15);assert.match(html,/class="dp-segment dp-selected"/);
});
test('Основание Ц0 показывает пять общих требований ровно по одному разу',()=>{
 const html=render({initialSelection:{section:'quality'}}),foundation=html.split('data-pyramid-level="Ц0"')[1].split('</li>')[0];assert.equal((foundation.match(/data-metric=/g)||[]).length,5);assert.match(html,/Предлагаемая цель/);assert.match(html,/99,9%/);assert.match(html,/Рабочая операция \/ время \/ потеря данных/);assert.match(html,/Одинаковый класс задач/);assert.match(html,/aria-selected="true"/);assert.match(html,/aria-colspan="3">Успешные операции в согласованное время \/ все попытки/);
});
test('Участок объединяет площадки и выбирает операционные показатели функции',()=>{
 const html=render({initialSelection:{section:'business'},filter:{process:'Выращивание / Войсковицы'}});assert.match(html,/data-metric="fcr"/);assert.match(html,/data-metric="mortality"/);assert.match(html,/11,48%/);assert.match(html,/Январь–июнь 2026/);assert.doesNotMatch(html,/Войсковицы/);assert.match(html,/option value="grow" selected/);
});
test('Печать сохраняет выбранную группу КПЭ и подразделение',()=>{
 const html=renderToStaticMarkup(React.createElement(Pyramid,{data,list:[],contextList:[],initialKpiSelection:{section:'business',functionId:'deep',level:'Ц4'}}));assert.match(html,/data-metric="deep-share"/);assert.match(html,/data-metric="deep-margin"/);assert.doesNotMatch(html,/data-metric="automatic-valid"/);assert.match(html,/маржа альтернативного маршрута/);
});
test('Страница использует единственный объединённый дашборд и сохраняет исходные периоды',()=>{
 const html=renderToStaticMarkup(React.createElement(Pyramid,{data,list:[],contextList:[],onLayer:()=>{}}));assert.equal((html.match(/class="digital-pyramid /g)||[]).length,1);assert.equal((html.match(/data-outcome=/g)||[]).length,4);assert.equal((html.match(/data-metric=/g)||[]).length,15);assert.match(html,/Май 2025–апрель 2026/);assert.doesNotMatch(html,/kpi-level-controls|dp-purpose|КПЭ связывают работу ИТ/);
});
test('Пустой источник показывает замер, цели сохраняют статус предложения',()=>{
 const html=renderToStaticMarkup(React.createElement(Kpis,{data:{},initialSelection:{section:'business',functionId:'hatch'}}));assert.match(html,/Требуется замер/);assert.match(html,/Зафиксировать базу/);assert.doesNotMatch(html,/NaN|undefined|Infinity/);assert.match(html,/class="kpi-goal addition"/);
});

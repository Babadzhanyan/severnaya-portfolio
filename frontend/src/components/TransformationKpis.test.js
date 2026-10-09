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
const visible=html=>html.replace(/<[^>]+>/g,'');
test('Одна пирамида показывает по две метрики на каждом уровне и сохраняет компактные цели',()=>{
 const html=render({});assert.equal((html.match(/data-pyramid-level=/g)||[]).length,6);assert.equal((html.match(/data-metric=/g)||[]).length,12);
 assert.equal((html.match(/class="digital-pyramid /g)||[]).length,1);const metricIds=[...html.matchAll(/data-metric="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(metricIds).size,12);
 assert.deepEqual([...html.matchAll(/<strong class="addition">([^<]+)<\/strong>/g)].map(m=>m[1]),['≥90%','−10%','≥99%','≥99%','≥95%','≥98%','≥98%','≥95%','≥99%','≥95%','≥99,9%','100%']);
 assert.doesNotMatch(html,/role="tab(?:list|panel)?"|<select|role="table"|data-outcome=|kpi-level-controls|kpi-outcomes|dp-purpose|dp-result-kpis|kpi-compact/);
 assert.match(visible(html),/после замера базы ИТ за 30 дней/);assert.equal((visible(html).match(/искусственный интеллект/g)||[]).length,1);
});
test('Фильтр выделяет ступень и сохраняет метрики всех шести уровней',()=>{
 const html=render({filter:{layer:'Ц5 Аналитика и ИИ'},contextList:[{digital_layer:'Ц5 Аналитика и ИИ'}]});assert.match(html,/Ц5 Аналитика и искусственный интеллект \/ количество инициатив: 1/);
 assert.match(visible(html),/Решения по данным/);assert.match(visible(html),/Ошибка прогноза/);assert.match(html,/data-metric="automatic-valid"/);assert.equal((html.match(/data-metric=/g)||[]).length,12);assert.match(html,/class="dp-segment dp-selected"/);
 assert.match(html,/aria-description="Качество прогноза относительно действующего метода/);assert.doesNotMatch(visible(html),/сумма абсолютных ошибок|машинного зрения/);
});
test('Основание Ц0 сохраняет только надёжность и восстановление, полный метод доступен в описании',()=>{
 const html=render({initialSelection:{section:'quality'}}),foundation=html.split('data-pyramid-level="Ц0"')[1].split('</ol>')[0];
 assert.equal((foundation.match(/data-metric=/g)||[]).length,2);assert.match(visible(foundation),/Надёжность/);assert.match(visible(foundation),/Восстановление/);assert.match(visible(foundation),/≥99,9%/);assert.match(visible(foundation),/100%/);
 assert.match(foundation,/title="Проверенное восстановление \/ Системы с успешным испытанием/);assert.match(foundation,/Цель: 100% \/ проверка раз в квартал/);
 assert.doesNotMatch(html,/data-metric="change-failure"|data-metric="delivery-time"|data-metric="overdue-controls"/);
});
test('Участок и прежнее состояние подразделения сохраняют единый набор уровневых метрик',()=>{
 const html=render({initialSelection:{section:'business',functionId:'grow'},filter:{process:'Выращивание / Войсковицы'}});
 assert.equal((html.match(/data-metric=/g)||[]).length,12);assert.match(html,/data-metric="automatic-valid"/);assert.match(html,/data-metric="critical-success"/);
 assert.doesNotMatch(html,/<select|role="tab(?:list|panel)?"|data-metric="(?:fcr|mortality)"|Войсковицы|Подразделения/);
});
test('Печать сохраняет единственную пирамиду и выбранную ступень',()=>{
 const level='Ц4 Единые данные и интеграции',html=renderToStaticMarkup(React.createElement(Pyramid,{data,list:[],contextList:[{digital_layer:level}],filter:{layer:level},initialKpiSelection:{section:'business',functionId:'deep',level}}));
 assert.equal((html.match(/data-metric=/g)||[]).length,12);assert.equal((html.match(/class="digital-pyramid /g)||[]).length,1);assert.match(html,/class="dp-segment dp-selected"/);
 assert.doesNotMatch(html,/data-metric="deep-share"|data-metric="deep-margin"|<select|role="tab(?:list|panel)?"/);
});
test('Вершина содержит только результат бизнеса, фактические суммы и КПЭ вершины исключены',()=>{
 const html=renderToStaticMarkup(React.createElement(Pyramid,{data,list:[],contextList:[],onLayer:()=>{}})),apex=html.split('class="dp-row dp-apex-row"')[1].split('<ol')[0];
 assert.match(visible(apex),/Результаты бизнеса/);assert.doesNotMatch(apex,/data-metric=|data-outcome=|Предлагаемая цель|База|dp-result-kpis/);
 assert.doesNotMatch(visible(html),/158,72|208,52|Май 2025–апрель 2026|EBIT|амортизац|Гипотеза|Требуется замер/);
});
test('Пустой источник сохраняет предлагаемые цели и пояснение о замере базы',()=>{
 const html=renderToStaticMarkup(React.createElement(Kpis,{data:{},initialSelection:{section:'business',functionId:'hatch'}}));
 assert.match(visible(html),/предлагаемые цели/);assert.match(visible(html),/замера базы ИТ/);assert.equal((html.match(/data-metric=/g)||[]).length,12);
 assert.doesNotMatch(html,/NaN|undefined|Infinity/);assert.doesNotMatch(visible(html),/База: 0|(?:^|\s)0%/);
});

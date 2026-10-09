import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

const root=fileURLToPath(new URL('../../',import.meta.url));
const built=await build({configFile:false,root,logLevel:'silent',plugins:[react()],build:{write:false,lib:{entry:resolve(root,'src/components/UserJourney.jsx'),formats:['es']},rollupOptions:{external:['react','react/jsx-runtime']}}});
const code=(Array.isArray(built)?built[0]:built).output.find(o=>o.type==='chunk').code.replace(/["']react(?:\/jsx-runtime)?["']/g,name=>JSON.stringify(pathToFileURL(resolve(root,'node_modules/react/'+(name.includes('/')?'jsx-runtime.js':'index.js'))).href));
const {default:UserJourney}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const card={code:'ИТ-001',title:'Учёт выпуска',stage:'L1 Идея',problem:'Выпуск сверяется вручную',solution:'Собирать выпуск автоматически',scope:'Настроить сбор данных и проверить сверку',initiative_lead:'Ответственный',curator:'Куратор',_source_row:3,_source_sheet_id:404672457};
const render=i=>renderToStaticMarkup(React.createElement(UserJourney,{data:{staff:[{employee:i.initiative_lead}],initiatives:[i]},list:[i],employee:i.initiative_lead,initiative:i,onOpen:()=>{}}));

test('Мои инициативы показывают статус Google и сохраняют текущую стадию и код',()=>{
 for(const admission of ['Готово к L2','Доработать','Требуется проблема','Переход подтверждён']){
  const i={...card,admission},before=JSON.stringify(i),html=render(i);
  assert.match(html,new RegExp('Проверка карточки: '+admission));
  assert.equal((html.match(/data-field="admission"/g)||[]).length,1);
  assert.doesNotMatch(html,/Состав готов к проверке перехода/);
  assert.match(html,/ИТ-001/);
  assert.equal(JSON.stringify(i),before);
  assert.equal(i.stage,'L1 Идея');
 }
});

test('Ожидание отображается кратко, пропуск Q сохраняет проверку видимого состава',()=>{
 assert.match(render({...card,admission:'Проверить карточку'}),/Проверка карточки: Ожидает проверки/);
 assert.match(render(card),/Состав готов к проверке перехода в L2/);
});

test('Историческая карточка сохраняет выполненный результат',()=>{
 const html=render({...card,admission:'Готово к L2',decision:'История',execution_fact:{audited:true,state:'completed',scope_complete:true}});
 assert.doesNotMatch(html,/data-field="admission"/);
 assert.match(html,/Выполненные проекты/);
});

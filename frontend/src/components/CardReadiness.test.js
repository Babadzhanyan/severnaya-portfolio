import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {cardReadiness} from '../model/portfolio.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
async function component(file){
 const result=await build({configFile:false,root,logLevel:'silent',plugins:[react()],build:{write:false,lib:{entry:resolve(root,'src/components/'+file+'.jsx'),formats:['es']},rollupOptions:{external:['react','react/jsx-runtime']}}});
 const code=(Array.isArray(result)?result[0]:result).output.find(o=>o.type==='chunk').code.replace(/["']react(?:\/jsx-runtime)?["']/g,name=>JSON.stringify(pathToFileURL(resolve(root,'node_modules/react/'+(name.includes('/')?'jsx-runtime.js':'index.js'))).href));
 return (await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).default;
}
const [PassportCanvas,PassportTracker]=await Promise.all([component('PassportCanvas'),component('PassportTracker')]);
const render=(Component,props)=>renderToStaticMarkup(React.createElement(Component,props));
const card={code:'ИТ-001',title:'Проверка формы',stage:'L1 Идея',initiative_lead:'Ответственный',it_group:'Разработка',curator:'Куратор',_source_row:3,_source_sheet_id:404672457};
const data={initiatives:[card],plan:[],decisions:[],ledger:[],actuals:[]};

test('Google передаёт готовность и возврат в паспорт и трекер, сохраняя текущую стадию',()=>{
 for(const admission of ['Готово к L2','Доработать','Выбрать причину','Требуется проблема']){
  const i={...card,admission};
  for(const html of [render(PassportCanvas,{data,i}),render(PassportTracker,{data,list:[i],onOpen:()=>{}})]){
   assert.match(html,new RegExp('Проверка карточки: '+admission));
   assert.match(html,/L1/);
  }
 }
});

test('Статус проверки различает ожидание и исторический факт исполнения',()=>{
 assert.equal(cardReadiness({...card,admission:'Проверить карточку'}),'Ожидает проверки');
 assert.equal(cardReadiness({...card,admission:'История'}),'');
 assert.equal(cardReadiness(card),'');
 const i={...card,admission:'Готово к L2',execution_fact:{audited:true,state:'completed',scope_complete:true}};
 for(const html of [render(PassportCanvas,{data,i}),render(PassportTracker,{data,list:[i],onOpen:()=>{}})]){
  assert.doesNotMatch(html,/data-field="admission"/);
  assert.match(html,/Выполнено/);
 }
});

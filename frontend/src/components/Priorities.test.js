import test from 'node:test';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {build} from 'vite';
import react from '@vitejs/plugin-react';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ideas from '../model/fixtures/ideas_priority_inputs_v25.json' with {type:'json'};

const root=fileURLToPath(new URL('../../',import.meta.url));
const result=await build({configFile:false,root,logLevel:'silent',plugins:[react()],build:{write:false,lib:{entry:resolve(root,'src/components/Priorities.jsx'),formats:['es']},rollupOptions:{external:['react','react/jsx-runtime']}}});
const code=(Array.isArray(result)?result[0]:result).output.find(o=>o.type==='chunk').code.replace(/["']react(?:\/jsx-runtime)?["']/g,name=>JSON.stringify(pathToFileURL(resolve(root,'node_modules/react/'+(name.includes('/')?'jsx-runtime.js':'index.js'))).href));
const Priorities=(await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'))).default;

test('Диаграмма выводит100 новых предложений с предварительным статусом',()=>{
 const html=renderToStaticMarkup(React.createElement(Priorities,{list:ideas,onOpen:()=>{}}));
 assert.equal((html.match(/data-priority-point="ИТ-\d{3}"/g)||[]).length,100);
 assert.match(html,/Оценено 100 из 100 текущих карточек/);
 assert.equal((html.match(/>Предварительная оценка<\/td>/g)||[]).length,100);
 assert.doesNotMatch(html,/Дополнительная амортизация|Подтверждено/);
 for(const i of ideas)assert.ok(html.includes('data-priority-point="'+i.code+'"'));
});

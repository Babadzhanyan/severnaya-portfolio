import test from 'node:test';
import assert from 'node:assert/strict';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'vite';
import ReactPlugin from '@vitejs/plugin-react';
const root=fileURLToPath(new URL('../../',import.meta.url));
const built=await build({configFile:false,root,logLevel:'silent',plugins:[ReactPlugin()],build:{write:false,lib:{entry:resolve(root,'src/data/source.js'),formats:['es']},rollupOptions:{external:['react']}}});
const code=(Array.isArray(built)?built[0]:built).output.find(x=>x.type==='chunk').code.replace(/from ["']react["']/g,'from '+JSON.stringify(pathToFileURL(resolve(root,'node_modules/react/index.js')).href));
const realMap=globalThis.Map,realTimeout=globalThis.setTimeout,realClear=globalThis.clearTimeout,trackedMaps=[];
let now=0,nextTimer=0;const timers=new realMap(),scripts=[];
class TrackingMap extends realMap{constructor(...args){super(...args);trackedMaps.push(this);}}
const windowMock={PMO_RUNTIME:{}};
const documentMock={createElement:()=>({removed:false,remove(){this.removed=true;}}),head:{append(script){scripts.push(script);}}};
globalThis.window=windowMock;globalThis.document=documentMock;globalThis.Map=TrackingMap;
globalThis.setTimeout=(fn,delay)=>{const id=++nextTimer;timers.set(id,{fn,time:now+delay});return id;};
globalThis.clearTimeout=id=>timers.delete(id);
const {queryGoogle}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
globalThis.Map=realMap;
const receiver=windowMock.__pmoReactFeed;
const request=script=>Object.fromEntries(new URL(script.src).searchParams.get('tqx').split(';').map(v=>{const p=v.indexOf(':');return [v.slice(0,p),v.slice(p+1)];}));
const advance=ms=>{now+=ms;for(const[id,entry]of[...timers].sort((a,b)=>a[1].time-b[1].time)){if(entry.time<=now&&timers.has(id)){timers.delete(id);entry.fn();}}};
const pendingMap=req=>trackedMaps.find(map=>map.has(req));
const clean=()=>{assert.equal(timers.size,0);assert.equal(scripts.filter(s=>!s.removed).length,0);assert.deepEqual(Object.keys(windowMock).filter(k=>k.startsWith('__pmoReactFeed')),['__pmoReactFeed']);assert.equal(windowMock.__pmoReactFeed,receiver);};

test('Таймаут очищает ожидание и принимает поздний JSONP через постоянный приёмник',async()=>{
 const promise=queryGoogle(),script=scripts.at(-1),req=request(script).reqId,map=pendingMap(req);assert.ok(map);const failure=assert.rejects(promise,/дольше 30 секунд/);advance(29999);assert.equal(map.size,1);assert.equal(script.removed,false);assert.equal(timers.size,1);advance(1);await failure;assert.equal(map.size,0);advance(120000);assert.doesNotThrow(()=>windowMock.__pmoReactFeed({reqId:req,status:'ok',sig:'late'}));clean();
});
test('Отмена удаляет обработчик и пропускает поздний ответ',async()=>{
 const controller=new AbortController();let removes=0;const remove=controller.signal.removeEventListener.bind(controller.signal);controller.signal.removeEventListener=(...args)=>{removes++;return remove(...args);};
 const promise=queryGoogle('',controller.signal),script=scripts.at(-1),req=request(script).reqId,map=pendingMap(req),failure=assert.rejects(promise,{name:'AbortError'});controller.abort();await failure;assert.equal(map.size,0);assert.equal(removes,1);advance(120000);assert.doesNotThrow(()=>receiver({reqId:req,status:'ok'}));clean();
 const before=scripts.length,preCancelled=new AbortController();preCancelled.abort();await assert.rejects(queryGoogle('',preCancelled.signal),{name:'AbortError'});assert.equal(scripts.length,before);clean();
});
test('Параллельные ответы в обратном порядке сохраняют свой запрос и подпись',async()=>{
 const first=queryGoogle('saved-signature'),script1=scripts.at(-1),req1=request(script1),second=queryGoogle(),script2=scripts.at(-1),req2=request(script2),map=pendingMap(req1.reqId);
 assert.equal(new URL(script1.src).searchParams.get('tq'),'select * options no_format');assert.equal(req1.sig,'saved-signature');assert.equal(req1.responseHandler,'__pmoReactFeed');assert.equal(req2.responseHandler,'__pmoReactFeed');assert.notEqual(req1.reqId,req2.reqId);
 receiver({reqId:'unknown',status:'ok',sig:'wrong'});assert.equal(map.size,2);const data2={reqId:req2.reqId,status:'not_modified',sig:'second'};receiver(data2);assert.equal(await second,data2);assert.equal(map.size,1);receiver({reqId:req2.reqId,status:'ok',sig:'duplicate'});assert.equal(map.size,1);
 const data1={reqId:Number(req1.reqId),status:'ok',sig:'first'};receiver(data1);assert.equal(await first,data1);assert.equal(map.size,0);clean();
});
test('Ошибка сети и серия запросов очищают все узлы, таймеры и ожидания',async()=>{
 const failed=queryGoogle(),script=scripts.at(-1),req=request(script).reqId,map=pendingMap(req),failure=assert.rejects(failed,/соединение и доступ/);script.onerror();await failure;assert.equal(map.size,0);receiver({reqId:req,status:'ok'});
 for(let k=0;k<100;k++){const promise=queryGoogle(),s=scripts.at(-1),id=request(s).reqId;receiver({reqId:id,status:'ok',sig:String(k)});assert.equal((await promise).sig,String(k));assert.equal(map.size,0);}clean();
});
test.after(()=>{globalThis.Map=realMap;globalThis.setTimeout=realTimeout;globalThis.clearTimeout=realClear;});

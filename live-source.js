(function(){
'use strict';
const config=window.PMOLiveConfig,$=s=>document.querySelector(s);
if(!config||config.schemaVersion!==9||config.protocolVersion!==1)return;
const sheetUrl='https://docs.google.com/spreadsheets/d/'+config.spreadsheetId+'/edit#gid='+config.masterSheetId;
const queryBase='https://docs.google.com/spreadsheets/d/'+config.spreadsheetId+'/gviz/tq';
let mode='closed',generation=0,timer=null,clock=null,inFlight=false,cancel=null,requestNo=0,signature='',lastChecked=null,lastChanged=null,lastError='',loading=false;
const time=v=>v?new Date(v).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Europe/Moscow'}):'требуется подключение';
function emitStatus(){
 const age=lastChecked?Date.now()-Date.parse(lastChecked):Infinity,stale=mode==='google'&&age>config.staleMs;
 const state=mode==='local'?'local':mode==='closed'?'closed':lastError?'error':loading?'loading':stale?'stale':'online';
 const bar=$('#live-status');bar.dataset.state=state;['open-file','export-file','more-button','welcome-upload'].forEach(id=>$('#'+id).hidden=mode!=='local');$('.snapshot-control').hidden=mode!=='local';
 $('#live-source-label').textContent=mode==='local'?'Локальный Excel сохраняет отдельную копию портфеля':mode==='closed'?'Google Sheets связывает портфель с управленческими экранами':lastError?'Требуется обновление живого источника':loading&&!lastChecked?'Google Sheets загружает портфель':stale?'Требуется свежая проверка Google Sheets':'Google Sheets обновляет портфель и паспорта';
 $('#live-sync-meta').textContent=mode==='local'?'Правки сохраняются кнопкой «Сохранить Excel»':mode==='closed'?'Подключите источник или откройте локальную книгу':lastError?(lastChecked?'Последняя проверка '+time(lastChecked)+' / ':'')+lastError:loading&&!lastChecked?'Источник подключается':document.hidden?'Пауза фоновой вкладки / последняя проверка '+time(lastChecked):'Проверено '+time(lastChecked)+' по Москве / обновление каждые 15 секунд'+(lastChanged?' / данные изменились '+time(lastChanged):'');
 $('#refresh-live').disabled=mode!=='google'||inFlight;$('#connect-live').textContent=mode==='google'?'Живая таблица подключена':'Живая таблица';
 $('#edit-google').href=sheetUrl;
 window.dispatchEvent(new CustomEvent('pmo-sync',{detail:{mode,state,lastChecked,lastChanged,error:lastError,stale,inFlight}}));
}
function decodeValue(cell){
 if(!cell||cell.v===null||cell.v===undefined)return null;
 const v=cell.v;if(typeof v!=='string')throw new Error('Google Sheets передаёт ячейку в формате для повторной проверки');
 const prefix=v.slice(0,2),body=v.slice(2);
 if(prefix==='z:')return null;
 if(prefix==='s:')return body;
 if(prefix==='n:'){const normalized=body.replace(/[\s\u00a0]/g,'').replace(',','.');if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized))throw new Error('Google Sheets передаёт число для повторной проверки');const n=Number(normalized);if(!Number.isFinite(n))throw new Error('Google Sheets передаёт число для повторной проверки');return n;}
 if(prefix==='b:'&&(body==='0'||body==='1'))return body==='1';
 if(prefix==='e:')throw new Error('Google Sheets сообщает об ошибке исходной ячейки');
 throw new Error('Google Sheets передаёт ячейку в формате для повторной проверки');
}
function sourceLocation(b,r,c){
 const actual=config.actualBlocks?.[b.key];
 if(!actual)return b.key==='snapshot'||b.key==='previous_meta'?' / лист «Настройки портфеля»':' / лист «'+config.feedSheetName+'»';
 let col=actual.firstColumn+c;if(b.key==='annualHistory')col=({0:2,4:3,6:4,7:5,9:6})[c]||col;
 let label='';for(let n=col;n>0;n=Math.floor((n-1)/26))label=String.fromCharCode(65+(n-1)%26)+label;
 return ' / лист «'+actual.sheetName+'», ячейка '+label+(actual.firstDataRow+r);
}
function decodeTable(response){
 if(response.status!=='ok'||!response.table||!Array.isArray(response.table.rows))throw new Error('Google Sheets ожидает доступ по ссылке и исправные формулы данных сайта');
 const rows=response.table.rows,last=config.blocks.at(-1).feedLast;
 if(rows.length!==last||response.table.cols?.length!==(config.transportColumns||46))throw new Error('Требуется полный состав данных Google Sheets / повторите обновление');
 return config.blocks.map(b=>({sheet:b.sheet,firstRow:b.firstSourceRow,firstColumn:b.firstSourceColumn,values:rows.slice(b.feedFirst-1,b.feedLast).map((row,r)=>Array.from({length:b.columns},(_,c)=>{try{return decodeValue(row.c?.[c]);}catch(e){throw new Error(e.message+sourceLocation(b,r,c));}}))}));
}
function query(sig,token){return new Promise((resolve,reject)=>{
 const req=++requestNo,name='__pmoLiveResponse'+req,script=document.createElement('script');let done=false;
 const finish=(err,result)=>{if(done)return;done=true;clearTimeout(timeout);script.remove();window[name]=()=>{};setTimeout(()=>{delete window[name];},60000);if(cancel===abort)cancel=null;err?reject(err):resolve(result);};
 const abort=()=>finish(new Error('Подключение источника приостановлено'));cancel=abort;
 window[name]=response=>{if(token!==generation)return finish(new Error('Источник переключён'));if(String(response?.reqId)!==String(req))return finish(new Error('Google Sheets сопоставляет ответ текущему запросу'));finish(null,response);};
 script.onerror=()=>finish(new Error('Источник временно недоступен / проверьте соединение и доступ Google Sheets'));
 const timeout=setTimeout(()=>finish(new Error('Источник отвечает дольше 12 секунд / следующий запрос повторит проверку')),config.timeoutMs);
 const url=new URL(queryBase);url.searchParams.set('gid',String(config.feedSheetId));url.searchParams.set('range',config.feedRange);url.searchParams.set('headers','0');url.searchParams.set('tqx','out:json;reqId:'+req+';responseHandler:'+name+(sig?';sig:'+sig:''));url.searchParams.set('_pmo',String(Math.floor(Date.now()/config.pollMs)));script.src=url.href;script.referrerPolicy='no-referrer';document.head.append(script);
 });}
async function refresh(force=false){
 if(mode!=='google'||inFlight||document.hidden&&!force)return;
 const token=generation;inFlight=true;loading=true;emitStatus();
 try{
  const response=await query(force?'':signature,token);if(token!==generation||mode!=='google')return;
  if(response.status==='error'&&response.errors?.some(e=>e.reason==='not_modified')||response.status==='not_modified'){
   if(!signature||!window.PMOData||window.PMOData.sourceMode!=='google')throw new Error('Google Sheets передаёт первый полный срез портфеля');
  }else{
   const grids=decodeTable(response),next=String(response.sig||'');if(next&&!/^[\w-]{1,200}$/.test(next))throw new Error('Google Sheets передаёт действительную сигнатуру среза');
   if(next!==signature||window.PMOData?.sourceMode!=='google'){const stamp=new Date().toISOString();window.PMOWorkbook.importGrid(grids,{signature:next,sourceUrl:sheetUrl,sourceOrigin:config.sourceOrigin,receivedAt:stamp});lastChanged=stamp;}signature=next;
  }
  lastChecked=new Date().toISOString();lastError='';
 }catch(e){if(token===generation&&mode==='google')lastError=e.message||'Источник требует повторную проверку';}
 finally{if(token===generation){loading=false;inFlight=false;emitStatus();}}
}
function stop(next='closed'){
 generation++;clearInterval(timer);clearInterval(clock);timer=null;clock=null;const abort=cancel;cancel=null;abort?.();inFlight=false;loading=false;mode=next;lastError='';emitStatus();
}
function start(){
 if(window.PMOWorkbook.getData()?.dirty){lastError='Сохраните текущие правки Excel и подключите общий источник';emitStatus();return;}
 stop('google');signature='';lastChecked=null;lastChanged=null;emitStatus();refresh(true);timer=setInterval(()=>refresh(),config.pollMs);clock=setInterval(emitStatus,1000);
}
$('#connect-live').onclick=$('#welcome-live').onclick=start;$('#refresh-live').onclick=()=>refresh(true);
window.addEventListener('online',()=>refresh(true));document.addEventListener('visibilitychange',()=>{emitStatus();if(!document.hidden)refresh(true);});
window.addEventListener('pagehide',()=>stop());
window.PMOLive={start,stop,refresh,getStatus:()=>({mode,lastChecked,lastChanged,error:lastError,signature,inFlight}),decodeValue,decodeTable,sheetUrl,config};
const params=new URLSearchParams(location.search);params.get('mode')==='local'?stop('local'):start();
})();

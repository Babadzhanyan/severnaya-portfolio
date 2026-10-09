import {useCallback,useEffect,useRef,useState} from 'react';
import config from './live-config.js';
import schema from './schema.js';
import {projectResponse} from './projector.js';
const API=String(window.PMO_RUNTIME?.apiBase||import.meta.env.VITE_API_BASE||'').replace(/\/$/,'');
let seq=0;
const pendingGoogle=new Map();
window.__pmoReactFeed=response=>pendingGoogle.get(String(response?.reqId))?.(response);
export const apiBase=API;
export function queryGoogle(signature='',signal){return new Promise((resolve,reject)=>{
 const req=String(++seq),script=document.createElement('script');let done=false;
 const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);script.remove();signal?.removeEventListener('abort',abort);pendingGoogle.delete(req);error?reject(error):resolve(value);};
 const abort=()=>finish(new DOMException('Источник переключён','AbortError'));
 pendingGoogle.set(req,response=>finish(null,response));
 const timer=setTimeout(()=>finish(new Error('Источник отвечает дольше 30 секунд')),config.timeoutMs);
 script.onerror=()=>finish(new Error('Требуется соединение и доступ Google Sheets'));
 const url=new URL(`https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/gviz/tq`);url.searchParams.set('gid',config.feedSheetId);url.searchParams.set('range',config.feedRange);url.searchParams.set('headers','0');url.searchParams.set('tq','select * options no_format');url.searchParams.set('tqx',`out:json;reqId:${req};responseHandler:__pmoReactFeed${signature?';sig:'+signature:''}`);url.searchParams.set('_pmo',Math.floor(Date.now()/config.pollMs));script.src=url;script.referrerPolicy='no-referrer';signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)return abort();document.head.append(script);
 });}
export function usePortfolioSource(){
 const [state,setState]=useState({data:null,mode:API?'api':'google',loading:true,error:'',lastChecked:null,lastChanged:null,syncedAt:null,paused:document.hidden,stale:false,sourceCheckedAt:null});
 const [tick,setTick]=useState(0);const current=useRef({signature:'',data:null,inFlight:false});
 const refresh=useCallback(()=>setTick(x=>x+1),[]);
 useEffect(()=>{let stopped=false,busy=false;const controller=new AbortController();const run=async(force=false)=>{
  if(stopped||busy||document.hidden&&!force)return;busy=true;setState(s=>({...s,loading:true,paused:false}));
  try{let data=null,mode='google',syncedAt=null,sourceCheckedAt=null,warning='';
   if(API){try{const response=await fetch(API+'/api/portfolio',{signal:controller.signal,cache:'no-store'});if(!response.ok)throw new Error('Сервер проверяет доступ к портфелю');const body=await response.json();data=body.portfolio||body;syncedAt=body.synced_at||data.receivedAt;sourceCheckedAt=body.source_status?.checked_at;mode='api';if(!Array.isArray(data.initiatives)||data.schema?.columns?.length!==schema.columns.length)throw new Error('Сервер передаёт полный реестр инициатив');if(body.source_status?.error||body.source_status?.state==='stale')warning='Сервер ожидает свежий срез Google Sheets';}catch(e){if(e.name==='AbortError')throw e;warning='Прямое чтение Google Sheets / сервер ожидает подключение';}}
   if(!data){const response=await queryGoogle(force?'':current.current.signature,controller.signal);const unchanged=response.status==='not_modified'||response.status==='error'&&response.errors?.some(e=>e.reason==='not_modified');if(unchanged||current.current.signature&&String(response.sig||'')===current.current.signature&&current.current.data){if(!current.current.data)throw new Error('Google Sheets передаёт первый полный срез');data=current.current.data;}else{data=projectResponse(response);current.current.signature=String(response.sig||'');}syncedAt=data.receivedAt;}
   const now=new Date().toISOString(),changed=JSON.stringify(data)!==JSON.stringify(current.current.data);current.current.data=data;if(!stopped)setState(s=>({...s,data,mode,loading:false,error:'',warning,lastChecked:now,lastChanged:changed?now:s.lastChanged,syncedAt,sourceCheckedAt:sourceCheckedAt||now,stale:!!sourceCheckedAt&&Date.now()-Date.parse(sourceCheckedAt)>config.staleMs}));
  }catch(e){if(!stopped&&e.name!=='AbortError')setState(s=>({...s,loading:false,error:e.message||'Источник требует повторную проверку'}));}finally{busy=false;}
 };
 run(true);const timer=setInterval(()=>run(),config.pollMs),clock=setInterval(()=>setState(s=>({...s,paused:document.hidden,stale:!!(s.sourceCheckedAt||s.lastChecked)&&Date.now()-Date.parse(s.sourceCheckedAt||s.lastChecked)>config.staleMs})),1000);
 const resume=()=>{if(!document.hidden)run(true);};document.addEventListener('visibilitychange',resume);window.addEventListener('online',resume);
 return()=>{stopped=true;controller.abort();clearInterval(timer);clearInterval(clock);document.removeEventListener('visibilitychange',resume);window.removeEventListener('online',resume);};
 },[tick]);
 return {...state,refresh,pollMs:config.pollMs,apiBase:API};
}
export async function postCalculation(input,signal){if(!API)return null;const response=await fetch(API+'/api/calculations/production',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal});const value=await response.json();if(!response.ok)throw new Error(typeof value.detail==='string'?value.detail:'Расчёт требует проверку исходных значений');return value;}

import config from '../data/live-config.js';
import schema from '../data/schema.js';
import {executionState,isCompleted,isHistorical,executionLabel,actualFinishLabel,executionGateEvidence,plannedEndDate,plannedEndLabel} from './execution.js';
export {executionFact,executionState,isCompleted,isHistorical,executionLabel,actualFinishLabel,executionGateEvidence,plannedEndDate,plannedEndLabel} from './execution.js';
export const stages=[['L0','Входящие предложения'],['L1','Идея'],['L2','Оценка'],['L3','Решение о запуске'],['L4','Реализация'],['L5','Подтверждение эффекта']];
export const isNumber=v=>typeof v==='number'&&Number.isFinite(v);
export const display=v=>String(v??'').replace(/Гипотеза:\s*/gi,'').replace(/Гипотез(?:ами|ах|ам|ой|а|ы|у|е)?/gi,'').replace(/[ \t]{2,}/g,' ').replace(/—/g,'–').replace(/\bEBITDA\b/gi,'операционная прибыль');
export const fmt=(v,d=2,empty='Требуется расчёт')=>isNumber(v)?v.toLocaleString('ru-RU',{maximumFractionDigits:d}):empty;
export function dateText(v){if(!v)return '';if(isNumber(v))return new Date(Math.round((v-25569)*86400000)).toISOString().slice(0,10);return String(v).slice(0,10);}
export function dateTimeText(value){if(value==null||value==='')return '';if(isNumber(value))return new Date(Math.round((value-25569)*86400000)).toISOString().slice(0,19)+'+03:00';const text=String(value);if(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(text)&&!/(?:Z|[+-]\d{2}:\d{2})$/.test(text))return text+'+03:00';return text;}
export function dateTimeLabel(value){const text=dateTimeText(value);if(!text)return 'Требуется срок';if(!text.includes('T'))return shortDate(text);const date=new Date(text);return Number.isNaN(date.getTime())?'Требуется срок':date.toLocaleString('ru-RU',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).replace(',','');}
export const shortDate=v=>dateText(v)?new Date(dateText(v)+'T12:00:00Z').toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow'}):'Требуется срок';
export const longDate=v=>dateText(v)?new Date(dateText(v)+'T12:00:00Z').toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow',day:'numeric',month:'long',year:'numeric'}).replace(/\s*г\.$/,''):'Требуется дата';
export const todayMoscow=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow'}).format(new Date());
export const stageCode=v=>/^L[0-5](?:\s|$)/.test(String(typeof v==='object'?v?.stage:v))?String(typeof v==='object'?v.stage:v).slice(0,2):'Уточнить';
export const person=i=>display(i.candidate_employee||i.initiative_lead||'Требуется назначение');
export const group=i=>display(i.it_group||'Требуется направление');
export const working=i=>i.decision!=='Объединить';
export const isNewIdea=i=>i.collection==='ideas'||(!i.collection&&i.provenance?.origin==='addition');
export const digitalLayers=[
 {code:'Ц0',name:'Устойчивый ИТ-контур',lines:['Устойчивый','ИТ-контур'],scope:'Инфраструктура, безопасность, проектный офис и способности команды'},
 {code:'Ц1',name:'Автоматика и первичные данные',lines:['Автоматика','и первичные данные'],scope:'Оборудование, датчики, сигналы и первичный сбор данных'},
 {code:'Ц2',name:'Управление производством',lines:['Управление','производством'],scope:'Планирование, выполнение и контроль производственных операций'},
 {code:'Ц3',name:'Учёт и цифровые процессы',lines:['Учёт и процессы'],scope:'Учёт, приложения, согласования и цифровые формы'},
 {code:'Ц4',name:'Единые данные и интеграции',lines:['Единые данные','и интеграции'],scope:'Обмен данными, единые справочники и общая информационная основа'},
 {code:'Ц5',name:'Аналитика и ИИ',lines:['Аналитика и ИИ'],scope:'Аналитические модели, прогнозы и искусственный интеллект'}
];
export const digitalLayerCode=i=>/^Ц[0-5](?:\s|$|[–-])/.exec(String(i?.digital_layer||''))?.[0]?.slice(0,2)||'';
export const digitalLayer=i=>{const level=digitalLayers.find(l=>l.code===digitalLayerCode(i));return level?level.code+' '+level.name:'Уточнить уровень';};
export const layerSummary=list=>digitalLayers.map(l=>({...l,count:list.filter(i=>digitalLayerCode(i)===l.code).length}));

export const processGroup=i=>display(typeof i==='object'?i?.process:i).split(/\s*\/\s*/)[0].trim();
export const initiativeTitle=i=>display(typeof i==='object'?i?.title:i).replace(/(?:,\s*|\s*\/\s*|\s+)?источник\s+Д\.?\s*\d+(?:\s*[–-]\s*Д?\.?\s*\d+)?/gi,'').replace(/\(\s*\)/g,'').replace(/,\s*\)/g,')').replace(/\s{2,}/g,' ').trim();

export const sortPortfolio=list=>[...list].sort((a,b)=>group(a).localeCompare(group(b),'ru')||person(a).localeCompare(person(b),'ru')||processGroup(a).localeCompare(processGroup(b),'ru')||String(a.code).localeCompare(String(b.code),'ru'));
export const origin=(i,key)=>key==='digital_layer'||key.startsWith('priority_')||['legal_required','legal_basis'].includes(key)?'addition':key==='curator'?'formula':i?.provenance?.fields?.[key]?.origin||(key==='code'?'addition':i?.provenance?.origin==='primary'?'primary':'addition');
export const color=(i,key)=>origin(i,key)==='primary'?'source-primary':origin(i,key)==='formula'?'formula':'addition';
export function fieldSource(i,key){return i?.provenance?.fields?.[key]?.source||(key==='curator'?'Команда ИТ / куратор команды внедрения':key==='digital_layer'?'Основной уровень определён по составу и ожидаемому результату инициативы; владелец подтверждает отнесение':'Требуется координата исходного значения');}
export const dimensions=['group','curator','person','process','stage','decision','layer'];
export const dimensionValue=(i,key)=>({group:group(i),curator:display(i.curator||'Требуется куратор'),person:person(i),process:processGroup(i),stage:stageCode(i),decision:i.decision||'',layer:digitalLayer(i)})[key];
export function matchesFilters(i,filter={},exclude=null){const selectedProcess=processGroup(filter.process||'');const inScope=!filter.scope||filter.scope==='all'?true:filter.scope==='primary'?!isNewIdea(i)&&working(i):filter.scope==='ideas'?isNewIdea(i)&&working(i):filter.scope==='history'?isHistorical(i)&&working(i):working(i)&&!isHistorical(i);return inScope&&dimensions.every(key=>key===exclude||!filter[key]||dimensionValue(i,key)===(key==='process'?selectedProcess:filter[key]))&&(!filter.search||display([i.code,...aliasCodes(i),i.title,i.initiative_lead,i.curator,i.process,i.customer].join(' ')).toLowerCase().includes(filter.search.toLowerCase()));}
export function filterPortfolio(data,filter={}){return sortPortfolio((data?.initiatives||[]).filter(i=>matchesFilters(i,filter)));}
export function facetedOptions(data,filter,dimension){return [...new Set((data?.initiatives||[]).filter(i=>matchesFilters(i,filter,dimension)).map(i=>dimensionValue(i,dimension)).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru'));}
export function reconcileFilters(data,filter,changed=null){const result={...filter};const keys=dimensions.filter(key=>key!==changed);for(const key of keys){if(result[key]&&!facetedOptions(data,result,key).includes(result[key]))result[key]='';}if(changed&&dimensions.includes(changed)&&result[changed]&&!(data.initiatives||[]).some(i=>dimensionValue(i,changed)===result[changed]))result[changed]='';return result;}
export function selectedCard(data,list,code){return list.find(i=>i.code===code)||list.find(i=>aliasCodes(i).includes(code))||list[0]||null;}

const validProof=r=>r.date&&r.approved_by&&String(r.approved_by).length>=5&&String(r.document||'').length>=8&&!/Уточнить|Требуется|Пример|Гипотеза/i.test(String(r.approved_by)+' '+String(r.document))&&(!r.readiness||!/Требуется|На согласовании|Уточнить/i.test(r.readiness));
export function effectMeasurement(data,i,today=todayMoscow()){
 const measurement=i.execution_fact?.effect_measurement||{};
 const monetary=i.value_type==='Денежный эффект';
 return (data.actuals||[]).find(r=>{
  if(r.code!==i.code||!r.source||!r.date||dateText(r.date)>today)return false;
  const period=r.actual_period||r.period||measurement.period;
  if(!String(period||'').trim())return false;
  if(monetary){
   const baseline=measurement.baseline_value??i.baseline;
   const baselinePeriod=measurement.baseline_period||i.baseline_period;
   const baselineSource=measurement.baseline_source||i.baseline_source;
   return isNumber(r.actual_effect)&&isNumber(baseline)&&!!String(baselinePeriod||'').trim()&&!!String(baselineSource||'').trim();
  }
  return isNumber(r.actual_metric)&&!!String(i.metric||'').trim()&&!!String(i.success||'').trim();
 })||null;
}
export function gateProof(data,i,level,today=todayMoscow()){ 
 const types={1:['Состав'],2:['Расчёт эффекта'],3:['Запуск','Выбор портфеля'],4:['Приёмка'],5:['Эффект']}[level]||[];
 const proofs=(data.decisions||[]).filter(r=>r.code===i.code&&types.includes(r.type)&&validProof(r)&&dateText(r.date)<=today&&(level!==3||i.decision==='В работу')).sort((a,b)=>dateText(b.date).localeCompare(dateText(a.date)));
 if(level===5){if(!effectMeasurement(data,i,today))return null;if(i.value_type==='Денежный эффект'&&!(data.ledger||[]).some(r=>r.code===i.code&&/^Подтвержден/i.test(String(r.confirmation||''))))return null;}
 return proofs[0]||null;
}
export function deadlineStatus(data,i,today=todayMoscow()){
 if(isHistorical(i))return {code:'done',text:executionLabel(i),due:executionFactDate(i),actual:true,actualLabel:actualFinishLabel(i)};
 const stage=stageCode(i),level=stage==='Уточнить'?-1:Number(stage.slice(1));
 const unfinished=Array.from({length:5},(_,k)=>{const gate=k+1;return {gate,proof:gateEvidence(data,i,gate,today),due:stageDeadlineDate(i,gate)};}).filter(g=>!g.proof);
 const overdue=unfinished.filter(g=>g.due&&g.due<today);
 if(overdue.length){const item=overdue.sort((a,b)=>a.due.localeCompare(b.due))[0];return {code:'overdue',text:'Просрочен L'+item.gate,due:item.due,dueLabel:stageDeadlineLabel(i,item.gate),gate:item.gate};}
 const dueToday=unfinished.find(g=>g.due===today);if(dueToday)return {code:'today',text:'Срок сегодня / L'+dueToday.gate,due:today,dueLabel:stageDeadlineLabel(i,dueToday.gate),gate:dueToday.gate};
 if(level>0&&Array.from({length:Math.min(level,5)},(_,k)=>k+1).some(g=>!gateEvidence(data,i,g,today)))return {code:'proof',text:executionState(i)==='in_progress'?'В работе / требуется приёмка':'Требуется подтверждение стадии'};
 const next=unfinished.sort((a,b)=>(a.due||'9999').localeCompare(b.due||'9999'))[0];
 return next?next.due?{code:'upcoming',text:'Следующий срок L'+next.gate,due:next.due,dueLabel:stageDeadlineLabel(i,next.gate),gate:next.gate}:{code:'missing',text:'Требуется срок'}:{code:'done',text:'Стадии подтверждены'};
}
const executionFactDate=i=>i.execution_fact?.actual_finish||null;
export const gateEvidence=(data,i,level,today=todayMoscow())=>gateProof(data,i,level,today)||executionGateEvidence(i,level);
export function stageDeadlineDate(i,level){if(isHistorical(i)||executionState(i)==='in_progress'&&level<4)return '';const date=dateText(i['due_l'+level]),alignment=i.provenance?.calendar_alignment;if(level===4&&date&&alignment?.source_deadline_precision==='month'){const [year,month]=date.slice(0,7).split('-').map(Number);return new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);}if(level===4&&alignment?.source_deadline_technical_date&&date)return date;if(executionState(i)==='in_progress'&&level===4)return plannedEndDate(i);return date;}
export function stageDeadlineLabel(i,level){if(isHistorical(i))return isCompleted(i)?level<4?'Этап пройден':level===4?actualFinishLabel(i)||'Выполнено':'Требуется замер эффекта':'Отменено';if(level===4&&i.provenance?.calendar_alignment?.source_deadline_precision==='month'&&stageDeadlineDate(i,4))return new Date(stageDeadlineDate(i,4)+'T12:00:00Z').toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow',month:'long',year:'numeric'}).replace(/\s*г\.$/,'');if(executionState(i)==='in_progress'&&level<4)return 'Исторический этап';if(executionState(i)==='in_progress'&&level===4)return plannedEndLabel(i)||'Требуется срок';return stageDeadlineDate(i,level)?longDate(stageDeadlineDate(i,level)):'Требуется срок';}
export function detailedPlanAllowed(data,i){return !isHistorical(i)&&['L3','L4','L5'].includes(stageCode(i))&&!!gateProof(data,i,3);}
export function confirmedFinance(data,i){const ledger=(data.ledger||[]).find(r=>r.code===i.code);return !!ledger&&/^Подтвержден/i.test(String(ledger.confirmation||''))&&i.effect_role!=='Поддерживающий вклад'&&i.decision!=='Объединить';}
export function finances(data,list){
 const map=new Map((data.ledger||[]).map(r=>[r.code,r]));
 const eligible=list.filter(i=>working(i)&&!isHistorical(i));
 const approved=i=>working(i)&&!isHistorical(i)&&/^Подтвержден/i.test(String(map.get(i.code)?.confirmation||''));
 const owners=new Map();for(const i of data.initiatives||list){if(approved(i)&&i.effect_role!=='Поддерживающий вклад'){const key=String(i.effect_group||i.code);if(!owners.has(key))owners.set(key,i.code);}}
 const admitted=list.filter(i=>approved(i)&&i.effect_role!=='Поддерживающий вклад'&&owners.get(String(i.effect_group||i.code))===i.code);
 const included=list.filter(i=>approved(i)&&owners.has(String(i.effect_group||i.code))&&(i.effect_role==='Поддерживающий вклад'||owners.get(String(i.effect_group||i.code))===i.code));
 const sum=(key,rows)=>list.length===0?0:included.length===0?null:rows.every(i=>isNumber(map.get(i.code)?.[key]))?rows.reduce((a,i)=>a+map.get(i.code)[key],0):null;
 const payments=eligible.filter(i=>isNumber(i.one_off_2027));
 return {admittedCodes:admitted.map(i=>i.code),includedCodes:included.map(i=>i.code),confirmedCount:admitted.length,annual:sum('annual_potential',admitted),cash:sum('cash_2027',included),ebitda2027:sum('ebitda_2027',included),payments:payments.reduce((a,i)=>a+i.one_off_2027,0),paymentsKnown:payments.length,paymentsTotal:eligible.length,historicalCount:list.filter(isHistorical).length,investmentCount:eligible.length,excludedDuplicates:list.filter(i=>approved(i)&&i.effect_role!=='Поддерживающий вклад').length-admitted.length};
}

export function previousComparable(data){const prev=data.previousSnapshot||[],date=dateText(data.previousAsOf),today=dateText(data.asOf);return !!date&&!!today&&date<today&&!!data.snapshotMethod&&prev.length>0&&prev.every(r=>r.year===2027||r.year==='2027')&&prev.every(r=>r.method===data.snapshotMethod)&&prev.every(r=>/^Подтвержден/i.test(String(r.confirmation||'')));}
export function stageSummary(data,list){const prior=previousComparable(data)?data.previousSnapshot:null;return [...stages,['Уточнить','Требуется стадия']].map(([code,name])=>{const items=list.filter(i=>stageCode(i)===code),f=finances(data,items);const old=prior?.filter(i=>stageCode(i)===code);const currentScope=new Set(list.map(i=>i.code));const priorScoped=old?.filter(i=>currentScope.has(i.code));return {code,name,count:items.length,completedCount:items.filter(isCompleted).length,inProgressCount:items.filter(i=>executionState(i)==='in_progress').length,cancelledCount:items.filter(i=>executionState(i)==='cancelled').length,...f,countDelta:priorScoped?items.length-priorScoped.length:null,annualDelta:priorScoped&&priorScoped.every(r=>isNumber(r.annual_potential))&&isNumber(f.annual)?f.annual-priorScoped.reduce((a,r)=>a+r.annual_potential,0):null};});}
export function googleLink(i,key=null){const row=Number(i._source_row||i._row||7);const actual=i._source_row?row:row-4;const field=key?schema.columns.find(f=>f.key===key):null;const increment=s=>{let n=[...s].reduce((a,c)=>a*26+c.charCodeAt(0)-64,0)+1,t='';for(;n;n=Math.floor((n-1)/26))t=String.fromCharCode(65+(n-1)%26)+t;return t;};const range=field?increment(field.column)+actual:'B'+actual+':'+increment(schema.columns.at(-1).column)+actual;return `https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit#gid=${i._source_sheet_id??config.masterSheetId}&range=${encodeURIComponent(range)}`;}
export const sourceSheet=()=>`https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit#gid=${config.masterSheetId}`;
export const sheetLink=(id,range='B2')=>`https://docs.google.com/spreadsheets/d/${config.spreadsheetId}/edit#gid=${id}&range=${encodeURIComponent(range)}`;
export function hours(i){if(isHistorical(i))return null;if(isNumber(i.total_hours))return i.total_hours;const match=display(i.total_hours).match(/^\s*(\d+(?:[.,]\d+)?)\s*ч(?:ас.*)?\s*$/i);return match?Number(match[1].replace(',','.')):null;}

export function aliasCodes(i){let values=i.provenance?.retired_aliases||i.provenance?.aliases;if(!values){const match=String(i.sources||'').match(/Паспортные метаданные: (\{[^\n]+\})/);if(match){try{values=JSON.parse(match[1]).aliases;}catch{values=[];}}}return (Array.isArray(values)?values:[]).map(v=>typeof v==='string'?v:v.code).filter(Boolean);}
export function cleanSourceDisplay(value){
 const visible=[];
 for(const line of String(value??'').split(/\r?\n/)){
  const start=line.search(/(?:\{\s*"|\[\s*\{)/);
  if(start<0){visible.push(line);continue;}
  let record;
  try{record=JSON.parse(line.slice(start));}catch{continue;}
  if(!record||Array.isArray(record))continue;
  if(Object.hasOwn(record,'год')){
   const dates=['начало','план','факт'].filter(key=>record[key]!==null&&record[key]!==undefined&&String(record[key]).trim()).map(key=>key+' '+record[key]);
   visible.push('Исходные сроки '+record['год']+(dates.length?': '+dates.join(' / '):''));
  }else if(Object.hasOwn(record,'restored_source_value')){
   visible.push('Исходное значение: '+String(record.restored_source_value??''));
   if(record.source)visible.push('Источник: '+record.source);
  }else if(Object.hasOwn(record,'value')&&typeof record.source==='string'){
   visible.push('Исходное значение: '+String(record.value??''));
   visible.push('Источник: '+record.source);
  }
 }
 return display(visible.join('\n')).replace(/\n{3,}/g,'\n\n').trim();
}
export const sortPassportPack=list=>[...list].sort((a,b)=>digitalLayer(a).localeCompare(digitalLayer(b),'ru')||group(a).localeCompare(group(b),'ru')||display(a.curator).localeCompare(display(b.curator),'ru')||person(a).localeCompare(person(b),'ru')||display(a.process).localeCompare(display(b.process),'ru')||String(a.code).localeCompare(String(b.code),'ru'));
export const mergedCount=list=>new Set(list.flatMap(aliasCodes)).size;

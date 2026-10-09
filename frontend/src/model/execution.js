const states=new Set(['completed','in_progress','planned','paused','cancelled','unknown']);
const labels={completed:'Выполнено',in_progress:'В работе',planned:'Запланировано',paused:'Отложено',cancelled:'Отменено',unknown:'Требуется подтверждение'};

export function normalizeExecutionFact(value){
 if(value===undefined||value===null)return null;
 if(typeof value!=='object'||Array.isArray(value)||!states.has(value.state)||value.audited!==true||typeof value.scope_complete!=='boolean')throw new Error('Факт исполнения требует проверку статуса и источника');
 const precision=value.actual_finish_precision??null,rawDate=value.actual_finish??null,date=precision==='month'&&typeof rawDate==='string'&&/^\d{4}-\d{2}$/.test(rawDate)?rawDate+'-01':rawDate;
 if(![null,'month','day'].includes(precision)||date!==null&&(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T12:00:00Z'))||new Date(date+'T12:00:00Z').toISOString().slice(0,10)!==date)||precision&&date===null)throw new Error('Фактическая дата требует проверку точности источника');
 if(value.state==='completed'&&!value.scope_complete)throw new Error('Завершение требует подтверждение полного состава работ');
 let end=value.planned_end;
 if(end!==undefined&&end!==null){
  if(typeof end!=='object'||Array.isArray(end)||![null,'month','day'].includes(end.precision??null))throw new Error('Плановый срок требует проверку точности источника');
  const raw=end.value??null,position=end.precision==='month'&&typeof raw==='string'&&/^\d{4}-\d{2}$/.test(raw)?raw+'-01':raw;
  if(position!==null&&(typeof position!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(position)||!Number.isFinite(Date.parse(position+'T12:00:00Z'))||new Date(position+'T12:00:00Z').toISOString().slice(0,10)!==position)||end.precision&&position===null)throw new Error('Плановый срок требует проверку точности источника');
  end={...end,value:raw,precision:end.precision??null};
 }
 return {...value,actual_finish:date,actual_finish_precision:precision,...(end!==undefined?{planned_end:end}:{})};
}
export const executionFact=i=>i?.execution_fact?.audited===true?i.execution_fact:null;
export const executionState=i=>executionFact(i)?.state||'unknown';
export const isCompleted=i=>executionState(i)==='completed'&&executionFact(i)?.scope_complete===true;
export const isHistorical=i=>isCompleted(i)||executionState(i)==='cancelled';
export const executionLabel=i=>executionFact(i)?.work_status||labels[executionState(i)];
export function actualFinishLabel(i){
 const fact=executionFact(i);if(!fact)return '';
 const date=fact.actual_finish;if(!date)return fact.actual_finish_label||fact.actual_finish_raw||'';
 return new Date(date+'T12:00:00Z').toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow',month:'long',year:'numeric',...(fact.actual_finish_precision==='day'?{day:'numeric'}:{})}).replace(/\s*г\.$/,'');
}
export function executionGateEvidence(i,level){
 const fact=executionFact(i),last=isCompleted(i)?4:executionState(i)==='in_progress'?3:0;
 if(!fact||level<1||level>last)return null;
 return {historical:true,type:'Факт исполнения',date:fact.actual_finish||null,label:executionLabel(i),source:fact.sources||[],basis:fact.basis||'Первичные источники'};
}
export function plannedEndDate(i){
 const end=executionFact(i)?.planned_end;if(!end?.value)return '';
 if(end.precision==='month'){const parts=end.value.slice(0,7).split('-').map(Number);return new Date(Date.UTC(parts[0],parts[1],0)).toISOString().slice(0,10);}
 return end.value;
}
export function plannedEndLabel(i){
 const end=executionFact(i)?.planned_end,date=plannedEndDate(i);if(!date)return '';
 return new Date(date+'T12:00:00Z').toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow',month:'long',year:'numeric',...(end.precision==='day'?{day:'numeric'}:{})}).replace(/\s*г\.$/,'');
}

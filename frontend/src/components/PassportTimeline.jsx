import React from 'react';
import {dateText,longDate,todayMoscow,stageCode,gateEvidence,detailedPlanAllowed,stages,color,display,isNewIdea,isHistorical,executionLabel,actualFinishLabel,executionState,stageDeadlineDate,stageDeadlineLabel} from '../model/portfolio.js';
import '../passport-timeline.css';

const day=86400000,width=700,left=242,right=686,top=60;
function parsed(value){
 try{const text=dateText(value),ms=Date.parse(text+'T00:00:00Z');return /^\d{4}-\d{2}-\d{2}$/.test(text)&&Number.isFinite(ms)&&new Date(ms).toISOString().slice(0,10)===text?{text,ms}:null;}catch{return null;}
}
function heightFor(text,extra=0){return Math.max(74,Math.ceil(String(text).length/25)*21+extra+13);}

export default function PassportTimeline({data,i}){
 if(!i)return null;
 if(isHistorical(i))return <section className="passport-execution-calendar" aria-label={'Фактическое исполнение '+i.code}><h3>Фактическое исполнение</h3><p className={'execution-source-marker '+(i.execution_fact?.basis==='user_confirmation'?'addition':'source-primary')}>{i.execution_fact?.basis==='user_confirmation'?'По подтверждению завершения':'По исходному реестру'}</p><p className={i.execution_fact?.basis==='user_confirmation'?'addition':'source-primary'}>{executionLabel(i)}<time className="source-primary">{actualFinishLabel(i)||(executionState(i)==='completed'?'Требуется дата завершения':'')}</time></p>{i.execution_fact?.source_status&&<p className="execution-original-status source-primary">Статус источника: {display(i.execution_fact.source_status)}</p>}{i.execution_fact?.basis==='user_confirmation'&&<p className="execution-user-confirmation addition">Пользователь подтвердил завершение{ i.execution_fact.user_confirmation?.date?' '+longDate(i.execution_fact.user_confirmation.date):''}</p>}{i.execution_fact?.source_comment&&<p>{display(i.execution_fact.source_comment)}</p>}</section>;
 const idea=isNewIdea(i),timelineStages=idea?[['L1','Анализ предложения']]:executionState(i)==='in_progress'?stages.slice(4):stages.slice(1);
 let previous=null;
 const points=timelineStages.map(([code,name])=>{
  const field='due_'+code.toLowerCase(),date=parsed(stageDeadlineDate(i,Number(code.slice(1)))),reversed=date&&previous!==null&&date.ms<previous;
  if(date&&!reversed)previous=date.ms;
  return {code,name,field,date,plotDate:reversed?null:date,error:!date?'Требуется подтверждение: срок '+code:reversed?'Требуется подтверждение: порядок дат':'',proof:gateEvidence(data,i,Number(code.slice(1))),height:!date?100:reversed?116:74};
 });
 const detailed=!idea&&detailedPlanAllowed(data,i),works=detailed?(data.plan||[]).filter(row=>row.code===i.code).map(row=>{
  const start=parsed(row.start),end=parsed(row.end),valid=start&&end&&end.ms>=start.ms;
  const error=!start||!end?'Требуется подтверждение: начало и завершение':!valid?'Требуется подтверждение: порядок дат':'';
  const extra=42+Math.ceil(('Исполнитель: '+(display(row.owner)||'Требуется ответственный')).length/30)*17+(display(row.predecessor)?Math.ceil(('Предшественник: '+display(row.predecessor)).length/30)*17:0)+(error?Math.ceil(error.length/30)*17:0);
  return {...row,startDate:start,endDate:end,valid,error,height:heightFor(display(row.result),extra)};
 }):[];
 const dates=[...points.flatMap(row=>row.plotDate?[row.plotDate.ms]:[]),...works.flatMap(row=>row.valid?[row.startDate.ms,row.endDate.ms]:[])];
 const first=dates.length?new Date(Math.min(...dates)):null,last=dates.length?new Date(Math.max(...dates)):null;
 const start=first?Date.UTC(first.getUTCFullYear(),first.getUTCMonth(),1):null,end=last?Date.UTC(last.getUTCFullYear(),last.getUTCMonth()+1,1):null;
 const x=ms=>left+(ms-start)/(end-start)*(right-left),months=first?(last.getUTCFullYear()-first.getUTCFullYear())*12+last.getUTCMonth()-first.getUTCMonth()+1:0;
 const ticks=[];for(let offset=0;offset<months;offset+=Math.max(1,Math.ceil(months/4))){const date=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+offset,1));ticks.push({ms:date.getTime(),month:date.toLocaleDateString('ru-RU',{timeZone:'UTC',month:'long'}),year:date.getUTCFullYear()});}
 const today=parsed(todayMoscow()),showToday=Boolean(today&&dates.length&&today.ms>=start&&today.ms<end);
 const rows=[...points,...works],chartHeight=top+rows.reduce((sum,row)=>sum+row.height,0)+10;
 let y=top;
 return <section className={'passport-timeline'+(idea?' passport-timeline-idea':'')+' pt-compact-print'} aria-label={'Календарный план '+i.code}>
  <div className="passport-timeline-scroll" tabIndex="0" aria-label="Календарь прокручивается по горизонтали и вертикали">
   <svg className="passport-timeline-svg" viewBox={'0 0 '+width+' '+chartHeight} role="group" aria-label="Сроки стадий и разрешённые работы на календарной шкале">
    {ticks.map(tick=><g key={tick.ms}><line x1={x(tick.ms)} x2={x(tick.ms)} y1="53" y2={chartHeight-8} className="pt-grid"/><text x={x(tick.ms)+3} y="31" className="pt-axis">{tick.month}</text><text x={x(tick.ms)+3} y="49" className="pt-axis-year">{tick.year}</text></g>)}
    {showToday&&<g><line x1={x(today.ms)} x2={x(today.ms)} y1="56" y2={chartHeight-8} className="pt-today-line"/><text x={x(today.ms)+3} y="15" className="pt-today-label">Сегодня</text></g>}
    {!dates.length&&<text x={left+10} y="27" className="pt-empty-axis">Владелец подтверждает календарные даты</text>}
    {points.map(row=>{const currentY=y;y+=row.height;const cx=row.plotDate?x(row.plotDate.ms):null,cy=currentY+26;return <g key={row.code} data-stage={row.code}>
     <line x1="0" x2={right} y1={currentY+row.height-2} y2={currentY+row.height-2} className="pt-row-line"/>
     <foreignObject x="0" y={currentY} width={left-15} height={row.height}><div xmlns="http://www.w3.org/1999/xhtml" className={'pt-label '+(stageCode(i)===row.code?'pt-current':'')}><strong>{row.code} {row.name}</strong><span className={'pt-date '+color(i,row.field)} data-field={row.field}>{row.date?stageDeadlineLabel(i,Number(row.code.slice(1))):'Требуется подтверждение: срок '+row.code}</span><small>{row.proof?.historical?'Исходный этап пройден':row.proof?'Решение подтверждено':'Решение ожидается'}</small>{row.date&&row.error&&<small className="pt-date-warning">{row.error}</small>}</div></foreignObject>
     {cx!==null&&<path className={'pt-milestone '+(row.proof?'pt-confirmed':'')} data-date={row.plotDate.text} data-x={cx} d={`M${cx} ${cy-6}L${cx+6} ${cy}L${cx} ${cy+6}L${cx-6} ${cy}Z`}><title>{row.code+' / '+stageDeadlineLabel(i,Number(row.code.slice(1)))+' / '+(row.proof?.historical?'Исходный этап пройден':row.proof?'Решение подтверждено':'Решение ожидается')}</title></path>}
    </g>;})}
    {works.map((row,index)=>{const currentY=y;y+=row.height;return <g key={row._row??index} data-work-row={row._row??index}>
     <line x1="0" x2={right} y1={currentY+row.height-2} y2={currentY+row.height-2} className="pt-row-line"/>
     <foreignObject x="0" y={currentY} width={left-15} height={row.height}><div xmlns="http://www.w3.org/1999/xhtml" className="pt-label pt-work-label"><strong>{display(row.result)||'Требуется название работы'}</strong><span><span className={'pt-date '+color(row,'start')}>{row.startDate?longDate(row.startDate.text):'Требуется начало'}</span> – <span className={'pt-date '+color(row,'end')}>{row.endDate?longDate(row.endDate.text):'Требуется завершение'}</span></span><small>Исполнитель: {display(row.owner)||'Требуется ответственный'}</small>{display(row.predecessor)&&<small>Предшественник: {display(row.predecessor)}</small>}{row.error&&<small className="pt-date-warning">{row.error}</small>}</div></foreignObject>
     {row.valid&&<rect className="pt-work-bar" data-start={row.startDate.text} data-end={row.endDate.text} x={x(row.startDate.ms)} y={currentY+20} width={x(Math.min(end,row.endDate.ms+day))-x(row.startDate.ms)} height="15" rx="2"><title>{display(row.result)+' / '+longDate(row.startDate.text)+' – '+longDate(row.endDate.text)+' / '+display(row.owner)+(display(row.predecessor)?' / предшественник '+display(row.predecessor):'')}</title></rect>}
    </g>;})}
   </svg>
  </div>
  {<svg className="pt-print-chart" viewBox={'0 0 700 '+(52+points.length*29+8)} role="img" aria-label="Календарная шкала контрольных точек">
   {ticks.map(tick=>{const px=48+(tick.ms-start)/(end-start)*638;return <g key={tick.ms}><line x1={px} x2={px} y1="45" y2={52+points.length*29} className="pt-grid"/><text x={px+3} y="18">{tick.month}</text><text x={px+3} y="36">{tick.year}</text></g>;})}
   {points.map((row,index)=>{const cy=66+index*29,cx=row.plotDate?48+(row.plotDate.ms-start)/(end-start)*638:null;return <g key={row.code}><text x="0" y={cy+5} className="pt-print-stage">{row.code}</text><line x1="44" x2="686" y1={cy+13} y2={cy+13} className="pt-row-line"/>{cx!==null&&<path className={'pt-milestone '+(row.proof?'pt-confirmed':'')} d={`M${cx} ${cy-5}L${cx+5} ${cy}L${cx} ${cy+5}L${cx-5} ${cy}Z`}><title>{row.code+' / '+stageDeadlineLabel(i,Number(row.code.slice(1)))}</title></path>}</g>;})}
  </svg>}
  <div className="pt-print-dates" aria-label="Печатные сроки стадий">{points.map(row=><div key={row.code} data-stage={row.code}><span>{row.code}{idea?' / Анализ предложения':''}</span><time className={color(i,row.field)} data-field={row.field} dateTime={row.date?.text}>{row.date?stageDeadlineLabel(i,Number(row.code.slice(1))):'Требуется срок'}</time></div>)}</div>
  {idea&&<p className="passport-timeline-idea-note">Сроки реализации определяются после отбора идеи</p>}
  <p className="passport-timeline-key"><span className="pt-key-diamond"/>Контрольная точка{works.length>0&&<span className="pt-works-key"><span className="pt-key-bar"/>Работа по календарю</span>}</p>
 </section>;
}

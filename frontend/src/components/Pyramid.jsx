import React,{useEffect,useState} from 'react';
import {digitalLayerCode,digitalLayer,initiativeTitle,layerSummary,group,person,display,color,fmt,finances,working,isHistorical,isNewIdea,isNumber,stageCode,executionLabel} from '../model/portfolio.js';
import {annualForecast} from '../model/assessment.js';
import {ViewTitle} from './Common.jsx';
import DigitalPyramid from './DigitalPyramid.jsx';
import TransformationKpis from './TransformationKpis.jsx';

export function PyramidSvg(props){return <DigitalPyramid {...props}/>;}
const grouped=(items,read)=>[...items.reduce((groups,i)=>groups.set(read(i),[...(groups.get(read(i))||[]),i]),new Map())].sort((a,b)=>a[0].localeCompare(b[0],'ru'));
const value=v=>isNumber(v)?fmt(v):display(v)||'Требуется значение';
export const transformationOrder=items=>[...items].sort((a,b)=>digitalLayer(b).localeCompare(digitalLayer(a),'ru')||group(a).localeCompare(group(b),'ru')||person(a).localeCompare(person(b),'ru')||String(a.code).localeCompare(String(b.code),'ru'));
const pageSize=20;

function InitiativeResult({i,onOpen}){
 const historical=isHistorical(i),label=historical?'История / '+executionLabel(i):(isNewIdea(i)?'Идея / ':'')+stageCode(i);
 return <article className="transformation-initiative" data-code={i.code}>
  <div className="transformation-initiative-heading">
   {onOpen?<button className="transformation-passport-link" aria-label={`${i.code} ${initiativeTitle(i)} / открыть паспорт`} onClick={()=>onOpen(i.code)}><span className={'code-button '+color(i,'code')}>{i.code}</span><span className={color(i,'title')}>{initiativeTitle(i)}</span></button>:<strong className="transformation-print-title">{i.code} / {initiativeTitle(i)}</strong>}
   <span className={'pill '+(isNewIdea(i)?'addition':'')}>{label}</span>
  </div>
  <div className="transformation-initiative-result">
   <div><span className="transformation-result-label">Операционный показатель</span><p className={color(i,'metric')}>{display(i.metric)||'Владелец уточняет показатель'}{i.unit?' / '+display(i.unit):''}</p><small><span className={color(i,'baseline')}>База: {value(i.baseline)}</span><span className={color(i,'target')}>Цель: {value(i.target)}</span></small></div>
   {!historical&&<div className="transformation-initiative-money"><span className="transformation-result-label">Оценка прибыли, млн руб / год</span><strong className="addition">{fmt(i.priority_annual_ebitda,2,'Требуется оценка')}</strong></div>}
  </div>
 </article>;
}

export default function Pyramid({data,list,contextList=list,filter={},onLayer,onTeamLayer,onOpen,onView,onPrint,initialKpiSelection={}}){
 const [kpiSelection,setKpiSelection]=useState(initialKpiSelection);
 const [page,setPage]=useState(0),ordered=transformationOrder(list),signature=ordered.map(i=>i.code).join(','),pages=Math.max(1,Math.ceil(ordered.length/pageSize));
 useEffect(()=>setPage(0),[signature]);
 const currentPage=Math.min(page,pages-1),cards=onOpen?ordered.slice(currentPage*pageSize,(currentPage+1)*pageSize):ordered;
 const levels=layerSummary(contextList).reverse(),unassigned=contextList.length-levels.reduce((sum,l)=>sum+l.count,0),finance=finances(data,list.filter(working)),annual=annualForecast(list),history=list.filter(isHistorical).length;
 const changePage=value=>{setPage(value);const heading=document.getElementById('transformation-pack-heading');heading?.focus({preventScroll:true});heading?.scrollIntoView({block:'start',behavior:'instant'});};
 return <section className="transformation-view">
  <ViewTitle title="Уровни трансформации связывают технологии с результатами бизнеса" description="Выберите уровень, команду и ответственного в фильтрах; код открывает паспорт" onPrint={onPrint?()=>onPrint({kpiSelection}):undefined}/>
  <TransformationKpis data={data} filter={filter} contextList={contextList} onLayer={onLayer} onView={onView} initialSelection={initialKpiSelection} onSelectionChange={setKpiSelection}/>
  <div className="transformation-pyramid"><PyramidSvg items={contextList} selected={filter.layer} onLayer={onLayer} onResult={onView?()=>onView('calculator'):null}/>{unassigned>0&&<p className="caption">Уровень проходит уточнение / инициатив: {unassigned}</p>}</div>
  <section className="transformation-portfolio" aria-label="Иерархия инициатив по уровням трансформации">
   <div className="transformation-portfolio-heading"><div><h2 id="transformation-pack-heading" tabIndex={-1}>Уровень, команда и ответственный определяют пакет инициатив</h2><p className="caption">{filter.layer||'Все уровни'} / текущие проекты и идеи: {annual.count} / история: {history}</p></div><div className="transformation-net"><span>Предварительный годовой прирост операционной прибыли, млн руб</span><strong>{fmt(annual.value,2,'Требуется оценка')}</strong><small>Согласованных конечных эффектов: {finance.confirmedCount}</small></div></div>
   {onOpen&&ordered.length>pageSize&&<p className="caption transformation-page-count">Инициативы {currentPage*pageSize+1}–{Math.min((currentPage+1)*pageSize,ordered.length)} из {ordered.length}</p>}
   <div className="transformation-tree">{grouped(cards,digitalLayer).reverse().map(([level,levelCards])=><section className="transformation-level" data-layer={digitalLayerCode(levelCards[0])||'unassigned'} key={level}>
    <h3>{level}</h3>
    {grouped(levelCards,group).map(([team,teamCards])=><section className="transformation-team" data-team={team} key={team}><div className="transformation-team-heading"><h4><span>Команда внедрения</span>{team}</h4>{onTeamLayer&&digitalLayerCode(teamCards[0])&&<button className="transformation-team-filter" onClick={()=>onTeamLayer(level,team)}>Выбрать команду</button>}</div>
     {grouped(teamCards,person).map(([owner,ownerCards])=><section className="transformation-owner" data-owner={owner} key={owner}><h5><span>Ответственный за паспорт</span>{owner}</h5><div className="transformation-initiatives">{ownerCards.map(i=><InitiativeResult i={i} onOpen={onOpen} key={i.code}/>)}</div></section>)}
    </section>)}
   </section>)}</div>
   {onOpen&&ordered.length>pageSize&&<div className="transformation-pagination" aria-label="Страницы инициатив"><span>{currentPage*pageSize+1}–{Math.min((currentPage+1)*pageSize,ordered.length)} из {ordered.length}</span><button disabled={currentPage===0} onClick={()=>changePage(currentPage-1)}>Предыдущие</button><button disabled={currentPage===pages-1} onClick={()=>changePage(currentPage+1)}>Следующие</button></div>}
   {list.length===0&&<p className="empty">Измените фильтры, чтобы выбрать инициативы</p>}
  </section>
 </section>;
}

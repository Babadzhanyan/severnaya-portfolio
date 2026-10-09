import React,{useEffect,useId,useState} from 'react';
import {isNumber} from '../model/portfolio.js';
import {businessFunctions,businessFunctionFor,companyKpis,itRequirements,levelKpis,metricValue,operationalKpis} from '../model/transformation-kpis.js';
import DigitalPyramid from './DigitalPyramid.jsx';
import './transformation-kpis.css';

const sections=[['levels','Пирамида и КПЭ'],['business','Подразделения']];
const goalText=goal=>isNumber(goal.value)?metricValue(goal.value,goal.unit):goal.label;
const qualityContext={
 'critical-success':'Услуга / 28 дней',
 'tested-recovery':'Рабочая операция / время / потеря данных',
 'change-failure':'90 дней / число сбоев и внедрений',
 'delivery-time':'Одинаковый класс задач / срок для 90% задач',
 'overdue-controls':'Применимость требований / еженедельно'
};

function KpiTable({metrics,sharedContext=false}){
 return <div className="kpi-table" role="table" aria-label="Показатели, база и предлагаемые цели">
  <div className="kpi-table-head" role="row"><span role="columnheader">Показатель и расчёт</span><span role="columnheader">База источника</span><span role="columnheader">Предлагаемая цель</span><span role="columnheader">Ответственность и действие</span></div>
  {metrics.map(m=><div className="kpi-table-row" role="row" data-metric={m.id} key={m.id}>
   <div role="cell"><span className="kpi-mobile-label" aria-hidden="true">Показатель</span><strong>{m.name}</strong><small>{m.formula}</small>{m.window&&!sharedContext&&<small>Период: {m.window}</small>}</div>
   <div role="cell" className={'kpi-baseline '+(m.base.origin==='formula'?'formula':'')}><span className="kpi-mobile-label" aria-hidden="true">База источника</span><strong>{metricValue(m.base.value,m.base.unit)}</strong>{m.base.period&&<small>{m.base.period} / {m.base.scope}</small>}</div>
   <div role="cell" className="kpi-goal addition"><span className="kpi-mobile-label" aria-hidden="true">Предлагаемая цель</span><strong>{goalText(m.goal)}</strong>{isNumber(m.goal.value)&&m.goal.change&&<small>{m.goal.change}</small>}</div>
   <div role="cell"><span className="kpi-mobile-label" aria-hidden="true">Ответственность и действие</span><strong>{m.owner}</strong><small>{m.action}</small>{m.guardrail&&!sharedContext&&<small>Контроль: {m.guardrail}</small>}{m.note&&<small>{m.note}</small>}</div>
  </div>)}
 </div>;
}

function LevelMetrics({level}){
 const metrics=level.code==='Ц0'?itRequirements:level.drivers;
 return <div className="kpi-level-metrics">
  <div className="kpi-compact-table" role="table" aria-label={'КПЭ уровня '+level.code}>
   <div className="kpi-compact-head kpi-accessible-head" role="row"><span role="columnheader">Показатель</span><span role="columnheader">База</span><span role="columnheader">Предлагаемая цель</span></div>
   {metrics.map(m=><div role="rowgroup" key={m.id}>
    <div className="kpi-compact-row" role="row" data-metric={m.id}>
     <div role="cell"><strong>{m.name}</strong></div>
     <div role="cell" className="kpi-baseline"><span className="kpi-mobile-label" aria-hidden="true">База</span><strong>{metricValue(m.base.value,m.base.unit)}</strong></div>
     <div role="cell" className="kpi-goal addition"><span className="kpi-mobile-label" aria-hidden="true">Предлагаемая цель</span><strong>{goalText(m.goal)}</strong></div>
    </div>
    <div className="kpi-compact-method-row" role="row"><div role="cell" aria-colspan={3}>{m.formula}{qualityContext[m.id]&&<span> / {qualityContext[m.id]}</span>}</div></div>
   </div>)}
  </div>
  {level.note&&<p className="kpi-level-note">{level.note}</p>}
 </div>;
}

function CompanyMetrics({metrics}){
 return <div className="kpi-compact-table kpi-company-metrics" role="table" aria-label="Результаты компании">
  <div className="kpi-compact-head" role="row"><span role="columnheader">Показатель</span><span role="columnheader">База</span><span role="columnheader">Предлагаемая цель</span></div>
  {metrics.map(m=><div className="kpi-compact-row" role="row" key={m.id} data-outcome={m.id}>
   <div role="cell"><strong>{m.name}</strong>{m.base.period&&<small>{m.base.period} / {m.base.scope}</small>}</div>
   <div role="cell" className="kpi-baseline"><span className="kpi-mobile-label" aria-hidden="true">База</span><strong className="kpi-outcome-value">{metricValue(m.base.value,m.base.unit)}</strong></div>
   <div role="cell" className="kpi-goal addition"><span className="kpi-mobile-label" aria-hidden="true">Предлагаемая цель</span><strong>{goalText(m.goal)}</strong>{isNumber(m.goal.value)&&m.goal.change&&<small>{m.goal.change}</small>}</div>
  </div>)}
 </div>;
}

export default function TransformationKpis({data={},filter={},contextList=[],onLayer,onView,initialSelection={},onSelectionChange}){
 const [section,setSection]=useState(sections.some(([key])=>key===initialSelection.section)?initialSelection.section:'levels'),[functionId,setFunctionId]=useState(businessFunctions.some(f=>f.id===initialSelection.functionId)?initialSelection.functionId:'hatch');
 const id=useId();
 const selectedFunction=businessFunctionFor(filter.process)||functionId,fn=businessFunctions.find(f=>f.id===selectedFunction);
 useEffect(()=>{onSelectionChange?.({section,level:filter.layer||'',functionId:selectedFunction});},[section,filter.layer,selectedFunction,onSelectionChange]);
 const outcomes=companyKpis(data),operational=operationalKpis(data,selectedFunction);
 const moveTab=(event,index)=>{const next=event.key==='ArrowRight'?(index+1)%sections.length:event.key==='ArrowLeft'?(index+sections.length-1)%sections.length:event.key==='Home'?0:event.key==='End'?sections.length-1:null;if(next===null)return;event.preventDefault();setSection(sections[next][0]);event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();};
 return <section className="transformation-kpis" aria-label="Пирамида трансформации и показатели эффективности">
  <div className="kpi-dashboard-toolbar"><div className="kpi-tabs" role="tablist" aria-label="Группы показателей">{sections.map(([key,label],index)=><button type="button" role="tab" id={id+'-'+key} aria-controls={id+'-panel'} aria-selected={section===key} tabIndex={section===key?0:-1} className={section===key?'active':''} key={key} onKeyDown={event=>moveTab(event,index)} onClick={()=>setSection(key)}>{label}</button>)}</div>{onView&&<button onClick={()=>onView('calculator')}>Рассчитать эффект</button>}</div>
  <p className="kpi-scope-note">Ключевые показатели эффективности (КПЭ): бизнес принимает результат, ИТ обеспечивает решение, финансы подтверждают прибыль. Первый замер 30 дней фиксирует базу ИТ; владельцы утверждают предлагаемые цели первого квартала пилота</p>
  <div id={id+'-panel'} className="kpi-panel" role="tabpanel" tabIndex={0} aria-labelledby={id+'-'+section}>
   {section==='levels'&&<>
    <DigitalPyramid items={contextList} selected={filter.layer} onLayer={onLayer} onResult={onView?()=>onView('calculator'):null} renderResult={()=> <CompanyMetrics metrics={outcomes}/>} renderLevel={l=><LevelMetrics level={levelKpis.find(item=>item.code===l.code)}/>}/>
   </>}
   {section==='business'&&<>
    <div className="kpi-panel-heading"><label>Подразделение<select aria-label="Подразделение для КПЭ" value={selectedFunction} onChange={e=>setFunctionId(e.target.value)} disabled={!!businessFunctionFor(filter.process)}>{businessFunctions.map(f=><option value={f.id} key={f.id}>{f.name}</option>)}</select></label><span>{filter.process?'Выбрано фильтром участка':'Два показателя выбранного процесса'}</span></div>
    <h3>{fn.name} улучшает операционный результат</h3><KpiTable metrics={operational} sharedContext/>
    <p className="kpi-scope-note">Первый замер: 4 сопоставимые недели. Общий контроль: {operational[0].guardrail}</p>
    {selectedFunction==='grow'&&<p className="kpi-scope-note">Руководители выращивания сверяют отчётную конверсию и падёж по одинаковым закрытым партиям</p>}
   </>}
  </div>
  <p className="kpi-scope-note">Ц0–Ц5 обозначают области технологий; L0–L5 обозначают стадии инициатив. Общие требования ИТ действуют на каждом уровне. Финансы учитывают конечный денежный эффект один раз</p>
 </section>;
}

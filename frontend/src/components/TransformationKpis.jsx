import React,{useEffect,useId,useState} from 'react';
import {digitalLayerCode,fmt,isNumber,layerSummary} from '../model/portfolio.js';
import {businessFunctions,businessFunctionFor,companyKpis,itRequirements,levelKpis,metricValue,operationalKpis} from '../model/transformation-kpis.js';
import './transformation-kpis.css';

const sections=[['levels','Уровни трансформации'],['business','Подразделения'],['quality','Качество ИТ']];
const goalText=goal=>isNumber(goal.value)?metricValue(goal.value,goal.unit):goal.label;

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

export default function TransformationKpis({data={},filter={},contextList=[],onLayer,onView,initialSelection={},onSelectionChange}){
 const [section,setSection]=useState(sections.some(([key])=>key===initialSelection.section)?initialSelection.section:'levels'),[localLevel,setLocalLevel]=useState(levelKpis.some(l=>l.code===initialSelection.level)?initialSelection.level:'Ц1'),[functionId,setFunctionId]=useState(businessFunctions.some(f=>f.id===initialSelection.functionId)?initialSelection.functionId:'hatch');
 const id=useId(),selectedLevel=digitalLayerCode({digital_layer:filter.layer})||localLevel;
 const level=levelKpis.find(l=>l.code===selectedLevel)||levelKpis[1],counts=layerSummary(contextList);
 const selectedFunction=businessFunctionFor(filter.process)||functionId,fn=businessFunctions.find(f=>f.id===selectedFunction);
 useEffect(()=>{onSelectionChange?.({section,level:selectedLevel,functionId:selectedFunction});},[section,selectedLevel,selectedFunction,onSelectionChange]);
 const outcomes=companyKpis(data),operational=operationalKpis(data,selectedFunction);
 const selectLevel=code=>{setLocalLevel(code);const item=levelKpis.find(l=>l.code===code),value=item.code+' '+item.name;if(filter.layer!==value)onLayer?.(value);};
 const moveTab=(event,index)=>{const next=event.key==='ArrowRight'?(index+1)%sections.length:event.key==='ArrowLeft'?(index+sections.length-1)%sections.length:event.key==='Home'?0:event.key==='End'?sections.length-1:null;if(next===null)return;event.preventDefault();setSection(sections[next][0]);event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();};
 return <section className="transformation-kpis" aria-labelledby={id+'-heading'}>
  <div className="kpi-heading"><h2 id={id+'-heading'}>КПЭ связывают работу ИТ с результатом подразделений</h2>{onView&&<button onClick={()=>onView('calculator')}>Рассчитать эффект</button>}</div>
  <p className="caption">Ключевые показатели эффективности (КПЭ): бизнес принимает результат, ИТ обеспечивает решение, финансы подтверждают прибыль</p>
  <div className="kpi-outcomes" aria-label="Результаты компании">{outcomes.map(m=><article key={m.id} data-outcome={m.id}>
   <h3>{m.name}</h3><span className="kpi-value-label">База источника</span><strong className={'kpi-outcome-value '+(m.base.origin==='formula'?'formula':'')}>{metricValue(m.base.value,m.base.unit)}</strong>
   <small>{m.base.period?m.base.period+' / '+m.base.scope:m.id==='profit'?'Финансы подтверждают конечные эффекты':'Технолог фиксирует отдельную долю каждого маршрута'}</small>
   <div className="kpi-outcome-goal addition"><span>Предлагаемая цель пилота</span><strong>{goalText(m.goal)}</strong>{isNumber(m.goal.value)&&m.goal.change&&<small>{m.goal.change}</small>}</div>
  </article>)}</div>
  <p className="kpi-scope-note">База компании сохраняет свой период при выборе инициатив. Владельцы утверждают цели первого квартала пилота после сверки базы</p>
  <div className="kpi-tabs" role="tablist" aria-label="Группы показателей">{sections.map(([key,label],index)=><button type="button" role="tab" id={id+'-'+key} aria-controls={id+'-panel'} aria-selected={section===key} tabIndex={section===key?0:-1} className={section===key?'active':''} key={key} onKeyDown={event=>moveTab(event,index)} onClick={()=>setSection(key)}>{label}</button>)}</div>
  <div id={id+'-panel'} className="kpi-panel" role="tabpanel" tabIndex={0} aria-labelledby={id+'-'+section}>
   {section==='levels'&&<>
    <div className="kpi-level-controls" aria-label="Выбор уровня КПЭ">{levelKpis.map(l=><button type="button" key={l.code} aria-label={l.code+' '+l.name+' / показать КПЭ и инициативы'} aria-pressed={selectedLevel===l.code} className={selectedLevel===l.code?'active':''} onClick={()=>selectLevel(l.code)}><strong>{l.code}</strong><span>{l.name}</span></button>)}</div>
    <div className="kpi-panel-heading"><div><h3>{level.code} / {level.name}</h3><p>{level.effect}</p></div><span>Инициатив: {fmt(counts.find(l=>l.code===level.code)?.count||0,0)}</span></div>
    <p className="kpi-scope-note">Первый замер 30 дней фиксирует базу выбранного контура</p>
    <KpiTable metrics={level.drivers}/>{level.note&&<p className="kpi-scope-note">{level.note}</p>}
    <p className="kpi-scope-note">Ц0–Ц5 обозначают области технологий; L0–L5 обозначают стадии инициатив. Общие требования качества действуют на каждом уровне</p>
   </>}
   {section==='business'&&<>
    <div className="kpi-panel-heading"><label>Подразделение<select aria-label="Подразделение для КПЭ" value={selectedFunction} onChange={e=>setFunctionId(e.target.value)} disabled={!!businessFunctionFor(filter.process)}>{businessFunctions.map(f=><option value={f.id} key={f.id}>{f.name}</option>)}</select></label><span>{filter.process?'Выбрано фильтром участка':'Два показателя выбранного процесса'}</span></div>
    <h3>{fn.name} улучшает операционный результат</h3><KpiTable metrics={operational} sharedContext/>
    <p className="kpi-scope-note">Первый замер: 4 сопоставимые недели. Общий контроль: {operational[0].guardrail}</p>
    {selectedFunction==='grow'&&<p className="kpi-scope-note">Руководители выращивания сверяют отчётную конверсию и падёж по одинаковым закрытым партиям</p>}
   </>}
   {section==='quality'&&<>
    <h3>ИТ сохраняет надёжность и доводит изменения до результата</h3><p className="kpi-scope-note">Первый замер 30 дней фиксирует базу каждого критичного сервиса. Руководители согласуют цели с допустимым ущербом и стоимостью обеспечения</p><KpiTable metrics={itRequirements}/>
   </>}
  </div>
  <p className="kpi-scope-note">Паспорт фиксирует один ключевой бизнес-показатель, базу, цель, срок и владельца. Финансы учитывают общий конечный эффект один раз; высвобождённые часы показывают отдельно от денежных результатов</p>
  <div className="kpi-method-links"><span>Практики измерения:</span><a href="https://sre.google/workbook/implementing-slos/" target="_blank" rel="noopener noreferrer">Google / надёжность</a><a href="https://dora.dev/guides/dora-metrics/" target="_blank" rel="noopener noreferrer">DORA / качество изменений</a><a href="https://airc.nist.gov/airmf-resources/airmf/5-sec-core/" target="_blank" rel="noopener noreferrer">NIST / проверка моделей ИИ</a></div>
 </section>;
}

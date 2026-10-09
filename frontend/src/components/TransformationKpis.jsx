import React,{useEffect} from 'react';
import {levelKpis} from '../model/transformation-kpis.js';
import DigitalPyramid from './DigitalPyramid.jsx';
import './transformation-kpis.css';

const names={
 'critical-success':'Надёжность',
 'tested-recovery':'Восстановление',
 'automatic-valid':'Данные вовремя',
 'automatic-coverage':'Охват измерений',
 'batch-trace':'История партии',
 'deviation-action':'Реакция в срок',
 'digital-route':'Цифровой маршрут',
 'first-pass':'Приёмка с первого раза',
 'data-quality':'Качество данных',
 'data-freshness':'Обновление в срок',
 'data-decisions':'Решения по данным',
 'model-value':'Ошибка прогноза'
};
const goalText=goal=>goal.label.match(/[≥≤−+-]?\d+(?:[.,]\d+)?%/)?.[0]||goal.label;

function LevelMetrics({level}){
 return <ul className="kpi-inline-metrics" aria-label={'КПЭ уровня '+level.code}>
  {level.drivers.map(m=>{const method=[m.name,m.formula,'Цель: '+m.goal.label,'Период: '+m.window,'Ответственный: '+m.owner,m.action,m.guardrail,level.note].filter(Boolean).join(' / ');
   return <li data-metric={m.id} key={m.id} title={method} aria-description={method}><span>{names[m.id]}</span><strong className="addition">{goalText(m.goal)}</strong></li>;
  })}
 </ul>;
}

export default function TransformationKpis({filter={},contextList=[],onLayer,onView,onSelectionChange}){
 useEffect(()=>{onSelectionChange?.({level:filter.layer||''});},[filter.layer,onSelectionChange]);
 return <section className="transformation-kpis" aria-label="Пирамида трансформации и показатели эффективности">
  {onView&&<div className="kpi-dashboard-toolbar"><button onClick={()=>onView('calculator')}>Рассчитать эффект</button></div>}
  <p className="kpi-scope-note">Ключевые показатели эффективности (КПЭ) показывают предлагаемые цели. Владельцы уточняют их после замера базы ИТ за 30 дней. ИИ – искусственный интеллект</p>
  <DigitalPyramid items={contextList} selected={filter.layer} onLayer={onLayer} onResult={onView?()=>onView('calculator'):null} renderLevel={l=><LevelMetrics level={levelKpis.find(item=>item.code===l.code)}/>}/>
 </section>;
}

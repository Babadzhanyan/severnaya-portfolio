import React from 'react';
import {digitalLayers,digitalLayerCode,layerSummary,group,person,fmt,finances,working} from '../model/portfolio.js';
import {ViewTitle} from './Common.jsx';
import DigitalPyramid from './DigitalPyramid.jsx';

export function PyramidSvg(props){return <DigitalPyramid {...props}/>;}

export default function Pyramid({data,list,contextList=list,filter={},onLayer,onTeamLayer,onView,onPrint}){
 const levels=layerSummary(contextList),unassigned=contextList.length-levels.reduce((sum,l)=>sum+l.count,0),finance=finances(data,list.filter(working));
 const departments=[...new Set(list.map(group))].sort((a,b)=>a.localeCompare(b,'ru'));
 return <section className="transformation-view">
  <ViewTitle title="Уровни трансформации связывают технологии с результатами бизнеса" description="Уровень задаёт область изменения, стадия отражает готовность, владельцы подтверждают бизнесэффект показателями" onPrint={onPrint}/>
  <div className="transformation-chain" aria-label="Связь изменений и результата"><span>Уровень</span><span>Инициатива</span><span>Показатель: база → цель</span><span>Критерий приёмки</span><span>Эффект бизнеса</span></div><div className="transformation-layout">
   <div className="transformation-pyramid"><PyramidSvg items={contextList} selected={filter.layer} onLayer={onLayer} onResult={onView?()=>onView('calculator'):null}/>{unassigned>0&&<p className="notice">Уровень ожидает определения: {unassigned} инициатив</p>}</div>
   <div className="transformation-meaning">
    <section className="transformation-confirmation"><h2>Владельцы подтверждают эффект показателями бизнеса</h2>
    <dl className="transformation-results"><dt>Производство</dt><dd>Годная продукция, кг / доля разделки и глубокой переработки / цена реализации</dd><dt>Деньги</dt><dd>Операционный результат / расходы внедрения и сопровождения / денежный эффект</dd><dt>Качество ИТ</dt><dd>Надёжность, сроки выполнения и качество поддержки</dd><dt>Обязательства</dt><dd>Безопасность и исполнение требований</dd></dl>
    <div className="transformation-finance"><span>Годовой потенциал до затрат ИТ, млн руб</span><strong>{fmt(finance.annual,2,'Требуется согласование')}</strong><small>Согласованных конечных эффектов: {finance.confirmedCount}</small></div></section>
    <section className="transformation-implementation">
    <h2>Команды внедрения защищают выбранный состав</h2>
    <p className="caption">{filter.layer?filter.layer:'Все уровни'} / {list.length} инициатив</p>
    <table className="transformation-teams"><thead><tr><th>Команда внедрения</th><th>Инициатив</th><th>Ответственных</th></tr></thead><tbody>{departments.map(name=>{const cards=list.filter(i=>group(i)===name);return <tr key={name}><td>{name}</td><td className="numeric">{cards.length}</td><td className="numeric">{new Set(cards.map(person)).size}</td></tr>;})}</tbody></table>
    {onView&&<div className="transformation-actions"><button className="primary" onClick={()=>onView('teams')}>Открыть уровни, направления и людей</button><button onClick={()=>onView('tracker')}>Открыть стадии и эффекты</button></div>}
    <p className="caption">Уровни описывают область изменений; команды внедрения закрепляют исполнителей</p>
    </section>
   </div>
  </div>
  <details className="form-section team-layer-details"><summary>Команды внедрения по уровням</summary><div className="table-wrap"><table className="team-layer-matrix"><thead><tr><th>Уровень изменения</th>{departments.map(name=><th key={name}>{name}</th>)}</tr></thead><tbody>{digitalLayers.map(level=><tr key={level.code}><th>{level.code} {level.name}</th>{departments.map(name=>{const count=list.filter(i=>digitalLayerCode(i)===level.code&&group(i)===name).length;return <td className="numeric" key={name}>{count>0&&onTeamLayer?<button aria-label={`${level.code} ${level.name} / ${name} / ${count} инициатив`} onClick={()=>onTeamLayer(level.code+' '+level.name,name)}>{count}</button>:count||'–'}</td>;})}</tr>)}</tbody></table></div><p className="caption">Команда внедрения ведёт изменение; состав паспорта закрепляет участников бизнеса и сопровождения</p></details>
  <details className="form-section"><summary>Область изменения каждого уровня</summary><table><thead><tr><th>Уровень</th><th>Что меняет компания</th><th>Инициатив</th></tr></thead><tbody>{levels.map(l=><tr key={l.code}><td>{l.code} {l.name}</td><td>{l.scope}</td><td className="numeric">{l.count}</td></tr>)}</tbody></table></details>
 </section>;
}

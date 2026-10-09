import React from 'react';
import {layerSummary,fmt} from '../model/portfolio.js';
import Icon from './Icon.jsx';
import './digital-pyramid.css';

const meanings={
  Ц0:{title:'Устойчивый ИТ-контур',icon:'shield',purpose:'Сквозная опора поддерживает все уровни',description:'Инфраструктура, безопасность и способности команды поддерживают работу систем; проектный офис ведёт изменения',capabilities:['Инфраструктура','Безопасность','Способности команды']},
  Ц1:{title:'Датчики и автоматика',icon:'sensor',purpose:'Автоматика передаёт первичные данные всей цепочки',description:'Датчики и контроллеры фиксируют параметры производства и поддерживающих служб'},
  Ц2:{title:'Производственные системы',icon:'process',purpose:'Производство и инженерные службы получают оперативное управление',description:'Системы участков связывают планы, операции, состояние оборудования и обслуживание',systems:'INNOVA / SKOV / FarmOnline'},
  Ц3:{title:'Учёт и цифровые процессы',icon:'accounting',purpose:'Учёт и приложения формализуют процессы всей цепочки',description:'Персонал, финансы, закупки и производство связывают документы, данные и операции',parallel:['1С / учёт','Собственные приложения'],systems:'1С / Excel'},
  Ц4:{title:'Платформа данных и интеграции',icon:'integration',purpose:'Платформа объединяет данные систем',description:'Единая модель данных сохраняет сведения и правила работы внутри компании'},
  Ц5:{title:'Аналитика и искусственный интеллект',icon:'analytics',purpose:'Аналитика поддерживает решения',description:'Отчётность и прогнозные модели связывают показатели с производственными и коммерческими решениями'}
};

function SegmentShape({apex=false}){
  return <svg className="dp-segment-shape" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d={apex?'M200 2 398 98H2Z':'M20 2H380L398 98H2Z'}/></svg>;
}

export default function DigitalPyramid({items=[],selected='',onLayer,onResult}){
  const levels=layerSummary(items).reverse();
  return <figure className="digital-pyramid">
    <div className="dp-row dp-apex-row">
      <div className="dp-graphic-cell">{onResult?<button type="button" className="dp-apex" onClick={onResult} aria-label="Результаты бизнеса / открыть расчёт эффектов"><SegmentShape apex/><span><Icon name="effect" size={24}/>Результаты бизнеса</span></button>:<div className="dp-apex"><SegmentShape apex/><span><Icon name="effect" size={24}/>Результаты бизнеса</span></div>}</div>
      <div className="dp-purpose"><div><h3>Компания оценивает инициативы по результатам бизнеса</h3><p>Повышение выхода годной продукции, доли разделки и глубокой переработки, средней цены</p></div></div>
    </div>
    <ol className="dp-levels" aria-label="Уровни цифровой трансформации от аналитики к общей опоре">
      {levels.map((l,k)=>{const meaning=meanings[l.code],value=l.code+' '+l.name,active=selected===value,enabled=l.count>0&&!!onLayer;
        return <li key={l.code} className={'dp-row '+(l.code==='Ц0'?'dp-foundation-row':'')} style={{'--dp-width':(70+k*6)+'%'}}>
          <div className="dp-graphic-cell"><button type="button" className={'dp-segment '+(active?'dp-selected':'')} disabled={!enabled} aria-pressed={active} aria-label={`${l.code} ${meaning.title} / количество инициатив: ${l.count}`} onClick={()=>onLayer(value)}>
            <SegmentShape/><span className="dp-segment-content"><span className="dp-level-code"><Icon name={meaning.icon} size={22}/>{l.code}</span><span className="dp-level-name">{meaning.title}{meaning.parallel&&<span className="dp-parallel">{meaning.parallel.map(text=><span key={text}>{text}</span>)}</span>}{meaning.capabilities&&<span className="dp-capabilities">{meaning.capabilities.join(' / ')}</span>}</span><span className="dp-count"><strong>{fmt(l.count,0)}</strong><small>всего</small>{active&&<small className="dp-selected-label">Выбран</small>}</span></span>
          </button></div>
          <div className="dp-purpose"><div><h3>{meaning.purpose}</h3><p>{meaning.description}</p>{meaning.systems&&<small>{meaning.systems}</small>}{l.code==='Ц0'&&<small>Общая опора уровней Ц1–Ц5</small>}</div></div>
        </li>;
      })}
    </ol>
  </figure>;
}

import React from 'react';
import {layerSummary,fmt} from '../model/portfolio.js';
import Icon from './Icon.jsx';
import './digital-pyramid.css';

const meanings={
  Ц0:{summary:'Инфраструктура, безопасность и команда',title:'Устойчивый ИТ-контур',icon:'shield',meaning:'Инфраструктура, безопасность и команда поддерживают системы и изменения'},
  Ц1:{summary:'Первичные данные с датчиков и контроллеров',title:'Датчики и автоматика',icon:'sensor',meaning:'Датчики фиксируют параметры производства и передают первичные данные'},
  Ц2:{summary:'INNOVA / SKOV / FarmOnline',title:'Производственные системы',icon:'process',meaning:'Планы, операции и обслуживание оборудования управляются в INNOVA / SKOV / FarmOnline'},
  Ц3:{summary:'1С и собственные приложения',title:'Учёт и цифровые процессы',icon:'accounting',meaning:'1С и собственные приложения связывают документы и операции всей цепочки'},
  Ц4:{summary:'Общая модель и обмен данными систем',title:'Платформа данных и интеграции',icon:'integration',meaning:'Единая модель объединяет сведения и правила работы всех систем'},
  Ц5:{summary:'Отчётность и прогнозы для рабочих решений',title:'Аналитика и ИИ',fullTitle:'Аналитика и искусственный интеллект',icon:'analytics',meaning:'Отчётность и прогнозы помогают выбирать производственные и коммерческие решения'}
};

function SegmentShape({apex=false}){
  return <svg className="dp-segment-shape" viewBox="0 0 400 100" preserveAspectRatio="none" aria-hidden="true" focusable="false"><path d={apex?'M200 2 398 98H2Z':'M20 2H380L398 98H2Z'}/></svg>;
}

export default function DigitalPyramid({items=[],selected='',onLayer,onResult,renderResult,renderLevel}){
  const levels=layerSummary(items).reverse();
  const resultContent=<><Icon name="effect" size={24}/><span><strong>Результаты бизнеса</strong><small>Годные кг / переработка<br/>Цена / прибыль</small></span></>;
  return <figure className={'digital-pyramid '+(renderLevel||renderResult?'dp-with-kpis':'')}>
    <div className="dp-row dp-apex-row">
      <div className="dp-graphic-cell">{onResult?<button type="button" className="dp-apex" onClick={onResult} aria-label="Результаты бизнеса / открыть расчёт эффектов"><SegmentShape apex/><span className="dp-apex-content">{resultContent}</span></button>:<div className="dp-apex"><SegmentShape apex/><span className="dp-apex-content">{resultContent}</span></div>}</div>
      {renderResult&&<div className="dp-kpis dp-result-kpis">{renderResult()}</div>}
    </div>
    <ol className="dp-levels" aria-label="Уровни цифровой трансформации от аналитики к общей опоре">
      {levels.map((l,k)=>{const meaning=meanings[l.code],value=l.code+' '+l.name,active=selected===value,enabled=l.count>0&&!!onLayer;
        return <li key={l.code} data-pyramid-level={l.code} className={'dp-row '+(l.code==='Ц0'?'dp-foundation-row':'')} style={{'--dp-width':(70+k*6)+'%'}}>
          <div className="dp-graphic-cell"><button type="button" className={'dp-segment '+(active?'dp-selected':'')} disabled={!enabled} aria-pressed={active} aria-label={`${l.code} ${meaning.fullTitle||meaning.title} / количество инициатив: ${l.count}`} onClick={()=>onLayer(value)}>
            <SegmentShape/><span className="dp-segment-content"><span className="dp-level-code"><Icon name={meaning.icon} size={22}/>{l.code}</span><span className="dp-level-copy"><span className="dp-level-name">{meaning.title}</span><span className="dp-level-meaning" title={meaning.meaning}>{meaning.summary}</span></span><span className="dp-count"><strong>{fmt(l.count,0)}</strong><small>всего</small>{active&&<small className="dp-selected-label">Выбран</small>}</span></span>
          </button></div>
          {renderLevel&&<div className="dp-kpis">{renderLevel(l)}</div>}
        </li>;
      })}
    </ol>
  </figure>;
}

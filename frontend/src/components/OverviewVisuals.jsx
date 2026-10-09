import React from 'react';
import Icon from './Icon.jsx';
import '../overview-ui.css';

const routes = [
  {view:'tracker',icon:'tracker',title:'Проверить готовность',description:'Стадии и решения владельцев определяют движение инициатив'},
  {view:'map',icon:'map',title:'Найти участок',description:'Карта производства открывает связанные паспорта'},
  {view:'calculator',icon:'calculator',title:'Рассчитать эффект',description:'Производственные рычаги связывают выпуск, расходы и денежный результат'},
  {view:'sessions',icon:'teams',title:'Подготовить встречу',description:'Владельцы защищают паспорта, направления и выбранный портфель'}
];

// Раздел заменяет прежний блок timeline-preview с тремя переходами
export function OverviewRoutes({onView}){
  return <section className="overview-routes" aria-labelledby="overview-routes-title">
    <h2 id="overview-routes-title">Следующее действие открывает нужный раздел</h2>
    <div className="overview-route-grid">
      {routes.map(route=><button key={route.view} className="overview-route" onClick={()=>onView?.(route.view)}>
        <Icon name={route.icon} size={30} className="overview-route-icon"/>
        <strong>{route.title}</strong><span>{route.description}</span>
        <span className="overview-route-action">Открыть раздел <Icon name="arrow" size={18}/></span>
      </button>)}
    </div>
  </section>;
}

export function SectionHeading({icon,children,as='h2'}){
  const Heading=as;
  return <Heading className="visual-section-heading"><Icon name={icon} size={22}/><span>{children}</span></Heading>;
}

import React from 'react';
import {display,fmt,isNumber} from '../model/portfolio.js';
import {useProductionAssets} from '../data/production-assets.js';
import Icon from './Icon.jsx';
import './effect-ui.css';

const amount=v=>fmt(isNumber(v)?v/1e6:null,2,'Заполните данные');
const signed=v=>isNumber(v)?(v>0?'+':v<0?'−':'')+amount(Math.abs(v)):'Требуется расчёт';
const quantity=(v,unit)=>{
  if(!isNumber(v))return 'Заполните базу';
  const divisor=Math.abs(v)>=1e6?1e6:Math.abs(v)>=1e3?1e3:1;
  const scale=divisor===1e6?'млн ':divisor===1e3?'тыс. ':'';
  return new Intl.NumberFormat('ru-RU',{maximumSignificantDigits:3}).format(v/divisor)+' '+scale+unit;
};
const steps=[
  {key:'eggs_set',label:'Закладка яиц',unit:'шт',icon:'egg',asset:'parents',levers:[['eggs_pct','Закладка','%']]},
  {key:'placed_chicks',label:'Посадка цыплят',unit:'гол',icon:'chicken',asset:'hatch',levers:[['hatch_pp','Выводимость','п.п.'],['chick_reject_pp','Отбраковка','п.п.']]},
  {key:'live_heads',label:'Птица на убой',unit:'гол',icon:'chicken',asset:'grow',levers:[['mortality_pp','Падёж','п.п.']]},
  {key:'live_kg',label:'Живой вес',unit:'кг',icon:'weight',levers:[['average_weight_pct','Средний вес','%']]},
  {key:'meat_kg',label:'Годное мясо',unit:'кг',icon:'meat',asset:'kill',levers:[['slaughter_yield_pp','Выход мяса','п.п.']]}
];

function ComparedValue({result,name,unit,empty='Заполните базу',money=false}){
  const target=result?.target?.[name],base=result?.baseline?.[name];
  const value=v=>isNumber(v)?money?amount(v)+' млн руб':quantity(v,unit):empty;
  const delta=isNumber(target)&&isNumber(base)?target-base:null;
  const deltaText=isNumber(delta)?(delta>0?'+':delta<0?'−':'')+(money?new Intl.NumberFormat('ru-RU',{maximumSignificantDigits:3}).format(Math.abs(delta)/1e6)+' млн руб':quantity(Math.abs(delta),unit)):null;
  return <><strong title={isNumber(target)?fmt(target,2)+(money?' руб':' '+unit):undefined}>{value(target)}</strong><small title={isNumber(base)?fmt(base,2)+(money?' руб':' '+unit):undefined}>База {value(base)}</small>{deltaText&&<small className="ev-value-delta" title={fmt(delta,10)+(money?' руб':' '+unit)}>Δ {deltaText}</small>}</>;
}

function ebitdaRequirement(result){
  const gaps=result?.confirmation_fields||[];
  if(gaps.includes('Календарь запасов'))return 'Согласуйте календарь запасов';
  if(result&&!isNumber(result.target?.revenue))return 'Заполните цены продукции';
  if(gaps.includes('Состав и ставки расходов')&&!isNumber(result?.target?.variable_expenses))return 'Заполните ставки расходов';
  if(gaps.includes('Постоянные расходы')&&!isNumber(result?.target?.fixed_expenses))return 'Заполните постоянные расходы';
  return 'Заполните данные';
}

export function CalculationFlow({input,result}){
  const images=useProductionAssets(),feedBasis=result?.reconciliation?.feed_basis;
  const expenseItems=[['revenue','Выручка','money','Заполните цены'],['variable_expenses','Переменные расходы','costs','Заполните ставки'],['fixed_expenses','Постоянные расходы','costs','Заполните расходы'],...(Object.hasOwn(result?.target||{},'extra_opex_delta')&&result.target.extra_opex_delta!==0?[['extra_opex_delta','Дополнительные расходы','costs','Заполните дополнительные расходы']]:[]),['ebitda','Операционная прибыль','effect',ebitdaRequirement(result)]];
  const feedLabel=feedBasis?feedBasis==='Наблюдаемый расход'?'Наблюдаемый расход корма':'Расчётный расход корма':isNumber(input?.baseline?.feed_kg)?'Наблюдаемый расход корма':'Расход корма';
  return <figure className="ev-calculation">
    <figcaption><h2>Производственные рычаги определяют объём годного мяса</h2>{input&&<p className="ev-calculation-note">Процентный пункт (п.п.) меняет долю на 0,01</p>}</figcaption>
    <ol className="ev-production-flow" aria-label="Последовательность производственного расчёта">
      {steps.map(s=><li key={s.key}>
        <div className="ev-production-object">{images[s.asset]?<img src={images[s.asset]} alt="" width="104" height="82" decoding="async"/>:<Icon name={s.icon} size={32}/>}</div>
        <h3>{s.label}</h3><ComparedValue result={result} name={s.key} unit={s.unit}/>
        {input&&<div className="ev-lever-notes">{s.levers.map(([key,label,unit])=><span key={key}>{label} {fmt(input.changes?.[key]??0)} {unit}</span>)}</div>}
      </li>)}
    </ol>
    <div className="ev-feed-branch">
      <Icon name="feed" size={28}/><div><h3>{feedLabel}</h3><ComparedValue result={result} name="feed_kg" unit="кг"/></div>
      <p>Живой вес и конверсия задают расход <span>Конверсия цели {fmt(result?.target?.fcr,3,'Заполните базу')} кг / кг{input&&' / изменение '+fmt(input.changes?.fcr_pct??0)+'%'}</span></p>
    </div>
    <div className="ev-pricing-equation" aria-label="Выручка равна объёму продаж, умноженному на среднюю цену">
      <div><span><Icon name="truck"/>Продажи</span><ComparedValue result={result} name="sold_kg" unit="кг"/></div><b className="ev-operator" aria-hidden="true">×</b>
      <div><span><Icon name="price"/>Средняя цена</span><strong>{fmt(result?.target?.average_price,2,'Заполните цены')}</strong><small>руб / кг / база {fmt(result?.baseline?.average_price,2,'Заполните цены')}</small></div><b className="ev-operator" aria-hidden="true">=</b>
      <div><span><Icon name="money"/>Выручка</span><ComparedValue result={result} name="revenue" unit="млн руб" empty="Заполните цены" money/></div>
    </div>
    <div className={'ev-profit-equation '+(expenseItems.length===5?'ev-profit-extra':'')} aria-label="Прибыль равна выручке за вычетом переменных и постоянных расходов">
      {expenseItems.map(([key,label,icon,empty],k)=><React.Fragment key={key}>
        {k>0&&<b className="ev-operator" aria-hidden="true">{k===expenseItems.length-1?'=':'−'}</b>}
        <div className={k===expenseItems.length-1?'ev-equation-result':''}><span><Icon name={icon}/>{label}</span><strong>{fmt(isNumber(result?.target?.[key])?result.target[key]/1e6:null,2,empty)}</strong><small>млн руб / база {fmt(key==='extra_opex_delta'?0:isNumber(result?.baseline?.[key])?result.baseline[key]/1e6:null,2,empty)}</small></div>
      </React.Fragment>)}
    </div>
    <p className="ev-calculation-note">Выручка − операционные расходы / {display(result?.baseline_period)||'Укажите период расчёта'}</p>
  </figure>;
}

export function bridgeGeometry(result){
  const rows=result?.bridge,total=result?.period_delta_ebitda;
  const codes=['yield','mix','price','variable_cost','fixed_cost',...(rows?.length===6?['extra_opex']:[])];
  if(!Array.isArray(rows)||rows.length!==codes.length||!isNumber(total)||rows.some((r,k)=>r?.code!==codes[k]||!isNumber(r?.rub)))return null;
  const sum=rows.reduce((v,r)=>v+r.rub,0);
  // Копейка допускает округление при сверке денежных составляющих
  if(Math.abs(sum-total)>Math.max(.01,Math.abs(total)*1e-9))return null;
  let value=0;
  const bars=rows.map(r=>{const start=value;value+=r.rub;return {...r,start,end:value};});
  const values=[0,total,...bars.flatMap(r=>[r.start,r.end])],min=Math.min(...values),max=Math.max(...values),range=max-min||1;
  const low=min-range*.15,high=max+range*.2,y=v=>50+(high-v)/(high-low)*208;
  const count=bars.length+1,width=900,left=32,step=(width-left-24)/count,barWidth=Math.min(80,step*.6);
  return {bars:bars.map((r,k)=>({...r,x:left+step*k+(step-barWidth)/2,y:Math.min(y(r.start),y(r.end)),height:Math.abs(y(r.end)-y(r.start)),endY:y(r.end)})),total,x:left+step*bars.length+(step-barWidth)/2,totalY:Math.min(y(0),y(total)),totalHeight:Math.abs(y(total)-y(0)),zeroY:y(0),barWidth,step,width};
}

const bridgeLabels={yield:['Выход'],mix:['Структура'],price:['Цена'],variable_cost:['Переменные','расходы'],fixed_cost:['Постоянные','расходы'],extra_opex:['Дополнительные','расходы']};
export function EffectBridge({result}){
  if(!result)return null;
  const geometry=bridgeGeometry(result);
  return <figure className="ev-effect-bridge">
    <figcaption><h2>Выход, структура и расходы формируют изменение прибыли</h2><p>Млн руб за период / {display(result.baseline_period)}</p></figcaption>
    {geometry?<>
      <div className="ev-bridge-scroll"><svg className="ev-waterfall" viewBox="0 0 900 326" role="img" aria-label={'Последовательное изменение операционной прибыли за период: '+signed(geometry.total)+' млн руб'}>
        <title>Денежные составляющие формируют изменение операционной прибыли</title>
        <line x1="24" x2="884" y1={geometry.zeroY} y2={geometry.zeroY} className="ev-zero-line"/>
        {geometry.bars.map((b,k)=><g key={b.code}>
          <title>{display(b.name)+': '+signed(b.rub)+' млн руб'}</title>
          <rect className={b.rub<0?'ev-negative':'ev-positive'} x={b.x} y={b.y} width={geometry.barWidth} height={Math.max(b.height,1)}/>
          <text x={b.x} y={b.y-9} className="ev-bar-value">{signed(b.rub)}</text>
          <line x1={b.x+geometry.barWidth} x2={k<geometry.bars.length-1?geometry.bars[k+1].x:geometry.x} y1={b.endY} y2={b.endY} className="ev-connector"/>
          <text x={b.x} y="286" className="ev-bar-label">{(bridgeLabels[b.code]||[display(b.name)]).map((line,j)=><tspan key={j} x={b.x} dy={j?18:0}>{line}</tspan>)}</text>
        </g>)}
        <rect className="ev-total" x={geometry.x} y={geometry.totalY} width={geometry.barWidth} height={Math.max(geometry.totalHeight,1)}/>
        <text x={geometry.x} y={geometry.totalY-9} className="ev-bar-value">{signed(geometry.total)}</text><text x={geometry.x} y="286" className="ev-bar-label">Изменение<tspan x={geometry.x} dy="18">прибыли</tspan></text>
      </svg></div>
      <div className="ev-bridge-reading"><span><i className="ev-positive"/>Рост прибыли</span><span><i className="ev-negative"/>Снижение прибыли</span><strong>Изменение операционной прибыли {signed(result.period_delta_ebitda)} млн руб</strong></div>
    </>:<div className="ev-bridge-pending">
      <p>{isNumber(result.period_delta_ebitda)?'Сверьте денежные составляющие с изменением операционной прибыли':'Цены и ставки расходов завершают денежный расчёт'}</p>
      <dl>{(result.bridge||[]).map((r,k)=><React.Fragment key={r.code+'-'+k}><dt>{display(r.name)}</dt><dd>{isNumber(r.rub)?signed(r.rub)+' млн руб':['yield','mix','price'].includes(r.code)?'Заполните цены':'Заполните ставки'}</dd></React.Fragment>)}</dl>
      {!isNumber(result.period_delta_ebitda)&&<p>Физические объёмы показаны в производственной схеме</p>}
    </div>}
  </figure>;
}

export function InitiativeEffect({lever}){
  if(!lever)return null;
  return <section className="ev-initiative-effect">
    <div className="ev-initiative-metric"><Icon name="target" size={26}/><div><h3>{display(lever.metric)||'Укажите показатель эффекта'}</h3><p><span>База {fmt(lever.baseline,3,'Заполните базу')}</span><span>Цель {fmt(lever.target,3,'Заполните цель')}</span></p></div><span>{display(lever.readiness)}</span></div>
    <dl className="ev-initiative-money">{[['annual_ebitda','Годовая операционная прибыль выбранного режима','effect',display(lever.mechanism)],['ebitda_2027','Операционная прибыль 2027','clock','Срок начала, охват и освоение'],['cash_2027','Деньги 2027 до налога','money','Реализация денежного эффекта и платежи']].map(([key,label,icon,detail])=><div key={key}><dt><Icon name={icon}/>{label}</dt><dd>{fmt(lever[key],2)}<small>млн руб</small></dd><p>{detail}</p></div>)}</dl>
  </section>;
}

const journey=[['Владельцы','teams'],['Паспорта','passport'],['Портфель','check'],['Запуск','launch']];
const spaced=s=>display(s).replace(/([А-Яа-я])(\d)/g,'$1 $2').replace(/(\d)([А-Яа-я])/g,'$1 $2');
export function SessionJourney({sessions=[],selectedIndex,onSelect,showResults=true}){
  return <nav className="ev-session-journey" aria-label="Результаты четырёх встреч"><ol>
    {sessions.slice(0,4).map((s,k)=>{const [label,icon]=journey[k],content=<><span className="ev-session-step"><b>{k+1}</b><Icon name={icon} size={25}/></span><strong>{label}</strong><time>{spaced(s.date)}</time>{showResults&&<p>{spaced(s.output)}</p>}</>;
      return <li key={s.date||k} className={selectedIndex===k?'ev-session-selected':''}>{onSelect?<button type="button" aria-pressed={selectedIndex===k} onClick={()=>onSelect(k)}>{content}</button>:<div>{content}</div>}</li>;
    })}
  </ol></nav>;
}

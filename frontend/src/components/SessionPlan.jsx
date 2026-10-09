import React,{useRef} from 'react';
import {ViewTitle} from './Common.jsx';
import {SessionJourney} from './EffectVisuals.jsx';
import programme from '../data/programme_public_v18.json';

const spaced=s=>s.replace(/([А-Яа-я])(\d)/g,'$1 $2').replace(/(\d)([А-Яа-я])/g,'$1 $2');
export default function SessionPlan({onPrint,data,active=true}){
 const sessionRefs=useRef({});
 const tokens={total_count:data?.initiatives?.length??200,project_count:data?.initiatives?.filter(i=>i.collection!=='ideas').length??172,idea_count:data?.initiatives?.filter(i=>i.collection==='ideas').length??28,history_count:data?.initiatives?.filter(i=>['completed','cancelled'].includes(i.execution_fact?.state)).length??53,working_count:data?.initiatives?.filter(i=>!['completed','cancelled'].includes(i.execution_fact?.state)).length??147};
 const text=v=>spaced(String(v??'').replace(/\{\{([a-z_]+)\}\}/g,(_,key)=>tokens[key]??'Требуется уточнение'));
 const sessions=programme.sessions.map(s=>Object.fromEntries(Object.entries(s).map(([key,value])=>[key,typeof value==='string'?text(value):value])));
 return <section className="session-plan">
  <ViewTitle title="Четыре встречи согласуют состав, ресурсы и запуск" description="8 октября – 5 ноября 2026 / встречи 2–4 согласуются с участниками" onPrint={onPrint}/>
  <SessionJourney sessions={sessions} showResults={false} onSelect={index=>sessionRefs.current[sessions[index]?.id]?.scrollIntoView({block:"start",behavior:"auto"})}/>
  <p className="caption">{text(programme.first_meeting_status)}</p>
  <section className="session-actions" aria-label="Ближайшие задачи участников">
   <div><h2>Сотрудники проверяют карточки</h2><strong>До 13 октября, 18:00</strong><p>Проверьте статус, состав работ, показатель результата, сроки, часы и закупки. Передайте паспорт своему руководителю</p></div>
   <div><h2>Руководители согласуют пакет</h2><strong>До 14 октября, 18:00</strong><p>Подтвердите текущие работы, ответственных и предложения 2027 года. Подготовьте оценку загрузки направления</p></div>
  </section>
  <div className="session-governance"><p><strong>Дмитрий Петров</strong> ведёт проектный офис и проверяет готовность карточек</p><p><strong>Сергей Белов</strong> утверждает портфель, ресурсы и сроки запуска</p></div>
  {sessions.map((s,k)=><article className="session-card" key={s.id} ref={node=>{sessionRefs.current[s.id]=node;}}>
   <div className="session-number" aria-hidden="true">{k+1}</div>
   <div><p className="eyebrow">{s.date}</p><h2>{s.title}</h2>{s.status&&<p className="caption">{s.status}</p>}
    <dl><dt>Подготовка</dt><dd>{s.input}</dd><dt>Задача участников</dt><dd>{s.team}</dd><dt>Результат</dt><dd>{s.output}</dd><dt>Следующий шаг</dt><dd>{s.homework}</dd></dl>
   </div>
  </article>)}
  <section className="section-block session-stage-rules"><h2>Владельцы подтверждают переход между стадиями</h2><div className="table-wrap"><table><thead><tr><th>Стадия</th><th>Готовый результат</th><th>Кто подтверждает</th></tr></thead><tbody>{programme.stages.map(s=><tr key={s.stage}><td>{s.stage} / {s.name}</td><td>{text(s.evidence)}</td><td>{text(s.decision)}</td></tr>)}</tbody></table></div><p className="caption">Первый контроль эффекта проходит через 30 дней после приёмки; владелец показателя и финансы согласуют период окончательного подтверждения</p></section>
  {active&&<section className="section-block" aria-label="Видеоинструкции"><h2>Видео помогают проверить паспорт, расчёт и портфель</h2><div className="tutorial-grid">{[['01-passport','Проверка паспорта','Проверьте карточку и передайте её руководителю'],['02-effects','Расчёт эффекта','Измените показатель и оцените прирост операционной прибыли'],['03-portfolio','Защита портфеля','Сравните состав, ресурсы и приоритеты']].map(([file,title,caption])=><article key={file}><video controls preload="metadata" poster={import.meta.env.BASE_URL+'assets/tutorials/'+file+'.jpg?v=20261009-18'} aria-label={title}><source src={import.meta.env.BASE_URL+'assets/tutorials/'+file+'.mp4?v=20261009-18'} type="video/mp4"/><track kind="subtitles" src={import.meta.env.BASE_URL+'assets/tutorials/'+file+'.vtt?v=20261009-18'} srcLang="ru" label="Русские субтитры"/></video><h3>{title}</h3><p>{caption}</p></article>)}</div></section>}
 </section>;
}

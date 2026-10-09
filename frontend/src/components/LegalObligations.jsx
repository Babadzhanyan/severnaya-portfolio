import React from 'react';
import {display} from '../model/portfolio.js';
import {obligationIndex,obligationStatus,obligationDeadlines,officialLinks} from '../model/legal.js';
export default function LegalObligations({list,onOpen,compact=false}){
 const rows=obligationIndex(list);
 if(!rows.length)return null;
 return <section className="section-block legal-obligations" aria-label="Обязательства и применимые требования">
  <h2>Обязательства и применимые требования / {rows.length}</h2>
  <p className="caption">Юридическая служба подтверждает применимость и состав работ</p>
  <div className="legal-requirement-list">{rows.map(law=><article key={law.id} data-law={law.id} className="legal-requirement">
   <div><h3>{display(law.title)}</h3><p className="caption">{display(law.reference)}</p><div className="legal-official-links">{officialLinks(law).map((item,k)=><a key={k} href={item.url} target="_blank" rel="noopener noreferrer">{display(item.title)||'Открыть нормативный акт'}</a>)}</div>{!compact&&<div className="project-chips">{law.codes.map(code=><button key={code} className="code-button addition" onClick={()=>onOpen(code)}>{code}</button>)}</div>}</div>
   <div className="legal-requirement-status"><strong>{obligationStatus(law)}</strong><p>Работа ИТ: требуется подтверждение</p><p className="caption">{obligationDeadlines(law).length?obligationDeadlines(law).join(' / '):'Владелец уточняет срок проверки'}</p></div>
  </article>)}</div>
 </section>;
}

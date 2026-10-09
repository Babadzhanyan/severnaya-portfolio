import {display,stageCode,isNewIdea,isHistorical} from './portfolio.js';

const ideaFields=[['problem','Предмет идеи'],['scope','Состав анализа'],['initiative_lead','Ответственный за анализ'],['action_due','Срок анализа']];
const compositionFields=[['problem','Задача'],['solution','Решение'],['scope','Основной результат'],['customer','Заказчик / инициатор'],['benefit_owner','Владелец эффекта'],['digital_layer','Уровень трансформации'],['initiative_lead','Ответственный за паспорт']];
const measurementFields=[['metric','Показатель успеха'],['baseline','База показателя'],['baseline_source','Источник базы'],['target','Цель показателя'],['target_date','Дата достижения цели']];
const missing=value=>value===null||value===undefined||display(value).trim()===''||/^(?:Требуется|Уточнить|Ожидается|База ожидается|Цель ожидается)/i.test(display(value));

export function passportCheckLevel(i){
 if(isHistorical(i))return 3;
 const stage=stageCode(i);
 if(stage==='L0'||stage==='Уточнить'&&isNewIdea(i||{}))return 0;
 return ['L2','L3','L4','L5'].includes(stage)?2:1;
}

export function passportGaps(i){
 if(isHistorical(i))return [];
 const level=passportCheckLevel(i),fields=level===0?ideaFields:level===1?compositionFields:[...compositionFields,...measurementFields];
 return fields.filter(([key])=>missing(i?.[key])).map(([,label])=>label);
}

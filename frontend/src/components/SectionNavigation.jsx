import React,{useEffect,useRef,useState} from 'react';
import Icon from './Icon.jsx';
import '../section-navigation.css';

export default function SectionNavigation({items,active,onChange}){
  const ref=useRef(null),[edges,setEdges]=useState({back:false,forward:false});
  const update=()=>{const nav=ref.current;if(nav)setEdges({back:nav.scrollLeft>1,forward:nav.scrollLeft+nav.clientWidth<nav.scrollWidth-1});};
  useEffect(()=>{
    const nav=ref.current;if(!nav)return;
    let alive=true;
    const reveal=()=>{if(!alive)return;const selected=nav.querySelector('.active');if(selected){const n=nav.getBoundingClientRect(),b=selected.getBoundingClientRect();if(b.left<n.left||b.right>n.right)nav.scrollTo({left:Math.max(0,Math.min(nav.scrollWidth-nav.clientWidth,nav.scrollLeft+b.left-n.left-(nav.clientWidth-b.width)/2)),behavior:'auto'});}update();};
    reveal();window.addEventListener('resize',reveal);
    const observer=new ResizeObserver(reveal);observer.observe(nav);
    document.fonts.ready.then(reveal);
    return()=>{alive=false;observer.disconnect();window.removeEventListener('resize',reveal);};
  },[active,items]);
  const move=direction=>{const nav=ref.current;if(nav){nav.scrollBy({left:direction*Math.max(150,nav.clientWidth*.7),behavior:'auto'});update();}};
  return <div className="section-navigation">
    <button className="section-nav-control" type="button" aria-label="Предыдущие разделы" title="Предыдущие разделы" disabled={!edges.back} onClick={()=>move(-1)}>Назад</button>
    <nav ref={ref} className="tabs" aria-label="Разделы портфеля" onScroll={update}>
      {items.map(([id,label])=><button className={active===id?'active':''} aria-current={active===id?'page':undefined} key={id} onClick={()=>onChange(id)}><Icon name={id==='transformation'?'layers':id}/>{label}</button>)}
    </nav>
    <button className="section-nav-control" type="button" aria-label="Следующие разделы" title="Следующие разделы" disabled={!edges.forward} onClick={()=>move(1)}>Далее</button>
  </div>;
}

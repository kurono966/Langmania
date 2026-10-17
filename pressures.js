/* Endogenous feedback: observed language state -> competing pressures -> responses.
   Values and thresholds are game parameters, not empirical linguistic estimates. */
(function(root){
const D=root.DriftData,P=root.DriftPhonology,clamp=x=>Math.max(0,Math.min(1,x));
const definitions=[
 {id:'effort',name:'発音省力化圧力',color:'green',description:'発話負荷と長い語形が高める。縮約・弱化を促し、短縮が進むと下がる。'},
 {id:'clarity',name:'明瞭性維持圧力',color:'blue',description:'新しい同音衝突と語形の揺れが高める。区別化複合と省略の抑制を促す。'},
 {id:'ambiguity',name:'文法的曖昧性',color:'orange',description:'助詞省略、多義化、構文・活用の共存から生じる。語順や標識の再固定を促す。'},
 {id:'standardization',name:'標準化圧力',color:'pink',description:'教育、威信、政策と変異の多さで変わる。独自変異を抑え、接触時の標準形学習を支える。'},
 {id:'contact',name:'他地域・他言語からの接触圧',color:'blue',description:'接続網、交流期間、二言語使用と言語差から生じる。接続がなければ新たな接触圧はゼロ。'}
];
const value=r=>Object.fromEntries(definitions.map(d=>[d.id,r.pressures?.[d.id]||0]));
const key=p=>p.map(x=>x==='I'?'i':x==='U'?'u':x==='ŋ'?'n':x).join('|');
const initialPairs=new Set();
for(let a=0;a<D.lexicon.length;a++)for(let b=a+1;b<D.lexicon.length;b++)if(key(D.lexicon[a].phonemes)===key(D.lexicon[b].phonemes))initialPairs.add(a+':'+b);
function collisions(r){const groups=new Map(),pairs=[];for(const w of r.words.filter(w=>w.active)){const k=key(w.phonemes);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(w);}for(const words of groups.values())for(let a=0;a<words.length;a++)for(let b=a+1;b<words.length;b++){const ids=[words[a].id,words[b].id].sort((a,b)=>a-b);if(!initialPairs.has(ids.join(':')))pairs.push(ids);}return pairs;}
function measure(sim,r){
 const n=r.words.length,colliding=collisions(r),collisionWords=new Set(colliding.flat());let cost=0,initialCost=0,uncertainty=0,polysemy=0,morphology=0;
 for(const w of r.words){const frequency=w.frequency/100,base=D.lexicon[w.id].phonemes.length;cost+=w.phonemes.length*frequency;initialCost+=base*frequency;uncertainty+=1-Math.max(...w.variants.map(v=>v.share));polysemy+=1-Math.max(...w.senses.map(s=>s.share));if(w.morphology)morphology+=4*w.morphology.analogicalShare*(1-w.morphology.analogicalShare);}
 const lengthRatio=cost/Math.max(1,initialCost),g=r.grammar,orderFixed=g.strictOrder||g.stage>=2;
 const caseLoss=(g.particle?0:.2)+(g.object?0:orderFixed?.06:.42);
 const constructionAmbiguity=g.constructions.reduce((sum,c)=>sum+(c.stage===1?.08:c.stage===2?.035:0),0);
 const ambiguity=clamp(caseLoss+collisionWords.size/n*.9+polysemy/n*.5+morphology/n*.2+constructionAmbiguity-(orderFixed?.16:0));
 const contacts=sim.regions.filter(o=>o.id!==r.id).map(o=>{const strength=sim.contactStrength(r,o),difference=1-sim.similarity(r,o)/100;const bilingual=r.groups.reduce((s,g)=>s+g.share*g.bilingual,0);return strength*(.45+Math.min(1,r.contactYears[o.id]/100)*.25+bilingual*.5+difference);});
 const contact=clamp(contacts.reduce((a,b)=>a+b,0));
 const standardization=clamp(r.education*(.65+r.prestige*.25+uncertainty/n*.3)+(r.policies.some(p=>p.id==='standard')?.15:0));
 const effort=clamp((.28+r.contact*.24+r.groups[0].share*.15)*lengthRatio+g.constructions.filter(c=>c.stage===3).length*.015-standardization*.12);
 const clarity=clamp(.05+collisionWords.size/n*3+Math.max(0,1-lengthRatio)*.4+uncertainty/n*.35+ambiguity*.35);
 return {targets:{effort,clarity,ambiguity,standardization,contact},evidence:{collisionPairs:colliding,collisionWords:[...collisionWords],lengthRatio,variantUncertainty:uncertainty/n,polysemy:polysemy/n,caseLoss,constructionAmbiguity,contactChannels:contacts}};
}
function initialize(sim,r){const m=measure(sim,r);r.pressures={...m.targets};r.pressureEvidence=m.evidence;r.pressureState={effortBudget:0,repairBudget:0,grammarBudget:0,lastSound:-30,lastRepair:-25,semanticBridges:[]};r.pressureHistory=[{year:sim.year,...value(r)}];}
function update(sim,r){const m=measure(sim,r);r.pressureEvidence=m.evidence;for(const d of definitions){const old=r.pressures[d.id],target=m.targets[d.id];r.pressures[d.id]=d.id==='contact'&&target===0?0:clamp(old+(target-old)*.28);}r.pressureHistory.push({year:sim.year,...value(r)});}
function causes(sim,r,types,words=[]){return sim.events.filter(e=>e.region===r.id&&types.includes(e.type)&&(!words.length||e.affectedWords.some(id=>words.includes(id)))).slice(-3).map(e=>e.id);}
function chain(sim,r,title,detail,rule,words,parents=[]){return sim.log(r.id,'cascade',title,detail,{rule,affectedWords:words,adoption:r.pressures[rule]||0,causes:parents,pressures:value(r)});}
function respond(sim,r){
 const p=r.pressures,s=r.pressureState,e=r.pressureEvidence;
 // These are accumulated, competing constraints. Spontaneous innovation odds are unchanged.
 s.effortBudget=Math.max(0,s.effortBudget+5*Math.max(0,p.effort-.28)*(1-p.standardization*.65)*(1-p.clarity));
 s.repairBudget=Math.max(0,s.repairBudget+5*Math.max(0,p.clarity-.13));
 s.grammarBudget=Math.max(0,s.grammarBudget+5*Math.max(0,p.ambiguity-.18));
 if(s.effortBudget>=8&&sim.year-s.lastSound>=30&&p.clarity<.65){
  const candidates=['phonemic','loss','simplify','short','voice','initial','devoicedVowel'].map(id=>P.rules.find(rule=>rule.id===id)).filter(rule=>!r.rules.some(x=>x.id===rule.id)&&rule.requires.every(id=>r.rules.some(x=>x.id===id&&x.adoption>.5))&&r.words.some(w=>rule.fn(w.phonemes,w).join('|')!==w.phonemes.join('|')));
  // Prefer the greatest reduction in actual eligible material, with a regional cost.
  const score=rule=>r.words.reduce((sum,w)=>{const next=rule.fn(w.phonemes,w);return sum+(next.join('|')===w.phonemes.join('|')?0:(1+Math.max(0,w.phonemes.length-next.length))*w.frequency/100);},0)*rule.regional[r.id];
  const rule=candidates.sort((a,b)=>score(b)-score(a))[0];if(rule){const affected=r.words.filter(w=>rule.fn(w.phonemes,w).join('|')!==w.phonemes.join('|')).map(w=>w.id),parents=causes(sim,r,['word','grammaticalization','lexicon','policy']);const trigger=chain(sim,r,'省力化圧力が次の音変化を誘発',`長さ比 ${e.lengthRatio.toFixed(2)}・発話負荷から蓄積した圧力が「${rule.name}」を促進。明瞭性・標準化が高いほど蓄積は抑制。`,'effort',affected,parents);sim.startRule(r,rule,'蓄積した発音省力化圧力',null,{causes:[trigger.id],pressureTrigger:'effort'});s.effortBudget=0;s.lastSound=sim.year;}
 }
 // Repair actual NEW collisions only. Inherited Japanese homophones are not treated as a new crisis.
 if(s.repairBudget>=1&&sim.year-s.lastRepair>=25&&e.collisionPairs.length){
  for(const pair of e.collisionPairs){if(pair.some(id=>r.words[id].disambiguator?.share<.8))continue;const w=pair.map(id=>r.words[id]).filter(w=>!w.disambiguator).sort((a,b)=>a.frequency-b.frequency)[0];if(!w)continue;
   const classifier={自然:'木',身体:'人',社会:'人',食物:'米',生物:'人',時間:'日',動作:'言葉',性質:'言葉',指示:'人',数量:'一つ'}[w.category]||'言葉';const suffix=r.words.find(x=>x.meaning===classifier);const proposed=[...w.basePhonemes,...suffix.phonemes];if(!P.safe(proposed,w.basePhonemes)||pair.some(id=>key(r.words[id].phonemes)===key(proposed)))continue;
   const parents=causes(sim,r,['word','sound'],pair),trigger=chain(sim,r,'音の衝突から区別化複合へ',`${pair.map(id=>r.words[id].meaning).join('・')}が同音化。「${w.meaning}」に「${suffix.meaning}」由来の分類語を添える新形が発生。`,'clarity',[w.id],parents);
   w.disambiguator={suffixId:suffix.id,suffixPhonemes:[...suffix.phonemes],share:.08,since:sim.year};sim.log(r.id,'lexicon','同音衝突を避ける新語形',`「${w.meaning}」：${D.hiragana(w.phonemes)} → ${D.hiragana(proposed)}（旧形と共存）。`,{rule:'clarity-compound',affectedWords:[w.id],adoption:.08,causes:[trigger.id],before:[...w.phonemes],after:proposed});s.repairBudget=0;s.lastRepair=sim.year;break;
  }
 }
 for(const w of r.words.filter(w=>w.disambiguator)){const d=w.disambiguator;d.share=clamp(d.share+.025+p.clarity*.07-p.standardization*.015);}
 if(s.grammarBudget>=1.5&&!r.grammar.strictOrder&&p.ambiguity>.2){const g=r.grammar,parents=causes(sim,r,['grammar','semantic','word','analogy','grammaticalization']);const trigger=chain(sim,r,'曖昧性が文法の再固定を誘発','助詞省略・意味や構文の共存で役割の解釈が不安定になり、語順と標識の使用を固定。','ambiguity',[],parents);g.strictOrder=true;if(g.order==='SOV')g.object='を';sim.log(r.id,'grammar','曖昧性を補う固定語順',`${g.order}語順を厳格化し、${g.order==='SOV'?'目的語標識「を」も保持':'語順で主語・目的語を区別'}。曖昧性は次の評価から低下。`,{rule:'ambiguity-repair',affectedWords:[],adoption:1,causes:[trigger.id]});s.grammarBudget=0;}
}
function bridge(sim,r,c,event){
 if(c.stage!==1||r.pressureState.semanticBridges.includes(c.id))return;
 const path=root.DriftGrammar.paths.find(x=>x.id===c.id),w=r.words.find(w=>w.meaning===path.source),target={future:'予定される',perfect:'完了する',possession:'所有関係'}[c.id],edge=w?.semanticRelations.find(e=>e.to===target);if(!edge)return;
 r.pressureState.semanticBridges.push(c.id);if(w.senses.some(s=>s.meaning===target))return;
 w.senses.forEach(s=>s.share*=.8);w.senses.push({meaning:target,share:.2,since:sim.year,original:false,relation:edge.type});w.semanticHistory.push({...edge,year:sim.year});sim.log(r.id,'semantic','文法化から語彙の意味拡張へ',`「${w.meaning}」の反復構文が「${target}」という解釈を生み、次世代の構文使用を支える。`,{rule:edge.type,affectedWords:[w.id],adoption:.2,causes:[event.id],before:w.meaning,after:target});
}
root.DriftPressures={definitions,value,measure,initialize,update,respond,bridge,causes};
})(globalThis);

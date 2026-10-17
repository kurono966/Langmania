/* Segment rules, prosodic parsing and bounded lexical diffusion. No text substitutions. */
(function(root){
const D=root.DriftData,plain=x=>({I:'i',U:'u','ö':'e'}[x]||x),vowel=x=>['a','i','u','e','o','I','U','ö'].includes(x),voiceless=x=>['k','s','sh','t','ts','ch','h','f','p'].includes(x);
function structure(p){
 const morae=[],syllables=[];let pending=[];
 for(let i=0;i<p.length;i++){
  const x=p[i];
  if(vowel(x)){const m={onset:pending.splice(0),nucleus:x,coda:[],phonemes:[]};m.phonemes=[...m.onset,x];morae.push(m);syllables.push({onset:[...m.onset],nucleus:[x],coda:[],moraCount:1});}
  else if((x==='n'||x==='m'||x==='ŋ')&&!vowel(p[i+1])){morae.push({onset:[],nucleus:null,coda:[x],phonemes:[x]});if(syllables.length){syllables.at(-1).coda.push(x);syllables.at(-1).moraCount++;}else pending.push(x);}
  else if(x===p[i+1]||(x==='t'&&['ts','ch'].includes(p[i+1]))){if(!syllables.length){pending.push(x);continue;}morae.push({onset:[],nucleus:null,coda:['Q'],phonemes:[x]});if(syllables.length){syllables.at(-1).coda.push('Q');syllables.at(-1).moraCount++;}}
  else pending.push(x);
 }
 // Adjacent vowel morae form a heavy syllable when their qualities agree.
 for(let i=syllables.length-1;i>0;i--)if(!syllables[i].onset.length&&!syllables[i-1].coda.length&&plain(syllables[i].nucleus[0])===plain(syllables[i-1].nucleus.at(-1))){syllables[i-1].nucleus.push(...syllables[i].nucleus);syllables[i-1].moraCount+=syllables[i].moraCount;syllables.splice(i,1);}
 return {morae,syllables,valid:!pending.length&&syllables.length>0&&syllables.every(s=>s.onset.length<=1&&s.coda.length<=1)};
}
function safe(p,old=p){return p.length&&structure(p).valid&&p.filter(vowel).length>=1&&p.length<=Math.max(old.length+3,18);}
const map=(p,fn)=>p.map((x,i)=>fn(x,i,p)),drop=(p,fn)=>p.filter((x,i)=>!fn(x,i,p));
const definitions=[
 ['voice','母音間の有声化','k,t,s → g,d,z / V_V','contact',.7,.034,[.7,1,1.3],p=>map(p,(x,i)=>vowel(p[i-1])&&vowel(p[i+1])?({k:'g',t:'d',s:'z'}[x]||x):x)],
 ['devoice','語頭の無声化','g,d,z,b → k,t,s,p / #_V','isolation',.28,.023,[1.4,.6,.8],p=>map(p,(x,i)=>!i?({g:'k',d:'t',z:'s',b:'p'}[x]||x):x)],
 ['vowel','語末母音の合流','e → i / _#','isolation',.45,.029,[1.4,.6,1],p=>map(p,(x,i)=>i===p.length-1&&x==='e'?'i':x)],
 ['loss','母音間 h の脱落','h → ∅ / V_V','contact',.65,.035,[1.1,.8,1.2],p=>drop(p,(x,i)=>x==='h'&&vowel(p[i-1])&&vowel(p[i+1]))],
 ['initial','語頭 h の弱化','h → ∅ / #_{i,e}','contact',.4,.028,[1.3,.6,1],p=>p[0]==='h'&&['i','e'].includes(p[1])?p.slice(1):p.slice()],
 ['assimilation','鼻音の同化','n → m / _{b,p,m}','contact',.6,.04,[1,1,1.2],p=>map(p,(x,i)=>x==='n'&&['b','p','m'].includes(p[i+1])?'m':x)],
 ['dissimilation','流音の異化','r → n / r V … _ V（同一語）','isolation',.15,.018,[1.3,.6,.7],p=>map(p,(x,i)=>x==='r'&&p.slice(0,i).includes('r')?'n':x)],
 ['simplify','長母音の短化','VV → V（同質母音）','contact',.4,.025,[1.1,.6,1.3],p=>drop(p,(x,i)=>vowel(x)&&x===p[i-1])],
 ['insert','母音連続の解消','∅ → y / i_{a,u,e,o}','isolation',.25,.021,[1.3,.5,.9],p=>p.flatMap((x,i)=>x==='i'&&vowel(p[i+1])&&p[i+1]!=='i'?[x,'y']:[x])],
 ['short','頻出動詞の縮約','ru → ∅ / V_#（高頻度・長い語のみ）','contact',.25,.02,[1,.5,1.4],(p,w)=>w.frequency>=85&&p.length>=5&&p.slice(-2).join('')==='ru'?p.slice(0,-2):p.slice()],
 ['palatal','摩擦音の合流','s → sh / _i','contact',.4,.03,[1,1,1],p=>map(p,(x,i)=>x==='s'&&p[i+1]==='i'?'sh':x)],
 ['raising','語末母音の上昇','o → u / _#','isolation',.35,.024,[1.4,.5,.9],p=>map(p,(x,i)=>i===p.length-1&&x==='o'?'u':x)],
 ['devoicedVowel','高母音の無声化','i,u → I,U / C[-voice]_C[-voice]（連続無声化を回避）','contact',.85,.045,[.6,1.3,1],p=>{let last=-3;return map(p,(x,i)=>{if(['i','u'].includes(x)&&voiceless(p[i-1])&&voiceless(p[i+1])&&i-last>2){last=i;return x.toUpperCase();}return x;});}],
 ['coda','音節末鼻音の軟口蓋化','n → ŋ / _{k,g}（条件異音）','contact',.5,.035,[1,1,1.2],p=>map(p,(x,i)=>x==='n'&&['k','g'].includes(p[i+1])?'ŋ':x)],
 ['split','母音の条件的前舌化','o → ö / _i（この段階では異音）','isolation',.4,.025,[1.5,.5,.8],p=>map(p,(x,i)=>x==='o'&&p[i+1]==='i'?'ö':x)],
 ['phonemic','条件消失による音韻化','i → ∅ / ö_（前舌化後にのみ発生）','isolation',.35,.023,[1.5,.5,.8],p=>drop(p,(x,i)=>x==='i'&&p[i-1]==='ö')]
];
const rules=definitions.map(([id,name,environment,kind,likelihood,speed,regional,fn])=>({id,name,detail:environment,environment,kind,likelihood,speed,regional,requires:id==='phonemic'?['split']:[],fn:(p,w={frequency:90})=>{const next=fn(p,w);return safe(next,p)?next:p.slice();}}));
// ŋ is a coda realization of /n/, not a newly invented vowel/consonant contrast.
const rawStructure=structure;
function analyze(p){return rawStructure(p);}
const originalKana=D.hiragana;
D.hiragana=p=>{if(!p.some((x,i)=>['I','U','ö','ŋ'].includes(x)||x==='m'&&!vowel(p[i+1])))return originalKana(p);return analyze(p).morae.map(m=>{if(m.coda.length)return {Q:'っ',n:'ん',m:'んᵐ','ŋ':'んᵑ'}[m.coda[0]];let txt=originalKana(m.phonemes.map(plain));if(['I','U'].includes(m.nucleus))txt+='̥';if(m.nucleus==='ö')txt+='̈';return txt;}).join('');};
function inventory(r){
 const forms=r.words.flatMap(w=>w.variants||[{phonemes:w.phonemes,share:1}]).filter(v=>v.share>=.03),sounds=[...new Set(forms.flatMap(v=>v.phonemes))].sort();
 const phonemic=r.rules.some(x=>x.id==='phonemic'&&x.adoption>=.5&&x.status!=='lost')&&forms.some(v=>v.path?.includes('phonemic')&&v.phonemes.includes('ö'));
 const contrast=sounds.map(x=>x==='I'?'i':x==='U'?'u':x==='ŋ'?'n':x==='ö'&&!phonemic?'o':x);
 const mergers={vowel:['e/i','_#'],devoice:['g/k, d/t, z/s, b/p','#_V'],voice:['k/g, t/d, s/z','V_V'],palatal:['s/sh','_i']};
 return {vowels:[...new Set([...D.phonology.vowels,...contrast.filter(vowel)])],consonants:[...new Set([...D.phonology.consonants,...contrast.filter(x=>!vowel(x))])],allophones:sounds.filter(x=>['I','U','ŋ'].includes(x)||x==='ö'&&!phonemic),newContrasts:phonemic?['ö']:[],neutralizations:r.rules.filter(s=>s.adoption>=.65&&s.status!=='lost'&&mergers[s.id]).map(s=>({contrast:mergers[s.id][0],environment:mergers[s.id][1],adoption:s.adoption})),syllable:'(C)V(V)(N/Q)',moraCount:r.words.reduce((s,w)=>s+analyze(w.phonemes).morae.length,0)};
}
function variants(r,w){let forms=[{phonemes:[...w.basePhonemes],share:1,source:w.origin||'継承語',path:[]}];
 for(const loan of w.loans||[]){forms.forEach(v=>v.share*=1-loan.share);forms.push({phonemes:[...loan.phonemes],share:loan.share,source:loan.source,path:[]});}
 if(w.disambiguator&&!w.renewal){const d=w.disambiguator,extra=forms.map(v=>({...v,phonemes:[...v.phonemes,...d.suffixPhonemes],share:v.share*d.share,source:'同音衝突による区別化複合'}));forms.forEach(v=>v.share*=1-d.share);forms.push(...extra);}
 if(root.DriftCycles)forms=root.DriftCycles.augment(r,w,forms);
 for(const state of r.rules.filter(s=>s.status!=='lost')){const rule=rules.find(x=>x.id===state.id);let next=[];let lexical=(.75+w.frequency/200)*(w.loans?.length ? .82 : 1);const adoption=Math.max(0,Math.min(1,(state.adoption-.025)*lexical));for(const v of forms){const p=rule.fn(v.phonemes,w);if(p.join('|')===v.phonemes.join('|'))next.push(v);else{next.push({...v,share:v.share*(1-adoption)});next.push({...v,phonemes:p,share:v.share*adoption,path:[...v.path,rule.id]});}}
 const merged=new Map();for(const v of next){let key=v.phonemes.join('|');if(merged.has(key))merged.get(key).share+=v.share;else merged.set(key,v);}forms=[...merged.values()].filter(v=>v.share>.0001).sort((a,b)=>b.share-a.share).slice(0,8);const sum=forms.reduce((s,v)=>s+v.share,0);forms.forEach(v=>v.share/=sum);
 }return forms.sort((a,b)=>b.share-a.share);
}
root.DriftPhonology={rules,vowel,plain,analyze,safe:(p,old)=>safe(p.map(x=>x==='ŋ'?'n':x),old),inventory,variants};
})(globalThis);

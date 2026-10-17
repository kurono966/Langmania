import test from 'node:test';
import assert from 'node:assert/strict';
import '../data.js';
import '../phonology.js';
import '../lexicon.js';
import '../grammar.js';
import '../pressures.js';
import '../simulation.js';
const {Simulation,rules}=Drift,P=DriftPhonology,D=DriftData;
const state=(id,adoption=.5)=>({id,adoption,status:'spreading',cohorts:[adoption,adoption,adoption],prestige:.8,since:0,milestone:0,established:false,cause:'test'});
test('phonological rules have environments, rates, regional factors and bounded outputs',()=>{
 for(const rule of rules){assert.ok(rule.environment&&rule.likelihood>0&&rule.speed>0);assert.equal(rule.regional.length,3);for(const w of D.lexicon){const p=rule.fn(w.phonemes,w);assert.ok(P.analyze(p).valid,`${rule.id}: ${w.meaning}`);assert.ok(p.some(P.vowel));}}
 assert.deepEqual(rules.find(r=>r.id==='initial').fn(['h','i']),['i']);
 assert.deepEqual(rules.find(r=>r.id==='loss').fn(['h','a']),['h','a']);
 assert.deepEqual(rules.find(r=>r.id==='coda').fn(D.tokenize('tenki')),['t','e','ŋ','k','i']);
 assert.equal(D.hiragana(rules.find(r=>r.id==='assimilation').fn(D.tokenize('shinbun'))),'しんᵐぶん');
});
test('high-vowel devoicing retains morae and does not invent a phonemic contrast',()=>{
 const s=new Simulation('allophone'),r=s.regions[0],w=r.words.find(w=>w.meaning==='聞く');r.rules=[state('devoicedVowel',.99)];s.refresh(r);
 assert.ok(w.phonemes.includes('I'));assert.equal(P.analyze(w.phonemes).morae.length,P.analyze(w.basePhonemes).morae.length);
 assert.ok(r.phonology.allophones.includes('I'));assert.ok(!r.phonology.vowels.includes('I'));
});
test('new contrast requires prior split and the loss of its conditioning environment',()=>{
 const s=new Simulation('contrast'),r=s.regions[0];assert.equal(s.startRule(r,rules.find(x=>x.id==='phonemic')),false);
 r.rules=[state('split',.99)];s.refresh(r);assert.ok(r.phonology.allophones.includes('ö'));assert.ok(!r.phonology.newContrasts.includes('ö'));
 assert.equal(s.startRule(r,rules.find(x=>x.id==='phonemic')),true);r.rules[1].adoption=.99;s.refresh(r);
 assert.ok(r.phonology.newContrasts.includes('ö'));assert.ok(r.words.some(w=>w.phonemes.includes('ö')&&!w.phonemes.some((x,i)=>x==='i'&&w.phonemes[i-1]==='ö')));
});
test('old/new forms coexist; frequency changes diffusion without arbitrary segments',()=>{
 const s=new Simulation('diffusion'),r=s.regions[0],w=r.words.find(w=>w.meaning==='魚');r.rules=[state('voice',.4)];s.refresh(r);
 assert.equal(w.variants.length,2);assert.ok(w.variants.every(v=>['sakana','sagana'].includes(v.phonemes.join(''))));
 const high=P.variants(r,{...w,frequency:100}),low=P.variants(r,{...w,frequency:20});
 assert.ok(high.find(v=>v.phonemes.join('')==='sagana').share>low.find(v=>v.phonemes.join('')==='sagana').share);
 assert.ok(Math.abs(w.variants.reduce((sum,v)=>sum+v.share,0)-1)<1e-10);
});
test('unsupported innovations can disappear under standardization',()=>{
 const s=new Simulation('failure'),r=s.regions[1];r.education=1;r.groupNetwork=r.groupNetwork.map(row=>row.map(()=>0));const x=state('voice',.08);x.prestige=0;r.rules=[x];for(let i=0;i<40;i++){s.year+=5;s.spread(r);}assert.equal(x.status,'lost');assert.equal(x.adoption,0);assert.ok(s.events.some(e=>e.type==='loss'));
});
test('zero contact or a missing network edge prevents all interregional transmission',()=>{
 for(const mode of ['contact','edge']){const s=new Simulation(mode),r=s.regions[0],other=s.regions[1];r.isolation=0;other.isolation=0;if(mode==='contact')r.contact=0;else s.links[0]=[0,0,0];other.rules=[state('voice',.9)];other.words[40].phonemes=D.tokenize('sagana');r.policies.push({id:'standard',remaining:30});s.random=()=>0;for(let i=0;i<30;i++)s.contact(r);assert.equal(r.rules.length,0);assert.equal(r.words.flatMap(w=>w.loans).length,0);assert.equal(r.codeSwitches.length,0);assert.equal(r.grammar.contactEvidence,0);assert.equal(s.events.length,0);}
});
test('sustained contact produces bilingual use and adapted, coexisting loans',()=>{
 const s=new Simulation('contact'),r=s.regions[0],other=s.regions[1];r.contact=other.contact=1;r.isolation=other.isolation=0;s.links[0]=[0,1,0];other.words[40].phonemes=D.tokenize('sagana');s.random=()=>0;s.contact(r);s.refresh(r);
 assert.ok(r.groups[0].bilingual>0);assert.equal(r.codeSwitches.length,1);assert.equal(r.words[40].loans.length,1);assert.ok(r.words[40].variants.length>1);assert.ok(s.events.some(e=>e.type==='borrow'&&e.sourceRegion===1));
 assert.deepEqual(s.adaptLoan(r,['k','I','k','U']),['k','i','k','u']);
});
test('analogy spreads to lower-frequency paradigms while frequent irregulars persist',()=>{
 const s=new Simulation('analogy'),r=s.regions[0],low=r.words.find(w=>w.meaning==='歩く'),high=r.words.find(w=>w.meaning==='行く');low.frequency=25;high.frequency=100;
 for(let i=0;i<20;i++){s.year+=25;DriftGrammar.analogy(s,r);}assert.ok(low.morphology.analogicalShare>.5);assert.ok(high.morphology.analogicalShare<.1);assert.notDeepEqual(low.morphology.past,low.morphology.inherited);assert.deepEqual(high.morphology.past,high.morphology.inherited);
});
test('grammaticalization depends on construction use and advances one stage at a time',()=>{
 const s=new Simulation('construction'),r=s.regions[0],go=r.words.find(w=>w.meaning==='行く');go.frequency=0;const future=r.grammar.constructions[0];DriftGrammar.evolve(s,r);assert.equal(future.uses,0);assert.equal(future.stage,0);
 go.frequency=100;r.contact=1;future.uses=5000;DriftGrammar.evolve(s,r);assert.equal(future.stage,1);assert.equal(future.form,'ていく');assert.ok(s.events.some(e=>e.rule==='future'&&e.affectedWords.includes(go.id)));
});
test('semantic expansion follows explicit relations and supports polysemy and sense loss',()=>{
 const s=new Simulation('meaning'),r=s.regions[0],head=r.words.find(w=>w.meaning==='頭');for(const w of r.words)if(w!==head)w.semanticRelations=[];s.random=()=>0;
 DriftLexicon.evolve(s,r);assert.ok(head.senses.some(x=>x.meaning==='先端'));DriftLexicon.evolve(s,r);assert.ok(head.senses.some(x=>x.meaning==='指導者'));assert.equal(head.senses.length,3);
 const boat=r.words.find(w=>w.meaning==='船');boat.senses=[{meaning:'船',share:.1,original:true,since:0},{meaning:'大型船',share:.9,original:false,since:0,relation:'narrowing'}];s.year=150;s.random=()=>1;DriftLexicon.evolve(s,r);assert.equal(boat.senses.length,1);assert.equal(boat.senses[0].meaning,'大型船');assert.ok(boat.active);
});
test('long runs retain valid prosody, normalized distributions and consistent grammar',()=>{
 for(const seed of ['natural-1','natural-2','natural-3','natural-4']){const s=new Simulation(seed);for(let i=0;i<20;i++){s.advance(25);for(const r of s.regions){assert.ok(r.grammar.order==='SOV'?r.grammar.object==='を':r.grammar.order==='SVO'&&r.grammar.object==='');assert.ok(Math.abs(r.groups.reduce((sum,g)=>sum+g.share,0)-1)<1e-9);for(const w of [...r.words,...r.neologisms]){assert.ok(w.active&&w.phonemes.some(P.vowel));assert.ok(P.analyze(w.phonemes).valid);assert.ok(Math.abs(w.variants.reduce((sum,v)=>sum+v.share,0)-1)<1e-9);assert.ok(Math.abs(w.senses.reduce((sum,v)=>sum+v.share,0)-1)<1e-9);for(const v of w.variants)assert.ok(P.analyze(v.phonemes).valid);}}}assert.equal(s.regions[0].systemHistory.length,21);}
});
test('per-word histories resolve to structured, reproducible events',()=>{
 const s=new Simulation('trace');s.advance(500);for(const r of s.regions)for(const w of r.words){const trace=s.trace(r.id,w.id);for(const e of trace.events){assert.ok(e.affectedWords.includes(w.id));assert.equal(e.region,r.id);assert.ok(e.rule&&e.social&&Number.isFinite(e.adoption));assert.ok(e.year>=0&&e.year<=500);}}assert.ok(s.events.some(e=>e.type==='word'&&Array.isArray(e.before)&&Array.isArray(e.after)));
});
test('linguistic forms do not change every year between evaluation intervals',()=>{
 const s=new Simulation('annual'),before=s.regions.map(r=>r.words.map(w=>[...w.phonemes]));s.advance(4);assert.deepEqual(s.regions.map(r=>r.words.map(w=>w.phonemes)),before);assert.ok(s.regions.every(r=>r.rules.length===0));
});
test('an isolated region is unaffected by random draws or interventions elsewhere',()=>{
 const a=new Simulation('causality'),b=new Simulation('causality');for(const s of [a,b])for(let i=0;i<3;i++)s.links[0][i]=s.links[i][0]=0;
 b.intervene('education',1);a.advance(500);b.advance(500);
 const linguistic=r=>({rules:r.rules,grammar:r.grammar,words:r.words.map(w=>({phonemes:w.phonemes,variants:w.variants,senses:w.senses,morphology:w.morphology})),population:r.population});
 assert.deepEqual(linguistic(a.regions[0]),linguistic(b.regions[0]));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import '../data.js';
import '../phonology.js';
import '../lexicon.js';
import '../grammar.js';
import '../cycles.js';
import '../grammar-cycles.js';
import '../pressures.js';
import '../simulation.js';
const C=DriftCycles,G=DriftGrammarCycles,D=DriftData,P=DriftPhonology;
const fixture=()=>{const sim=new Drift.Simulation('renewal'),r=sim.regions[0];return{sim,r};};
function collide(sim,r){const fish=r.words[40],river=r.words[3];for(const w of [fish,river]){w.phonemes=['k','a'];w.variants=[{phonemes:['k','a'],share:1,path:[],source:'短縮'}];}fish.frequency=75;river.frequency=95;sim.log(r.id,'word','条件付き縮約','kana / kara → ka',{rule:'fixture-reduction',affectedWords:[40,3],adoption:1,before:['k','a','n','a'],after:['k','a']});sim.random=()=>0;return fish;}
test('per-word, regional and grammatical assessments include both functional pressures',()=>{
 const {sim,r}=fixture();C.assess(r);for(const w of C.all(r)){for(const key of ['pronunciationCost','length','homophones','nearForms','ambiguity','informationLoss','identifiability','economy','distinctiveness'])assert.ok(Number.isFinite(w.functionalMetrics[key]),key);}
 for(const key of ['economy','distinctiveness'])assert.ok(r.competition[key]>=0&&r.competition[key]<=1);assert.ok(r.grammar.functionalMetrics.cost>0);assert.equal(r.grammar.functionalMetrics.informationLoss,0);assert.equal(r.languageHistory[0].affixCount,2);
});
test('new near forms raise ambiguity before they become exact homophones',()=>{
 const {r}=fixture();r.words[1].phonemes=D.tokenize('misana');r.words[15].phonemes=D.tokenize('mizana');const m=C.assess(r);assert.ok(m.newConflicts.some(p=>p.ids.includes(1)&&p.ids.includes(15)&&!p.exact));assert.ok(r.words[1].functionalMetrics.nearForms>0);assert.ok(r.words[1].functionalMetrics.identifiability<1);
});
test('shortening -> collision -> semantic compound -> reuse -> re-contraction',()=>{
 const {sim,r}=fixture(),fish=collide(sim,r);sim.year=100;assert.ok(C.repairLexicon(sim,r));assert.equal(fish.renewal.current.join(''),'umika');assert.ok(fish.renewal.components.some(c=>c.meaning==='海'));assert.ok(sim.trace(0,40).events.some(e=>e.direction==='lengthening'));
 r.competition.economy=.9;for(let i=0;i<75;i++){sim.year+=5;C.evolveWord(sim,r,fish);sim.refresh(r);}assert.equal(fish.renewal.current.join(''),'mia');assert.ok(fish.renewal.usedReductions.includes('initial-vowel'));assert.ok(fish.renewal.usedReductions.includes('intervocalic-lenition'));assert.ok(fish.phonemes.some(P.vowel));
 const events=sim.trace(0,40).events;assert.ok(events.some(e=>e.type==='lexicalization'));assert.ok(events.some(e=>e.type==='contraction'&&e.causes.length));assert.ok(events.filter(e=>e.type==='contraction').every(e=>e.after.length<e.before.length));
});
test('umi-sakana can fuse and shorten regularly to umisana, misana, misa',()=>{
 let p=D.tokenize('umisakana'),used=[];const forms=[];for(let i=0;i<3;i++){const next=C.reduce(p,used);assert.ok(next);used.push(next.rule.id);p=next.phonemes;forms.push(p.join(''));assert.ok(P.safe(p));}assert.deepEqual(forms,['umisana','misana','misa']);assert.equal(C.reduce(['k','a']),null);
});
test('repair alternatives are semantic and borrowing requires an actual connection',()=>{
 const {sim,r}=fixture(),fish=collide(sim,r),conflict={ids:[40,3],exact:true};const w=DriftLexicon.initialize({id:90,meaning:'海魚',phonemes:D.tokenize('umisakana'),frequency:60,pos:'noun',category:'生物',semanticRelations:[]});w.covers='魚';r.neologisms.push(w);sim.regions[1].words[40].phonemes=D.tokenize('sana');let candidates=C.buildCandidates(sim,r,fish,conflict);assert.ok(candidates.some(c=>c.kind==='compound'));assert.ok(candidates.some(c=>c.kind==='suffix'));assert.ok(candidates.some(c=>c.kind==='replacement'));assert.ok(candidates.some(c=>c.kind==='loan'));
 sim.links[0]=[0,0,0];candidates=C.buildCandidates(sim,r,fish,conflict);assert.ok(candidates.every(c=>c.kind!=='loan'));const boat=r.words.find(w=>w.meaning==='船');assert.ok(C.buildCandidates(sim,r,boat,{ids:[boat.id,40]}).some(c=>c.kind==='modifier'));
});
test('the same missing case information can select different regional solutions',()=>{
 const sim=new Drift.Simulation('regional');sim.random=()=>.5;sim.regions[2].groups.forEach(g=>g.bilingual=1);const kinds=[];for(const r of sim.regions){const ch=r.grammar.channels.object;ch.form=[];ch.phase='lost';assert.ok(G.compensate(sim,r,ch));kinds.push(ch.strategy);assert.ok(ch.form.length||r.grammar.strictOrder||r.grammar.agreement);}
 assert.deepEqual(kinds,['particle','order','agreement']);assert.ok(sim.events.some(e=>e.rule==='grammatical-renewal'&&e.direction==='lengthening'));
});
test('actual regional sound changes reach grammatical signals',()=>{
 const {sim,r}=fixture();sim.startRule(r,P.rules.find(x=>x.id==='voice'));r.rules[0].adoption=.99;sim.year=5;G.tickChannel(sim,r,r.grammar.channels.past);assert.equal(r.grammar.channels.past.form.join(''),'da');assert.ok(sim.events.some(e=>e.rule==='marker-sound-change'));
});
test('compensation lowers the existing ambiguity pressure as information is recovered',()=>{
 const {sim,r}=fixture(),g=r.grammar;g.particle='';g.object='';for(const id of ['subject','object']){g.channels[id].form=[];g.channels[id].phase='lost';}const before=DriftPressures.measure(sim,r).targets.ambiguity;
 g.agreement={share:.5,form:['w','a'],phase:'independent'};g.channels.subject.strategy=g.channels.object.strategy='agreement';const partial=DriftPressures.measure(sim,r).targets.ambiguity;g.agreement.share=1;const after=DriftPressures.measure(sim,r).targets.ambiguity;assert.ok(before>partial&&partial>after);assert.ok(after<.1);
});
test('tense can erode, acquire a time adverb, bind, disappear and renew again',()=>{
 const {sim,r}=fixture(),ch=r.grammar.channels.past;ch.form=[];ch.phase='lost';assert.ok(G.compensate(sim,r,ch));assert.equal(ch.phase,'independent');assert.ok(ch.form.length>2);assert.equal(ch.cycle,1);r.competition={economy:.95,distinctiveness:.02};
 for(let i=0;i<100;i++){sim.year+=5;G.tickChannel(sim,r,ch);}assert.ok(ch.cycle>=2);assert.ok(ch.sourceHistory.length>=2);assert.ok(sim.events.some(e=>e.rule==='renewal-grammaticalization'));assert.ok(sim.events.some(e=>e.rule==='marker-erosion'&&e.after.length===0));assert.ok(ch.form.length||ch.repair);
});
test('negative reinforcement is two exponents of one negative meaning, then one new marker',()=>{
 const {sim,r}=fixture(),ch=r.grammar.channels.negative;ch.form=['e'];assert.ok(G.compensate(sim,r,ch));assert.deepEqual(ch.oldForm,['e']);assert.ok(ch.form.length>1);ch.usage=19;sim.year=5;G.tickChannel(sim,r,ch);assert.equal(ch.stage,1);let tokens=G.sentence(r,'negative');assert.ok(tokens.some(t=>t.role==='negative'));assert.ok(tokens.some(t=>t.role==='old-negative'));
 ch.usage=54;sim.year+=5;G.tickChannel(sim,r,ch);assert.equal(ch.stage,2);assert.equal(ch.oldForm,null);tokens=G.sentence(r,'negative');assert.ok(tokens.some(t=>t.role==='negative'));assert.ok(!tokens.some(t=>t.role==='old-negative'));assert.ok(sim.events.some(e=>e.rule==='negative-cycle-loss'));
});
test('initial Japanese examples and later constructions use real channel state',()=>{
 const {r}=fixture();const text=mode=>G.sentence(r,mode).map(t=>(t.bind?'':' ')+(t.label||D.hiragana(t.phonemes))).join('').trim();assert.equal(text('present'),'わたしが さかなを みる');assert.equal(text('past'),'わたしが さかなを みた');assert.equal(text('negative'),'わたしが さかなを みない');assert.ok(text('future').includes('あした'));assert.ok(text('perfect').includes('しまう'));
});
test('construction activation preserves kana-derived grammatical forms and future renewal',()=>{
 const {sim,r}=fixture(),c=r.grammar.constructions.find(c=>c.id==='future'),ch=r.grammar.channels.future;c.stage=1;c.form='ていく';G.tickChannel(sim,r,ch);assert.equal(ch.form.join(''),'teiku');c.stage=3;c.form='く';G.tickChannel(sim,r,ch);assert.equal(ch.phase,'affix');assert.equal(ch.form.join(''),'ku');assert.ok(c.cycling);
 ch.form=[];ch.phase='lost';sim.year=10;G.tickChannel(sim,r,ch);assert.ok(ch.form.length);const renewed=[...ch.form];DriftGrammar.evolve(sim,r);assert.deepEqual(ch.form,renewed);assert.ok(ch.cycle>=1);
});
test('reinforcing a subject can produce a replacement subject pronoun',()=>{
 const {sim,r}=fixture();r.pressures.ambiguity=.5;r.grammar.agreement={form:['w','a'],share:.7,usage:20,phase:'independent'};G.tick(sim,r);const w=r.words[68];assert.equal(w.renewal.kind,'reflexive');r.competition.economy=.2;for(let i=0;i<20;i++){sim.year+=5;C.evolveWord(sim,r,w);}assert.equal(w.renewal.stage,2);assert.equal(w.renewal.current.join(''),'zibun');assert.ok(sim.events.some(e=>e.rule==='pronoun-renewal'));
});
test('no extra material appears without need, and non-frequent phrases do not contract',()=>{
 const {sim,r}=fixture();assert.equal(C.repairLexicon(sim,r),false);const w=r.words[40];w.renewal={current:D.tokenize('umisakana'),components:[{id:4},{id:40}],previous:null,share:.1,contractionAdoption:1,usage:0,stage:0,since:0,lastReduction:0,usedReductions:[],cycle:1};w.frequency=0;r.competition.economy=1;for(let i=0;i<50;i++){sim.year+=5;C.evolveWord(sim,r,w);}assert.deepEqual(w.renewal.current,D.tokenize('umisakana'));assert.equal(w.renewal.stage,0);
});
test('all requested historical statistics are recorded and length goes in both directions',()=>{
 const sim=new Drift.Simulation('DRIFT-2026');sim.advance(500);for(const r of sim.regions){assert.equal(r.languageHistory.length,101);for(const row of r.languageHistory)for(const key of ['meanWordLength','meanSentenceLength','morphemeCount','homophoneCount','ambiguity','affixCount'])assert.ok(Number.isFinite(row[key])&&row[key]>=0,key);const lengths=r.languageHistory.map(h=>h.meanWordLength);assert.ok(lengths.some((x,i)=>i&&x>lengths[i-1]+.001));assert.ok(lengths.some((x,i)=>i&&x<lengths[i-1]-.001));assert.ok(r.neologisms.length>0);for(const w of C.all(r)){assert.ok(P.safe(w.phonemes));assert.ok(Math.abs(w.variants.reduce((s,v)=>s+v.share,0)-1)<1e-8);}}
 const lengthenings=sim.events.filter(e=>e.direction==='lengthening'),shortenings=sim.events.filter(e=>e.direction==='shortening');assert.ok(lengthenings.length&&shortenings.length);assert.ok(sim.events.some(e=>e.type==='contraction'));assert.ok(sim.events.some(e=>e.rule==='negative-cycle-loss'));assert.ok(sim.events.some(e=>e.channel==='future'&&e.rule==='grammatical-renewal'));
});

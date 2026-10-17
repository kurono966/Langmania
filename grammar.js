(function(root){
const D=root.DriftData;
const paradigms={持つ:['godan','motta','mochita'],終わる:['godan','owatta','owarita'],しまう:['godan','shimatta','shimaita'],行く:['godan','itta','ikita'],来る:['irregular','kita','kuruta'],見る:['ichidan','mita','mita'],聞く:['godan','kiita','kikita'],食べる:['ichidan','tabeta','tabeta'],飲む:['godan','nonda','nomita'],話す:['godan','hanashita','hanashita'],歩く:['godan','aruita','arukita'],眠る:['godan','nemutta','nemurita'],書く:['godan','kaita','kakita']};
const paths=[
 {id:'future',name:'移動から未来へ',source:'行く',context:'目的を持つ移動 → 予定された行為',forms:['て いく','ていく','てく','く'],stages:['移動の連続構文','予定・未来の推論','未来の補助表現','未来接辞'],min:140},
 {id:'perfect',name:'片付けから完了へ',source:'しまう',context:'行為後に片付ける → 行為の完了',forms:['て しまう','てしまう','てしまう','ちゃう'],stages:['独立した動作','完了の含意','完了補助動詞','融合した完了標識'],min:150},
 {id:'possession',name:'所有から連体標識へ',source:'持つ',context:'Xが持つY → Xに属するY',forms:['が もつ','がもつ','もつ','も'],stages:['所有の関係節','所有関係の標示','所有連結辞','所有接辞'],min:165}
];
function initialize(words){for(const w of words)if(paradigms[w.meaning]){const [klass,past,regular]=paradigms[w.meaning];w.morphology={klass,past:D.tokenize(past),inherited:D.tokenize(past),regular:D.tokenize(regular),analogicalShare:0};}return {order:'SOV',particle:'が',object:'を',past:'た',stage:0,progress:0,constructions:paths.map(p=>({id:p.id,stage:0,uses:0,share:0,form:p.forms[0]})),contactEvidence:0,postposedUses:0,particleOmission:0};}
function analogy(sim,r){
 const productive=r.words.filter(w=>w.morphology&&w.morphology.klass==='godan');const typeSupport=productive.length/r.words.filter(w=>w.morphology).length;
 for(const w of r.words.filter(w=>w.morphology)){const m=w.morphology;if(m.inherited.join('')===m.regular.join(''))continue;
 const old=m.analogicalShare;const protection=(1-w.frequency/105)**2;
 m.analogicalShare=Math.min(.95,m.analogicalShare+typeSupport*protection*(1-r.education*.5)*.28);
 if(old<.05&&m.analogicalShare>=.05)sim.log(r.id,'analogy','類推形の出現',`「${w.meaning}」で${D.hiragana(m.regular)}が現れ、継承形${D.hiragana(m.inherited)}と共存。`,{rule:'godan-i-ta',affectedWords:[w.id],adoption:m.analogicalShare,before:D.hiragana(m.inherited),after:D.hiragana(m.regular)});
 if(old<.5&&m.analogicalShare>=.5){m.past=[...m.regular];sim.log(r.id,'analogy','過去形の類推平準化',`「${w.meaning}」：${D.hiragana(m.inherited)} → ${D.hiragana(m.regular)}。子音語幹＋i-ta の型が拡張。高頻度語ほど旧形が保護されます。`,{rule:'godan-i-ta',affectedWords:[w.id],adoption:m.analogicalShare,before:D.hiragana(m.inherited),after:D.hiragana(m.regular)});}
 }
}
function evolve(sim,r){const g=r.grammar;
 for(const c of g.constructions){const path=paths.find(p=>p.id===c.id);const source=r.words.find(w=>w.meaning===path.source);const lexicalFrequency=source?source.frequency/100:.65;
 const usage=lexicalFrequency*(c.id==='future'?(.35+r.contact*.9):c.id==='perfect'?(.45+r.influence*.75):(.3+r.contact*.7));
 c.uses+=25*usage;c.share=Math.min(1,c.uses/(path.min*2));const target=Math.min(3,Math.floor(c.uses/path.min));if(target>c.stage){c.stage++;c.form=path.forms[c.stage];sim.log(r.id,'grammaticalization',path.name,`${path.context}。${path.stages[c.stage-1]} → ${path.stages[c.stage]}：${c.form}。累積構文使用量 ${c.uses.toFixed(0)}。`,{rule:c.id,affectedWords:source?[source.id]:[],adoption:c.share,before:path.forms[c.stage-1],after:c.form});}
 }
 // Omission grows in locally predictable conversation. Object marking stays until a
 // contact-supported, fixed alternative order can disambiguate grammatical roles.
 g.particleOmission=Math.min(1,g.particleOmission+(.02+.035*r.contact)*(1-r.education));
 if(g.particleOmission>.45&&g.stage===0){g.particle='';g.stage=1;sim.log(r.id,'grammar','主語助詞の任意省略が一般化','高頻度の対話で主語が予測可能になり「が」を省略。SOVと目的語標識「を」を維持。',{rule:'subject-omission',adoption:g.particleOmission});}
 if(g.stage===1&&g.contactEvidence>1.2){g.stage=2;g.order='SVO';g.object='';sim.log(r.id,'grammar','接触による語順の固定','二言語会話の後置目的語構文の反復、または接触先の固定語順の受容によりSVOが固定化。役割を語順で区別できるため、目的語助詞を省略。',{rule:'contact-order',adoption:Math.min(1,g.contactEvidence/2)});}
 g.progress=g.constructions.reduce((s,c)=>s+c.stage,0)/3;
 analogy(sim,r);
}
function pastForm(r,w){const m=w.morphology;if(!m)return[];let p=[...m.past];for(const state of r.rules.filter(x=>x.adoption>.5&&x.status!=='lost'))p=root.DriftPhonology.rules.find(rule=>rule.id===state.id).fn(p,w);return p;}
function example(r,c){const path=paths.find(p=>p.id===c.id),eat=r.words.find(w=>w.meaning==='食べる');const stem=D.hiragana(eat.phonemes.slice(0,-2));if(c.id==='possession')return `わたし${c.form} ふね`;return stem+c.form;}
root.DriftGrammar={initialize,evolve,analogy,pastForm,paths,example};
})(globalThis);

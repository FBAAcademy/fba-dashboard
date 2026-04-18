const https = require('https');

const PRICES = {
  'Full course': {FA:3500000,MA:3500000,BT:3500000,LW:3500000,PM:4500000,TX:4500000,FR:4500000,AA:4500000,FM:4500000,SBL:7500000,SBR:7500000,AFM:7500000,APM:7500000,ATX:7500000,AAA:7500000,DipIFR:7000000,PreDipIFR:4000000,PreMSFO:5000000,MSFO:5000000,default:3500000},
  'Video Lesson':{FA:1750000,MA:1750000,BT:1000000,PM:2250000,TX:2250000,FR:2250000,AA:2250000,FM:2250000,DipIFR:2500000,MSFO:2500000,default:1750000},
  'Revision':{FA:1100000,MA:1000000,BT:1000000,PM:2000000,TX:2000000,FR:2000000,AA:2000000,FM:3500000,SBL:3000000,default:1500000},
  'default':{default:3500000}
};

function getPrice(product, productType) {
  const pt = PRICES[productType] || PRICES['default'];
  return pt[product] || pt['default'] || 3500000;
}

function calcFinancials(snap) {
  const s = snap.summary || {};
  const subjects = snap.subjects || [];
  const stopped = s.stopped || 0;
  const avgPrice = 3800000;
  const lostRevenue = stopped * avgPrice;
  const noExam = s.no_exam || 0;
  const noExamLost = noExam * 1500000;
  const converted = s.converted || 0;
  const notConverted = Math.max(0, (s.yakunlagan || 0) - converted);
  const convGain = Math.round(notConverted * 0.15 * avgPrice);
  const subjectLoss = subjects.map(sub => ({
    product: sub.Product,
    stopped: sub.stopped,
    price: getPrice(sub.Product, 'Full course'),
    loss: sub.stopped * getPrice(sub.Product, 'Full course')
  })).sort((a,b) => b.loss - a.loss).slice(0,6);
  return { lostRevenue, noExamLost, convGain, subjectLoss,
    totalPotential: Math.round(lostRevenue*0.15) + Math.round(noExamLost*0.3) + convGain };
}

function httpsPost(hostname, path, data, headers) {
  return new Promise((resolve, reject) => {
    const options = {hostname, path, method:'POST', headers:{...headers,'Content-Length':Buffer.byteLength(data)}};
    const req = https.request(options, (res) => {
      let body=''; res.on('data',c=>body+=c); res.on('end',()=>resolve({status:res.statusCode,body}));
    });
    req.on('error', reject); req.write(data); req.end();
  });
}

function buildPrompt(snap, section) {
  const s = snap.summary || {};
  const teachers = (snap.teachers || []).slice(0,15);
  const subjects = snap.subjects || [];
  const dr = snap.dropout_reasons || {};
  const dp = snap.dropout_period || {};
  const yearly = snap.yearly || {};
  const op_stats = snap.operator_stats || [];
  const sales = snap.sales || {};
  const mkt = snap.marketing || {};
  const fin = calcFinancials(snap);

  const base = `Siz FBA Academy (ACCA preparatory courses in Tashkent, Uzbekistan) uchun professional analytics consultant sifatida mustaqil tahlil qiling.

MUHIM: Javobni IKKI TILDA bering — avval O'ZBEK tilida, keyin INGLIZ tilida.
Har bo'lim uchun: ### [Bo'lim nomi / Section Name] formatida yozing.

ASOSIY KO'RSATKICHLAR / KEY METRICS:
| Ko'rsatkich | Qiymat | Benchmark |
|---|---|---|
| Jami o'quvchilar | ${(s.jami||0).toLocaleString()} | - |
| Retention | ${s.retention_pct||0}% | 65-75% (ACCA industry) |
| Pass rate | ${s.pass_rate_pct||0}% | 55-65% (ACCA global) |
| Exam entry | ${s.exam_entry_pct||0}% | 70-80% (ideal) |
| Dropout rate | ${s.jami>0?Math.round((s.stopped||0)/s.jami*100):0}% | <30% (ideal) |
| No Exam | ${(s.no_exam||0).toLocaleString()} ta | <20% of finished |
| Converted (2+ kurs) | ${(s.converted||0).toLocaleString()} ta | >40% (ideal) |

YILLIK DINAMIKA / YEARLY TREND:
${Object.entries(yearly).map(([y,d])=>`${y}: ${d.jami} o'quvchi, Ret=${d.retention}%, Pass=${d.pass_rate}%`).join('\n')}

MOLIYAVIY KO'RSATKICHLAR / FINANCIAL METRICS:
| Yo'qotish turi | Summa |
|---|---|
| Stopped o'quvchilar yo'qotishi | ${(fin.lostRevenue/1e9).toFixed(2)} mlrd so'm |
| No Exam — yo'qotilgan Revision daromadi | ${(fin.noExamLost/1e6).toFixed(0)} mln so'm |
| Potensial LTV o'sishi (15% conversion+) | ${(fin.convGain/1e6).toFixed(0)} mln so'm |
| JAMI POTENSIAL | ${(fin.totalPotential/1e6).toFixed(0)} mln so'm/yil |

Fan bo'yicha yo'qotishlar:
${fin.subjectLoss.map(s=>`${s.product}: ${s.stopped} stopped × ${(s.price/1e6).toFixed(1)}M = ${(s.loss/1e6).toFixed(0)}M so'm`).join('\n')}`;

  const bizOwner = `

---
## 🏆 MEN BIZNES EGASI BO'LGANIMDA — BIRINCHI 30 KUN / IF I WERE THE BUSINESS OWNER — FIRST 30 DAYS

Tahlildan kelib chiqib, eng yuqori ROI beradigan 5 ta harakat:
For each action: Nima qilardim / What I would do | Nima uchun / Why | Natija / Expected result | Muddat / Timeline

**#1 — [Eng tez natija]:**
**#2 — [Eng katta yo'qotishni to'xtatish]:**
**#3 — [Tizimiy o'zgarish]:**
**#4 — [Jamoa sifati]:**
**#5 — [O'lchash tizimi]:**

## 📊 6 OYLIK MAQSADLAR / 6-MONTH TARGETS
| Ko'rsatkich | Hozir | Maqsad | Qo'shimcha daromad |
|---|---|---|---|
| Retention | ${s.retention_pct||0}% | ___% | ___ mln so'm |
| Pass rate | ${s.pass_rate_pct||0}% | ___% | - |
| Dropout | ${s.jami>0?Math.round((s.stopped||0)/s.jami*100):0}% | ___% | ___ mln so'm |
| Converted | ${s.converted||0} | ___ | ___ mln so'm |`;

  const prompts = {
    overview: `${base}

PROFESSIONAL MUSTAQIL TAHLIL VAZIFASI:
Siz konsultant sifatida ushbu ma'lumotlarni ko'rdingiz. Mustaqil ravishda:

1. HOLAT BAHOSI / SITUATION ASSESSMENT
   - Umumiy holat qanday? Yaxshi, o'rtacha yoki yomon?
   - ACCA industry benchmark bilan solishtiring
   - Eng kritik 3 ta muammo nima?

2. RETENTION CHUQUR TAHLILI / RETENTION DEEP DIVE
   - ${s.retention_pct||0}% retention — bu nima anglatadi?
   - Yillik trend: ${Object.entries(yearly).map(([y,d])=>`${y}=${d.retention}%`).join(' → ')}
   - Sabablar va tizimiy muammolar

3. MOLIYAVIY YO'QOTISHLAR TAHLILI / FINANCIAL LOSS ANALYSIS
   - Jami yo'qotilgan summa: ${(fin.lostRevenue/1e9).toFixed(2)} mlrd so'm
   - Har bir yo'qotish turi alohida tahlil
   - Optimal ssenariy va pesimistik ssenariy

4. NO EXAM MUAMMOSI / NO EXAM PROBLEM
   - ${(s.no_exam||0).toLocaleString()} ta o'quvchi imtihon topshirmagan
   - Bu FBA Academy uchun nima anglatadi?
   - Yashirin sabablari

5. LTV VA KONVERSIYA / LTV AND CONVERSION
   - Hozirgi LTV vs potensial LTV
   - ${(s.converted||0).toLocaleString()} converted — yaxshimi?
   - Ko'paytirish strategiyasi

6. PROFESSIONAL XULOSALAR / PROFESSIONAL CONCLUSIONS
   - 3 ta eng muhim insight (siz o'zingiz topgan)
   - FBA Academy ning asosiy raqobat ustunligi va zaif tomoni

${bizOwner}`,

    teachers: `${base}

O'QITUVCHILAR TO'LIQ MA'LUMOTI:
| O'qituvchi | n | Retention | Pass rate | Exam entry |
|---|---|---|---|---|
${teachers.map(t=>`| ${t.Oqituvchi} | ${t.jami} | ${t.retention}% | ${t.pass_rate}% | ${t.exam_entry}% |`).join('\n')}

PROFESSIONAL TAHLIL VAZIFASI:

1. PERFORMANCE TAHLILI / PERFORMANCE ANALYSIS
   - Eng yaxshi va eng yomon o'qituvchilarni aniqlang
   - Statistik jihatdan sezilarli farqlar bormi?
   - Kichik guruhlar (n<30) uchun ehtiyot bo'lish kerak

2. PATTERN IZLASH / PATTERN DETECTION
   - Retention yuqori lekin pass rate past — bu nima anglatadi?
   - Qaysi o'qituvchida eng barqaror natija?
   - Fan bo'yicha o'qituvchi samaradorligi farqi

3. MOLIYAVIY TA'SIR / FINANCIAL IMPACT
   - Past retention o'qituvchi = qancha pul yo'qotish?
   - Agar barcha o'qituvchi top 3 darajasiga yetsa — qancha qo'shimcha daromad?

4. HR TAVSIYALAR / HR RECOMMENDATIONS
   - Kim uchun qo'shimcha support kerak?
   - Best practice kim?
   - Mentoring tizimi qanday bo'lishi kerak?

${bizOwner}`,

    subjects: `${base}

FANLAR TO'LIQ STATISTIKA:
| Fan | n | Ret% | Pass% | Entry% | Yo'qotish (mln so'm) |
|---|---|---|---|---|---|
${subjects.map(s=>`| ${s.Product} | ${s.jami} | ${s.retention}% | ${s.pass_rate}% | ${s.exam_entry}% | ${(s.stopped*getPrice(s.Product,'Full course')/1e6).toFixed(0)} |`).join('\n')}

PROFESSIONAL TAHLIL VAZIFASI:

1. PORTFOLIO TAHLILI / PORTFOLIO ANALYSIS
   - Qaysi fan eng foydali? (daromad × retention)
   - Qaysi fan eng zaif? Nima uchun?
   - Fanlar orasidagi korrelyatsiya

2. EXAM ENTRY MUAMMOSI / EXAM ENTRY CRISIS
   - 20% dan past entry bo'lgan fanlar
   - Bu ACCA ning imtihon ro'yxatga olish muammosimi yoki motivatsiya muammosimi?

3. 2024 VS 2025 TAQQOSLASH / YEAR-OVER-YEAR
${subjects.map(s=>{
  const y24=s.by_year?.['2024'], y25=s.by_year?.['2025'];
  if(!y24||!y25) return '';
  return `   - ${s.Product}: Ret ${y24.retention}% → ${y25.retention}% (${y25.retention>y24.retention?'+':''}${(y25.retention-y24.retention).toFixed(1)}pp)`;
}).filter(Boolean).join('\n')}

4. STRATEGIK QAROR / STRATEGIC DECISION
   - Qaysi fanlarga ko'proq investitsiya kerak?
   - Qaysi fanlarni optimize qilish kerak?

${bizOwner}`,

    dropout: `${base}

DROPOUT BATAFSIL TAHLIL:
Sabablar:
${Object.entries(dr).map(([k,v])=>`${k}: ${v} ta`).join('\n')}

Davr:
| Davr | Soni | Foiz |
|---|---|---|
${Object.entries(dp).map(([k,v])=>`| ${k} | ${v.count} | ${v.pct}% |`).join('\n')}

Operator ko'rsatkichlari:
| Operator | Jami | Dropout% |
|---|---|---|
${op_stats.map(o=>`| ${o.operator} | ${o.jami} | ${o.dropout_pct}% |`).join('\n')}

PROFESSIONAL TAHLIL VAZIFASI:

1. DROPOUT PATTERN TAHLILI / DROPOUT PATTERN ANALYSIS
   - Qaysi davr eng xavfli? Nima uchun?
   - "Vaqti yetmayabdi" — haqiqiy sabab yoki bahona? Qanday tekshirish mumkin?
   - Operator farqi statistik jihatdan muhimmi?

2. MOLIYAVIY HISOB / FINANCIAL CALCULATION
   - Jami yo'qotish: ${(fin.lostRevenue/1e9).toFixed(2)} mlrd so'm
   - Birinchi oyda chiqib ketganlar: ${(dp['1-oyda chiqqanlar']?.count||0)} ta = ${((dp['1-oyda chiqqanlar']?.count||0)*3800000/1e6).toFixed(0)} mln so'm
   - Dropout 20% kamaytirish = qancha tejash?

3. ROOT CAUSE ANALYSIS
   - Yuzaki sabab vs chuqur sabab
   - Tizimiy muammo qayerda?
   - Onboarding jarayoni qanchalik samarali?

4. PREVENTION STRATEGY / OLDINI OLISH STRATEGIYASI
   - Early warning indicators nima bo'lishi kerak?
   - Intervensiya nuqtalari qayerda?

${bizOwner}`,

    sales: `${base}

SALES TO'LIQ MA'LUMOTI:
Umumiy: Lidlar=${sales.summary?.jami_lidlar?.toLocaleString()||0}, Muvaffaqiyatli=${sales.summary?.muvaffaqiyatli||0}, Konversiya=${sales.summary?.konversiya||0}%

Manba kesimi:
| Manba | Jami | Muvaffaq | Konversiya |
|---|---|---|---|
${(sales.manba||[]).map(m=>`| ${m.manba} | ${m.jami} | ${m.muvaffaqiyatli} | ${m.konversiya}% |`).join('\n')}

Operator kesimi:
| Operator | Jami | Muvaffaq | Konversiya |
|---|---|---|---|
${(sales.operators||[]).map(o=>`| ${o.operator} | ${o.jami} | ${o.muvaffaqiyatli} | ${o.konversiya}% |`).join('\n')}

PROFESSIONAL TAHLIL VAZIFASI:

1. KONVERSIYA SIFATI / CONVERSION QUALITY
   - ${sales.summary?.konversiya||0}% konversiya — bu yaxshimi? ACCA o'quv markazlari uchun benchmark: 5-12%
   - Har bir manba uchun alohida baholash

2. OPERATOR SAMARADORLIGI / OPERATOR PERFORMANCE
   - Kim eng samarali? Nima uchun?
   - Farq qayerdan kelyapti — lid sifati yoki ishlov berish?

3. LID SIFATI TAHLILI / LEAD QUALITY ANALYSIS
   - Qaysi manba eng sifatli lid bermoqda?
   - Meta vs organik — qaysi biri uzoq muddatda foydali?

4. MOLIYAVIY IMKONIYAT / FINANCIAL OPPORTUNITY
   - Konversiya 1% oshirilsa: ${Math.round((sales.summary?.jami_lidlar||0)*0.01*3800000/1e6)} mln so'm qo'shimcha
   - Eng arzon va sifatli lid manbasi

${bizOwner}`,

    marketing: `${base}

MARKETING TO'LIQ MA'LUMOTI:
Umumiy: Xarajat=$${mkt.summary?.jami_xarajat_usd?.toLocaleString()||0}, Lidlar=${mkt.summary?.jami_leadlar?.toLocaleString()||0}, CPL=$${mkt.summary?.avg_cpl||0}

Manba kesimi:
| Manba | Xarajat $ | Lidlar | CPL $ |
|---|---|---|---|
${(mkt.manba_xarajat||[]).map(m=>`| ${m.manba} | ${m.xarajat_usd} | ${m.leadlar} | ${m.cpl} |`).join('\n')}

PROFESSIONAL TAHLIL VAZIFASI:

1. ROI TAHLILI / ROI ANALYSIS
   - $${mkt.summary?.avg_cpl||0} CPL + ${sales.summary?.konversiya||0}% konversiya = haqiqiy CPA qancha?
   - Kurs narxi (~$280) vs CPA — bu foydali biznesmi?
   - Har bir kanal uchun alohida ROI hisoblash

2. KANAL SAMARADORLIGI / CHANNEL EFFICIENCY
   - Eng yuqori va eng past ROI kanallar
   - Budget qayta taqsimlash tavsiyasi

3. MARKETING-SALES ALIGNMENT
   - Marketing lidlar sifati vs Sales konversiyasi
   - Muvofiqlik muammolari bormi?

4. O'SISH IMKONIYATLARI / GROWTH OPPORTUNITIES
   - Referral kanalini kuchaytirish potensiali
   - Organik o'sish strategiyasi
   - ACCA market penetration qancha?

${bizOwner}`
  };

  return prompts[section] || prompts.overview;
}

const CORS = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Content-Type':'application/json'};

module.exports = async function(context, req) {
  if (req.method === 'OPTIONS') { context.res={status:200,headers:CORS,body:''}; return; }
  try {
    const {snapData, section} = req.body || {};
    if (!snapData || !section) { context.res={status:400,headers:CORS,body:JSON.stringify({error:'snapData va section kerak'})}; return; }
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY yoq');
    context.log(`AI tahlil: ${section}`);
    const prompt = buildPrompt(snapData, section);
    const reqBody = JSON.stringify({model:'claude-sonnet-4-5',max_tokens:6000,messages:[{role:'user',content:prompt}]});
    const result = await httpsPost('api.anthropic.com','/v1/messages',reqBody,{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'});
    if (result.status!==200) throw new Error(`Claude ${result.status}: ${result.body}`);
    const analysis = JSON.parse(result.body).content[0].text;
    context.res={status:200,headers:CORS,body:JSON.stringify({analysis,section})};
  } catch(err) {
    context.log.error('Xato:',err.message);
    context.res={status:500,headers:CORS,body:JSON.stringify({error:err.message})};
  }
};

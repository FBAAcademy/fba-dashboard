const https = require('https');

// Kurs narxlari (2026-mart holatiga ko'ra, so'mda)
const PRICES = {
  'Full course': {
    FA:3500000,MA:3500000,BT:3500000,LW:3500000,
    PM:4500000,TX:4500000,FR:4500000,AA:4500000,FM:4500000,
    SBL:7500000,SBR:7500000,AFM:7500000,APM:7500000,ATX:7500000,AAA:7500000,
    DipIFR:7000000,PreDipIFR:4000000,PreMSFO:5000000,MSFO:5000000,
    default:3500000
  },
  'Video Lesson':{FA:1750000,MA:1750000,BT:1000000,PM:2250000,TX:2250000,FR:2250000,AA:2250000,FM:2250000,DipIFR:2500000,MSFO:2500000,default:1750000},
  'Revision':{FA:1100000,MA:1000000,BT:1000000,PM:2000000,TX:2000000,FR:2000000,AA:2000000,FM:3500000,SBL:3000000,default:1500000},
  'Exclusive':{default:6500000}
};

function getPrice(product, productType) {
  const pt = PRICES[productType] || PRICES['Full course'];
  return pt[product] || pt['default'] || 3500000;
}

function calcFinancials(snap) {
  const s = snap.summary || {};
  const subjects = snap.subjects || [];
  const teachers = snap.teachers || [];
  
  // Dropout yo'qotilgan daromad
  const stopped = s.stopped || 0;
  const avgPrice = 3500000; // o'rtacha narx
  const lostRevenue = stopped * avgPrice;
  
  // Agar 10% dropout kamaytirish
  const dropout10 = Math.round(stopped * 0.1);
  const gain10pct = dropout10 * avgPrice;
  
  // No exam - imtihonga kirmaganlari uchun yo'qotish (Revision kursdan)
  const noExam = s.no_exam || 0;
  const revisionPrice = 1500000; // o'rtacha revision narxi
  const noExamLost = noExam * revisionPrice;
  
  // Converted - 2+ kurs o'qiganlar
  const converted = s.converted || 0;
  const notConverted = (s.yakunlagan || 0) - converted;
  const conversionGain = notConverted * 0.1 * avgPrice; // agar 10% ni ushlab qolsak
  
  // Fan bo'yicha yo'qotish
  const subjectLoss = subjects.map(sub => {
    const price = getPrice(sub.Product, 'Full course');
    const loss = sub.stopped * price;
    return { product: sub.Product, stopped: sub.stopped, price, loss };
  }).sort((a,b) => b.loss - a.loss);
  
  return {
    lostRevenue,
    gain10pct,
    noExamLost,
    conversionGain,
    subjectLoss: subjectLoss.slice(0,5),
    totalPotential: gain10pct + Math.round(noExamLost * 0.3) + Math.round(conversionGain)
  };
}

function httpsPost(hostname, path, data, headers) {
  return new Promise((resolve, reject) => {
    const options = {hostname, path, method:'POST', headers:{...headers,'Content-Length':Buffer.byteLength(data)}};
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({status:res.statusCode, body}));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function buildPrompt(snap, section) {
  const s = snap.summary || {};
  const teachers = (snap.teachers || []).slice(0,12);
  const subjects = snap.subjects || [];
  const dropout_reasons = snap.dropout_reasons || {};
  const dropout_period = snap.dropout_period || {};
  const yearly = snap.yearly || {};
  const op_stats = snap.operator_stats || [];
  const sales = snap.sales || {};
  const mkt = snap.marketing || {};
  const fin = calcFinancials(snap);

  const base = `Sen FBA Academy (ACCA kurslari o'quv markazi) uchun ilmiy-analitik maslahatchi sifatida ish olib borasan.
O'zbek tilida professional, chuqur va amaliy tahlil ber. Barcha xulosalarni raqamlar bilan asosla.
Tavsiyalar aniq, o'lchanadigan va harakatga yo'naltirilgan bo'lsin.

ASOSIY KO'RSATKICHLAR (2024-yildan buyon):
- Jami o'quvchilar: ${s.jami?.toLocaleString()||0} ta
- Hozir o'qiyotganlar (In Progress): ${s.in_progress||0} ta
- Kursni yakunlaganlar: ${s.yakunlagan?.toLocaleString()||0} ta
- Kursni tark etganlar (Stopped): ${s.stopped?.toLocaleString()||0} ta
- ACCA imtihonini topshirganlar: ${s.passed||0} ta (Pass rate: ${s.pass_rate_pct||0}%)
- Imtihondan o'tolmaganlar: ${s.failed||0} ta
- Imtihon topshirmaganlar (No Exam): ${s.no_exam?.toLocaleString()||0} ta
- Retention: ${s.retention_pct||0}%
- Exam entry: ${s.exam_entry_pct||0}%
- 2+ kurs o'qiganlar (Converted): ${s.converted||0} ta

YILLIK DINAMIKA:
${Object.entries(yearly).map(([y,d])=>`${y}-yil: ${d.jami} ta yangi o'quvchi, Retention ${d.retention}%, Pass rate ${d.pass_rate}%`).join('\n')}

KURS NARXLARI (2026-mart):
- Full course (FA,MA,FR,AA,FM,PM,TX va b.): 3,500,000 - 4,500,000 so'm
- Full course (SBL,SBR,AFM va b. advanced): 7,500,000 so'm
- Video Lesson: 1,750,000 - 2,250,000 so'm
- Revision: 1,000,000 - 2,000,000 so'm

MOLIYAVIY HISOB-KITOB:
- Stopped o'quvchilardan yo'qotilgan daromad: ${(fin.lostRevenue/1e9).toFixed(2)} mlrd so'm
- Dropout 10% kamaytirilsa qo'shimcha daromad: ${(fin.gain10pct/1e6).toFixed(0)} mln so'm/yil
- No Exam o'quvchilardan yo'qotilgan Revision daromad: ${(fin.noExamLost/1e6).toFixed(0)} mln so'm
- Jami potensial qo'shimcha daromad: ${(fin.totalPotential/1e6).toFixed(0)} mln so'm/yil
- Eng ko'p yo'qotish bergan fanlar:
${fin.subjectLoss.map(s=>`  ${s.product}: ${s.stopped} ta stopped × ${(s.price/1e6).toFixed(1)}M = ${(s.loss/1e6).toFixed(0)}M so'm yo'qotildi`).join('\n')}`;

  const ending = `

TAHLIL FORMATI:
Har bo'lim uchun quyidagi strukturada yoz:
### 📊 [Bo'lim nomi]
**Holat:** Qisqacha baho (yaxshi/o'rtacha/yomon)
**Asosiy muammo:** ...
**Moliyaviy ta'sir:** ... so'm
**Tavsiya:** Aniq harakat, mas'ul shaxs, muddat
---`;

  const prompts = {
    overview: `${base}

ILMIY-ANALITIK TOPSHIRIQ — UMUMIY TAHLIL:

1. 📈 RETENTION TAHLILI
   - 2024→2025→2026 trendini baholash
   - Sanoat standarti (ACCA o'quv markazlari uchun 65-75%) bilan solishtirish
   - ${s.retention_pct||0}% nimani anglatadi?

2. 💰 MOLIYAVIY YO'QOTISHLAR TAHLILI
   - ${s.stopped?.toLocaleString()||0} ta stopped o'quvchi = qancha pul yo'qotildi?
   - ${s.no_exam?.toLocaleString()||0} ta No Exam = qancha potensial Revision daromadi yo'qoldi?
   - Agar Retention 5% oshirilsa qancha qo'shimcha daromad keladi?

3. 🎯 IMTIHON TAHLILI
   - Pass rate ${s.pass_rate_pct||0}% va Exam entry ${s.exam_entry_pct||0}% kombinatsiyasi nima ko'rsatmoqda?
   - ${s.no_exam?.toLocaleString()||0} ta o'quvchi nima uchun imtihon topshirmayapti?
   - Bu FBA Academy uchun nima yo'qotmoqda?

4. 🔄 LTV (LIFETIME VALUE) TAHLILI
   - Hozirgi avg LTV vs potensial avg LTV
   - ${s.converted||0} ta 2+ kurs o'qigan — agar 20% ko'proq qoldirsak qancha daromad?

5. 🏆 BIZNES EGASI NUQTAI NAZARI
   Men biznes egasi bo'lganimda BIRINCHI nimalarga e'tibor qaratardim:
   - Eng tez natija beradigan 3 ta harakat
   - Eng ko'p pul yo'qotayotgan 3 ta muammo
   - 6 oy ichida o'lchanadigan maqsadlar

6. 📋 TOP 7 STRATEGIK TAVSIYA
   Har biri uchun: harakat + mas'ul shaxs + muddat + kutilayotgan natija (so'mda)

${ending}`,

    teachers: `${base}

O'QITUVCHILAR (retention bo'yicha):
${teachers.map(t=>`${t.Oqituvchi}: ${t.jami} ta o'quvchi, Retention ${t.retention}%, Pass rate ${t.pass_rate}%, Exam entry ${t.exam_entry}%`).join('\n')}

ILMIY-ANALITIK TOPSHIRIQ — O'QITUVCHILAR TAHLILI:

1. 🏆 TOP vs BOTTOM TAHLILI
   - Eng yaxshi va eng yomon orasidagi farq qancha? Sabablari nima?
   - Eng yaxshi o'qituvchining yondashuvi nima bo'lishi mumkin?

2. 💰 MOLIYAVIY TA'SIR
   - Past retention o'qituvchining har bir o'quvchisi = qancha pul yo'qotilmoqda?
   - Agar past retention o'qituvchilar o'rtacha darajaga ko'tarilsa qancha qo'shimcha daromad?

3. ⚠️ DIQQAT TALAB QILADIGAN HOLATLAR
   - Retention yuqori lekin pass rate past — bu nima anglatadi?
   - Kichik o'quvchi soni bilan baholashda nima hisobga olish kerak?

4. 🎓 PROFESSIONAL RIVOJLANISH REJASI
   - Har bir darajadagi o'qituvchi uchun aniq harakat rejasi
   - Mentoring va bilim almashish tizimi qanday bo'lishi kerak?

5. 📊 RATING TIZIMI BAHOLASH
   - Hozirgi rating (Pass+Entry+Retention) adolatlimi?
   - Qanday yaxshilanishi mumkin?

6. TOP 5 TAVSIYA (har biri uchun: harakat + mas'ul + muddat + moliyaviy natija)

${ending}`,

    subjects: `${base}

FANLAR:
${subjects.map(s=>{
  const price = getPrice(s.Product, 'Full course');
  const lostM = Math.round(s.stopped * price / 1e6);
  return `${s.Product}: ${s.jami} ta o'quvchi, Ret ${s.retention}%, Pass ${s.pass_rate}%, Entry ${s.exam_entry}%, Yo'qotish: ${lostM}M so'm`;
}).join('\n')}

ILMIY-ANALITIK TOPSHIRIQ — FANLAR TAHLILI:

1. 📊 FANLAR REYTINGI
   - Retention, Pass rate va moliyaviy natija bo'yicha fanlarni tartiblash
   - Eng samarali va eng muammoli fanlar

2. 💰 MOLIYAVIY TAHLIL
   - Har bir fanda stopped o'quvchilardan yo'qotilgan summa
   - Qaysi fan eng ko'p daromad va eng ko'p yo'qotish keltirmoqda?

3. 📚 EXAM ENTRY MUAMMOSI
   - 20% dan past entry bo'lgan fanlar — sababi va yechimi
   - Bu fanlardan yo'qotilgan Revision daromadi qancha?

4. 📅 2024→2025 DINAMIKASI
   - Qaysi fanlar yaxshilanmoqda, qaysilari yomonlashmoqda?
   - Trend sabablari va prognozi

5. 🎯 STRATEGIK PORTFOLIO TAHLILI
   - Qaysi fanlarga ko'proq investitsiya kerak?
   - Qaysi fanlar profitabilitiyi yuqori?

6. TOP 5 TAVSIYA (har biri moliyaviy natija bilan)

${ending}`,

    dropout: `${base}

DROPOUT SABABLARI (top 10):
${Object.entries(dropout_reasons).map(([k,v])=>`${k}: ${v} ta o'quvchi`).join('\n')}

DROPOUT DAVRI:
${Object.entries(dropout_period).map(([k,v])=>`${k}: ${v.count} ta (${v.pct}%)`).join('\n')}

OPERATORLAR:
${op_stats.map(o=>`${o.operator}: ${o.jami} ta o'quvchi, Dropout ${o.dropout_pct}%, Passed ${o.passed}`).join('\n')}

MOLIYAVIY HISOB:
${fin.subjectLoss.map(s=>`${s.product}: ${s.stopped} ta stopped = ${(s.loss/1e6).toFixed(0)}M so'm yo'qotildi`).join('\n')}

ILMIY-ANALITIK TOPSHIRIQ — DROPOUT TAHLILI:

1. ⏰ KRITIK DAVRLAR TAHLILI
   - Birinchi 3 dars: ${(snap.dropout_period?.['3-darsgacha chiqqanlar']?.count||0)} ta o'quvchi = qancha pul yo'qoldi?
   - Birinchi oy: ${(snap.dropout_period?.['1-oyda chiqqanlar']?.count||0)} ta = qancha?
   - Bu qaysi bosqichda eng ko'p e'tibor kerak ekanini ko'rsatmoqda?

2. 🔍 SABAB TAHLILI
   - "Vaqti yetmayabdi" — bu haqiqiy sabab yoki bahona?
   - Onboarding jarayoni qanchalik samarali?
   - Boshqa kurslar bilan taqqoslaganda bu ko'rsatkich qanday?

3. 👥 OPERATOR TAQQOSLASH
   - Operatorlar orasidagi dropout farqi sabablari
   - Eng yaxshi operator nimani boshqacha qilyapti?
   - Moliyaviy farq qancha?

4. 💰 MOLIYAVIY TAHLIL
   - Jami dropout = ${(fin.lostRevenue/1e9).toFixed(2)} mlrd so'm yo'qotildi
   - Agar dropout 20% kamaytirilsa: ${(fin.lostRevenue*0.2/1e6).toFixed(0)} mln so'm qo'shimcha
   - Onboarding tizimiga investitsiya ROI hisoblash

5. 🛡️ DROPOUT KAMAYTIRISH TIZIMI
   - Birinchi hafta uchun "dropout prevention" protokoli
   - Erta ogohlantirish tizimi (early warning system)
   - Operator training dasturi

6. TOP 5 TAVSIYA (har biri uchun: harakat + ROI hisob-kitobi + muddat)

${ending}`,

    sales: `${base}

SALES MA'LUMOTLARI:
- Jami lidlar: ${sales.summary?.jami_lidlar?.toLocaleString()||0} ta
- Muvaffaqiyatli: ${sales.summary?.muvaffaqiyatli||0} ta
- Konversiya: ${sales.summary?.konversiya||0}%
- Agar konversiya 1% oshirilsa: ~${Math.round((sales.summary?.jami_lidlar||0)*0.01)} ta qo'shimcha o'quvchi = ~${Math.round((sales.summary?.jami_lidlar||0)*0.01*3500000/1e6)} mln so'm

MANBA BO'YICHA:
${(sales.manba||[]).map(m=>`${m.manba}: ${m.jami} lid → ${m.muvaffaqiyatli} o'quvchi (${m.konversiya}% konversiya)`).join('\n')}

OPERATORLAR:
${(sales.operators||[]).map(o=>`${o.operator}: ${o.jami} lid, ${o.konversiya}% konversiya, ${o.muvaffaqiyatli} muvaffaqiyatli`).join('\n')}

ILMIY-ANALITIK TOPSHIRIQ — SALES TAHLILI:

1. 📊 KONVERSIYA TAHLILI
   - ${sales.summary?.konversiya||0}% — ACCA o'quv markazlari uchun ideal ${5-8}% bilan solishtiring
   - Konversiya nima uchun past? Lid sifati yoki sales jarayoni?

2. 💰 MOLIYAVIY IMKONIYAT
   - Konversiya 1% oshirilsa qancha qo'shimcha daromad?
   - Har bir lid qancha turadi va ROI qanday?

3. 🎯 MANBA TAHLILI
   - Tavsiya (${(sales.manba||[]).find(m=>m.manba==='Tavsiya')?.konversiya||0}%) vs Meta (${(sales.manba||[]).find(m=>m.manba==='Meta')?.konversiya||0}%) farqi
   - Eng arzon va sifatli lid qayerdan kelmoqda?
   - Budget qayta taqsimlash taklifi

4. 👥 OPERATOR TAHLILI
   - Operatorlar orasidagi konversiya farqi sababi
   - Eng yaxshi operator usulini boshqalarga o'rgatish

5. 🚀 SALES FUNNEL OPTIMALLASHTIRISH
   - Qaysi bosqichda eng ko'p lid yo'qolmoqda?
   - CRM tizimi qanchalik samarali?

6. TOP 5 TAVSIYA (har biri uchun: harakat + moliyaviy ta'sir + muddat)

${ending}`,

    marketing: `${base}

MARKETING MA'LUMOTLARI:
- Jami xarajat: $${mkt.summary?.jami_xarajat_usd?.toLocaleString()||0}
- Jami lidlar: ${mkt.summary?.jami_leadlar?.toLocaleString()||0} ta
- O'rtacha CPL: $${mkt.summary?.avg_cpl||0}
- Taxminiy UZS da: ${Math.round((mkt.summary?.jami_xarajat_usd||0)*12500/1e6)} mln so'm sarflandi

MANBA BO'YICHA:
${(mkt.manba_xarajat||[]).map(m=>`${m.manba}: $${m.xarajat_usd} sarflandi, ${m.leadlar} lid, CPL $${m.cpl}`).join('\n')}

ILMIY-ANALITIK TOPSHIRIQ — MARKETING TAHLILI:

1. 📊 ROI TAHLILI
   - $${mkt.summary?.avg_cpl||0} CPL va 3,500,000 so'm (~$280) avg kurs narxi — bu foydali biznesmi?
   - Marketing xarajatidan olingan daromad nisbati

2. 💰 BUDGET OPTIMALLASHTIRISH
   - Qaysi kanal eng yaxshi ROI bermoqda?
   - Qaysi kanalga ko'proq/kamroq sarflash kerak?
   - Taxminiy optimal budget taqsimoti

3. 📱 KANAL TAHLILI
   - Meta vs Telegram vs boshqalar samaradorligi
   - Har bir kanaldan kelgan lidlarning konversiyasi qanday?

4. 📈 O'SISH IMKONIYATLARI
   - Referral (Tavsiya) kanalini kuchaytirish potensiali
   - Organik o'sish strategiyasi
   - Content marketing imkoniyatlari

5. 🎯 MAQSADLI AUDITORIYA
   - Eng yaxshi konversiya beruvchi segment qaysi?
   - Retargeting imkoniyatlari

6. TOP 5 TAVSIYA (har biri uchun: harakat + kutilayotgan ROI + muddat)

${ending}`
  };

  return prompts[section] || prompts.overview;
}

module.exports = async function(context, req) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    'Content-Type': 'application/json'
  };

  if (req.method === 'OPTIONS') {
    context.res = {status:200, headers:cors, body:''};
    return;
  }

  try {
    const body = req.body || {};
    const {snapData, section} = body;
    if (!snapData || !section) {
      context.res = {status:400, headers:cors, body:JSON.stringify({error:'snapData va section kerak'})};
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY yoq');

    const prompt = buildPrompt(snapData, section);
    context.log(`AI tahlil boshlandi: ${section}, prompt uzunligi: ${prompt.length}`);

    const reqBody = JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 5000,
      messages: [{role:'user', content:prompt}]
    });

    const result = await httpsPost('api.anthropic.com', '/v1/messages', reqBody, {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01'
    });

    if (result.status !== 200) throw new Error(`Claude ${result.status}: ${result.body}`);

    const analysis = JSON.parse(result.body).content[0].text;
    context.log(`Tahlil tugadi: ${analysis.length} belgi`);
    context.res = {status:200, headers:cors, body:JSON.stringify({analysis, section})};

  } catch(err) {
    context.log.error('Xato:', err.message);
    context.res = {status:500, headers:cors, body:JSON.stringify({error:err.message})};
  }
};

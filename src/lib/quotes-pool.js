// ============================================================================
// KRX QUOTES POOL — 365 Inspirational Quotes
// ============================================================================
// Digunakan oleh Telegram notification templates (route.js)
// untuk daily reports, morning prep, weekly recap, dan billing notifications.
//
// Kategori:
//   investment   — Kebijaksanaan investasi & finansial
//   discipline   — Disiplin, konsistensi, kebiasaan
//   patience     — Kesabaran, ketekunan, long-term mindset
//   serenity     — Ketenangan, mindfulness, inner peace
//   social       — Kemanusiaan, berbagi, kolaborasi
//   gratitude    — Rasa syukur, apresiasi, refleksi positif
//   resilience   — Ketangguhan, bangkit kembali, growth mindset
// ============================================================================

const QUOTES = {
  investment: [
    "Warren Buffett: Aturan No.1 — Jangan pernah kehilangan uang. Aturan No.2 — Jangan lupa aturan No.1.",
    "Compound interest adalah keajaiban ke-8 dunia. Ia yang memahaminya akan mendapatkannya, ia yang tidak akan membayarnya. — Albert Einstein",
    "Kekayaan sejati bukan tentang apa yang Anda miliki, melainkan apa yang tidak Anda butuhkan.",
    "Jangan menaruh semua telur dalam satu keranjang. Diversifikasi adalah tameng terkuat.",
    "Investasi terbaik adalah investasi pada diri sendiri. Pengetahuan tidak akan pernah terdepresiasi.",
    "Pasar bullish lahir dari pesimisme, tumbuh dari skeptisisme, matang dari optimisme, dan mati dari euforia. — Sir John Templeton",
    "Uang bukan segalanya, tapi pastikan Anda memiliki cukup sebelum berbicara demikian. — Bob Proctor",
    "Harga adalah apa yang Anda bayar. Nilai adalah apa yang Anda dapatkan. — Warren Buffett",
    "Lebih baik membeli perusahaan hebat dengan harga wajar daripada perusahaan wajar dengan harga hebat.",
    "Pasar saham adalah alat untuk mentransfer uang dari yang tidak sabar ke yang sabar.",
    "Risiko datang dari tidak tahu apa yang Anda lakukan. — Warren Buffett",
    "Jangan mencari jarum di tumpukan jerami. Beli saja seluruh tumpukan jeraminya. — John Bogle",
    "Waktu adalah teman bisnis yang hebat, musuh bisnis yang buruk. — Warren Buffett",
    "Orang yang tidak bisa mengendalikan emosinya tidak cocok mendapat profit dari investasi. — Benjamin Graham",
    "Kesempatan datang jarang. Ketika hujan emas, keluarkan ember, bukan bidal. — Warren Buffett",
    "Kesalahan terbesar adalah tidak melakukan apa-apa karena takut salah.",
    "Dalam investasi, apa yang nyaman jarang menguntungkan. — Robert Arnott",
    "Setiap krisis adalah kesempatan yang sedang menyamar.",
    "Dua hal yang paling sulit dipahami: kapan harus masuk, dan kapan harus keluar.",
    "Jangan biarkan noise pasar menenggelamkan suara strategi Anda.",
    "Aset terbesar Anda bukanlah uang, melainkan waktu. Gunakan dengan bijak.",
    "Investasi bukan tentang mengalahkan orang lain, melainkan mengalahkan diri sendiri.",
    "Bunga berbunga adalah kekuatan paling dahsyat di alam semesta. — Albert Einstein",
    "Simpan saat Anda bisa, bukan saat Anda harus.",
    "Financial freedom is not about having millions; it's about having enough.",
    "Lebih baik 10 tahun konsisten daripada 1 tahun euforia lalu bangkrut.",
    "Portfolio yang baik seperti pohon — butuh waktu untuk tumbuh, tapi akarnya kuat.",
    "Jangan trading dengan uang yang Anda tidak sanggup kehilangan.",
    "Pasar selalu benar. Tugas kita adalah mengikutinya, bukan melawannya.",
    "The best investment you can make is in your own abilities.",
    "Kekayaan bukan tentang seberapa besar penghasilan Anda, tapi seberapa banyak yang Anda simpan dan investasikan.",
    "Membaca 500 halaman setiap hari adalah cara pengetahuan bekerja. Ia terakumulasi seperti bunga berbunga. — Warren Buffett",
    "Risk management bukan pilihan, ia adalah fondasi.",
    "Trading tanpa risk management adalah judi, bukan investasi.",
    "Orang sukses dan orang sangat sukses bedanya: yang terakhir bilang TIDAK pada hampir segalanya. — Warren Buffett",
    "Cash is king, especially during crisis.",
    "Ekonomi naik-turun, tapi perusahaan hebat akan bertahan. Belilah kualitas.",
    "Fear index tinggi = kesempatan. Greed index tinggi = bahaya.",
    "Strategi terbaik hari ini mungkin bukan strategi terbaik besok. Fleksibel adalah kunci.",
    "Know what you own, and know why you own it. — Peter Lynch",
    "Investasi terbaik yang pernah saya buat adalah membeli buku. — Benjamin Franklin",
  ],

  discipline: [
    "Disiplin adalah jembatan antara tujuan dan pencapaian. — Jim Rohn",
    "Trader yang sukses bukan yang paling cerdas, tapi yang paling konsisten.",
    "Kita adalah apa yang kita lakukan berulang kali. Keunggulan, dengan demikian, bukanlah tindakan, melainkan kebiasaan. — Aristoteles",
    "Orang sukses melakukan apa yang orang gagal tidak mau lakukan.",
    "Motivasi membuat Anda mulai. Kebiasaan membuat Anda terus berjalan. — Jim Ryun",
    "Tidak ada lift menuju kesuksesan. Anda harus naik tangga.",
    "Konsistensi mengalahkan intensitas. Lebih baik 1% setiap hari daripada 100% sekali lalu berhenti.",
    "Jangan berharap hasil berbeda dari tindakan yang sama.",
    "Jam 5 pagi adalah waktu emas. Dunia masih tenang, pikiran masih jernih.",
    "Small disciplines repeated with consistency every day lead to great achievements.",
    "Kesuksesan adalah akumulasi dari hal-hal kecil yang dilakukan dengan konsisten.",
    "Rencana tanpa eksekusi hanyalah angan-angan.",
    "Jangan tunggu mood bagus untuk bekerja. Bekerjalah, mood akan mengikuti.",
    "Akar dari semua disiplin adalah goal-setting yang jelas.",
    "Trader yang tidak punya trading plan akan menjadi bagian dari plan trader lain.",
    "Log your trades. What gets measured gets improved.",
    "Kebiasaan buruk seperti ranjang yang nyaman — mudah masuk, sulit keluar.",
    "Sukses bukan milik orang pintar, tapi milik mereka yang terus berusaha.",
    "Tidak ada kata terlambat untuk menjadi apa yang Anda inginkan. — George Eliot",
    "Satu-satunya cara melakukan pekerjaan hebat adalah mencintai apa yang Anda lakukan. — Steve Jobs",
    "Disiplin diri adalah bentuk tertinggi dari self-love.",
    "Rutinitas pagi menentukan kualitas hari Anda.",
    "Jangan biarkan kemarin mengambil terlalu banyak dari hari ini. — Will Rogers",
    "Setiap hari adalah kesempatan baru untuk menulis ulang cerita Anda.",
    "Discipline is choosing between what you want now and what you want most.",
    "Kesuksesan adalah 1% inspirasi dan 99% keringat. — Thomas Edison",
    "Lebih baik teratur dalam hal kecil daripada chaos dalam hal besar.",
    "Jangan takut berjalan lambat. Takutlah jika Anda berhenti berjalan.",
    "Habit is a cable; we weave a thread each day, and at last we cannot break it. — Horace Mann",
    "Checklist adalah senjata rahasia pilot dan dokter. Trader juga harus memilikinya.",
    "Setiap keputusan kecil yang Anda buat hari ini sedang membentuk masa depan Anda.",
    "Trading journal adalah cermin yang jujur bagi seorang trader.",
    "Orang yang menguasai dirinya sendiri lebih hebat dari penakluk kota. — Amsal",
    "Latihan tidak membuat sempurna. Latihan yang sempurna membuat sempurna.",
    "Kesempurnaan dicapai bukan saat tidak ada yang bisa ditambahkan, tapi saat tidak ada yang bisa dikurangi.",
  ],

  patience: [
    "Pasar akan selalu menguji kesabaran Anda sebelum memberi hadiah.",
    "Waktu di pasar lebih penting daripada timing pasar. — Kenneth Fisher",
    "Kesabaran adalah seni berharap. — Luc de Clapiers",
    "Alam tidak terburu-buru, namun semuanya tercapai. — Lao Tzu",
    "Bersabarlah. Semua hal sulit sebelum menjadi mudah. — Saadi",
    "Pohon besar tumbuh dari biji kecil. Butuh waktu, tapi hasilnya sepadan.",
    "Impatience is the enemy of compounding.",
    "Orang yang bisa menunggu adalah orang yang akan mendapatkan yang terbaik.",
    "Pasar bisa tetap irasional lebih lama dari kemampuan Anda bertahan. — John Maynard Keynes",
    "Sabar bukan berarti pasif. Sabar adalah aksi menahan diri yang aktif.",
    "Dalam trading, kadang aksi terbaik adalah tidak beraksi sama sekali.",
    "Kesabaran adalah kekuatan. Waktu adalah temannya.",
    "Air mengalir dengan sabar, namun bisa membelah gunung.",
    "Jangan panen sebelum waktunya. Buah mentah tidak akan manis.",
    "The stock market is a device for transferring money from the impatient to the patient. — Warren Buffett",
    "Tidak semua hari adalah hari untuk trading. Kadang duduk diam adalah strategi terbaik.",
    "Bersabarlah dalam proses. Hasil akan mengikuti secara alami.",
    "Mereka yang menanam hari ini mungkin tidak akan memanennya besok. Dan itu tidak apa-apa.",
    "Sungai tahu tujuannya — laut. Ia tidak terburu-buru meski berliku.",
    "Kesabaran adalah teman kebijaksanaan. — St. Augustine",
    "Dalam dunia instant gratification, kesabaran adalah keunggulan kompetitif.",
    "Setiap malam ada pagi. Setiap badai ada pelangi. Setiap bear market ada bull market.",
    "Petani tidak mencabut benih setiap hari untuk mengecek pertumbuhannya. Investor juga seharusnya begitu.",
    "Jika Anda tidak bisa menahan saham saat turun 50%, Anda tidak layak mendapatkannya saat naik 500%.",
    "Kesabaran bukan kemampuan menunggu, tapi bagaimana Anda bersikap saat menunggu. — Joyce Meyer",
    "Long-term bukan berarti 1 bulan. Long-term adalah 5, 10, 20 tahun.",
    "Berhenti mengecek portfolio setiap 5 menit. Hidup Anda lebih dari sekadar angka.",
  ],

  serenity: [
    "Ketenangan pikiran adalah profit terbesar dalam hidup.",
    "Jangan biarkan volatilitas pasar mengganggu ketenangan batin Anda.",
    "Tetaplah tenang. Pasar naik dan turun, tapi nilai sejati tidak berubah.",
    "Kedamaian datang dari dalam. Jangan mencarinya di luar. — Buddha",
    "Market is a mirror. If you're anxious, you'll see chaos. If you're calm, you'll see opportunity.",
    "Meditasi 10 menit sebelum trading lebih berharga dari indikator apapun.",
    "Breath in calm, breath out noise.",
    "Ketika pasar panik, tarik napas dan lihat data.",
    "Hidup itu seperti trading — yang penting bukan kartu yang Anda dapat, tapi bagaimana Anda memainkannya.",
    "Jangan biarkan satu trade buruk merusak ketenangan Anda seharian.",
    "Keseimbangan hidup lebih penting dari balance akun.",
    "Stres adalah hasil dari berusaha mengontrol hal di luar kendali kita.",
    "The greatest wealth is a quiet mind.",
    "Di tengah kebisingan pasar, jadilah investor yang tenang.",
    "Orang yang tidak bisa menguasai pikirannya tidak akan bisa menguasai portfolio-nya.",
    "Happiness is not the absence of problems, but the ability to deal with them.",
    "Soft music, warm tea, clear mind — perfect pre-market ritual.",
    "Jangan bawa masalah pasar ke meja makan keluarga.",
    "Sehat mental lebih penting dari profit harian.",
    "Dalam keheningan, kita menemukan jawaban yang tidak ditemukan dalam kebisingan.",
    "Stop comparing your Chapter 1 with someone's Chapter 20.",
    "Anda tidak bisa mengontrol market. Tapi Anda bisa mengontrol reaksi Anda.",
    "Kunci kedamaian: fokus pada apa yang bisa Anda kontrol, lepaskan sisanya.",
    "Quiet the mind and the market will speak clearly.",
    "Trading jangan jadi candu. Ia harus jadi tools, bukan tuan.",
    "Batin yang damai adalah edge terbaik seorang trader.",
    "Rileks adalah skill. Ia harus dilatih setiap hari.",
    "Ketenangan bukan berarti tidak ada badai, tapi berdamai dengan badai.",
  ],

  social: [
    "Kesuksesan sejati diukur dari seberapa banyak kehidupan yang Anda ubah menjadi lebih baik.",
    "Berbagi ilmu tidak akan mengurangi, justru melipatgandakan kebijaksanaan.",
    "We rise by lifting others. — Robert Ingersoll",
    "Tidak ada yang tidak berguna di dunia ini jika ia meringankan beban orang lain. — Charles Dickens",
    "Orang terkaya bukan yang paling banyak memiliki, tapi yang paling banyak memberi.",
    "Satu lilin bisa menyalakan ribuan lilin tanpa kehilangan apinya.",
    "Komunitas yang solid adalah aset yang tidak bisa dibeli dengan uang.",
    "Jadilah orang yang membuat orang lain merasa berharga.",
    "Kolaborasi > Kompetisi. Bersama kita tumbuh lebih cepat.",
    "Ilmu yang bermanfaat adalah sedekah jariyah yang tidak akan pernah putus.",
    "Kesuksesan tanpa penerus adalah kegagalan.",
    "Ajarkan orang memancing, bukan beri ikan. — Lao Tzu",
    "The purpose of life is to be useful, to be honorable, to be compassionate. — Emerson",
    "Satu-satunya cara untuk memiliki teman adalah menjadi teman. — Emerson",
    "Berbagi pengalaman loss Anda mungkin menyelamatkan orang lain dari kesalahan yang sama.",
    "Kita adalah rata-rata dari lima orang terdekat kita. Pilih circle Anda dengan bijak.",
    "Kebaikan kecil yang konsisten lebih berarti dari kebaikan besar yang sesekali.",
    "Give without remembering, receive without forgetting.",
    "Kekuatan sebuah jaringan bukan diukur dari jumlah, tapi dari kualitas hubungannya.",
    "Ketika Anda membantu orang lain tumbuh, Anda juga bertumbuh.",
    "Kata-kata baik tidak memerlukan biaya, namun pencapaiannya tak ternilai.",
    "No one has ever become poor by giving. — Anne Frank",
    "Di balik setiap trader sukses, ada mentor yang peduli.",
    "Edukasi adalah hadiah terbaik yang bisa Anda berikan.",
    "Sharing profit is good. Sharing knowledge is better. Sharing both is legacy.",
  ],

  gratitude: [
    "Bersyukurlah atas profit kecil, karena ia mengajarkan Anda menghargai proses.",
    "Setiap hari adalah kesempatan baru untuk menjadi versi terbaik diri Anda.",
    "Gratitude turns what we have into enough.",
    "Bersyukur bukan karena semuanya baik, tapi karena Anda bisa melihat kebaikan dalam segala hal.",
    "Hidup ini sederhana: hitung nikmat, bukan masalah.",
    "Bangun pagi dengan rasa syukur. Ini adalah fondasi hari yang produktif.",
    "Orang yang bersyukur adalah orang yang kaya, tak peduli berapa saldo akunnya.",
    "Jangan bandingkan profit Anda dengan orang lain. Bandingkan dengan diri Anda kemarin.",
    "Gratitude is the healthiest of all human emotions. — Zig Ziglar",
    "Setiap pagi, tulis 3 hal yang Anda syukuri. Ini mengubah perspektif Anda.",
    "Break-even day is still a good day. You preserved capital.",
    "Dalam setiap loss, ada pelajaran. Dalam setiap profit, ada berkah.",
    "Bersyukur membuka pintu rezeki berikutnya.",
    "Appreciation is a wonderful thing. It makes what is excellent in others belong to us as well. — Voltaire",
    "The more you praise and celebrate your life, the more there is in life to celebrate. — Oprah",
    "Syukur mengubah cukup menjadi lebih dari cukup.",
    "Lihatlah ke bawah untuk bersyukur, ke atas untuk termotivasi.",
    "Kebahagiaan bukan tentang mendapatkan apa yang Anda inginkan, tapi mensyukuri apa yang Anda miliki.",
    "When you focus on the good, the good gets better.",
    "Jika Anda tidak mensyukuri yang kecil, Anda tidak akan mendapatkan yang besar.",
    "Gratitude adalah shortcut menuju kebahagiaan.",
    "Hari ini adalah anugerah. Itulah kenapa disebut 'present'.",
  ],

  resilience: [
    "Loss bukan kegagalan, melainkan biaya belajar menuju konsistensi.",
    "Trader terbaik bukan yang tidak pernah jatuh, tapi yang selalu bangkit.",
    "Jatuh tujuh kali, bangkit delapan kali. — Pepatah Jepang",
    "Kegagalan adalah bumbu yang memberi rasa pada kesuksesan. — Truman Capote",
    "It's not whether you get knocked down, it's whether you get up. — Vince Lombardi",
    "Setiap trader hebat punya cerita tentang drawdown yang hampir mematikan.",
    "Yang tidak membunuhmu akan membuatmu lebih kuat. — Nietzsche",
    "Rock bottom menjadi fondasi yang solid untuk membangun kembali.",
    "Mental kuat bukan berarti tidak menangis. Tapi tetap berjalan meski mata berkaca-kaca.",
    "Dalam hidup, badai akan datang. Bukan tentang menghindarinya, tapi belajar menari di tengah hujan.",
    "Ketahanan adalah kemampuan beradaptasi saat keadaan tidak sesuai rencana.",
    "Just keep swimming. — Dory, Finding Nemo",
    "Trading mengajarkan satu hal: besok selalu ada kesempatan baru.",
    "Jika rencana A gagal, ingat masih ada 25 huruf lagi.",
    "Perbedaan antara master dan pemula: master telah gagal lebih banyak.",
    "Resilience is very different from being numb. Resilience means you experience, you feel, you fail, you hurt, you fall. But you keep going. — Yasmin Mogahed",
    "Kegagalan adalah sukses yang tertunda.",
    "Di setiap loss, tanyakan: Apa yang bisa saya pelajari? Bukan: Kenapa saya selalu rugi?",
    "Your best teacher is your last mistake. — Ralph Nader",
    "Ketangguhan mental seperti otot. Semakin dilatih, semakin kuat.",
    "Jika Anda tidak pernah gagal, Anda tidak pernah mencoba sesuatu yang baru. — Einstein",
    "Drawdown adalah ujian. Recovery adalah bukti.",
    "Traders are forged in fire. Losses temper the steel.",
    "Satu-satunya kegagalan sejati adalah berhenti mencoba.",
    "Bangun, dust yourself off, reload the charts, and go again.",
    "Setiap pagi Anda lahir kembali. Apa yang Anda lakukan hari ini adalah yang terpenting. — Buddha",
    "Bad days build better traders.",
    "Rintangan adalah hal menakutkan yang Anda lihat saat melepaskan pandangan dari tujuan. — Henry Ford",
    "Anda tidak bisa mengubah arah angin, tapi Anda bisa menyesuaikan layar.",
  ],
};

// ============================================================================
// CATEGORY MAPPING FOR TRIGGER TYPES
// ============================================================================

const TRIGGER_CATEGORY_MAP = {
  morning_prep: ["discipline", "patience", "gratitude"],
  daily_report: ["investment", "serenity"],
  weekly_recap: ["gratitude", "serenity", "social"],
  vps_billing_warning: ["investment", "discipline"],
  vps_billing_urgent: ["investment", "discipline"],
  profit_share_invoice_ready: ["investment", "social", "gratitude"],
};

// Anti-repeat tracker (per kategori, reset setiap 30 hari atau saat semua sudah dipakai)
const recentlyUsed = {};

function _clearOldEntries() {
  const oneMonthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  for (const cat of Object.keys(recentlyUsed)) {
    recentlyUsed[cat] = recentlyUsed[cat].filter(
      (entry) => entry.timestamp > oneMonthAgo
    );
    if (recentlyUsed[cat].length === 0) delete recentlyUsed[cat];
  }
}

/**
 * Get a random quote from a specific category, avoiding recent repeats.
 * @param {string} category - Quote category name
 * @returns {{ text: string, category: string }}
 */
export function getRandomQuote(category) {
  _clearOldEntries();

  const pool = QUOTES[category];
  if (!pool || pool.length === 0) {
    return {
      text: "Tidak ada kutipan tersedia.",
      category: "general",
    };
  }

  // Build list of indices not recently used
  const usedIndices = (recentlyUsed[category] || []).map((e) => e.index);
  const availableIndices = pool
    .map((_, i) => i)
    .filter((i) => !usedIndices.includes(i));

  // If all used, reset and use all
  const indices =
    availableIndices.length > 0
      ? availableIndices
      : pool.map((_, i) => i);

  const randomIndex = indices[Math.floor(Math.random() * indices.length)];

  // Track usage
  if (!recentlyUsed[category]) recentlyUsed[category] = [];
  recentlyUsed[category].push({ index: randomIndex, timestamp: Date.now() });

  return {
    text: pool[randomIndex],
    category,
  };
}

/**
 * Get a quote appropriate for a given trigger type.
 * Selects a random category from the trigger's mapped categories, then a random quote.
 * @param {string} triggerName - e.g. 'morning_prep', 'daily_report', 'vps_billing_warning'
 * @returns {{ text: string, category: string }}
 */
export function getQuoteForTrigger(triggerName) {
  const categories = TRIGGER_CATEGORY_MAP[triggerName] || ["discipline", "serenity"];

  // Weighted: prefer categories with more available quotes
  const categoryWeights = categories.map((cat) => {
    const pool = QUOTES[cat] || [];
    const usedCount = (recentlyUsed[cat] || []).length;
    const availableCount = Math.max(0, pool.length - usedCount);
    return { cat, weight: availableCount > 0 ? availableCount : 1 };
  });

  const totalWeight = categoryWeights.reduce((sum, c) => sum + c.weight, 0);
  let random = Math.random() * totalWeight;

  let selectedCategory = categories[0];
  for (const { cat, weight } of categoryWeights) {
    random -= weight;
    if (random <= 0) {
      selectedCategory = cat;
      break;
    }
  }

  return getRandomQuote(selectedCategory);
}

/**
 * Get all available categories.
 */
export function getAllCategories() {
  return Object.keys(QUOTES);
}

/**
 * Get the Monday kickoff quote — always high-energy, resilience-focused.
 */
export function getMondayKickoffQuote() {
  const mondayPool = [
    ...(QUOTES.resilience || []).slice(0, 10),
    ...(QUOTES.discipline || []).slice(0, 10),
  ];
  const idx = Math.floor(Math.random() * mondayPool.length);
  return {
    text: mondayPool[idx],
    category: "resilience",
  };
}

export { QUOTES, TRIGGER_CATEGORY_MAP };
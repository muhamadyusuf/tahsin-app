// ─────────────────────────────────────────────────────────────────────────────
// Dzikir Pagi & Petang (Dzikir Sore)
//
// Teks dinukil dari kumpulan dzikir shahih yang masyhur, terutama kitab
// "Hishnul Muslim" (Sa'id bin 'Ali bin Wahf al-Qahthani) yang menghimpun
// dzikir dari Al-Qur'an dan hadits-hadits shahih/hasan. Setiap butir
// disertai sumber (takhrij) beserta derajat keshahihannya agar dapat
// diperiksa ulang keabsahannya. Waktu dzikir pagi: setelah Subuh hingga
// matahari meninggi. Waktu dzikir petang: setelah 'Ashar hingga terbenam
// matahari (sebagian ulama membolehkan hingga sepertiga malam).
// ─────────────────────────────────────────────────────────────────────────────

export type DzikirItem = {
  id: string;
  /** Judul singkat butir dzikir */
  judul: string;
  /** Teks Arab berharakat */
  arab: string;
  /** Transliterasi latin */
  latin: string;
  /** Terjemahan bahasa Indonesia */
  terjemah: string;
  /** Jumlah pengulangan yang dianjurkan */
  ulang: number;
  /** Keutamaan / faedah (bila ada dalam riwayat) */
  fadhilah?: string;
  /** Sumber riwayat + derajat keshahihan (takhrij) */
  sumber: string;
};

// ── DZIKIR PAGI ──────────────────────────────────────────────────────────────
export const DZIKIR_PAGI: DzikirItem[] = [
  {
    id: "pagi-taawudz-kursi",
    judul: "Ayat Kursi",
    arab:
      "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ ۚ لَا تَأْخُذُهُ سِنَةٌ وَلَا نَوْمٌ ۚ لَهُ مَا فِي السَّمَاوَاتِ وَمَا فِي الْأَرْضِ ۗ مَنْ ذَا الَّذِي يَشْفَعُ عِنْدَهُ إِلَّا بِإِذْنِهِ ۚ يَعْلَمُ مَا بَيْنَ أَيْدِيهِمْ وَمَا خَلْفَهُمْ ۖ وَلَا يُحِيطُونَ بِشَيْءٍ مِنْ عِلْمِهِ إِلَّا بِمَا شَاءَ ۚ وَسِعَ كُرْسِيُّهُ السَّمَاوَاتِ وَالْأَرْضَ ۖ وَلَا يَئُودُهُ حِفْظُهُمَا ۚ وَهُوَ الْعَلِيُّ الْعَظِيمُ",
    latin:
      "Allāhu lā ilāha illā huwal-ḥayyul-qayyūm, lā ta'khużuhū sinatuw wa lā naum, lahū mā fis-samāwāti wa mā fil-arḍ, man żallażī yasyfa'u 'indahū illā bi'iżnih, ya'lamu mā baina aidīhim wa mā khalfahum, wa lā yuḥīṭūna bisyai'im min 'ilmihī illā bimā syā', wasi'a kursiyyuhus-samāwāti wal-arḍ, wa lā ya'ūduhū ḥifẓuhumā, wa huwal-'aliyyul-'aẓīm.",
    terjemah:
      "Allah, tidak ada Tuhan (yang berhak disembah) melainkan Dia Yang Hidup kekal lagi terus-menerus mengurus (makhluk-Nya). Tidak mengantuk dan tidak tidur. Milik-Nya apa yang ada di langit dan di bumi. Tidak ada yang dapat memberi syafaat di sisi-Nya tanpa izin-Nya. Dia mengetahui apa yang di hadapan mereka dan di belakang mereka, dan mereka tidak mengetahui sesuatu apa pun dari ilmu-Nya kecuali apa yang Dia kehendaki. Kursi-Nya meliputi langit dan bumi, dan Dia tidak merasa berat memelihara keduanya. Dan Dia Mahatinggi lagi Mahabesar.",
    ulang: 1,
    fadhilah:
      "Siapa membacanya pada pagi hari, ia dijaga dari (gangguan) jin hingga sore, dan bila membacanya sore hari ia dijaga hingga pagi.",
    sumber: "QS. Al-Baqarah: 255. HR. Al-Hakim & An-Nasa'i (Amalul Yaum wal Lailah). Dishahihkan Al-Albani.",
  },
  {
    id: "pagi-ikhlas-muawwidzatain",
    judul: "Al-Ikhlash, Al-Falaq & An-Nas",
    arab:
      "قُلْ هُوَ اللَّهُ أَحَدٌ ۝ اللَّهُ الصَّمَدُ ۝ لَمْ يَلِدْ وَلَمْ يُولَدْ ۝ وَلَمْ يَكُنْ لَهُ كُفُوًا أَحَدٌ\n\nقُلْ أَعُوذُ بِرَبِّ الْفَلَقِ ۝ مِنْ شَرِّ مَا خَلَقَ ۝ وَمِنْ شَرِّ غَاسِقٍ إِذَا وَقَبَ ۝ وَمِنْ شَرِّ النَّفَّاثَاتِ فِي الْعُقَدِ ۝ وَمِنْ شَرِّ حَاسِدٍ إِذَا حَسَدَ\n\nقُلْ أَعُوذُ بِرَبِّ النَّاسِ ۝ مَلِكِ النَّاسِ ۝ إِلَٰهِ النَّاسِ ۝ مِنْ شَرِّ الْوَسْوَاسِ الْخَنَّاسِ ۝ الَّذِي يُوَسْوِسُ فِي صُدُورِ النَّاسِ ۝ مِنَ الْجِنَّةِ وَالنَّاسِ",
    latin:
      "Qul huwallāhu aḥad… (Al-Ikhlāṣ), Qul a'ūżu bi rabbil-falaq… (Al-Falaq), Qul a'ūżu bi rabbin-nās… (An-Nās).",
    terjemah:
      "Membaca surah Al-Ikhlash, Al-Falaq, dan An-Nas masing-masing tiga kali. (Terjemah lengkap ada pada mushaf).",
    ulang: 3,
    fadhilah:
      "Cukup bagimu (sebagai pelindung) dari segala sesuatu, dibaca tiga kali setiap pagi dan petang.",
    sumber: "QS. Al-Ikhlash, Al-Falaq, An-Nas. HR. Abu Dawud (5082) & At-Tirmidzi (3575). Hasan shahih.",
  },
  {
    id: "pagi-asbahna-mulku",
    judul: "Berpagi hari di atas kerajaan Allah",
    arab:
      "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَٰذَا الْيَوْمِ وَخَيْرَ مَا بَعْدَهُ، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَٰذَا الْيَوْمِ وَشَرِّ مَا بَعْدَهُ، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ",
    latin:
      "Aṣbaḥnā wa aṣbaḥal-mulku lillāh, wal-ḥamdu lillāh, lā ilāha illallāhu waḥdahū lā syarīka lah, lahul-mulku wa lahul-ḥamdu wa huwa 'alā kulli syai'in qadīr. Rabbi as'aluka khaira mā fī hāżal-yaum wa khaira mā ba'dah, wa a'ūżu bika min syarri mā fī hāżal-yaum wa syarri mā ba'dah. Rabbi a'ūżu bika minal-kasali wa sū'il-kibar. Rabbi a'ūżu bika min 'ażābin fin-nāri wa 'ażābin fil-qabr.",
    terjemah:
      "Kami memasuki waktu pagi dan kerajaan hanya milik Allah. Segala puji bagi Allah. Tidak ada Tuhan (yang berhak disembah) kecuali Allah semata, tiada sekutu bagi-Nya. Milik-Nya kerajaan dan bagi-Nya segala puji, dan Dia Mahakuasa atas segala sesuatu. Wahai Rabb, aku memohon kepada-Mu kebaikan hari ini dan kebaikan sesudahnya, dan aku berlindung kepada-Mu dari keburukan hari ini dan keburukan sesudahnya. Wahai Rabb, aku berlindung kepada-Mu dari kemalasan dan keburukan (masa) tua. Wahai Rabb, aku berlindung kepada-Mu dari siksa di neraka dan siksa di kubur.",
    ulang: 1,
    sumber: "HR. Muslim (2723) dari Ibnu Mas'ud radhiyallahu 'anhu. Shahih.",
  },
  {
    id: "pagi-allahumma-bika-asbahna",
    judul: "Dengan-Mu kami berpagi hari",
    arab:
      "اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ النُّشُورُ",
    latin:
      "Allāhumma bika aṣbaḥnā, wa bika amsainā, wa bika naḥyā, wa bika namūt, wa ilaikan-nusyūr.",
    terjemah:
      "Ya Allah, dengan (rahmat dan pertolongan)-Mu kami memasuki waktu pagi, dan dengan-Mu kami memasuki waktu petang. Dengan-Mu kami hidup dan dengan-Mu kami mati, dan kepada-Mu tempat kembali.",
    ulang: 1,
    sumber: "HR. At-Tirmidzi (3391) dari Abu Hurairah. Hasan.",
  },
  {
    id: "pagi-sayyidul-istighfar",
    judul: "Sayyidul Istighfar (Penghulu Istighfar)",
    arab:
      "اللَّهُمَّ أَنْتَ رَبِّي لَا إِلَٰهَ إِلَّا أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَىٰ عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي، فَاغْفِرْ لِي فَإِنَّهُ لَا يَغْفِرُ الذُّنُوبَ إِلَّا أَنْتَ",
    latin:
      "Allāhumma anta rabbī lā ilāha illā anta, khalaqtanī wa anā 'abduka, wa anā 'alā 'ahdika wa wa'dika mastaṭa'tu, a'ūżu bika min syarri mā ṣana'tu, abū'u laka bini'matika 'alayya, wa abū'u biżanbī faghfir lī fa'innahū lā yaghfiruż-żunūba illā anta.",
    terjemah:
      "Ya Allah, Engkau Tuhanku, tidak ada Tuhan (yang berhak disembah) selain Engkau. Engkau menciptakanku dan aku hamba-Mu. Aku menetapi perjanjian dan janji-Mu semampuku. Aku berlindung kepada-Mu dari keburukan yang kuperbuat. Aku mengakui nikmat-Mu kepadaku dan aku mengakui dosaku, maka ampunilah aku, sebab tidak ada yang mengampuni dosa selain Engkau.",
    ulang: 1,
    fadhilah:
      "Siapa membacanya di siang hari dengan penuh keyakinan lalu mati sebelum petang, ia termasuk penghuni surga; demikian pula bila dibaca malam hari.",
    sumber: "HR. Al-Bukhari (6306) dari Syaddad bin Aus. Shahih.",
  },
  {
    id: "pagi-ridhitu",
    judul: "Ridha kepada Allah, Islam & Nabi Muhammad",
    arab:
      "رَضِيتُ بِاللَّهِ رَبًّا، وَبِالْإِسْلَامِ دِينًا، وَبِمُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ نَبِيًّا",
    latin:
      "Raḍītu billāhi rabbā, wa bil-islāmi dīnā, wa bi Muḥammadin ṣallallāhu 'alaihi wa sallama nabiyyā.",
    terjemah:
      "Aku ridha Allah sebagai Tuhanku, Islam sebagai agamaku, dan Muhammad shallallahu 'alaihi wa sallam sebagai nabiku.",
    ulang: 3,
    fadhilah:
      "Barang siapa mengucapkannya tiga kali pada pagi dan petang, Allah berjanji akan meridhainya pada hari kiamat.",
    sumber: "HR. Ahmad, Abu Dawud (5072), At-Tirmidzi (3389), An-Nasa'i. Hasan.",
  },
  {
    id: "pagi-ya-hayyu-ya-qayyum",
    judul: "Memohon perbaikan seluruh urusan",
    arab:
      "يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ، أَصْلِحْ لِي شَأْنِي كُلَّهُ، وَلَا تَكِلْنِي إِلَىٰ نَفْسِي طَرْفَةَ عَيْنٍ",
    latin:
      "Yā ḥayyu yā qayyūmu biraḥmatika astagīṡu, aṣliḥ lī sya'nī kullah, wa lā takilnī ilā nafsī ṭarfata 'ain.",
    terjemah:
      "Wahai Yang Mahahidup, wahai Yang Maha Berdiri Sendiri, dengan rahmat-Mu aku memohon pertolongan. Perbaikilah seluruh urusanku, dan janganlah Engkau serahkan (urusan)ku kepada diriku sendiri walau sekejap mata.",
    ulang: 1,
    sumber: "HR. An-Nasa'i (Amalul Yaum), Al-Hakim, Al-Bazzar dari Anas bin Malik. Hasan.",
  },
  {
    id: "pagi-asbahna-fitrah",
    judul: "Berpagi di atas fitrah Islam",
    arab:
      "أَصْبَحْنَا عَلَىٰ فِطْرَةِ الْإِسْلَامِ، وَعَلَىٰ كَلِمَةِ الْإِخْلَاصِ، وَعَلَىٰ دِينِ نَبِيِّنَا مُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ، وَعَلَىٰ مِلَّةِ أَبِينَا إِبْرَاهِيمَ حَنِيفًا مُسْلِمًا وَمَا كَانَ مِنَ الْمُشْرِكِينَ",
    latin:
      "Aṣbaḥnā 'alā fiṭratil-islām, wa 'alā kalimatil-ikhlāṣ, wa 'alā dīni nabiyyinā Muḥammadin ṣallallāhu 'alaihi wa sallam, wa 'alā millati abīnā Ibrāhīma ḥanīfam muslimāw wa mā kāna minal-musyrikīn.",
    terjemah:
      "Kami berpagi hari di atas fitrah Islam, di atas kalimat ikhlas (syahadat), di atas agama Nabi kami Muhammad shallallahu 'alaihi wa sallam, dan di atas agama bapak kami Ibrahim yang lurus lagi berserah diri, dan ia bukanlah termasuk orang-orang musyrik.",
    ulang: 1,
    sumber: "HR. Ahmad (15360) dari Abdurrahman bin Abza. Shahih.",
  },
  {
    id: "pagi-subhanallah-bihamdihi-100",
    judul: "Tasbih dan pujian",
    arab: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ",
    latin: "Subḥānallāhi wa biḥamdih.",
    terjemah: "Mahasuci Allah dan segala puji bagi-Nya.",
    ulang: 100,
    fadhilah:
      "Siapa mengucapkannya seratus kali pada pagi dan petang, tidak ada seorang pun yang datang pada hari kiamat membawa amalan lebih baik darinya kecuali orang yang mengucapkan semisal atau lebih.",
    sumber: "HR. Muslim (2692) dari Abu Hurairah. Shahih.",
  },
  {
    id: "pagi-tahlil-100",
    judul: "Tahlil (pengesaan Allah)",
    arab:
      "لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ",
    latin:
      "Lā ilāha illallāhu waḥdahū lā syarīka lah, lahul-mulku wa lahul-ḥamdu wa huwa 'alā kulli syai'in qadīr.",
    terjemah:
      "Tidak ada Tuhan (yang berhak disembah) selain Allah semata, tiada sekutu bagi-Nya. Milik-Nya kerajaan dan bagi-Nya segala puji, dan Dia Mahakuasa atas segala sesuatu.",
    ulang: 100,
    fadhilah:
      "Siapa mengucapkannya seratus kali dalam sehari, baginya (pahala) seperti memerdekakan sepuluh budak, ditulis untuknya seratus kebaikan, dihapus seratus keburukan, dan ia terjaga dari setan hingga petang.",
    sumber: "HR. Al-Bukhari (3293) & Muslim (2691) dari Abu Hurairah. Shahih.",
  },
  {
    id: "pagi-tasbih-adada-khalqihi",
    judul: "Tasbih sebanyak ciptaan Allah",
    arab:
      "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ عَدَدَ خَلْقِهِ، وَرِضَا نَفْسِهِ، وَزِنَةَ عَرْشِهِ، وَمِدَادَ كَلِمَاتِهِ",
    latin:
      "Subḥānallāhi wa biḥamdihī 'adada khalqih, wa riḍā nafsih, wa zinata 'arsyih, wa midāda kalimātih.",
    terjemah:
      "Mahasuci Allah dan segala puji bagi-Nya, sebanyak bilangan makhluk-Nya, seridha diri-Nya, seberat timbangan 'Arsy-Nya, dan sebanyak tinta (untuk menulis) kalimat-kalimat-Nya.",
    ulang: 3,
    sumber: "HR. Muslim (2726) dari Juwairiyah binti Al-Harits. Shahih.",
  },
  {
    id: "pagi-bismillah-la-yadhurru",
    judul: "Perlindungan dengan nama Allah",
    arab:
      "بِسْمِ اللَّهِ الَّذِي لَا يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الْأَرْضِ وَلَا فِي السَّمَاءِ، وَهُوَ السَّمِيعُ الْعَلِيمُ",
    latin:
      "Bismillāhillażī lā yaḍurru ma'asmihī syai'un fil-arḍi wa lā fis-samā', wa huwas-samī'ul-'alīm.",
    terjemah:
      "Dengan nama Allah yang bersama nama-Nya tidak ada sesuatu pun di bumi dan di langit yang dapat membahayakan, dan Dia Maha Mendengar lagi Maha Mengetahui.",
    ulang: 3,
    fadhilah:
      "Siapa membacanya tiga kali pada pagi dan petang, tidak ada sesuatu pun yang membahayakannya.",
    sumber: "HR. Abu Dawud (5088), At-Tirmidzi (3388), Ibnu Majah (3869) dari Utsman bin Affan. Shahih.",
  },
  {
    id: "pagi-afini",
    judul: "Memohon 'afiyah (keselamatan) badan & pendengaran",
    arab:
      "اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لَا إِلَٰهَ إِلَّا أَنْتَ. اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْكُفْرِ وَالْفَقْرِ، وَأَعُوذُ بِكَ مِنْ عَذَابِ الْقَبْرِ، لَا إِلَٰهَ إِلَّا أَنْتَ",
    latin:
      "Allāhumma 'āfinī fī badanī, Allāhumma 'āfinī fī sam'ī, Allāhumma 'āfinī fī baṣarī, lā ilāha illā anta. Allāhumma innī a'ūżu bika minal-kufri wal-faqr, wa a'ūżu bika min 'ażābil-qabr, lā ilāha illā anta.",
    terjemah:
      "Ya Allah, sehatkanlah badanku. Ya Allah, sehatkanlah pendengaranku. Ya Allah, sehatkanlah penglihatanku. Tidak ada Tuhan (yang berhak disembah) selain Engkau. Ya Allah, aku berlindung kepada-Mu dari kekufuran dan kefakiran, dan aku berlindung kepada-Mu dari siksa kubur. Tidak ada Tuhan selain Engkau.",
    ulang: 3,
    sumber: "HR. Abu Dawud (5090) & Ahmad dari Abu Bakrah. Hasan.",
  },
  {
    id: "pagi-af-wal-afiyah",
    judul: "Memohon ampunan & keselamatan",
    arab:
      "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالْآخِرَةِ، اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي دِينِي وَدُنْيَايَ وَأَهْلِي وَمَالِي، اللَّهُمَّ اسْتُرْ عَوْرَاتِي وَآمِنْ رَوْعَاتِي، اللَّهُمَّ احْفَظْنِي مِنْ بَيْنِ يَدَيَّ وَمِنْ خَلْفِي، وَعَنْ يَمِينِي وَعَنْ شِمَالِي، وَمِنْ فَوْقِي، وَأَعُوذُ بِعَظَمَتِكَ أَنْ أُغْتَالَ مِنْ تَحْتِي",
    latin:
      "Allāhumma innī as'alukal-'afwa wal-'āfiyata fid-dunyā wal-ākhirah. Allāhumma innī as'alukal-'afwa wal-'āfiyata fī dīnī wa dunyāya wa ahlī wa mālī. Allāhummastur 'aurātī wa āmin rau'ātī. Allāhummaḥfaẓnī mim baini yadayya wa min khalfī, wa 'an yamīnī wa 'an syimālī, wa min fauqī, wa a'ūżu bi'aẓamatika an ugtāla min taḥtī.",
    terjemah:
      "Ya Allah, aku memohon kepada-Mu ampunan dan keselamatan di dunia dan akhirat. Ya Allah, aku memohon kepada-Mu ampunan dan keselamatan dalam agamaku, duniaku, keluargaku, dan hartaku. Ya Allah, tutupilah auratku (aib-aibku) dan tenteramkanlah ketakutanku. Ya Allah, jagalah aku dari depan, belakang, kanan, kiri, dan atasku. Dan aku berlindung dengan keagungan-Mu agar tidak disambar (binasa) dari bawahku.",
    ulang: 1,
    sumber: "HR. Abu Dawud (5074) & Ibnu Majah (3871) dari Ibnu Umar. Shahih.",
  },
  {
    id: "pagi-alimal-ghaib",
    judul: "Berlindung dari keburukan diri & setan",
    arab:
      "اللَّهُمَّ عَالِمَ الْغَيْبِ وَالشَّهَادَةِ فَاطِرَ السَّمَاوَاتِ وَالْأَرْضِ، رَبَّ كُلِّ شَيْءٍ وَمَلِيكَهُ، أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا أَنْتَ، أَعُوذُ بِكَ مِنْ شَرِّ نَفْسِي، وَمِنْ شَرِّ الشَّيْطَانِ وَشِرْكِهِ، وَأَنْ أَقْتَرِفَ عَلَىٰ نَفْسِي سُوءًا أَوْ أَجُرَّهُ إِلَىٰ مُسْلِمٍ",
    latin:
      "Allāhumma 'ālimal-gaibi wasy-syahādah, fāṭiras-samāwāti wal-arḍ, rabba kulli syai'iw wa malīkah, asyhadu allā ilāha illā anta, a'ūżu bika min syarri nafsī, wa min syarrisy-syaiṭāni wa syirkih, wa an aqtarifa 'alā nafsī sū'an au ajurrahū ilā muslim.",
    terjemah:
      "Ya Allah, Yang Maha Mengetahui yang gaib dan yang nyata, Pencipta langit dan bumi, Tuhan dan Penguasa segala sesuatu. Aku bersaksi tidak ada Tuhan (yang berhak disembah) selain Engkau. Aku berlindung kepada-Mu dari keburukan diriku, dari keburukan setan dan sekutunya, dan dari (keburukan) aku melakukan kejahatan terhadap diriku atau menyeretnya kepada seorang muslim.",
    ulang: 1,
    sumber: "HR. Abu Dawud (5067) & At-Tirmidzi (3529) dari Abu Hurairah. Shahih.",
  },
  {
    id: "pagi-shalawat",
    judul: "Shalawat kepada Nabi ﷺ",
    arab:
      "اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَىٰ نَبِيِّنَا مُحَمَّدٍ",
    latin: "Allāhumma ṣalli wa sallim 'alā nabiyyinā Muḥammad.",
    terjemah: "Ya Allah, limpahkanlah shalawat dan salam kepada Nabi kami Muhammad.",
    ulang: 10,
    fadhilah:
      "Siapa bershalawat kepadaku sepuluh kali di pagi hari dan sepuluh kali di petang hari, ia akan mendapatkan syafaatku pada hari kiamat.",
    sumber: "HR. Ath-Thabrani dalam Al-Ausath & Al-Kabir dari Abu Darda'. Hasan.",
  },
];

// Ambil butir dzikir pagi berdasarkan id (aman dari perubahan urutan array).
// Teks dzikir petang banyak yang identik dengan pagi, jadi cukup dirujuk.
const pagi = (id: string): DzikirItem => {
  const item = DZIKIR_PAGI.find((d) => d.id === id);
  if (!item) throw new Error(`Dzikir pagi tidak ditemukan: ${id}`);
  return item;
};

// ── DZIKIR PETANG (SORE) ─────────────────────────────────────────────────────
export const DZIKIR_SORE: DzikirItem[] = [
  {
    id: "sore-taawudz-kursi",
    judul: "Ayat Kursi",
    arab: pagi("pagi-taawudz-kursi").arab,
    latin: pagi("pagi-taawudz-kursi").latin,
    terjemah: pagi("pagi-taawudz-kursi").terjemah,
    ulang: 1,
    fadhilah:
      "Siapa membacanya pada sore hari, ia dijaga dari (gangguan) jin hingga pagi.",
    sumber: "QS. Al-Baqarah: 255. HR. Al-Hakim & An-Nasa'i (Amalul Yaum wal Lailah). Dishahihkan Al-Albani.",
  },
  {
    id: "sore-ikhlas-muawwidzatain",
    judul: "Al-Ikhlash, Al-Falaq & An-Nas",
    arab: pagi("pagi-ikhlas-muawwidzatain").arab,
    latin: pagi("pagi-ikhlas-muawwidzatain").latin,
    terjemah: pagi("pagi-ikhlas-muawwidzatain").terjemah,
    ulang: 3,
    fadhilah:
      "Cukup bagimu (sebagai pelindung) dari segala sesuatu, dibaca tiga kali setiap pagi dan petang.",
    sumber: "QS. Al-Ikhlash, Al-Falaq, An-Nas. HR. Abu Dawud (5082) & At-Tirmidzi (3575). Hasan shahih.",
  },
  {
    id: "sore-amsayna-mulku",
    judul: "Berpetang di atas kerajaan Allah",
    arab:
      "أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ، لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ، رَبِّ أَسْأَلُكَ خَيْرَ مَا فِي هَٰذِهِ اللَّيْلَةِ وَخَيْرَ مَا بَعْدَهَا، وَأَعُوذُ بِكَ مِنْ شَرِّ مَا فِي هَٰذِهِ اللَّيْلَةِ وَشَرِّ مَا بَعْدَهَا، رَبِّ أَعُوذُ بِكَ مِنَ الْكَسَلِ وَسُوءِ الْكِبَرِ، رَبِّ أَعُوذُ بِكَ مِنْ عَذَابٍ فِي النَّارِ وَعَذَابٍ فِي الْقَبْرِ",
    latin:
      "Amsainā wa amsal-mulku lillāh, wal-ḥamdu lillāh, lā ilāha illallāhu waḥdahū lā syarīka lah, lahul-mulku wa lahul-ḥamdu wa huwa 'alā kulli syai'in qadīr. Rabbi as'aluka khaira mā fī hāżihil-lailah wa khaira mā ba'dahā, wa a'ūżu bika min syarri mā fī hāżihil-lailah wa syarri mā ba'dahā. Rabbi a'ūżu bika minal-kasali wa sū'il-kibar. Rabbi a'ūżu bika min 'ażābin fin-nāri wa 'ażābin fil-qabr.",
    terjemah:
      "Kami memasuki waktu petang dan kerajaan hanya milik Allah. Segala puji bagi Allah. Tidak ada Tuhan (yang berhak disembah) kecuali Allah semata, tiada sekutu bagi-Nya. Milik-Nya kerajaan dan bagi-Nya segala puji, dan Dia Mahakuasa atas segala sesuatu. Wahai Rabb, aku memohon kepada-Mu kebaikan malam ini dan kebaikan sesudahnya, dan aku berlindung kepada-Mu dari keburukan malam ini dan keburukan sesudahnya. Wahai Rabb, aku berlindung kepada-Mu dari kemalasan dan keburukan (masa) tua. Wahai Rabb, aku berlindung kepada-Mu dari siksa di neraka dan siksa di kubur.",
    ulang: 1,
    sumber: "HR. Muslim (2723) dari Ibnu Mas'ud radhiyallahu 'anhu. Shahih.",
  },
  {
    id: "sore-allahumma-bika-amsayna",
    judul: "Dengan-Mu kami berpetang",
    arab:
      "اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ، وَإِلَيْكَ الْمَصِيرُ",
    latin:
      "Allāhumma bika amsainā, wa bika aṣbaḥnā, wa bika naḥyā, wa bika namūt, wa ilaikal-maṣīr.",
    terjemah:
      "Ya Allah, dengan (rahmat dan pertolongan)-Mu kami memasuki waktu petang, dan dengan-Mu kami memasuki waktu pagi. Dengan-Mu kami hidup dan dengan-Mu kami mati, dan kepada-Mu tempat kembali.",
    ulang: 1,
    sumber: "HR. At-Tirmidzi (3391) dari Abu Hurairah. Hasan.",
  },
  {
    id: "sore-sayyidul-istighfar",
    judul: "Sayyidul Istighfar (Penghulu Istighfar)",
    arab: pagi("pagi-sayyidul-istighfar").arab,
    latin: pagi("pagi-sayyidul-istighfar").latin,
    terjemah: pagi("pagi-sayyidul-istighfar").terjemah,
    ulang: 1,
    fadhilah:
      "Siapa membacanya di malam hari dengan penuh keyakinan lalu mati sebelum pagi, ia termasuk penghuni surga.",
    sumber: "HR. Al-Bukhari (6306) dari Syaddad bin Aus. Shahih.",
  },
  {
    id: "sore-ridhitu",
    judul: "Ridha kepada Allah, Islam & Nabi Muhammad",
    arab: pagi("pagi-ridhitu").arab,
    latin: pagi("pagi-ridhitu").latin,
    terjemah: pagi("pagi-ridhitu").terjemah,
    ulang: 3,
    fadhilah:
      "Barang siapa mengucapkannya tiga kali pada pagi dan petang, Allah berjanji akan meridhainya pada hari kiamat.",
    sumber: "HR. Ahmad, Abu Dawud (5072), At-Tirmidzi (3389), An-Nasa'i. Hasan.",
  },
  {
    id: "sore-ya-hayyu-ya-qayyum",
    judul: "Memohon perbaikan seluruh urusan",
    arab: pagi("pagi-ya-hayyu-ya-qayyum").arab,
    latin: pagi("pagi-ya-hayyu-ya-qayyum").latin,
    terjemah: pagi("pagi-ya-hayyu-ya-qayyum").terjemah,
    ulang: 1,
    sumber: "HR. An-Nasa'i (Amalul Yaum), Al-Hakim, Al-Bazzar dari Anas bin Malik. Hasan.",
  },
  {
    id: "sore-amsayna-fitrah",
    judul: "Berpetang di atas fitrah Islam",
    arab:
      "أَمْسَيْنَا عَلَىٰ فِطْرَةِ الْإِسْلَامِ، وَعَلَىٰ كَلِمَةِ الْإِخْلَاصِ، وَعَلَىٰ دِينِ نَبِيِّنَا مُحَمَّدٍ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ، وَعَلَىٰ مِلَّةِ أَبِينَا إِبْرَاهِيمَ حَنِيفًا مُسْلِمًا وَمَا كَانَ مِنَ الْمُشْرِكِينَ",
    latin:
      "Amsainā 'alā fiṭratil-islām, wa 'alā kalimatil-ikhlāṣ, wa 'alā dīni nabiyyinā Muḥammadin ṣallallāhu 'alaihi wa sallam, wa 'alā millati abīnā Ibrāhīma ḥanīfam muslimāw wa mā kāna minal-musyrikīn.",
    terjemah:
      "Kami berpetang hari di atas fitrah Islam, di atas kalimat ikhlas (syahadat), di atas agama Nabi kami Muhammad shallallahu 'alaihi wa sallam, dan di atas agama bapak kami Ibrahim yang lurus lagi berserah diri, dan ia bukanlah termasuk orang-orang musyrik.",
    ulang: 1,
    sumber: "HR. Ahmad (15360) dari Abdurrahman bin Abza. Shahih.",
  },
  {
    id: "sore-subhanallah-bihamdihi-100",
    judul: "Tasbih dan pujian",
    arab: pagi("pagi-subhanallah-bihamdihi-100").arab,
    latin: pagi("pagi-subhanallah-bihamdihi-100").latin,
    terjemah: pagi("pagi-subhanallah-bihamdihi-100").terjemah,
    ulang: 100,
    fadhilah:
      "Siapa mengucapkannya seratus kali pada pagi dan petang, tidak ada yang datang pada hari kiamat dengan amalan lebih baik darinya kecuali orang yang mengucapkan semisal atau lebih.",
    sumber: "HR. Muslim (2692) dari Abu Hurairah. Shahih.",
  },
  {
    id: "sore-tahlil-100",
    judul: "Tahlil (pengesaan Allah)",
    arab: pagi("pagi-tahlil-100").arab,
    latin: pagi("pagi-tahlil-100").latin,
    terjemah: pagi("pagi-tahlil-100").terjemah,
    ulang: 100,
    fadhilah:
      "Siapa mengucapkannya seratus kali dalam sehari, baginya (pahala) seperti memerdekakan sepuluh budak, ditulis seratus kebaikan, dihapus seratus keburukan, dan ia terjaga dari setan.",
    sumber: "HR. Al-Bukhari (3293) & Muslim (2691) dari Abu Hurairah. Shahih.",
  },
  {
    id: "sore-bismillah-la-yadhurru",
    judul: "Perlindungan dengan nama Allah",
    arab: pagi("pagi-bismillah-la-yadhurru").arab,
    latin: pagi("pagi-bismillah-la-yadhurru").latin,
    terjemah: pagi("pagi-bismillah-la-yadhurru").terjemah,
    ulang: 3,
    fadhilah:
      "Siapa membacanya tiga kali pada pagi dan petang, tidak ada sesuatu pun yang membahayakannya.",
    sumber: "HR. Abu Dawud (5088), At-Tirmidzi (3388), Ibnu Majah (3869) dari Utsman bin Affan. Shahih.",
  },
  {
    id: "sore-audzu-kalimat",
    judul: "Berlindung dengan kalimat Allah yang sempurna",
    arab:
      "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ",
    latin: "A'ūżu bikalimātillāhit-tāmmāti min syarri mā khalaq.",
    terjemah:
      "Aku berlindung dengan kalimat-kalimat Allah yang sempurna dari keburukan makhluk yang Dia ciptakan.",
    ulang: 3,
    fadhilah:
      "Siapa membacanya tiga kali ketika petang, tidak akan membahayakannya sengatan (binatang berbisa) pada malam itu.",
    sumber: "HR. Muslim (2709) & At-Tirmidzi (3437) dari Abu Hurairah. Shahih. (Khusus dibaca petang hari).",
  },
  {
    id: "sore-afini",
    judul: "Memohon 'afiyah (keselamatan) badan & pendengaran",
    arab: pagi("pagi-afini").arab,
    latin: pagi("pagi-afini").latin,
    terjemah: pagi("pagi-afini").terjemah,
    ulang: 3,
    sumber: "HR. Abu Dawud (5090) & Ahmad dari Abu Bakrah. Hasan.",
  },
  {
    id: "sore-af-wal-afiyah",
    judul: "Memohon ampunan & keselamatan",
    arab: pagi("pagi-af-wal-afiyah").arab,
    latin: pagi("pagi-af-wal-afiyah").latin,
    terjemah: pagi("pagi-af-wal-afiyah").terjemah,
    ulang: 1,
    sumber: "HR. Abu Dawud (5074) & Ibnu Majah (3871) dari Ibnu Umar. Shahih.",
  },
  {
    id: "sore-alimal-ghaib",
    judul: "Berlindung dari keburukan diri & setan",
    arab: pagi("pagi-alimal-ghaib").arab,
    latin: pagi("pagi-alimal-ghaib").latin,
    terjemah: pagi("pagi-alimal-ghaib").terjemah,
    ulang: 1,
    sumber: "HR. Abu Dawud (5067) & At-Tirmidzi (3529) dari Abu Hurairah. Shahih.",
  },
  {
    id: "sore-shalawat",
    judul: "Shalawat kepada Nabi ﷺ",
    arab: pagi("pagi-shalawat").arab,
    latin: pagi("pagi-shalawat").latin,
    terjemah: pagi("pagi-shalawat").terjemah,
    ulang: 10,
    fadhilah:
      "Siapa bershalawat kepadaku sepuluh kali di pagi hari dan sepuluh kali di petang hari, ia akan mendapatkan syafaatku pada hari kiamat.",
    sumber: "HR. Ath-Thabrani dalam Al-Ausath & Al-Kabir dari Abu Darda'. Hasan.",
  },
];

// ── DZIKIR SETELAH SHALAT FARDHU ─────────────────────────────────────────────
export const DZIKIR_SETELAH_SHALAT: DzikirItem[] = [
  {
    id: "bada-istighfar",
    judul: "Istighfar",
    arab: "أَسْتَغْفِرُ اللَّهَ",
    latin: "Astagfirullāh.",
    terjemah: "Aku memohon ampun kepada Allah. (dibaca 3 kali)",
    ulang: 3,
    sumber: "HR. Muslim (591) dari Tsauban radhiyallahu 'anhu. Shahih.",
  },
  {
    id: "bada-antas-salam",
    judul: "Memohon keselamatan",
    arab:
      "اللَّهُمَّ أَنْتَ السَّلَامُ، وَمِنْكَ السَّلَامُ، تَبَارَكْتَ يَا ذَا الْجَلَالِ وَالْإِكْرَامِ",
    latin: "Allāhumma antas-salām, wa minkas-salām, tabārakta yā żal-jalāli wal-ikrām.",
    terjemah:
      "Ya Allah, Engkaulah As-Salam (Yang Mahasejahtera), dan dari-Mu keselamatan. Mahaberkah Engkau, wahai Pemilik keagungan dan kemuliaan.",
    ulang: 1,
    sumber: "HR. Muslim (591) dari Tsauban radhiyallahu 'anhu. Shahih.",
  },
  {
    id: "bada-la-mani",
    judul: "Tahlil & pengakuan kuasa Allah",
    arab:
      "لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ، اللَّهُمَّ لَا مَانِعَ لِمَا أَعْطَيْتَ، وَلَا مُعْطِيَ لِمَا مَنَعْتَ، وَلَا يَنْفَعُ ذَا الْجَدِّ مِنْكَ الْجَدُّ",
    latin:
      "Lā ilāha illallāhu waḥdahū lā syarīka lah, lahul-mulku wa lahul-ḥamdu wa huwa 'alā kulli syai'in qadīr. Allāhumma lā māni'a limā a'ṭaita, wa lā mu'ṭiya limā mana'ta, wa lā yanfa'u żal-jaddi minkal-jadd.",
    terjemah:
      "Tidak ada Tuhan (yang berhak disembah) selain Allah semata, tiada sekutu bagi-Nya. Milik-Nya kerajaan dan bagi-Nya segala puji, dan Dia Mahakuasa atas segala sesuatu. Ya Allah, tidak ada yang mampu mencegah apa yang Engkau beri, dan tidak ada yang mampu memberi apa yang Engkau cegah, dan tidak berguna kekayaan (kedudukan) bagi pemiliknya di hadapan-Mu.",
    ulang: 1,
    sumber: "HR. Al-Bukhari (844) & Muslim (593) dari Al-Mughirah bin Syu'bah. Shahih.",
  },
  {
    id: "bada-ayat-kursi",
    judul: "Ayat Kursi",
    arab: pagi("pagi-taawudz-kursi").arab,
    latin: pagi("pagi-taawudz-kursi").latin,
    terjemah: pagi("pagi-taawudz-kursi").terjemah,
    ulang: 1,
    fadhilah:
      "Barang siapa membaca Ayat Kursi setiap selesai shalat wajib, tidak ada yang menghalanginya masuk surga kecuali kematian.",
    sumber: "QS. Al-Baqarah: 255. HR. An-Nasa'i (Amalul Yaum wal Lailah, 100). Dishahihkan Al-Albani.",
  },
  {
    id: "bada-muawwidzat",
    judul: "Al-Ikhlash, Al-Falaq & An-Nas",
    arab: pagi("pagi-ikhlas-muawwidzatain").arab,
    latin: pagi("pagi-ikhlas-muawwidzatain").latin,
    terjemah: pagi("pagi-ikhlas-muawwidzatain").terjemah,
    ulang: 1,
    fadhilah:
      "Dibaca setiap selesai shalat; masing-masing tiga kali setelah shalat Subuh dan Maghrib.",
    sumber: "HR. Abu Dawud (1523) & At-Tirmidzi (2903) dari 'Uqbah bin 'Amir. Hasan.",
  },
  {
    id: "bada-tasbih-tahmid-takbir",
    judul: "Tasbih, Tahmid & Takbir",
    arab: "سُبْحَانَ اللَّهِ، وَالْحَمْدُ لِلَّهِ، وَاللَّهُ أَكْبَرُ",
    latin:
      "Subḥānallāh (33×), Alḥamdulillāh (33×), Allāhu Akbar (33×), lalu menggenapkan seratus dengan: Lā ilāha illallāhu waḥdahū lā syarīka lah, lahul-mulku wa lahul-ḥamdu wa huwa 'alā kulli syai'in qadīr.",
    terjemah:
      "Mahasuci Allah (33×), segala puji bagi Allah (33×), Allah Mahabesar (33×), kemudian menggenapkan bilangan seratus dengan tahlil di atas.",
    ulang: 33,
    fadhilah:
      "Barang siapa mengucapkannya setiap selesai shalat, akan diampuni dosa-dosanya walau sebanyak buih di lautan.",
    sumber: "HR. Muslim (597) dari Abu Hurairah radhiyallahu 'anhu. Shahih.",
  },
  {
    id: "bada-ainni",
    judul: "Memohon pertolongan untuk beribadah",
    arab:
      "اللَّهُمَّ أَعِنِّي عَلَىٰ ذِكْرِكَ وَشُكْرِكَ وَحُسْنِ عِبَادَتِكَ",
    latin: "Allāhumma a'innī 'alā żikrika wa syukrika wa ḥusni 'ibādatik.",
    terjemah:
      "Ya Allah, tolonglah aku untuk selalu berdzikir kepada-Mu, bersyukur kepada-Mu, dan beribadah kepada-Mu dengan baik.",
    ulang: 1,
    fadhilah: "Nabi ﷺ berpesan kepada Mu'adz agar tidak meninggalkannya setiap selesai shalat.",
    sumber: "HR. Abu Dawud (1522) & An-Nasa'i (1303) dari Mu'adz bin Jabal. Shahih.",
  },
];

// ── DZIKIR SETELAH SHALAT WITIR ──────────────────────────────────────────────
export const DZIKIR_SETELAH_WITIR: DzikirItem[] = [
  {
    id: "witir-subhanal-malik",
    judul: "Subhanal Malikil Quddus",
    arab: "سُبْحَانَ الْمَلِكِ الْقُدُّوسِ",
    latin: "Subḥānal-Malikil-Quddūs.",
    terjemah: "Mahasuci Allah Sang Raja Yang Mahasuci.",
    ulang: 3,
    fadhilah:
      "Dibaca tiga kali setelah salam witir. Pada bacaan ketiga, suara dikeraskan dan dipanjangkan, lalu ditambahkan: “Rabbil-malā'ikati war-rūḥ” (Rabb para malaikat dan ruh/Jibril).",
    sumber: "HR. An-Nasa'i (1699), Abu Dawud (1430) & Ad-Daraquthni dari Ubay bin Ka'b. Shahih.",
  },
];

// ── DZIKIR SEBELUM TIDUR ─────────────────────────────────────────────────────
export const DZIKIR_SEBELUM_TIDUR: DzikirItem[] = [
  {
    id: "tidur-muawwidzat",
    judul: "Al-Ikhlash, Al-Falaq & An-Nas (lalu tiupkan)",
    arab: pagi("pagi-ikhlas-muawwidzatain").arab,
    latin: pagi("pagi-ikhlas-muawwidzatain").latin,
    terjemah:
      "Kumpulkan kedua telapak tangan, bacalah ketiga surah ini, lalu tiupkan pada kedua telapak tangan dan usapkan ke seluruh tubuh yang terjangkau — dimulai dari kepala, wajah, dan bagian depan tubuh. Dilakukan sebanyak tiga kali.",
    ulang: 3,
    sumber: "HR. Al-Bukhari (5017) dari 'Aisyah radhiyallahu 'anha. Shahih.",
  },
  {
    id: "tidur-ayat-kursi",
    judul: "Ayat Kursi",
    arab: pagi("pagi-taawudz-kursi").arab,
    latin: pagi("pagi-taawudz-kursi").latin,
    terjemah: pagi("pagi-taawudz-kursi").terjemah,
    ulang: 1,
    fadhilah:
      "Barang siapa membacanya ketika hendak tidur, senantiasa ada penjaga dari Allah untuknya, dan setan tidak akan mendekatinya hingga pagi.",
    sumber: "HR. Al-Bukhari (2311) dari Abu Hurairah radhiyallahu 'anhu. Shahih.",
  },
  {
    id: "tidur-akhir-baqarah",
    judul: "Dua Ayat Terakhir Surah Al-Baqarah",
    arab:
      "آمَنَ الرَّسُولُ بِمَا أُنْزِلَ إِلَيْهِ مِنْ رَبِّهِ وَالْمُؤْمِنُونَ ۚ كُلٌّ آمَنَ بِاللَّهِ وَمَلَائِكَتِهِ وَكُتُبِهِ وَرُسُلِهِ لَا نُفَرِّقُ بَيْنَ أَحَدٍ مِنْ رُسُلِهِ ۚ وَقَالُوا سَمِعْنَا وَأَطَعْنَا ۖ غُفْرَانَكَ رَبَّنَا وَإِلَيْكَ الْمَصِيرُ ۝ لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا ۚ لَهَا مَا كَسَبَتْ وَعَلَيْهَا مَا اكْتَسَبَتْ ۗ رَبَّنَا لَا تُؤَاخِذْنَا إِنْ نَسِينَا أَوْ أَخْطَأْنَا ۚ رَبَّنَا وَلَا تَحْمِلْ عَلَيْنَا إِصْرًا كَمَا حَمَلْتَهُ عَلَى الَّذِينَ مِنْ قَبْلِنَا ۚ رَبَّنَا وَلَا تُحَمِّلْنَا مَا لَا طَاقَةَ لَنَا بِهِ ۖ وَاعْفُ عَنَّا وَاغْفِرْ لَنَا وَارْحَمْنَا ۚ أَنْتَ مَوْلَانَا فَانْصُرْنَا عَلَى الْقَوْمِ الْكَافِرِينَ",
    latin:
      "Āmanar-rasūlu bimā unzila ilaihi mir rabbihī wal-mu'minūn… hingga akhir surah. (QS. Al-Baqarah: 285-286).",
    terjemah:
      "Rasul (Muhammad) beriman kepada apa yang diturunkan kepadanya dari Tuhannya, demikian pula orang-orang yang beriman… (terjemah lengkap terdapat pada mushaf).",
    ulang: 1,
    fadhilah:
      "Barang siapa membaca dua ayat terakhir surah Al-Baqarah pada malam hari, keduanya telah mencukupinya (sebagai pelindung).",
    sumber: "QS. Al-Baqarah: 285-286. HR. Al-Bukhari (5009) & Muslim (807) dari Abu Mas'ud. Shahih.",
  },
  {
    id: "tidur-bismika-rabbi",
    judul: "Menyerahkan diri saat berbaring",
    arab:
      "بِاسْمِكَ رَبِّي وَضَعْتُ جَنْبِي، وَبِكَ أَرْفَعُهُ، إِنْ أَمْسَكْتَ نَفْسِي فَارْحَمْهَا، وَإِنْ أَرْسَلْتَهَا فَاحْفَظْهَا بِمَا تَحْفَظُ بِهِ عِبَادَكَ الصَّالِحِينَ",
    latin:
      "Bismika rabbī waḍa'tu janbī, wa bika arfa'uh, in amsakta nafsī farḥamhā, wa in arsaltahā faḥfaẓhā bimā taḥfaẓu bihī 'ibādakaṣ-ṣāliḥīn.",
    terjemah:
      "Dengan nama-Mu wahai Rabbku, aku membaringkan tubuhku, dan dengan-Mu pula aku mengangkatnya. Jika Engkau menahan nyawaku (mematikannya), rahmatilah ia; dan jika Engkau melepasnya (menghidupkannya), jagalah ia sebagaimana Engkau menjaga hamba-hamba-Mu yang shalih.",
    ulang: 1,
    sumber: "HR. Al-Bukhari (6320) & Muslim (2714) dari Abu Hurairah. Shahih.",
  },
  {
    id: "tidur-aslamtu",
    judul: "Berserah diri kepada Allah",
    arab:
      "اللَّهُمَّ أَسْلَمْتُ نَفْسِي إِلَيْكَ، وَفَوَّضْتُ أَمْرِي إِلَيْكَ، وَوَجَّهْتُ وَجْهِي إِلَيْكَ، وَأَلْجَأْتُ ظَهْرِي إِلَيْكَ، رَغْبَةً وَرَهْبَةً إِلَيْكَ، لَا مَلْجَأَ وَلَا مَنْجَا مِنْكَ إِلَّا إِلَيْكَ، آمَنْتُ بِكِتَابِكَ الَّذِي أَنْزَلْتَ، وَبِنَبِيِّكَ الَّذِي أَرْسَلْتَ",
    latin:
      "Allāhumma aslamtu nafsī ilaik, wa fawwaḍtu amrī ilaik, wa wajjahtu wajhī ilaik, wa alja'tu ẓahrī ilaik, ragbatan wa rahbatan ilaik, lā malja'a wa lā manjā minka illā ilaik, āmantu bikitābikal-lażī anzalt, wa binabiyyikal-lażī arsalt.",
    terjemah:
      "Ya Allah, aku serahkan diriku kepada-Mu, kupasrahkan urusanku kepada-Mu, kuhadapkan wajahku kepada-Mu, dan kusandarkan punggungku kepada-Mu, karena harap dan takut kepada-Mu. Tidak ada tempat berlindung dan menyelamatkan diri dari (siksa)-Mu kecuali kepada-Mu. Aku beriman kepada kitab-Mu yang Engkau turunkan dan kepada nabi-Mu yang Engkau utus.",
    ulang: 1,
    fadhilah:
      "Barang siapa mengucapkannya sebagai akhir ucapannya lalu meninggal pada malam itu, ia meninggal di atas fitrah.",
    sumber: "HR. Al-Bukhari (6311) & Muslim (2710) dari Al-Bara' bin 'Azib. Shahih.",
  },
  {
    id: "tidur-bismika-amutu",
    judul: "Menyebut nama Allah menjelang tidur",
    arab: "بِاسْمِكَ اللَّهُمَّ أَمُوتُ وَأَحْيَا",
    latin: "Bismikallāhumma amūtu wa aḥyā.",
    terjemah: "Dengan nama-Mu ya Allah, aku mati dan aku hidup.",
    ulang: 1,
    sumber: "HR. Al-Bukhari (6324) dari Hudzaifah radhiyallahu 'anhu. Shahih.",
  },
  {
    id: "tidur-tasbih-fatimah",
    judul: "Tasbih Fatimah",
    arab: "سُبْحَانَ اللَّهِ، وَالْحَمْدُ لِلَّهِ، وَاللَّهُ أَكْبَرُ",
    latin: "Subḥānallāh (33×), Alḥamdulillāh (33×), Allāhu Akbar (34×).",
    terjemah: "Mahasuci Allah (33×), segala puji bagi Allah (33×), Allah Mahabesar (34×).",
    ulang: 33,
    fadhilah:
      "Nabi ﷺ mengajarkannya kepada Fatimah dan 'Ali, dan bersabda bahwa itu lebih baik bagi keduanya daripada seorang pembantu.",
    sumber: "HR. Al-Bukhari (5362) & Muslim (2727) dari 'Ali bin Abi Thalib. Shahih.",
  },
];

// ── DZIKIR BANGUN TIDUR ──────────────────────────────────────────────────────
export const DZIKIR_BANGUN_TIDUR: DzikirItem[] = [
  {
    id: "bangun-alhamdulillah",
    judul: "Pujian saat bangun tidur",
    arab:
      "الْحَمْدُ لِلَّهِ الَّذِي أَحْيَانَا بَعْدَ مَا أَمَاتَنَا وَإِلَيْهِ النُّشُورُ",
    latin: "Alḥamdu lillāhil-lażī aḥyānā ba'da mā amātanā wa ilaihin-nusyūr.",
    terjemah:
      "Segala puji bagi Allah yang telah menghidupkan kami setelah mematikan kami (tidur), dan kepada-Nya tempat kembali.",
    ulang: 1,
    sumber: "HR. Al-Bukhari (6312) & Muslim (2711) dari Hudzaifah. Shahih.",
  },
  {
    id: "bangun-tahlil-malam",
    judul: "Doa ketika terbangun di malam hari",
    arab:
      "لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَىٰ كُلِّ شَيْءٍ قَدِيرٌ، الْحَمْدُ لِلَّهِ، وَسُبْحَانَ اللَّهِ، وَلَا إِلَٰهَ إِلَّا اللَّهُ، وَاللَّهُ أَكْبَرُ، وَلَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ، رَبِّ اغْفِرْ لِي",
    latin:
      "Lā ilāha illallāhu waḥdahū lā syarīka lah, lahul-mulku wa lahul-ḥamdu wa huwa 'alā kulli syai'in qadīr. Alḥamdu lillāh, wa subḥānallāh, wa lā ilāha illallāh, wallāhu akbar, wa lā ḥaula wa lā quwwata illā billāh. Rabbigfir lī.",
    terjemah:
      "Tidak ada Tuhan selain Allah semata, tiada sekutu bagi-Nya. Milik-Nya kerajaan dan bagi-Nya pujian, dan Dia Mahakuasa atas segala sesuatu. Segala puji bagi Allah, Mahasuci Allah, tidak ada Tuhan selain Allah, Allah Mahabesar, dan tiada daya serta upaya kecuali dengan (pertolongan) Allah. Wahai Rabbku, ampunilah aku.",
    ulang: 1,
    fadhilah:
      "Barang siapa terbangun di malam hari lalu mengucapkannya kemudian berdoa, niscaya dikabulkan; jika ia berwudhu lalu shalat, shalatnya diterima.",
    sumber: "HR. Al-Bukhari (1154) dari 'Ubadah bin Ash-Shamit. Shahih.",
  },
];

// ── DZIKIR SETELAH ADZAN ─────────────────────────────────────────────────────
export const DZIKIR_SETELAH_ADZAN: DzikirItem[] = [
  {
    id: "adzan-shalawat",
    judul: "Bershalawat setelah menjawab adzan",
    arab: "اللَّهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ وَعَلَىٰ آلِ مُحَمَّدٍ",
    latin: "Allāhumma ṣalli 'alā Muḥammad wa 'alā āli Muḥammad.",
    terjemah:
      "Setelah menjawab adzan (mengikuti ucapan muadzin), bershalawatlah kepada Nabi ﷺ.",
    ulang: 1,
    fadhilah:
      "Barang siapa bershalawat kepadaku satu kali, Allah bershalawat (memberi rahmat) kepadanya sepuluh kali.",
    sumber: "HR. Muslim (384) dari 'Abdullah bin 'Amr. Shahih.",
  },
  {
    id: "adzan-wasilah",
    judul: "Doa Wasilah setelah adzan",
    arab:
      "اللَّهُمَّ رَبَّ هَٰذِهِ الدَّعْوَةِ التَّامَّةِ، وَالصَّلَاةِ الْقَائِمَةِ، آتِ مُحَمَّدًا الْوَسِيلَةَ وَالْفَضِيلَةَ، وَابْعَثْهُ مَقَامًا مَحْمُودًا الَّذِي وَعَدْتَهُ",
    latin:
      "Allāhumma rabba hāżihid-da'watit-tāmmah, waṣ-ṣalātil-qā'imah, āti Muḥammadanil-wasīlata wal-faḍīlah, wab'aṡhu maqāmam maḥmūdanil-lażī wa'adtah.",
    terjemah:
      "Ya Allah, Rabb pemilik seruan yang sempurna ini dan shalat yang akan ditegakkan, berikanlah kepada Muhammad wasilah (kedudukan tinggi di surga) dan keutamaan, serta bangkitkanlah ia pada kedudukan terpuji yang telah Engkau janjikan kepadanya.",
    ulang: 1,
    fadhilah: "Barang siapa membacanya setelah adzan, ia berhak mendapatkan syafaat Nabi ﷺ pada hari kiamat.",
    sumber: "HR. Al-Bukhari (614) dari Jabir bin 'Abdillah. Shahih.",
  },
];

// ── DZIKIR SETELAH WUDHU ─────────────────────────────────────────────────────
export const DZIKIR_SETELAH_WUDHU: DzikirItem[] = [
  {
    id: "wudhu-syahadat",
    judul: "Dua kalimat syahadat & doa taubat",
    arab:
      "أَشْهَدُ أَنْ لَا إِلَٰهَ إِلَّا اللَّهُ وَحْدَهُ لَا شَرِيكَ لَهُ، وَأَشْهَدُ أَنَّ مُحَمَّدًا عَبْدُهُ وَرَسُولُهُ، اللَّهُمَّ اجْعَلْنِي مِنَ التَّوَّابِينَ وَاجْعَلْنِي مِنَ الْمُتَطَهِّرِينَ",
    latin:
      "Asyhadu allā ilāha illallāhu waḥdahū lā syarīka lah, wa asyhadu anna Muḥammadan 'abduhū wa rasūluh. Allāhummaj'alnī minat-tawwābīna waj'alnī minal-mutaṭahhirīn.",
    terjemah:
      "Aku bersaksi bahwa tidak ada Tuhan (yang berhak disembah) selain Allah semata, tiada sekutu bagi-Nya, dan aku bersaksi bahwa Muhammad adalah hamba dan utusan-Nya. Ya Allah, jadikanlah aku termasuk orang-orang yang bertaubat dan jadikanlah aku termasuk orang-orang yang menyucikan diri.",
    ulang: 1,
    fadhilah:
      "Barang siapa membacanya setelah berwudhu, dibukakan untuknya delapan pintu surga; ia boleh masuk dari pintu mana saja yang ia kehendaki.",
    sumber: "HR. Muslim (234) & At-Tirmidzi (55) dari 'Umar bin Al-Khaththab. Shahih.",
  },
];

// ── KATEGORI DZIKIR (untuk menu Dzikir) ──────────────────────────────────────
export type DzikirKategori = {
  id: string;
  nama: string;
  deskripsi: string;
  /** Nama ikon FontAwesome */
  icon: string;
  /** Warna aksen kartu (hex) */
  warna: string;
  items: DzikirItem[];
};

export const DZIKIR_KATEGORI: DzikirKategori[] = [
  {
    id: "setelah-shalat",
    nama: "Dzikir Setelah Shalat",
    deskripsi: "Dibaca setiap selesai shalat fardhu",
    icon: "clock-o",
    warna: "#00695C",
    items: DZIKIR_SETELAH_SHALAT,
  },
  {
    id: "pagi",
    nama: "Dzikir Pagi",
    deskripsi: "Setelah Subuh hingga matahari meninggi",
    icon: "sun-o",
    warna: "#E65100",
    items: DZIKIR_PAGI,
  },
  {
    id: "petang",
    nama: "Dzikir Petang",
    deskripsi: "Setelah 'Ashar hingga matahari terbenam",
    icon: "moon-o",
    warna: "#283593",
    items: DZIKIR_SORE,
  },
  {
    id: "setelah-witir",
    nama: "Dzikir Setelah Witir",
    deskripsi: "Dibaca setelah salam shalat witir",
    icon: "star-o",
    warna: "#6A1B9A",
    items: DZIKIR_SETELAH_WITIR,
  },
  {
    id: "sebelum-tidur",
    nama: "Dzikir Sebelum Tidur",
    deskripsi: "Amalan menjelang tidur di malam hari",
    icon: "bed",
    warna: "#1565C0",
    items: DZIKIR_SEBELUM_TIDUR,
  },
  {
    id: "bangun-tidur",
    nama: "Dzikir Bangun Tidur",
    deskripsi: "Dibaca ketika terbangun dari tidur",
    icon: "coffee",
    warna: "#00838F",
    items: DZIKIR_BANGUN_TIDUR,
  },
  {
    id: "setelah-adzan",
    nama: "Dzikir Setelah Adzan",
    deskripsi: "Shalawat & doa wasilah setelah adzan",
    icon: "bullhorn",
    warna: "#2E7D32",
    items: DZIKIR_SETELAH_ADZAN,
  },
  {
    id: "setelah-wudhu",
    nama: "Dzikir Setelah Wudhu",
    deskripsi: "Dibaca setelah menyempurnakan wudhu",
    icon: "tint",
    warna: "#0277BD",
    items: DZIKIR_SETELAH_WUDHU,
  },
];

// ── PILIHAN DZIKIR UNTUK TASBIH ──────────────────────────────────────────────
export type TasbihDzikir = {
  id: string;
  arab: string;
  latin: string;
  arti: string;
  target: number;
};

export const TASBIH_DZIKIR_PRESETS: TasbihDzikir[] = [
  { id: "subhanallah", arab: "سُبْحَانَ اللَّهِ", latin: "Subhānallāh", arti: "Mahasuci Allah", target: 33 },
  { id: "alhamdulillah", arab: "الْحَمْدُ لِلَّهِ", latin: "Alhamdulillāh", arti: "Segala puji bagi Allah", target: 33 },
  { id: "allahuakbar", arab: "اللَّهُ أَكْبَرُ", latin: "Allāhu Akbar", arti: "Allah Mahabesar", target: 34 },
  {
    id: "tahlil",
    arab: "لَا إِلَٰهَ إِلَّا اللَّهُ",
    latin: "Lā ilāha illallāh",
    arti: "Tiada Tuhan selain Allah",
    target: 100,
  },
  {
    id: "istighfar",
    arab: "أَسْتَغْفِرُ اللَّهَ",
    latin: "Astagfirullāh",
    arti: "Aku memohon ampun kepada Allah",
    target: 100,
  },
  {
    id: "hauqalah",
    arab: "لَا حَوْلَ وَلَا قُوَّةَ إِلَّا بِاللَّهِ",
    latin: "Lā ḥaula wa lā quwwata illā billāh",
    arti: "Tiada daya dan upaya kecuali dengan Allah",
    target: 33,
  },
  {
    id: "shalawat",
    arab: "اللَّهُمَّ صَلِّ عَلَىٰ مُحَمَّدٍ",
    latin: "Allāhumma ṣalli 'alā Muḥammad",
    arti: "Ya Allah, bershalawatlah atas Muhammad",
    target: 100,
  },
  {
    id: "bebas",
    arab: "",
    latin: "Hitungan Bebas",
    arti: "Tanpa dzikir tertentu",
    target: 33,
  },
];

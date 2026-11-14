// Родословные Эльфборна: двенадцать Домов Книги Побегов и полуэльфы вне Книги (закон о Третьем Сорте).
// Кортеж: [ключ, имя, пол, родился, умер, отец, мать, супруг, должность, текст, образ, дом, тайна, раса, look].
// Два последних поля — своя раса и английское описание внешности для портрета (эльфы стареют медленно: в look — видимый возраст).
export const TAG = 'Эльфборн'

const HE = 'Высший эльф', SO = 'Солнечный эльф', SU = 'Сумеречный эльф', LE = 'Лесной эльф', DI = 'Дикий эльф'
const KR = 'Крылатый эльф', MO = 'Морской эльф', NO = 'Ночной эльф', BL = 'Кровавый эльф', PE = 'Полуэльф', HM = 'Человек (гладр)'
const HUI = 'Человек (имперец)'

export const SPECS = [
  {
    dyn: 'el-house-aeltar',
    people: [
      ['eae-ear', 'Эарэндиль Аэлтар', 'm', 860, 975, null, null, 'eae-nar', 'Старший в роду Аэлтар, хранитель Старой Книги', 'Эарэндиль писал первые списки Домов ещё до Войны Голых Ветвей. Умер в 975 г., за год до восстания Братств, и успел сказать сыну: «Дерево выбирает не тех, кто громче».', 'scholar', null, null, HE, 'ancient elf lord looking about eighty, long white hair, white scholar robe with a golden clasp, pale wise eyes, ink-stained fingers'],
      ['eae-nar', 'Нарэнис Аэлтар', 'f', 868, 984, null, null, 'eae-ear', 'Мать Фаэрона', 'Нарэнис пережила мужа и увидела, как сын принял Престол из рук Ивы. Всю жизнь носила белое и не позволяла никому в доме говорить о полуэльфах за столом.', 'noble', null, null, HE, 'elderly elf noblewoman looking about seventy, silver hair under a pearl net, white gown, proud thin face'],
      ['eae-len', 'Лэнэйра Аэлтар', 'f', 920, 979, null, null, '@el-faeron', 'Жена Фаэрона', 'Лэнэйра родила Фаэрону двоих сыновей и погибла при осаде Теанвена, когда стрела Братства нашла её у окна башни. Фаэрон с тех пор не терпит открытых окон.', 'noble', null, null, HE, 'elf noblewoman looking about forty, long golden hair, white and gold dress, gentle sad eyes'],
      ['eae-ald', 'Альдарон Аэлтар', 'm', 955, 997, '@el-faeron', 'eae-len', null, 'Счётчик Листвы, брат Валандиля', 'Альдарон ушёл в жрецы и считал знаки рядом с Ирмэль. Его нашли мёртвым на ступенях Чертога Счётчиков за три дня до Ночи Голых Ветвей 997 г.; считалось, что он оступился.', 'cleric', null, 'Нашёл в Книге три ложные записи и написал об этом Фаэрону; письмо перехватил Валандиль. Альдарона столкнули со ступеней по его слову.', HE, 'elf priest looking about forty, long fair hair, white robe with a small green leaf pendant, earnest troubled eyes'],
      ['eae-fjr', 'Фаэрон Младший', 'm', 982, 1008, '@el-valandil', 'eae-ith', null, 'Наследник Дома Аэлтар', 'Фаэрон Младший назван в честь деда и был его любимцем. Он вызвался в караул у Поющих Камней и погиб в 1008 г., когда Камни вдруг замолкли и на Стену пошли чужаки.', 'soldier', null, null, HE, 'young elf warrior looking about twenty-five, golden hair, bright mail shirt with a white tabard, proud open face'],
      ['eae-nim', 'Нимэриэль Аэлтар', 'f', 986, null, '@el-valandil', 'eae-ith', null, 'Ученица Счётчиков', 'Нимэриэль учится считать листву у Ирмэль и ещё верит в Книгу. Тонкая, с двумя косами цвета мёда, она записывает в блокнот всё, что слышит в Чертоге.', 'scholar', null, 'Видела, как Ирмэль вывела в Книге «пять», хотя Счётчики вслух называли «четыре». Никому не сказала: боится за отца.', HE, 'young elf woman looking about twenty, two honey-coloured braids, white scholar dress, notebook, clear anxious eyes'],
    ],
    patch: [
      ['@el-faeron', { father: 'eae-ear', mother: 'eae-nar', spouse: 'eae-len' }],
      ['@el-valandil', { father: '@el-faeron', mother: 'eae-len', spouse: 'eae-ith' }],
    ],
  },
  {
    dyn: 'el-house-mirinel',
    people: [
      ['emi-ber', 'Берелон Миринэль', 'm', 925, 1001, null, null, 'emi-aln', 'Старый глава Дома Миринэль, отец Серэлин', 'Берелон носил крылатый шлем даже за обедом. Умер в 1001 г., в год, когда засохла ветвь Миринэль; говорили, что он не пережил позора.', 'noble', null, null, HE, 'stern elf lord looking about sixty, grey-gold hair, tall winged helmet, azure cloak, hard disappointed eyes'],
      ['emi-aln', 'Алдэниэль Миринэль', 'f', 932, null, null, null, 'emi-ber', 'Мать Серэлин и Арвиэль', 'Алдэниэль ведёт хозяйство Дома и записи о долгах. Говорит тихо и никогда не повышает голос на должников.', 'noble', null, null, HE, 'elegant elf noblewoman looking about fifty-five, braided silver-gold hair, azure dress, calm calculating eyes'],
      ['emi-dor', 'Дорэнвир Миринэль', 'm', 955, 1001, null, null, '@el-serelin', 'Муж Серэлин', 'Дорэнвир из младшей ветви Аэлтар женился ради союза Домов и умер в 1001 г., в год, когда засохла ветвь Миринэль. Серэлин считает, что его убили знаки, а не болезнь.', 'noble', 'el-house-aeltar', null, HE, 'tall elf nobleman looking about forty-five, fair hair, white and azure coat, tired gentle eyes'],
      ['emi-bjr', 'Берелон Младший', 'm', 989, null, 'emi-dor', '@el-serelin', null, 'Наследник Дома Миринэль', 'Берелон Младший учится у отцовых писцов и хранит у себя копию Книги Побегов. Крылатый шлем ему ещё велик.', 'scholar', null, 'Его список знаков расходится с Чертогом на две записи; он решил, что ошибся, и никому не показал.', HE, 'young elf looking about twenty, golden hair, azure scholar coat, winged helmet under his arm, earnest eyes'],
      ['emi-ley', 'Лэйнэль Миринэль', 'f', 993, 1002, 'emi-dor', '@el-serelin', null, 'Дочь Серэлин, умершая ребёнком', 'Лэйнэль болела всю зиму 1002 г. и умерла, когда Крылатые отказались лечить Дом, державший их в долговом труде. Серэлин помнит об этом каждый раз, когда слышит имя Лирэн.', 'child', null, null, HE, 'little elf girl looking about nine, golden hair, azure dress, pale solemn face'],
      ['eae-ith', 'Итариэль Аэлтар', 'f', 958, null, null, null, '@el-valandil', 'Жена Валандиля, из Дома Миринэль', 'Итариэль, сестра Дорэнвира, вошла в Дом Аэлтар хозяйкой и стала его кошельком. Серэлин зовёт её «наша лазурная ветвь» с обидой.', 'noble', 'el-house-mirinel', 'Знает, что деньги на ложные записи дал Дом Миринэль через Серэлин, и молчит: её сын наследует Аэлтар.', HE, 'elf noblewoman looking about forty, fair hair in golden pins, azure and white gown, composed watchful eyes'],
    ],
    patch: [
      ['@el-serelin', { father: 'emi-ber', mother: 'emi-aln', spouse: 'emi-dor' }],
      ['@el-arviel', { father: 'emi-ber', mother: 'emi-aln' }],
    ],
  },
  {
    dyn: 'el-house-laurendil',
    people: [
      ['ela-sol', 'Солэнор Лаурэндил', 'm', 905, 978, null, null, 'ela-ail', 'Глава Дома Лаурэндил, отец Иллендель', 'Солэнор был красным солнцем Дома: громким, щедрым и бестолковым в счёте. Погиб в бою у Ауреэльватара в 978 г.; тело вернули в рощу в плаще цвета заката.', 'noble', null, null, SO, 'sun-tanned elf lord looking about fifty, auburn hair, golden eyes, sunset-red cloak, warm loud laugh lines'],
      ['ela-ail', 'Айлиэль Лаурэндил', 'f', 912, 990, null, null, 'ela-sol', 'Жена Солэнора, мать Иллендель', 'Айлиэль помнила времена до Империи и учила дочь и внуков, что солнце одинаково светит над гладрами и над эльфами. Её никто не слушал.', 'noble', null, null, SO, 'ancient elf grandmother looking about eighty, white hair, sun-tanned wrinkled skin, golden eyes, red shawl'],
      ['ela-cel', 'Келебран Исилвен', 'm', 935, 992, null, null, '@el-illendel', 'Муж Иллендель', 'Келебран из Дома Исилвен ушёл в Дом Лаурэндил и вёл переписку с послами. Умер в 992 г. от лихорадки, которую привёз из-за Залива.', 'merchant', 'el-house-isilven', null, SU, 'grey-haired dusk elf looking about fifty, pastel grey coat, a small dove brooch, calm tired eyes'],
      ['ela-cal', 'Калэнвэ Лаурэндил', 'f', 965, null, 'ela-cel', '@el-illendel', null, 'Хранительница ключей Чертога Счётчиков', 'Калэнвэ, дочь Иллендель, заведует ключами Чертога и знает, кто и когда туда входил. Смуглая, с тяжёлой связкой ключей на поясе.', 'cleric', 'el-house-laurendil', 'Знает о монетах Серэлин, которые приносили Сериндору, но не говорит матери: не хочет быть тем, кто объявил войну Миринэль.', SO, 'sun-tanned elf woman looking about thirty-five, auburn braid, golden eyes, red and white dress, a ring of keys at her belt'],
      ['ela-sor', 'Солэнор Младший', 'm', 968, null, 'ela-cel', '@el-illendel', null, 'Лорд-управляющий рощ Лаурэндил', 'Солэнор Младший объезжает рощи Дома и считает пожары: каждый — знак на ветвь. Весёлый и тревожный одновременно.', 'noble', 'el-house-laurendil', null, SO, 'sun-tanned elf man looking about thirty-three, auburn hair, golden eyes, sunset-orange coat, worried smile'],
      ['ela-ner', 'Нерэнис Лаурэндил', 'f', 972, null, 'ela-cel', '@el-illendel', null, 'Жрица Дома Света', 'Нерэнис поёт утренний гимн рядом со слепым Элэльмо и водит его по ступеням. Тихая, с красным платком на плечах.', 'cleric', 'el-house-laurendil', null, SO, 'sun-tanned elf priestess looking about thirty, auburn hair, golden eyes, white robe with a red sun, calm gentle face'],
      ['ela-ten', 'Тэлларион Лаурэндил', 'm', 975, 1000, 'ela-cel', '@el-illendel', null, 'Стражник Поющих Камней', 'Тэлларион служил в Страже Камней у Каранор и умер в 1000 г. от Отчаяния: лист на его груди потускнел. Иллендель до сих пор носит его браслет.', 'soldier', 'el-house-laurendil', 'Писал матери, что Камни замолкли уже в 1000 г., при пяти зелёных ветвях; она сожгла письма.', SO, 'sun-tanned young elf soldier looking about twenty-five, auburn hair, golden eyes, steel mail with a faded silver leaf, haunted eyes'],
    ],
    patch: [
      ['@el-illendel', { father: 'ela-sol', mother: 'ela-ail', spouse: 'ela-cel' }],
    ],
  },
  {
    dyn: 'el-house-isilven',
    people: [
      ['eis-tar', 'Таэрон Исилвен', 'm', 915, 990, null, null, null, 'Посол Дома Исилвен', 'Таэрон ездил послом к Империи до восстания и привёз вести о гражданской войне, которые подняли Братства. Умер в 990 г., не простив себе, что его вести оказались правдой.', 'merchant', null, null, SU, 'grey elf diplomat looking about sixty, grey hair, pastel grey coat, a dove on his sleeve, thoughtful eyes'],
      ['eis-oro', 'Орофэль Исилвен', 'm', 944, 999, null, null, '@el-meriel', 'Муж Мэриэль', 'Орофэль вёл дом, пока жена ездила по дворам. Умер в 999 г., сказав на смертном одре, что у дочери сердце не их крови.', 'noble', null, null, SU, 'grey dusk elf man looking about fifty, dark hair streaked with grey, pastel coat, gentle sorrowful eyes'],
      ['eis-lar', 'Ларэндил Исилвен', 'm', 945, 997, 'eis-tar', null, null, 'Брат Мэриэль, посол при Империи', 'Ларэндил вёл переписку с имперскими чиновниками и умер в 997 г., в год, когда засохла ветвь Исилвен. Мэриэль уверена, что его отравили.', 'merchant', null, 'Считал, что ветвь Исилвен засохла из-за подложных знаков, и собирался сказать об этом Престолу.', SU, 'grey dusk elf looking about forty-five, dark hair, grey travelling cloak, sharp clever eyes'],
      ['eis-ina', 'Инолиэль Исилвен', 'f', 972, null, 'eis-oro', '@el-meriel', null, 'Посланница Дома Исилвен', 'Инолиэль ездит с серым голубем по дорогам, которыми её мать не решается ездить. Худая, с чёрными косами и серыми глазами.', 'merchant', null, 'Носит письма Мэриэль в имперский порт; знает, что в них, но называет это «торговлей вестями».', SU, 'grey dusk elf woman looking about thirty, black braids, grey eyes, pastel grey riding coat, a small dove on her shoulder'],
      ['eis-tal', 'Талфэр Исилвен', 'm', 976, null, 'eis-oro', '@el-meriel', null, 'Писец Дома Исилвен', 'Талфэр переписывает договоры Дома; в 997 г., ещё юным, он видел, как отец плакал над засохшей ветвью. С тех пор не любит Счётчиков.', 'scholar', null, null, SU, 'grey dusk elf man looking about thirty, dark hair, ink-stained fingers, grey scribe coat, quiet wary eyes'],
    ],
    patch: [
      ['@el-meriel', { father: 'eis-tar', spouse: 'eis-oro' }],
    ],
  },
  {
    dyn: 'el-house-taurendil',
    people: [
      ['eta-bar', 'Барэндир Таурендил', 'm', 895, 985, null, null, null, 'Страж корней до Эльбарона', 'Барэндир первым стал обходить корни Ивы каждое утро; эту привычку унаследовал сын. Умер в 985 г., за год до засыхания ветви Ундоме.', 'folk', null, null, LE, 'old woodland elf looking about seventy, long white hair, green cloak, weathered gentle face'],
      ['eta-mir', 'Мирэтиль Таурендил', 'f', 935, 1005, null, null, '@el-elbaron', 'Жена Эльбарона', 'Мирэтиль знала слова песни корней и пела её, пока муж обходил рощу. Умерла в 1005 г., и в тот год Эльбарон впервые нашёл соль.', 'folk', null, null, LE, 'woodland elf woman looking about fifty, long fair hair with leaves, green dress, kind green eyes'],
      ['eta-ael', 'Аэлиндор Таурендил', 'm', 960, null, '@el-elbaron', 'eta-mir', null, 'Лучник и страж рощи', 'Аэлиндор — лучший лучник Дома, говорит мало и знает каждую ветвь Ивы по голосу. Ходит в накидке, которую не видно в листве.', 'soldier', null, null, LE, 'woodland elf archer looking about thirty-five, long fair hair, green hooded cloak, longbow, keen green eyes'],
      ['eta-nin', 'Нинорэль Таурендил', 'f', 961, 1003, '@el-elbaron', 'eta-mir', null, 'Слышащая корней', 'Нинорэль слышала корни яснее отца и умерла в 1003 г., когда Ива впервые зашумела от боли. Мирэтиль помнила её последние слова: «Горько. Земля горькая».', 'cleric', null, 'Нашла в корнях соль и принесла отцу; Эльбарон бросил письмо о ней в огонь. Нинорэль умерла, думая, что её не услышали.', LE, 'woodland elf woman looking about thirty-five, long fair hair with a rowan wreath, green dress, faded eyes, thin pale face'],
    ],
    patch: [
      ['@el-elbaron', { father: 'eta-bar', spouse: 'eta-mir' }],
    ],
  },
  {
    dyn: 'el-house-faelin',
    people: [
      ['efa-han', 'Хэнтарон Фаэлин', 'm', 900, 975, null, null, 'efa-ruh', 'Прежний глава Дома Фаэлин', 'Хэнтарон, татуированный волчьими следами, считал, что землю эльфов нужно очистить от всех чужих. Погиб в 975 г. от стрелы имперского наёмника, за год до восстания.', 'soldier', null, null, DI, 'tattooed wild elf looking about seventy, dark skin with wolf-track tattoos, white braided hair, wolf pelt on shoulders, fierce eyes'],
      ['efa-ruh', 'Руэнэ Фаэлин', 'f', 905, 1002, null, null, 'efa-han', 'Мать Тарилона', 'Руэнэ рисовала на телах сыновей знаки племени и пережила большинство из них. Умерла в 1002 г.; в год её смерти ветвь Фаэлин впервые зазеленела вновь.', 'folk', null, null, DI, 'old wild elf woman looking about ninety, grey braids, dark tattooed skin, plain dark dress, stern weary eyes'],
      ['efa-sel', 'Сэлиэн Фаэлин', 'f', 940, 985, null, null, '@el-tarilon', 'Жена Тарилона', 'Сэлиэн умерла в 985 г., через год после того, как засохла первая ветвь страны — её собственная. Тарилон не говорит о ней при чужих.', 'folk', null, null, DI, 'wild elf woman looking about forty-five, dark tattooed skin, long dark hair with feathers, hide dress, quiet strong eyes'],
      ['efa-hal', 'Хальдир Фаэлин', 'm', 962, 991, '@el-tarilon', 'efa-sel', null, 'Воин Дома Фаэлин', 'Хальдир дал обет духам рощи, чтобы ветвь зазеленела, и отдал его собственной жизнью в 991 г. После него в доме обеты уже не дают шёпотом.', 'soldier', null, null, DI, 'young wild elf warrior looking about twenty-eight, tattooed face, long braided dark hair, hide armour, burning eyes'],
      ['efa-tau', 'Таурэ Фаэлин', 'f', 968, null, '@el-tarilon', 'efa-sel', null, 'Дочь Тарилона, егерь Дома', 'Таурэ охотится на север от болот и знает тропы, которыми ходят Волчьи Братства. Широкоплечая, с волчьим зубом на шнурке.', 'soldier', null, 'Однажды нашла Брэндира раненым и отпустила его, не сказав отцу.', DI, 'wild elf huntress looking about thirty-five, dark tattooed skin, braided black hair, hide jerkin, a wolf tooth on a cord, steady eyes'],
      ['efa-fen', 'Фэнлин Фаэлин', 'm', 990, null, 'efa-hal', null, null, 'Внук Тарилона', 'Фэнлин, сын павшего Хальдира, растёт в чаще вместе с волчатами. Он не знает отца и ждёт, когда ему наколют первый знак.', 'child', null, null, DI, 'wild elf teenager looking about fifteen, dark skin, messy dark hair, first tattoo on cheek, hide clothes, shy fierce look'],
    ],
    patch: [
      ['@el-tarilon', { father: 'efa-han', mother: 'efa-ruh', spouse: 'efa-sel' }],
    ],
  },
  {
    dyn: 'el-house-ailin',
    people: [
      ['eai-oru', 'Орвэль Аилин', 'm', 940, 990, null, null, 'eai-sar', 'Прежний глава Дома Аилин', 'Орвэль первым стал лечить рабов в Анорланте и умер в 990 г., когда его собственные крылья ослабли в тесной камере долгового труда. Его освободили слишком поздно.', 'cleric', null, null, KR, 'winged elf man looking about forty-five, grey wings half open, plain healer robe, hollow tired eyes'],
      ['eai-sar', 'Сарэлье Аилин', 'f', 945, null, null, null, 'eai-oru', 'Мать Лирэн', 'Сарэлье, маленькая, как птица, лечит травами в предместье и не боится гладров. Серые крылья она красит сажей, чтобы не видели седины.', 'cleric', null, null, KR, 'small winged elf woman looking about fifty, grey feathered wings, grey hair in a braid, healer apron, warm bird-bright eyes'],
      ['eai-wen', 'Венэль Аилин', 'm', 965, null, null, null, '@el-liren', 'Муж Лирэн, лекарь', 'Венэль родом из младшей ветви Дома Аилин; вместе с женой ходит по домам рабов. Хромает: в 988 г. ему сломали крыло.', 'cleric', null, null, KR, 'winged elf man looking about thirty-five, light brown wings with one drooping, healer coat, a gentle crooked smile'],
      ['eai-lei', 'Лэйлин Аилин', 'f', 992, null, 'eai-wen', '@el-liren', null, 'Дочь Лирэн', 'Лэйлин, ещё ребёнок, уже летает над крышами, хотя ей запрещают. Ей нельзя сидеть взаперти — крылья сохнут.', 'child', null, null, KR, 'small winged elf girl looking about ten, brown feathered wings, brown braids, green dress, bright curious eyes'],
      ['eai-ael', 'Аэлиель Аилин', 'f', 970, 1008, 'eai-oru', 'eai-sar', null, 'Сестра Лирэн, в долговом труде', 'Аэлиель продалась в долговой труд Высшим, чтобы выкупить Дом из долгов, и умерла в 1008 г. в доме Арвиэль, не дожив до свободы.', 'folk', null, 'Умерла от тоски по небу: её крылья не распахивались шесть лет, и она так и не написала Лирэн, как с ней обращались.', KR, 'winged elf woman looking about thirty-five, pale clipped grey wings, grey serving dress with a grey ribbon, hollow dreaming eyes'],
      ['eai-fyr', 'Фирэль Аилин', 'f', 975, null, 'eai-oru', 'eai-sar', null, 'Младшая сестра Лирэн, учит детей', 'Фирэль учит крылатых детей читать и не бояться потолков. Любит носить на плечах цветы, которые вянут к вечеру.', 'folk', null, null, KR, 'winged elf woman looking about thirty, light grey wings, flowers in her hair, simple dress, cheerful tired eyes'],
    ],
    patch: [
      ['@el-liren', { father: 'eai-oru', mother: 'eai-sar', spouse: 'eai-wen' }],
    ],
  },
  {
    dyn: 'el-house-undome',
    people: [
      ['eun-ulm', 'Ульмон Ундоме', 'm', 895, 986, null, null, '@el-ninel', 'Муж Нинэль', 'Ульмон прожил с женой у моря девяносто лет и умер в 986 г., в год, когда засохла ветвь Ундоме. Нинэль не плакала: морские не плачут при людях.', 'folk', null, null, MO, 'old sea elf man looking about seventy, pale blue-green skin, white hair, a shell pendant, calm deep eyes'],
      ['eun-nor', 'Норэндиль Ундоме', 'm', 935, 1002, 'eun-ulm', '@el-ninel', null, 'Капитан флота Ундоме', 'Норэндиль водил корабли Ундоме мимо Стены и погиб в 1002 г., когда Камни замолкли и Отчаяние накрыло палубу. Его экипаж вернулся без слов.', 'soldier', null, null, MO, 'sea elf captain looking about forty, blue-grey skin, wet silver hair, dark seafarer coat, pearls in his collar, grim eyes'],
      ['eun-mel', 'Мэлиндис Ундоме', 'f', 940, null, 'eun-ulm', '@el-ninel', null, 'Посланница Дома Ундоме к Республике', 'Мэлиндис вела переговоры с Республикой о проходе кораблей мимо Стены. Живёт в воде три дня из четырёх.', 'merchant', null, 'Подписала договор от имени матери, не спросив Престол; печать Дома стоит на листе, спрятанном на дне раковины.', MO, 'sea elf woman looking about forty-five, pale blue skin, long silver-green hair with pearls, sea-blue gown, steady deep eyes'],
    ],
    patch: [
      ['@el-ninel', { spouse: 'eun-ulm' }],
    ],
  },
  {
    dyn: 'el-house-elendor',
    people: [
      ['eel-lun', 'Лунэндил Элендор', 'm', 890, 985, null, null, 'eel-sel', 'Прежний глава Дома Элендор', 'Лунэндил поставил Дом на ночную разведку и умер в 985 г., когда в Анорланте впервые зашептали об отравлении. Говорил, что тени не врут, врут лишь те, кто их читает.', 'noble', null, null, NO, 'old night elf lord looking about seventy, silver hair, pale skin, blue-black cloak, silver eyes squinting in light'],
      ['eel-sel', 'Селэнэ Элендор', 'f', 895, null, null, null, 'eel-lun', 'Мать Аэглоса, колдунья теней', 'Селэнэ живёт в тёмной комнате с зашторенными окнами и принимает гостей лишь в полнолуние. Говорит, что видела Ночь Голых Ветвей за год до того, как она случилась.', 'cleric', null, null, NO, 'ancient night elf woman looking about eighty, white hair, very pale skin, midnight blue robe, silver luminous eyes'],
      ['eel-hea', 'Хаэлиндор Элендор', 'm', 950, 1004, '@el-aeglos', null, null, 'Лекарь Дома Элендор', 'Хаэлиндор лечил Ромендиля у Поющих Камней и умер в тот же день, что и больной, выпив тот же отвар. Для Дома это была «случайность».', 'cleric', null, 'Подал Ромендилю яд по слову отца и Ирмэль, а потом выпил остатки, потому что не вынес вины.', NO, 'night elf healer looking about fifty, silver hair, pale thin face, dark blue healer robe, vial case at his belt, haunted silver eyes'],
      ['eel-nox', 'Нокторэн Элендор', 'm', 970, null, '@el-aeglos', null, null, 'Разведчик Дома Элендор', 'Нокторэн ходит по Анорланте ночью и знает, у кого горит свет после полуночи. Улыбчивый, лёгкий в беседе и почти невидимый.', 'soldier', null, null, NO, 'night elf spy looking about thirty-five, silver-black hair, pale skin, dark blue cloak, easy charming smile, sharp silver eyes'],
      ['eel-lua', 'Луиэнэ Каранор', 'f', 972, null, '@el-aeglos', null, '@el-gaelion', 'Дочь Аэглоса, жена Гаэлиона', 'Луиэнэ вышла замуж за Каранора, чтобы связать Дома, вражда которых опасна для Стены. Бледная, с серебряной косой; рядом с мужем она единственная не боится его молчания.', 'noble', null, null, NO, 'night elf noblewoman looking about thirty, long silver braid, very pale skin, midnight blue gown with a silver moon, clever eyes'],
    ],
    patch: [
      ['@el-aeglos', { father: 'eel-lun', mother: 'eel-sel' }],
    ],
  },
  {
    dyn: 'el-house-sangvel',
    people: [
      ['esa-vir', 'Вирэндор Сангвэль', 'm', 925, 988, null, null, 'esa-rub', 'Прежний глава Дома Сангвэль', 'Вирэндор возглавил Дом в год, когда его осудили за Магию Крови, и держал голову высоко до самой смерти в 988 г. Дочери он оставил только перчатки.', 'noble', null, null, BL, 'blood elf lord looking about fifty, dark red hair, vivid green eyes, red coat, black gloves, proud sad face'],
      ['esa-rub', 'Рубэнэ Сангвэль', 'f', 930, null, null, null, 'esa-vir', 'Мать Кармэль, сказительница', 'Рубэнэ помнит времена, когда Кровавых не презирали, и рассказывает дочери, что Магия Крови когда-то спасала от чумы.', 'folk', null, null, BL, 'old blood elf woman looking about eighty, grey-red hair, vivid green eyes, red shawl, soft wry smile'],
      ['esa-kor', 'Корвэль Сангвэль', 'm', 960, 1005, 'esa-vir', null, null, 'Брат Кармэль, воин', 'Корвэль ушёл в Стражу Камней, чтобы смыть позор Дома, и умер в 1005 г., истёкший кровью у Камня Седьмого. Кармэль не успела его спасти: Камни замолкли.', 'soldier', null, null, BL, 'blood elf soldier looking about forty, dark red hair, vivid green eyes, steel mail with a red tabard, scarred cheek'],
      ['esa-ris', 'Рисэль Сангвэль', 'f', 989, null, null, '@el-karmel', null, 'Дочь Кармэль, «оживлённая»', 'Рисэль умерла от лихорадки в 1001 г. и вернулась, когда мать влила в неё свою кровь. Ей двадцать один год, но она бледнее всех, и руки у неё холоднее камня.', 'child', null, 'Её жизнь держится на крови матери; если Кармэль умрёт, Рисэль умрёт на следующий день. Это знают только они двое.', BL, 'blood elf young woman looking about twenty, dark red hair, vivid green eyes, very pale cold skin, red dress, black gloves, calm uncanny gaze'],
    ],
    patch: [
      ['@el-karmel', { father: 'esa-vir', mother: 'esa-rub' }],
    ],
  },
  {
    dyn: 'el-house-karanor',
    people: [
      ['eka-kar', 'Каранор Старший', 'm', 880, 976, null, null, 'eka-tan', 'Основатель Стражи Стены, дед Гаэлиона', 'Каранор Старший ставил первые Поющие Камни после Пролома и сам обложил каждый камень рунами. Умер в 976 г., в год восстания, успев сказать сыну: «Камни держит дерево».', 'soldier', null, 'Знал, что Стена питается Ивой, и записал это в Книгу рода; страницу Ирмэль вырвала в 997 г.', HE, 'old elf marshal looking about eighty, white long hair, steel armour with a silver leaf, scarred face, stern eyes'],
      ['eka-tan', 'Таниэль Каранор', 'f', 885, 950, null, null, 'eka-kar', 'Мать Ромендиля', 'Таниэль растила сына одна в крепости на севере и учила его, что армия служит дереву, а не Престолу. Умерла в 950 г.', 'noble', null, null, HE, 'elf noblewoman looking about fifty, grey-gold braided hair, steel-grey gown, firm kind eyes'],
      ['eka-ael', 'Аэлвэн Каранор', 'f', 928, 979, null, null, '@el-romendil', 'Жена Ромендиля', 'Аэлвэн была врачом при Страже и погибла при осаде Теанвена в 979 г., прикрыв раненых. Гаэлион помнит её руки, пахнущие травами.', 'cleric', null, null, HE, 'elf healer woman looking about forty-five, fair hair in a braid, grey healer robe, steady kind eyes'],
      ['eka-aer', 'Аэриэль Каранор', 'f', 970, null, '@el-romendil', 'eka-ael', null, 'Дочь Ромендиля, дознаватель Стражи', 'Аэриэль ведёт дознание в Страже Стены и не верит в «случайности». Высокая, с серой косой и шрамом на подбородке.', 'soldier', null, 'Подозревает лекаря Дома Элендор в убийстве отца и ищет свидетеля; не знает, что лекарь уже мёртв от той же отравы.', HE, 'elf woman officer looking about thirty, grey-blond braid, steel armour, scar on the chin, hard clever eyes'],
      ['eka-rom', 'Ромэндиль Младший', 'm', 993, null, '@el-gaelion', 'eel-lua', null, 'Внук Ромендиля, мальчик', 'Ромэндиль Младший учится держать лук и слушать Камни. Его кормилица говорит, что он слышит их пение даже во сне.', 'child', null, null, HE, 'young elf boy looking about ten, light grey-blond hair, steel-grey tunic with a small silver leaf, serious listening eyes'],
    ],
    patch: [
      ['@el-romendil', { father: 'eka-kar', mother: 'eka-tan', spouse: 'eka-ael' }],
      ['@el-gaelion', { father: '@el-romendil', mother: 'eka-ael', spouse: 'eel-lua' }],
    ],
  },
  {
    dyn: 'el-house-vastar',
    people: [
      ['eva-ber', 'Бэрэнд Вастар', 'm', 925, 977, null, null, null, 'Прежний глава Дома Вастар', 'Бэрэнд повёл ветеранов Братств в бой у Ауреэльватара и пал в 977 г. Дом получил за него землю, но никто не вспомнил имя на её границе.', 'soldier', null, null, LE, 'grizzled woodland elf commander looking about fifty, short grey hair, plain mail, green tabard, battle-worn face'],
      ['eva-tol', 'Толмэн Вастар', 'm', 958, 977, 'eva-ber', null, null, 'Старший брат Хельдара', 'Толмэн погиб в том же бою, что и отец, в девятнадцать лет. Хельдар вернулся с боя без левой руки и всю жизнь носит его лук.', 'soldier', null, null, LE, 'young woodland elf soldier looking about twenty, short brown hair, mail, green tabard, eager face'],
      ['eva-sae', 'Саэнэ Вастар', 'f', 968, null, null, null, '@el-heldar', 'Жена Хельдара', 'Саэнэ — полуэльфийка с лицом гладра и острыми ушами. Хельдар женился на ней вопреки Книге; их дети тоже вне списков.', 'folk', null, 'Через мужа и сама переписывается с Ноллорэ; передала ей план рощи Сильвиэль.', PE, 'half-elf woman looking about thirty-five, brown hair in a braid, human face with slightly pointed ears, plain wool dress, warm determined eyes'],
      ['eva-hal', 'Хэльмар Вастар', 'm', 988, null, '@el-heldar', 'eva-sae', null, 'Сын Хельдара, молодой ветеран', 'Хэльмар служит в войске Вастар. Лицо у него человеческое, но он носит эльфийский лук и не позволяет шутить над ушами.', 'soldier', null, null, PE, 'young half-elf soldier looking about twenty, brown hair, human face with slightly pointed ears, mail and green tabard, proud wary eyes'],
      ['eva-vel', 'Велэна Вастар', 'f', 991, null, '@el-heldar', 'eva-sae', null, 'Дочь Хельдара, швея', 'Велэна шьёт плащи для ветеранов и не знает, что отец готовит для неё Дом. Тоненькая, с русыми косами.', 'folk', null, null, PE, 'half-elf young woman looking about eighteen, fair braids, human face with slightly pointed ears, simple green dress, bright curious eyes'],
    ],
    patch: [
      ['@el-heldar', { father: 'eva-ber', spouse: 'eva-sae' }],
    ],
  },
  {
    // Полуэльфы и люди вне Книги Побегов (закон о Третьем Сорте): без династии
    dyn: null,
    people: [
      ['ehb-mar', 'Марена', 'f', 948, 990, null, null, null, 'Мать Ноллорэ, служанка Дома Элендор', 'Марена, человеческая служанка в доме Аэглоса, умерла в 990 г. от лихорадки в долговом бараке. Ноллорэ помнит её серую ленту.', 'folk', null, 'Сын её хозяина-эльфа по слову двора считался «ничьим»; Аэглос знает отца дочери и молчит.', HM, 'human servant woman looking about forty, brown hair under a plain cap, grey ribbon on her arm, tired kind eyes'],
      ['ehb-ira', 'Ирэна', 'f', 950, 1001, null, null, null, 'Мать Брэндира, прачка', 'Ирэна жила на окраине Анорланте и стирала для Дома Фаэлин. Умерла в 1001 г., не дождавшись сына из болот.', 'folk', null, null, HM, 'human washerwoman looking about fifty, grey-streaked brown hair, rolled sleeves, grey ribbon, worn kind face'],
      ['ehb-hug', 'Гуго Рэйн', 'm', 940, 1003, null, null, 'ehb-lal', 'Имперский курьер, отец Мэйрин', 'Гуго возил письма между Анорланте и имперским портом и умер в 1003 г. на дороге; его тело вернули в серой ленте.', 'merchant', null, 'Любовник Мэриэль Исилвен: возил её письма Империи и передал ей дочь — Лиэну. Мэйрин знает только про письма.', HUI, 'imperial courier looking about fifty, short brown beard, travelling coat, grey ribbon, wary clever eyes'],
      ['ehb-lal', 'Лиаль Рэйн', 'f', 960, 1001, null, null, 'ehb-hug', 'Швея, мать Мэйрин', 'Лиаль шила платья Высшим и сводила концы с концами; от неё Мэйрин научилась ремеслу и осторожности. Умерла в 1001 г.', 'folk', null, null, PE, 'half-elf seamstress looking about forty, brown hair pinned up, human face with slightly pointed ears, plain dress, thimble on a cord, patient eyes'],
      ['ehb-lia', 'Лиэна', 'f', 990, null, 'ehb-hug', '@el-meriel', null, 'Полуэльфийка в долговом труде', 'Лиэна выросла в доме, где её мать не признавала её на людях. С двенадцати лет работает в долговом труде у Высших, с серой лентой на плече.', 'folk', null, 'Дочь Мэриэль Исилвен и Гуго Рэйна. Мэйрин ей сводная сестра, но обе этого не знают.', PE, 'half-elf young woman looking about twenty, dark hair, grey eyes, human face with slightly pointed ears, grey serving dress with a grey ribbon, quiet steady gaze'],
      ['ehb-tal', 'Талмир Одноглазый', 'm', 938, 1005, null, null, null, 'Старый боец Волчьих Братств', 'Талмир потерял глаз в бою у Ауреэльватара и ушёл в болота вместе с Брэндиром. Умер в 1005 г., оставив тайник с зерном.', 'soldier', null, null, PE, 'half-elf veteran looking about sixty-five, one eye missing with a leather patch, grey beard, patched leather armour, hard kind face'],
      ['ehb-sor', 'Сорэн', 'm', 1000, null, '@el-brendir', null, null, 'Сын Брэндира', 'Сорэн родился в болоте и до семи лет не видел города. Рыжий, как отец, и с волчьим зубом на шее.', 'child', null, null, PE, 'half-elf boy looking about ten, red hair, human face with slightly pointed ears, ragged fur-lined clothes, a wolf tooth on a cord, wary bright eyes'],
      ['ehb-vey', 'Харальд Вейл', 'm', 940, 1002, null, null, null, 'Торговец солью, отец Томаса', 'Харальд первым привёз в Анорланте имперскую соль и умер в 1002 г. в долговой яме за недоимки.', 'merchant', null, null, HUI, 'human salt merchant looking about sixty, grey-red beard, heavy travelling coat, grey ribbon, tired shrewd eyes'],
    ],
    patch: [
      ['@el-nolore', { father: '@el-aeglos', mother: 'ehb-mar' }],
      ['@el-brendir', { father: '@el-tarilon', mother: 'ehb-ira' }],
      ['@el-meyrin', { father: 'ehb-hug', mother: 'ehb-lal' }],
      ['@el-thomas', { father: 'ehb-vey' }],
    ],
  },
]

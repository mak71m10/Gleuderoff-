// Родословные Сильвленда: пять Домов Опекунов Матерей (Тавэлин, Аурелан, Вэйлин, Исенвэль, Риорэн).
// Кортеж как в el.mjs; помощник P заполняет роль и порядок полей. Сильва родословных не имеют (рождаются из плодов).
export const TAG = 'Сильвленд'
const LE = 'Лесной эльф', HE = 'Высший эльф', SO = 'Солнечный эльф', SU = 'Сумеречный эльф'
const P = (key, name, g, born, died, father, mother, spouse, title, text, house, secret, race, look) =>
  [key, name, g, born, died, father, mother, spouse, title, text, 'noble', house, secret, race, look]

export const SPECS = [
  {
    dyn: 'sv-house-tav',
    people: [
      P('svt-aro', 'Арондиль Тавэлин', 'm', 880, 962, null, null, 'svt-ela', 'Старый Опекун Нэнадор', 'Арондиль помнил Лесную войну и первым стал считать плоды Нэнадор на корнях. Умер за девятнадцать лет до того, как внук завязал десятый узел и взял Печать Листа.', null, null, LE,
        'old elf with long white hair and a moss-green cloak, pale northern face, deep-set grey eyes, a staff of pale wood, forest light'),
      P('svt-ela', 'Элариэль Тавэлин', 'f', 885, 970, null, null, 'svt-aro', 'Мать Илариона, хранительница корней', 'Элариэль вырастила Илариона на корнях Нэнадор и научила его не лгать дереву. Хоронили её в Ячори, и в тот год Нэнадор дала два плода сверх меры.', null, null, LE,
        'elderly elven woman with silver braid, kind grey eyes, pale skin, green wool dress with a leaf brooch'),
      P('svt-mel', 'Мелиэль Тавэлин', 'f', 915, 990, null, null, '@sv-ilarion', 'Жена первого Хранителя', 'Мелиэль была рядом, когда Иларион получил Печать Листа, и шила ему плащи цвета мха. Умерла за три года до его отставки.', null, null, LE,
        'middle-aged elf woman with a thick brown braid, calm blue-grey eyes, fair northern face, moss-green dress with leaf embroidery'),
      P('svt-tor', 'Торэнвир Тавэлин', 'm', 938, 1000, null, null, '@sv-meriene', 'Муж Мэриэнэ, садовник Нэнадор', 'Торэнвир пришёл в Дом из младшей ветви и всю жизнь подвязывал ветви Нэнадор. Умер за три года до Падалицы, не увидев, как Мать дала мало плодов.', null, null, LE,
        'sturdy forest elf with short beard, brown hair with grey, kind hazel eyes, fair weathered skin, green work tunic, gardener hands'),
      P('svt-ber', 'Берион Тавэлин', 'm', 978, null, '@sv-meriene', null, null, 'Ученик Счётчиков, брат Лаэрэль', 'Берион молод и недоволен: по его мнению, Печать должна вернуться к Дому Тавэлин, а Счётчики Плодов слишком осторожны. Часто спорит с сестрой.', null, 'Тайно читает запись Книги Урожаев по Риорриэли и сомневается в числе «1» за 1010 год. Сестре не говорит.', LE,
        'young elf of thirty-two with light brown hair tied back, grey-green eyes, fair pale face, sharp attentive look, green tunic, ink on fingers'),
    ],
    patch: [
      ['@sv-ilarion', { father: 'svt-aro', mother: 'svt-ela', spouse: 'svt-mel' }],
      ['@sv-meriene', { father: '@sv-ilarion', mother: 'svt-mel', spouse: 'svt-tor' }],
      ['@sv-laerel', { father: 'svt-tor', mother: '@sv-meriene' }],
    ],
  },
  {
    dyn: 'sv-house-aur',
    people: [
      P('sva-eld', 'Эльдаран Аурелан', 'm', 895, 975, null, null, 'sva-ima', 'Старый комендант Заставы Аэасвен', 'Эльдаран поставил первую береговую Заставу у Аэасвена и сорок лет смотрел на море Шеши. Умер за шесть лет до Грамоты Опушки.', null, null, HE,
        'old high elf with a long silver beard, tall noble bearing, pale northern face, blue eyes, blue cloak with a golden tower brooch'),
      P('sva-ima', 'Имаэлис Аурелан', 'f', 900, 980, null, null, 'sva-eld', 'Мать Валенора, хранительница Книги Портов', 'Имаэлис вела учёт портовых пошлин Лоанмиэля и записала первые долговые списки Дома. Её почерком до сих пор подписаны старые ящики Заставы.', null, null, HE,
        'elderly high elf woman with white hair in a crown braid, sharp blue eyes, fair face, blue dress with gold trim'),
      P('sva-lir', 'Лирэнис Аурелан', 'f', 935, 1002, null, null, '@sv-valenor', 'Жена Валенора', 'Лирэнис была строга и красива, пока позволяло здоровье. Умерла зимой 1002 г., когда уже не вставала с постели; Валенор с тех пор не снимает чёрной ленты.', null, null, HE,
        'dignified high elf woman in her late sixties, silver-blond hair, cool grey-blue eyes, pale skin, dark blue dress, gold pin'),
      P('sva-cal', 'Калдор Аурелан', 'm', 979, null, '@sv-valenor', 'sva-lir', null, 'Капитан порта Лоанмиэль', 'Калдор держит порт и берёт у Республики заём на ремонт пирса; отцу говорит, что это временно. Брат Сэлиндэ, не любит быть вторым в роду.', null, 'Подписал для Республики расписку на второй заём без ведома отца: залог — пошлины Лоанмиэля на пять лет.', HE,
        'young high elf of thirty-one, blond hair to the shoulder, blue eyes, clean-shaven fair face, blue captain coat with golden buttons, sea wind'),
    ],
    patch: [
      ['@sv-valenor', { father: 'sva-eld', mother: 'sva-ima', spouse: 'sva-lir' }],
      ['@sv-selinde', { father: '@sv-valenor', mother: 'sva-lir' }],
    ],
  },
  {
    dyn: 'sv-house-vey',
    people: [
      P('svv-sol', 'Солариэль Вэйлин', 'm', 915, 990, null, null, 'svv-ami', 'Старый Опекун Эленнор', 'Солариэль построил второй чертог Дома Света на плодовые пожертвования Опекунов. Умер в Алпрас, держа в руке ещё тёплый плод.', null, null, SO,
        'old sun elf with golden-white hair, warm amber eyes, fair freckled northern face, cream robe with red flame embroidery'),
      P('svv-ami', 'Амирэль Вэйлин', 'f', 922, 1005, null, null, 'svv-sol', 'Мать Эленвэ', 'Амирэль дожила до восьмидесяти трёх и успела благословить новый шнур Хранителя Аэлиндора в 1004 г. Хоронили её рыжей прядью, срезанной внучкой.', null, null, SO,
        'elderly sun elf woman, hair faded to pale copper, amber eyes, kindly lined fair face, cream dress with red embroidery'),
      P('svv-tal', 'Талирион Вэйлин', 'm', 948, 1003, null, null, '@sv-elenve', 'Муж Эленвэ', 'Талирион умер в Падалицу 1003 г., в месяц Алпрас, когда Мать Эленнор дала пустой плод. Лекари сказали: сердце. Эленвэ сказала: Мать.', null, 'Талирион сам уговорил Эленвэ не карать голодных в Падалицу, хотя знал, что шнур упадёт; она так и сделала, а потом назвала это своим решением.', SO,
        'tall sun elf with copper beard, warm amber eyes, fair freckled face, red and cream tunic, steady kind look'),
      P('svv-dar', 'Дарвиэль Вэйлин', 'm', 955, null, 'svv-sol', 'svv-ami', null, 'Хранитель Дома Света', 'Дарвиэль, брат Эленвэ, ведёт службу в Доме Света и принимает послов Опеки. С Бенно дружит по расчёту.', null, 'Берёт с Дома плату за каждый плод сверх меры, записывая это как «пожертвование»; половина оседает у него.', SO,
        'plump sun elf priest of fifty-five, thinning ginger hair, amber eyes, smooth fair face, cream and red vestments'),
      P('svv-iri', 'Ирэйлин Вэйлин', 'f', 985, null, '@sv-elenve', 'svv-tal', null, 'Послушница Дома Света', 'Ирэйлин, дочь Эленвэ, учится у дяди и мечтает о Печати; мать смотрит на это без удовольствия.', null, null, SO,
        'young sun elf of twenty-five, long copper-red hair, amber eyes, freckles on fair skin, simple cream novice dress with a red ribbon'),
    ],
    patch: [
      ['@sv-elenve', { father: 'svv-sol', mother: 'svv-ami', spouse: 'svv-tal' }],
    ],
  },
  {
    dyn: 'sv-house-ise',
    people: [
      P('svi-mor', 'Морвэн Исенвэль', 'm', 910, 988, null, null, 'svi-nai', 'Старый Опекун Исенриэль', 'Морвэн сажал побеги Исенриэль после Лесной войны и учил Дом молчать о том, чего не видел сам. Умер за год до спора о душе сильва.', null, null, SU,
        'old twilight elf with grey-brown hair, pale grey eyes, stern thin face, northern fair skin, brown cloak with a silver mountain pin'),
      P('svi-nai', 'Найрэ Исенвэль', 'f', 915, 1001, null, null, 'svi-mor', 'Мать Каэлиса', 'Найрэ погибла в Лаций 1001 г. в пожаре рощи, не успев выйти из дома. Тело нашла Ольха.', null, null, SU,
        'elderly twilight elf woman, silver-grey hair braided, grey eyes, tired kind face, brown wool dress with a silver pin'),
      P('svi-yel', 'Йэлэн Исенвэль', 'f', 950, 1001, null, null, '@sv-kaelis', 'Жена Каэлиса', 'Йэлэн погибла вместе со свекровью в пожаре Исенриэль. Каэлис с тех пор не говорит об ордынцах и молится сильва за мёртвых.', null, null, SU,
        'twilight elf woman in her fifties, dark hair streaked with grey, pale grey eyes, thin face, brown dress with a silver hem'),
      P('svi-lin', 'Линдэ Исенвэль', 'f', 980, null, '@sv-kaelis', 'svi-yel', null, 'Посредница Дома с Ордой', 'Линдэ выжила в Лаций 1001 г. и первой в Доме заговорила о переговорах с Ордой. Её не любят Южные Заставы; сильва её слушают, но решает Опекун.', null, 'Дважды встречалась с послом Орды в пустой роще и обещала открыть перевал за мир; о встречах знает только Тис.', SU,
        'twilight elf woman of thirty, dark brown hair in a loose braid, pale grey eyes, thin serious fair face, brown travelling cloak, a small burn scar on the hand'),
      P('svi-tev', 'Тэвиан Исенвэль', 'm', 983, 1001, '@sv-kaelis', 'svi-yel', null, 'Погибший в роще Исенриэль', 'Тэвиан не успел стать Опекуном: ему было восемнадцать, когда Орда сожгла рощу. Исенриэль выросла на его могиле новым побегом, говорят в Доме.', null, null, SU,
        'young twilight elf of eighteen, tousled dark hair, grey eyes, pale fair face, brown tunic, quiet look'),
    ],
    patch: [
      ['@sv-kaelis', { father: 'svi-mor', mother: 'svi-nai', spouse: 'svi-yel' }],
    ],
  },
  {
    dyn: 'sv-house-rio',
    people: [
      P('svr-gor', 'Горвэль Риорэн', 'm', 925, 998, null, null, 'svr-mar', 'Старый Опекун Риорриэли', 'Горвэль посадил восточные рощи Риорриэли и первым начал слать сок Ива-Стражу по договору 998 г.; умер весной того же года, не успев увидеть первую дань.', null, null, LE,
        'old forest elf with a grey wolf-fur collar, white beard, stern grey eyes, weathered pale northern face'),
      P('svr-mar', 'Марилин Риорэн', 'f', 930, 1004, null, null, 'svr-gor', 'Мать Аэлиндора и Дэйрована', 'Марилин дожила до Падалицы и до того, как сын Аэлиндор взял Печать Листа. Её последние слова — «Матерь устала».', null, null, LE,
        'elderly forest elf woman with a grey braid, tired stern grey eyes, wolf-tooth necklace, fur-trimmed dark green dress'),
      P('svr-ent', 'Энтэриэль Риорэн', 'f', 958, 1008, null, null, '@sv-aelindor', 'Вдова Аэлиндора', 'Энтэриэль умерла через год после мужа, осенью 1008 г.; хоронили её рядом с ним у корней Риорриэли. Говорят, дерево в тот день уронило первый сухой лист.', null, null, LE,
        'forest elf woman in her fifties, dark hair with grey, grey eyes, lined stern face, dark green dress, a wolf amulet'),
      P('svr-aev', 'Аэвин Риорэн', 'm', 998, null, '@sv-aelindor', 'svr-ent', null, 'Сирота Хранителя, воспитанник Дэйрована', 'Аэвин растёт у дяди и не знает, что на самом деле случилось с Риорриэлью. Любит гулять у её корней и спрашивает, почему лист жёлтый.', null, null, LE,
        'twelve year old boy elf with unruly dark hair, grey eyes, fair northern face, simple dark green tunic, curious look'),
      P('svr-sia', 'Сиарэ Риорэн', 'f', 962, null, null, null, '@sv-deirovan', 'Жена Дэйрована', 'Сиарэ ведёт хозяйство Дома и знает все его тайны. Подвязывает плоды вместе с мужем и молчит, пока он не просит совета.', null, 'Первой заметила в 1009 г., что Риорриэль не цветёт, и сама предложила привязать чужие плоды.', LE,
        'forest elf woman of forty-eight, auburn hair in a bun, grey eyes, firm fair face, dark green dress, wolf brooch'),
      P('svr-bra', 'Брайвин Риорэн', 'm', 985, null, '@sv-deirovan', 'svr-sia', null, 'Подвязчик плодов Дома', 'Брайвин, сын Дэйрована, лазит по ветвям и привязывает чужие плоды к ветвям Риорриэли. Не спит с тех пор, как понял, что делает.', null, 'Каждый Драгос приходит к корням Риорриэли и просит у умирающего дерева прощения; Нэллавэль видела это однажды и промолчала.', LE,
        'forest elf man of twenty-five, brown hair tied back, grey eyes, tired fair face with dark circles, dark green tunic, rope on the shoulder'),
    ],
    patch: [
      ['@sv-aelindor', { father: 'svr-gor', mother: 'svr-mar', spouse: 'svr-ent' }],
      ['@sv-deirovan', { father: 'svr-gor', mother: 'svr-mar', spouse: 'svr-sia' }],
      ['@sv-oriel', { father: 'svr-gor', mother: 'svr-mar' }],
      ['@sv-nellavel', { father: 'svr-gor', mother: 'svr-mar' }],
    ],
  },
]

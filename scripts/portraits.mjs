// Портреты персонажей Империи в духе средневековой фэнтези-живописи (масло, придворный портрет).
// Рисует локальная нейросеть: stable-diffusion.cpp (Vulkan) + модель DreamShaper 8 в tools/sd (не в git), через scripts/sd.mjs.
// Описание картины собирается из записи: пол, возраст, титул, характер, цвета великого дома; у ключевых
// персонажей — своё описание. Готовые портреты не перерисовываются (удалите файл, чтобы перерисовать).
// Запуск: node scripts/portraits.mjs [id …]  → resources/default-world/portraits/<id>.webp и поле image в записи
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import sharp from 'sharp'
import { HOUSES } from './lore/empire.mjs'
import { startSd, stopSd, txt2img } from './sd.mjs'

const WORLD = 'resources/default-world/world.json'
const OUT = 'resources/default-world/portraits'
const world = JSON.parse(readFileSync(WORLD, 'utf8'))
const YEAR = world.calendar.months.reduce((s, m) => s + m.days, 0)
const yearOf = (d) => (d == null ? null : Math.floor(d / YEAR) + 1)
mkdirSync(OUT, { recursive: true })

const STYLE = 'oil painting, medieval fantasy court portrait, renaissance old master style, dramatic chiaroscuro lighting, dark ornate background, rich textures, visible brush strokes, highly detailed face, half-length portrait, masterpiece'
const RP_STYLE = 'oil painting, dutch golden age style, renaissance old master, chiaroscuro lighting, dark background, visible brush strokes, detailed face, half-length portrait'
// юг: испано-итальянский колорит — испанский и итальянский придворный портрет
const SOUTH_STYLE = 'oil painting, spanish and italian renaissance court portrait, velazquez and titian style, chiaroscuro lighting, dark background, visible brush strokes, detailed face, half-length portrait'
// Святая церковь: папский двор эпохи Возрождения, белое с золотом
const CHURCH_STYLE = 'oil painting, renaissance papal court portrait, raphael and titian style, warm golden light, dark background, visible brush strokes, detailed face, half-length portrait'
// Земли Севера: суровый северный портрет — мех, кольчуга, дерево длинного дома, огонь очага
const NORTH_STYLE = 'oil painting, viking age nordic portrait, firelit longhouse interior, carved wooden pillars, dark background, visible brush strokes, detailed weathered face, half-length portrait'
// Креит: суровый портрет при свете факелов и серебра — тёмное дерево длинного дома или штольня, мех, железо, серебряные кольца
const HARNMARK_STYLE = 'oil painting, Germanic imperial principality portrait, half-timbered stone town and a white tower with a red pennant behind, overcast amber light, muted reds, creams and slate, painterly, half-length portrait'
const FEINOKO_STYLE = 'oil painting on canvas, old master, (medieval clothing:1.2), mountain island kingdom portrait, grey stone terraces and paper lanterns behind, misty blue dusk light, slate blue and grey tones, visible brush strokes, detailed face, half-length portrait'
const TAVAR_STYLE = 'oil painting on canvas, old master, (medieval clothing:1.2), forest elf kingdom portrait, a vast ancient yew tree with carved trunk behind, dappled green forest light, muted greens and browns, visible brush strokes, detailed face, half-length portrait'
const PAVIL_STYLE = 'oil painting on canvas, old master, (medieval clothing:1.2), golden-lit music pavilion portrait, a gilded gallery with seven glowing windows behind, warm candlelight, gold and plum tones, visible brush strokes, detailed face, half-length portrait'
const REDANIA_STYLE = 'oil painting on canvas, old master, (medieval clothing:1.2), river kingdom portrait, stone bridge over a dark river at dusk behind, first stars in the sky, cold blue and warm lamp tones, visible brush strokes, detailed face, half-length portrait'
const KAGIA_STYLE = 'oil painting on canvas, old master, (medieval clothing:1.2), imperial merchant-empire portrait, ochre plaster hall with a huge crimson gate behind, warm dusty sunlight, crimson, ochre and gold tones, visible brush strokes, detailed face, half-length portrait'
const KULAGON_STYLE = 'oil painting, Frisian canal-country portrait, flat green plain with brick houses and a stone arch over a canal behind, low grey sky with silver light, muted greens and slate blues, painterly, half-length portrait'
const KOGALYM_STYLE = 'oil painting, rural commune portrait, timber meeting hall with a notched tally stick and a wooden cart behind, warm daylight, earthy tones, visible brush strokes, detailed face, half-length portrait'
const LYRIA_STYLE = 'oil painting, mountain-roman ducal portrait, white marble hall with a wall of small glowing tablets behind, warm lamp light, terracotta and cream tones, visible brush strokes, detailed face, half-length portrait'
const TEMERIA_STYLE = 'oil painting, medieval forest kingdom portrait, warm hearth firelight in a half-timbered hall, an open oak door with a lantern glowing behind, green and gold accents, visible brush strokes, detailed face, half-length portrait'
const GAREFORD_STYLE = 'oil painting, alpine mountain-prince portrait, candlelit stone hall with dark oak panelling, warm lantern glow, a small brass lantern flame in the background, visible brush strokes, detailed face, half-length portrait'
const CRYDON_STYLE = 'oil painting, naval admiralty portrait, dark navy uniform with gold braid, warm cabin lamp light, charts and a brass telescope behind, sea light through a window, visible brush strokes, detailed face, half-length portrait'
const CHEAFARAL_STYLE = 'oil painting, northern republic council portrait, dutch golden age style, candlelight, dark wood and grey stone hall behind, visible brush strokes, detailed face, half-length portrait'
const HIGHLAND_STYLE = 'oil painting, alpine noble portrait, cold clear mountain light, snowy peaks and pale sky behind, dark wood panelling, visible brush strokes, detailed face, half-length portrait'
const FARVOL_STYLE = 'oil painting, fantasy mountain hall portrait, warm forge light and brass lamps, carved stone pillars, dark background, visible brush strokes, detailed face, half-length portrait'
// Эльфборн: светлый эльфийский двор — серебристая ива и белые арки за спиной, рассеянный зеленоватый свет
const ELFBORN_STYLE = 'oil painting, high fantasy elven court portrait, pre-raphaelite style, soft silver-green light through willow leaves, pale stone arches behind, visible brush strokes, detailed face, half-length portrait'
const SILVLAND_STYLE = 'oil painting, high fantasy forest portrait, deep green dappled light under giant ancient tree canopy, mossy roots and glowing fruit behind, visible brush strokes, detailed face, half-length portrait'
const KREIT_STYLE ='oil painting, viking age norwegian portrait, dark smoky longhouse lit by torches, glints of raw silver, carved dragon posts, dark background, visible brush strokes, detailed weathered face, half-length portrait'
const NEG = '(asian:1.5), (east asian, chinese, japanese, korean, mongolian:1.4), epicanthic fold, monolid eyes, narrow eyes, photo, photorealistic, 3d render, modern clothing, text, watermark, signature, frame border, blurry, lowres, deformed, extra fingers, extra limbs, cartoon, anime, nsfw, nude'

// цвета домов -> слова для одежды
const HOUSE_COLORS = {
  essenwald: 'black and gold', rheinhold: 'crimson and black', morving: 'deep blue and white', grauenstein: 'grey and silver',
  littenau: 'green and gold', falkenhorst: 'gold and crimson', tessen: 'forest green and brown', saltmar: 'white and teal',
  hoeldern: 'deep blue and gold', brandt: 'black and flame red', osterveld: 'purple and gold', kronau: 'white and gold',
  'house-argus': 'navy blue and silver', 'house-mangenium': 'brown and gold', 'house-styria': 'black and dark purple'
}
const houseOf = new Map(HOUSES.map((h) => [`lore-${h.id}`, h.id]))

// особые описания ключевых персонажей
const CUSTOM = {
  'hm-baltasar': 'thin stooped clerk about forty, short dark beard, short dark hair, (no hat:1.4), red-rimmed tired eyes, ink-stained fingers, plain dark wool doublet with a white linen collar, a small scraping knife on the belt, holding a quill',
  'fm-lA-eg': 'sturdy woman in her fifties, long dark brown hair tied back, full head of hair, plain brown wool dress, a simple pendant, tired practical eyes',
  'fm-lF-old': 'dignified landowner-judge in his sixties, short white hair, grey beard, dark toga, a scroll in hand, plain stone wall behind, no frame',
  'fm-lF-w': 'practical widow in her fifties, brown hair streaked with grey tied in a bun, olive dress, vineyard basket, calm tired eyes',
  'fm-lA-gn2': 'short broad-shouldered miner-engineer in his late twenties, short brown hair, light pale eyes, simple tunic with leather straps, a mine lamp',
  'fm-lT-gib10': 'young warrior king in his thirties, short dark hair, short beard, bronze breastplate, a notched iron circlet, grim face',
  // Кулагон: фризская равнина, каналы
  'kl-jasper': 'dry quick man of forty-eight, short grey-blond hair, grey cloak, a plain iron ring on a chain, tired watchful pale eyes',
  'kl-auke': 'old stern patriarch in his late seventies, white hair, deep wrinkles, worn leather jacket, a heavy iron ring, proud look',
  'kl-geeske': 'elderly woman in her late sixties, white hair under a linen cap, shrewd calm eyes, dark wool dress',
  'kl-sjoukje': 'composed woman of forty-four, blond hair braided, grey dress, quiet clever expression',
  'kl-piebe': 'serious boy of ten, straw hair, grey tunic, solemn look',
  // Сильвленд: сильва — растительные черты, эльфы и люди — северноевропейские лица
  'sv-ilarion': 'tall stooped old elf looking about eighty, long grey hair, moss-green cloak, a staff of pale wood, wise sad eyes',
  'sv-elenve': 'golden-eyed sun elf woman looking about fifty, red-gold hair, sunset-colored dress, proud calm face',
  'sv-aelindor': 'weathered forest elf warrior looking about fifty, scar on the cheek, grey wolf-tooth amulet, dark green leather',
  'sv-selinde': 'stern fair-haired high elf woman looking about thirty-five, blue gown, a small green leaf seal on a yew cord, composed face',
  'sv-meriene': 'sturdy forest elf woman looking about seventy, thick braid with a fruit ribbon, dark green dress, steady eyes',
  'sv-valenor': 'grey-haired high elf lord looking about eighty, blue doublet with a golden tower, stern commanding face',
  'sv-kaelis': 'thin silent twilight elf looking about sixty-five, grey skin, a wreath of grass on the shoulder, tired eyes',
  'sv-deirovan': 'stocky forest elf looking about fifty, grey eyes, wolf pelt on the shoulders, worried guilty face',
  'sv-laerel': 'quick-eyed forest elf woman looking about forty, hair pinned up, ink on her fingers, a ledger of root-bark',
  'sv-oriel': 'wiry elf woman archer looking about forty, burn scars on one cheek and neck, dark green leather, hard eyes',
  'sv-nellavel': 'quiet elf healer woman looking about thirty-five, light linen shirt, gentle sorrowful eyes',
  'sv-tis': 'ancient dark-green sylva elder, thick bark on the shoulders, red berries in the hair, slow wise amber eyes',
  'sv-bereskl': 'tall thin sylva man, birch-white bark skin, pink fruits on the shoulders, a scroll of birch bark in hand',
  'sv-malinnik': 'round sylva man with red berries growing in his palms, cheerful counting expression, green skin',
  'sv-yasen': 'tall sylva guard with pale ash-grey bark, a spear of ash wood, calm watchful eyes',
  'sv-buzina': 'small sylva woman healer with white flowers and black berries in her hair, kind eyes',
  'sv-olkha': 'slim sylva woman with alder catkins in her hair, brave direct look, leaf-green skin',
  'sv-kalina': 'young sylva woman merchant with clusters of red guelder-rose berries in the hair, smiling, market apron',
  'sv-brusnika': 'small sylva girl, pale washed-out green skin, dull faded eyes, a single pale berry in the hair',
  'sv-olger': 'ginger-bearded middle-aged human moneylender, dark coat with silver buttons, shrewd cold eyes',
  'sv-benno': 'bald plump human friar in a grey robe, soft cunning smile',
  // Эльфборн: эльфы стареют медленно — в описании видимый возраст; северноевропейские лица, остроконечные уши
  'el-faeron': 'ageless elf lord looking about sixty, long silver-grey hair with a golden ribbon, rigid straight posture, spotless white cloak, stern regretful eyes',
  'el-romendil': 'broad-shouldered elf warrior looking about fifty, scar across the eyebrow, long grey braid, worn steel armor with a silver leaf, hard tired face',
  'el-illendel': 'elf queen-regent looking about forty, sun-tanned golden skin, golden eyes, auburn hair, sunset-orange gown, a wooden bracelet of willow twig, anxious composed face',
  'el-irmel': 'thin almost translucent elf priestess looking about seventy, white robes, a silver chain with twelve small green leaves, pale cold eyes',
  'el-serindor': 'round-faced grey-skinned elf priest looking about fifty, plump hands, sly constant smile, grey robes, a small purse of gold coins',
  'el-elelmo': 'ancient blind elf high priest, milky white eyes, very long white hair, white and gold robes, serene face',
  'el-valandil': 'tall well-groomed elf lord looking about forty, long fair hair, white doublet with a golden crown embroidered on the collar, arrogant smile',
  'el-serelin': 'stately elf noblewoman looking about thirty-five, tall winged silver helmet, azure cloak, proud resentful eyes',
  'el-meriel': 'grey-haired elf noblewoman looking about fifty, pastel grey gown, a grey dove on her shoulder, calm unreadable face',
  'el-elbaron': 'narrow-faced elf ranger looking about fifty, green eyes, long brown hair, leaf-green hooded cloak, a longbow, watchful worried look',
  'el-tarilon': 'wild elf chieftain looking about forty-five, tanned skin with dark tribal tattoos from cheekbones down the neck, wolf-pelt cloak, fierce eyes',
  'el-liren': 'small elf healer looking about thirty, soft grey feathered wings half-open behind her, plain linen dress, kind determined eyes',
  'el-ninel': 'old sea elf woman, pale pearly skin, long white hair with pearls woven in, sea-blue robes, distant grey eyes',
  'el-aeglos': 'pale night elf lord looking about fifty, silver eyes squinting, long black hair, dark blue cloak, cold secretive face',
  'el-karmel': 'blood elf noblewoman looking about thirty-five, bright emerald green eyes, dark auburn hair, dark blood-red gown, black gloves',
  'el-gaelion': 'tall elf knight looking about thirty-five, long fair hair, heavy silver plate armor, a silver leaf brooch on the chest, tired sleepless eyes',
  'el-heldar': 'grey-haired elf veteran looking about forty-five, missing left forearm with the sleeve pinned by a silver brooch, brown leather coat, stubborn face',
  'el-nolore': 'short half-elf woman of forty, light brown hair with a grafted apple twig in it, plain green clothes, sharp defiant eyes',
  'el-brendir': 'broad red-haired half-elf man of thirty-five, stubble, a wolf fang on a cord around the neck, worn leather jerkin, rough grin',
  'el-meyrin': 'young half-elf seamstress of twenty-five, clear bright eyes, light brown hair, simple work dress with a grey ribbon on the shoulder',
  'el-silviel': 'slender elf seer looking about fifty, a rowan berry wreath on greying hair, mossy green robes, faraway eyes',
  'el-thomas': 'reddish-haired merchant of thirty-five, short beard, travelling coat with a grey ribbon on the left sleeve, wary look',
  'el-arviel': 'cold beautiful elf noblewoman looking about thirty, long fair braid with golden pins, white and azure gown, disdainful look',
  'kl-tjerk': 'hard exiled lord of seventy, long grey hair, weathered face, travelling cloak, bitter pride',
  'kl-eelke': 'broad man of thirty-eight, red-blond beard, practical wool coat, stubborn jaw',
  'kl-ymkje': 'strong woman of thirty-five, ginger hair tied back, shrewd green eyes',
  'kl-haije': 'restless boy of nine, ginger hair, scuffed knees, curious eyes',
  'kl-sybren': 'calm merchant lord of fifty-two, neat brown beard, blue coat, ledger under arm',
  'kl-hiske': 'dignified woman of fifty, brown hair with grey, blue dress, kind firm eyes',
  'kl-lolke': 'shy boy of eight, brown hair, big blue eyes, blue jacket',
  'kl-fokke': 'sturdy bargeman of twenty-five, brown hair, rope over shoulder, open face',
  'kl-obbe': 'heavy gruff man of fifty-five, grey beard, red-brown coat, wary hard eyes',
  'kl-tsjitske': 'stern woman of fifty, grey hair in a bun, red shawl, sharp gaze',
  'kl-eile': 'quiet young man of thirteen, dark blond hair, thin face, red scarf, haunted eyes',
  'kl-edzke': 'sharp woman of twenty-eight, dark hair, red ribbon, assessing look',
  'kl-hanneke': 'lively woman of forty-five, silver-blond hair, green dress, quick wry smile',
  'kl-sierd': 'old man of sixty-four, white hair, green coat, tired scholarly face',
  'kl-gerben': 'earnest boy of twelve, blond hair, green tunic, honest eyes',
  'kl-reiner': 'gaunt old lord of sixty-two, white hair, violet cloak, severe stare',
  'kl-doede': 'tall man of forty-two, light brown hair, violet coat, controlled expression',
  'kl-baukje': 'elegant woman of thirty-eight, blond hair in a braided crown, violet dress, calm eyes',
  'kl-sjoerd': 'small boy of seven, blond curls, violet tunic, serious face',
  'kl-jouke': 'girl of ten, blond braids, violet dress, bright curious eyes',
  'kl-wiebe': 'weathered man of sixty, grey hair, orange-brown coat, canal-boatman hands, steady look',
  'kl-griet': 'woman of fifty-five, grey-blond hair, orange shawl, motherly worried eyes',
  'kl-frouke': 'girl of fourteen, blond hair, orange ribbon, quiet resolute face',
  'kl-eibe': 'dry archivist of fifty, thin face, grey hair, ink-stained fingers, a bowl of notched clay shards, spectacles-free sharp eyes',
  'kl-remme': 'young scribe of thirty-two, brown hair, ink-stained cuffs, nervous clever eyes',
  'kl-ruurd': 'broad ferryman of forty, brown beard, pole in hand, oilskin cloak, calm pale eyes',
  'kl-anne': 'practical woman of thirty-two, brown hair under a cap, ferry ledger in hand',
  'kl-radbod': 'old priest of fifty-five, tonsured grey hair, plain brown robe, gentle weary face',
  'kl-garrelt': 'veteran captain of the Ward, forty-five, short grey hair, scarred jaw, grey leather coat, sword at hip',
  'kl-leandr': 'smooth envoy of thirty-five, neat dark-blond hair, fine imperial-cut coat, polite measured smile',
  'kl-meinert': 'bony clerk of thirty-two, thin blond hair, clay dust on hands, shrewd squint',
  'kl-neltje': 'weathered boatwoman of sixty, grey hair under a kerchief, strong arms, wry smile, oar behind her',
  'kl-jelle': 'stocky stonemason of sixty, white stubble, dusty apron, chisel in hand, patient eyes',
  // Когалым: крестьяне-беглецы Империи, северноевропейские лица
  'kg-hans': 'broad weathered hop farmer and carter in his late forties, brown hair with grey, short beard, rough linen shirt and leather vest, a rope over his shoulder, a wooden cart behind, calm patient eyes',
  'kg-agnes': 'dry upright woman in her early sixties, grey hair in a tight bun, a heavy iron key on a cord around her neck, plain dark wool dress, a bundle of notched tally sticks, sharp honest eyes',
  'kg-klaus': 'tough veteran instructor in his mid fifties, short grey hair, scarred cheek, a faded imperial tunic with the badge cut off, a training spear, hard patient eyes',
  'kg-erna': 'round cheerful woman in her fifties, brown hair with grey, flour on her arms and apron, a big ladle in hand, warm loud smile',
  'kg-wolfgang': 'bald elderly judge in his mid sixties, huge white moustache, plain dark coat, an oak tree behind him, a tally stick in hand, stern fair eyes',
  'kg-ortwin': 'broad young smith in his early forties, short dark beard, sooty leather apron, a spear shaft, strong honest eyes',
  'kg-gisela': 'quick elegant woman in her mid forties, auburn hair pinned up, green wool dress with a small brooch, a sample of hops in her hand, shrewd lively eyes',
  'kg-guntram': 'lean sleepless border watchman in his early forties, short brown hair, stubble, dark cloak and a signal horn, tired watchful eyes, hill fires behind',
  'kg-jakob': 'very old man in his nineties, almost bald, wispy white hair, deep lines, a plain grey tunic, a bundle of keys, kind secret-keeping eyes',
  'kg-martin': 'gentle tinsmith in his mid thirties, brown hair, clean shaven, leather apron, a small tin cup in hand, shy kind eyes',
  'kg-bruno': 'polished republican commissar in his sixty, well-groomed grey hair, clean white hands, a dark coat with a tricolour sash, a thin guarded smile',
  'kg-matilda': 'strong young baker woman in her mid thirties, dark hair under no cover, flour-dusted dress, a loaf of bread in her hands, hopeful determined eyes',
  'kg-leopold': 'broad gentle priest in his sixty, white short hair, plain white robe with a small flame badge, a bowl of bread, quiet voice kind face',
  'kg-conrad': 'old first Elder of the Cart, white beard, deep lines, rough homespun coat, a rope in his hands, tired proud smile',
  'kg-rudolf': 'ageing landlord count in his late thirties, short dark hair, trimmed beard, dark red coat with a rose brooch, a hard dissatisfied face',
  'kg-adelheid': 'tense noble lady in her early thirties, dark hair pinned up, plum-coloured gown, a rose brooch, frightened proud eyes',
  // Империя Кагия: купцы, гвардия и менялы пустоши, северноевропейские лица
  'kj-otmar': 'heavy-set emperor in his early fifties, short greying brown hair, trimmed beard, grey stone dust in the creases of his palms, crimson doublet with a gilded circlet tagged with a small lead price tag, a quarryman hands on a ledger',
  'kj-marcellus': 'old imperial prefect in his fifties, short white hair, clean shaven, deep lines, crimson cloak with a bronze eagle belt buckle, a customs ledger in hand',
  'kj-gaius': 'stooped former emperor in his early fifties, thinning dark hair, short beard, tired calculating eyes, dark red doublet with a bronze eagle buckle, counting coins on a table',
  'kj-livia': 'practical noblewoman in her late forties, dark blonde hair pinned up, olive-green gown, a small wooden water ladle pendant, shrewd eyes',
  'kj-marcellus2': 'young nobleman in his mid twenties, very short cropped legionary-style brown hair, clean shaven, bronze eagle belt buckle, crimson cloak, eager ambitious eyes',
  'kj-aufid': 'stout caravan merchant in his fifties, curly grey hair, full beard, ochre travel coat with copper buttons, a whip and a coin purse',
  'kj-hedwig': 'weathered woman in her mid forties, sun-bleached blonde hair in a braid, a man\'s ochre travel jacket with copper buttons, a mule halter in hand, determined eyes',
  'kj-adelheid': 'composed woman in her mid forties, brown hair under a plain coif, dark blue gown, a small brass key on her belt, quick counting eyes',
  'kj-konrad': 'young man in his early twenties, tousled light brown hair, clean shaven, ink-stained fingers, rolled bridge drawings, plain grey doublet',
  'kj-ortwin': 'old guard commander in his sixties, grey crew cut, scarred cheek, crimson cloak over mail, holding a folded customs sheet',
  'kj-gisela': 'tough female guard prefect in her early forties, short red-brown hair, a scar through one eyebrow, crimson cloak over mail, hand on a spear',
  'kj-bruno': 'grizzled old spearman in his sixties, bald with white stubble, crimson cloak, a spear shaft wrapped with six copper rings',
  'kj-cornelius': 'bald old money changer in his late sixties, spectacles on a cord, dark blue robe, brass scales and a thick ledger',
  'kj-lang': 'plump merchant in his mid fifties, velvet cap, round face, satisfied smile, a fur-trimmed coat',
  'kj-malz': 'quiet banker\'s agent around forty, neat dark hair, clean shaven, black coat, a signet ring, a sealed promissory note',
  'kj-martin': 'old town crier in his sixties, grey beard, big chest, crimson tabard, a wooden auction hammer, mouth slightly open as if shouting',
  'kj-lambert': 'elderly priest in his sixties, tonsured grey hair, white robe with crimson trim, a candle and a coin box',
  'kj-gerlinde': 'old village matriarch in her seventies, white hair under a kerchief, deeply tanned wrinkled face, a wooden ladle on her belt',
  'kj-wolfram': 'border captain in his early forties, dark blond hair, short beard, leaning on a cane, leather coat over mail, watchful eyes',
  // Королевство Редания: речные короли, паромщики и стража мостов, северноевропейские лица
  'rd-radvald2': 'lean king in his late thirties, dark blond hair to the collar, short trimmed beard, black doublet with a silver bridge-shaped pin, a thin silver circlet, watchful grey eyes',
  'rd-radvald1': 'old deposed king in his fifties, grey hair, heavy jaw, faded red mantle, a bridge seal ring, bitter proud eyes',
  'rd-hugo': 'jovial heavy king in his fifties, red-grey beard, ruddy cheeks, simple brown doublet with a crown pin, a beer tankard',
  'rd-ermen': 'plain dignified woman in her fifties, flour-pale hands, brown hair under a white coif, dark red gown',
  'rd-mathilde': 'composed queen in her mid thirties, dark hair in a net, grey-blue gown, a small notebook and a quill, quiet clever eyes',
  'rd-otto': 'twelve year old prince, blond hair, blue doublet with a white tower, curious eyes',
  'rd-falk': 'river marshal in his late forties, short grey hair, an old burn scar on one cheek, blue cloak over mail, an oar-shaped baton',
  'rd-ferger': 'stocky ferryman in his early fifties, weathered face, grey beard, tarred hands, oilskin coat, a ferry rope coiled on his shoulder',
  'rd-irena': 'miller widow in her mid forties, flour on her sleeves, brown hair under a kerchief, strong arms, practical eyes',
  'rd-fober': 'dyer around forty, hands and forearms stained deep blue, thin moustache, a shifty smile',
  'rd-steg': 'old bridge guard captain in his sixties, white crew cut, hard face, black coat, a copper seal with a bridge and an eye on his belt',
  'rd-ruetger': 'young ferryman in his mid thirties, curly dark blond hair, earring, colourful foreign scarf, a lute strapped on his back',
  'rd-himmel': 'thin elderly priest in his sixties, long fingers, white robe with stars embroidered, looking upwards, a brass astrolabe',
  'rd-weiss': 'pale official in his fifties, white gloves, black robe, a stack of white passes and a seal',
  'rd-klein': 'blind old inquisitor in his eighties, milky eyes, white beard, grey robe with a faded eye emblem, a walking staff',
  'rd-brokk': '(dwarf merchant:1.4), stocky, long braided grey beard tucked into his belt, fur-trimmed coat, a pass paper in his fist, impatient',
  'rd-lotte': 'merchant woman around forty, blue dress, a small brass weight on a chain around her neck, sharp businesslike smile',
  // Павильон Грёз: хранители золота, ревизоры и музыканты, северноевропейские лица
  'pv-naten': 'upright old man in his mid sixties, short white beard, cropped grey hair, a golden key on a cord at his chest, plain grey coat, calm iron eyes',
  'pv-melissa': 'gentle woman in her late fifties, grey hair in a bun, ink-stained fingers, warm smile, dark yellow gown with a small key brooch',
  'pv-ilya': 'weathered rider in his late twenties, short brown hair, a scar on his chin, grey travel cloak with a white key badge, direct eyes',
  'pv-svyat': 'dry thin auditor in his early fifties, grey short hair, dark caftan with a silver key-shaped button, brass scales in hand, exacting eyes',
  'pv-radomir': 'sharp young scribe in his mid twenties, dark hair, dark caftan, a ledger under his arm, sly quiet look',
  'pv-irma': 'woman in her fifties, red hair braid with a silver thread, a lute on her back, purple gown, a book of verses',
  'pv-brand': 'broad red-bearded consul in his forties, beard tucked into his belt, grey cloak with a white key, hand on a spear',
  'pv-hilde': 'practical woman in her early forties, brown hair under a kerchief, grey cardigan with many pockets, three small brass scales',
  'pv-marta': 'inconspicuous woman in her late thirties, dark hat, plain brown cloak, a crate with sheet music, watchful eyes',
  'pv-otto': 'stout bald musician in his fifties, white waistcoat, a baton, cheerful round face',
  'pv-sofia': 'young singer of twenty, long light blond braids, pale blue dress, clear innocent face',
  'pv-gert': 'upright elderly noblewoman in her early sixties, grey hair, necklace of small lead tags, severe elegant dress',
  // Таварвайт: лесные эльфы (остроконечные уши, северная внешность), лучники, лесорубы и банкиры
  'tw-taurtirit': '(wood elf king:1.4), tall ageless elf with long silver-white hair, long pointed elf ears, a thin scar across the throat from a slave collar, simple green cloak with a carved yew seal on a cord, serene commanding eyes',
  'tw-aelwen': '(wood elf queen:1.4), slender elf woman, silver-streaked light hair, long pointed elf ears, resin-dark fingers, plain green gown, a heavy book on her lap',
  'tw-eldarin': '(young wood elf prince:1.4), blond hair tied back, long pointed elf ears, hot proud eyes, green leather jerkin, a longbow of yew',
  'tw-nimrael': '(wood elf archer woman:1.4), grey-green cloak, long pointed elf ears, long dark braid, a yew longbow taller than herself, weathered stern face',
  'tw-haldor': '(wood elf spearman:1.4), broad for an elf, short brown hair, long pointed elf ears, plain shield, rusted spear, bark brown cloak',
  'tw-vorian': '(old wood elf woodcutter:1.4), long hands with calluses, grey hair, long pointed elf ears, resin-stained coat, a branding iron with a white tree',
  'tw-sylvien': '(wood elf carpenter woman:1.4), brown braid, long pointed elf ears, wooden-pegged tool belt, sawdust on her sleeves',
  'tw-eilinn': '(wood elf priestess:1.4), light robe, a wreath of yew needles, long pointed elf ears, serene face, a candle',
  'tw-bonif': 'plump human banker agent of forty-eight, round face, grey coat, leather gloves, a grey wax seal, polite cunning smile',
  'tw-dietrich': 'ruddy human grain trader around forty, red cheeks, a sack of wheat over his shoulder, brown coat',
  'tw-hiro': 'young man around thirty-five, plain dark clothes, clean shaven, quick sharp eyes, a stone slab sample under his arm, calm',
  'tw-tairon': '(wood elf archer:1.4), scar across his lip, white bowstring on a yew bow, long pointed elf ears, tattered slave-collar mark on his neck, fierce eyes',
  'tw-alith': '(wood elf resin maker woman:1.4), black-tarred hands, long pointed elf ears, calm gaze, a leather apron',
  // Фейноко: момиты — внешне люди, светлая кожа и тёмные волосы, северная внешность (правило автора), одежда в горном стиле
  'fn-iso': 'dignified old man in his late seventies, long white moustache, grey topknot, dark blue layered robe, a silver fish ring on his right hand, calm intelligent eyes',
  'fn-mika': 'small elderly woman of seventy, white hair in a bun, dark blue robe, a silver fish seal, kind sharp eyes',
  'fn-toya': 'tall man in his mid thirties, black hair tied back, dark leather armour with plaited sleeves, a short spear, serious eyes',
  'fn-koshi': 'old chieftain in his sixties, grey long hair, simple blue robe, a smooth white stone in his hand, stern face',
  'fn-nori': 'old man in his seventies, white hair, sad tired face, a dark blue belt with an empty fish buckle',
  'fn-hide': 'bald man in his sixties, dark cloak, round face, a ledger scroll in hand, thoughtful lips',
  'fn-sei': 'dry woman of forty-eight, black braid to her waist, dark robe, a raven feather pin, direct eyes',
  'fn-yasu': 'old man of sixty-five, pine-green robe, a hearing horn at his left ear, patient look',
  'fn-toyo': 'merchant of fifty-two, fox-fur collar, orange-brown robe, abacus in hand, shrewd smile',
  'fn-kasumi': 'woman of forty, plain grey robe, barefoot, a bone drumstick in hand, listening head tilted, serene face',
  'fn-rin': 'woman of forty-two, white layered robe, a crane feather pin, cold clear eyes',
  'fn-kai': 'broad fisherman of fifty, a fishing net over his shoulder, wave-blue vest, tanned face, wry smile',
  'fn-walter': 'old human clerk of sixty, ink-stained hands, imperial grey coat, a pen behind his ear, weary eyes',
  // Контроль качества центра: свои описания по биографиям (22.11.2026)
  'kj-romilda': 'dignified old widow in her late sixties, grey hair under a crimson-trimmed veil, deep lines at the mouth, dark red gown, a small iron coin-box key in her hands, patient stern eyes',
  'fm-kK-luc': 'severe old prefect in his sixties, thin white hair, long nose, crimson cloak with a bronze eagle clasp, a handful of customs tokens, sharp suspicious eyes',
  'fm-kK-tit': 'young soldier of nineteen, short brown hair, first beard fluff, crimson guard cloak over mail, a spear, brave uncertain look',
  'fm-kK-jul': 'young noblewoman of twenty, dark hair in a braid with a crimson ribbon, ochre gown, a sealed letter in hand, secretive half-smile',
  'fm-kK-rom': 'girl of fifteen, long chestnut braid, plain ochre dress, an open book of statutes, stubborn clever look',
  'fm-kS-hein': 'burly old stonecutter in his sixties, grey stubble, dusty leather apron, a stone mallet, calm hard eyes',
  'fm-kS-mar': 'old woman in her sixties, grey hair under a plain cap, soot-streaked cheeks, a wooden spoon and a charcoal stick, tired kind eyes',
  'fm-kS-ilse': 'young noblewoman of seventeen, loose light brown hair, grey-blue gown, a silver gate pendant, silent defiant look',
  'fm-kS-bert': 'rough quarry master in his late forties, short dark beard, grey stone dust in his hair, leather tunic, a stone chisel, shrewd smile',
  'fm-kB-mar': 'tired woman in her mid forties, dark hair with early grey, ochre travel gown, feverish pale face, a copper button in her hand',
  'fm-kB-rein': 'weathered caravan driver in his fifties, sun-bleached beard, long leather coat, a mule halter, silent steady eyes',
  'fm-kB-auf': 'young merchant of twenty, curly blond hair, ochre coat with copper buttons, a map of wells, eager open face',
  'fm-kH-bri': 'old seamstress in her fifties, grey hair pinned up, crimson cloth over her knees, a needle and thread, proud tender eyes',
  'fm-kH-wen': 'big red-haired guard captain in his mid forties, silver in his beard, crimson cloak over mail, hand on a spear, uneasy look',
  'fm-kH-ort': 'sixteen year old spear-bearer, auburn hair, an oversized crimson cloak, a new spear, proud nervous look',
  'fm-kW-hel': 'composed woman in her late fifties, grey hair in a coif, dark blue wool dress, a set of small brass scales, head tilted listening',
  'fm-kW-luk': 'ink-stained clerk in his forties, light brown hair, short beard, dark blue robe, a black draft ledger, anxious attentive eyes',
  'fm-kR-ekk': 'old village reeve in his fifties, white hair, lined face, green-brown coat, a wooden well bucket, steady eyes',
  'fm-kR-ann': 'sturdy woman in her mid thirties, blond braid, linen blouse and leather vest, a ring of keys, sharp clever eyes',
  'fm-kR-max': 'boy of eleven, messy dark blond hair, simple shirt, a pebble in his fist, mischievous grin',
  'fm-rR-alb': 'imperial count in his sixties, grey hair, heavy jaw, dark red coat with a silver bridge brooch, a bundle of white passes, cold proud eyes',
  'fm-rR-ilse': 'slender pale countess in her fifties, light grey hair under a thin veil, high-collared grey-blue gown, singing softly, a hint of sadness',
  'fm-rR-kat': 'abbess in her mid thirties, grey habit, wooden rosary, plain pale face, a pen and a letter, calm eyes',
  'fm-rR-gun': 'young knight of twenty-two, short blond hair, blue river-guard cloak over mail, a scorched sword, grim brave look',
  'fm-rR-eli': 'girl of nine, blond hair with a blue ribbon, a small red dress, looking up at stars, wondering look',
  'fm-rR-kon': 'loud red-haired man in his early forties, ruddy face, brown doublet, a beer tankard, a bitter smile',
  'fm-rR-hed': 'plain woman in her forties, brown hair under a kerchief, simple dark red dress, a ring of toll tokens, kind tired eyes',
  'fm-rF-karl': 'strong young ferryman of twenty-eight, wet dark hair, oilskin coat, a ferry rope, proud sleepless eyes',
  'fm-rF-gre': 'stout woman in her fifties, grey-brown hair in a scarf, apron over a blue dress, an account tally stick, no-nonsense look',
  'fm-rS-kon': 'stern young bridge captain of thirty-two, short dark hair, black coat, an oversized copper seal, uneasy look',
  'fm-rM-gun': 'old flour-dusted miller in his sixties, one eye squinting, white eyebrows, brown apron, a bag of flour, bitter resigned look',
  'fm-rM-liz': 'young miller girl of twenty, brown braid, flour on her cheek, plain linen dress, reciting from a charter, earnest look',
  'fm-pR-giu': 'old community elder in his sixties, white beard, plain grey coat, a heavy leather purse and a wooden stick, thoughtful eyes',
  'fm-pR-lia': 'young singer of twenty-five, auburn hair in a loose braid, deep yellow gown, a lute, bright calm smile',
  'fm-pR-ing': 'strong young woman of twenty-six, dark hair tied back, grey riding cloak with a white key badge, hand on a rein, alert eyes',
  'fm-pR-mar': 'little boy of five, brown curls, yellow tunic, counting on his fingers, serious bright eyes',
  'fm-pK-han': 'middle-aged fiddler of forty-five, thinning sandy hair, plum waistcoat, a violin under his chin, amiable look',
  'fm-pK-mia': 'young scribe of twenty-two, red hair in a bun, ink-stained fingers, plum dress, a book of windows, worried clever eyes',
  'fm-pY-vit': 'old auditor in his seventies, white hair, clean shaven, dark red caftan with a silver key button, three small brass scales, exacting eyes',
  'fm-tT-aur': 'old wood elf who looks about sixty, grey-silver hair, lined worn face, tattered ragged cloak, a rope of nomad knots, tired eyes',
  'fm-tT-liran': 'wood elf woman who looks about thirty, silver-white braid, green gown, a thick book, quiet serious eyes',
  'fm-tT-elen': 'wood elf woman who looks about thirty, dark hair in two braids, grey-green archer leather, a small bow, defiant eyes',
  'fm-tT-ila': 'young wood elf who looks about twenty, tousled blond hair, a long yew bow, bark brown jerkin, mischievous eyes',
  'fm-tN-roda': 'wood elf bowmaker who looks about forty, grey streaks in dark hair, leather apron, a half-finished yew bow, steady proud eyes',
  'fm-tN-ola': 'wood elf archer woman who looks about twenty-five, dark hair in a ponytail, grey-green cloak, a quiver of white-fletched arrows, intense eyes',
  'fm-fM-ryu': 'weathered man in his fifties, black hair streaked grey, dark blue quilted coat, climbing rope and an ice pick, calm eyes',
  'fm-fM-sa': 'old woman of eighty-five, white hair, wrinkled face, dark blue robe, smooth grey stone beads, patient eyes',
  'fm-fM-kei': 'young warrior of twenty-two, black hair, plaited leather armour, a short spear, grim brave look',
  'fm-fM-aya': 'little girl of eight, black hair, pale blue robe, counting on her fingers, quiet wondering look',
  'fm-fO-ume': 'sharp woman of thirty-eight, black hair pinned with a fish pin, yellow-brown robe, a folding fan, quick eyes',
  'fm-fO-rai': 'cautious man of forty, black hair, simple dark robe, hands folded, careful modest look',
  // Протекторат Лирия: римско-горная знать, северноевропейские лица
  'ly-gaius7': 'broad-shouldered duke in his mid forties, short dark brown hair with grey at the temples, strong jaw, clean shaven, deep red tunic with a gold eagle brooch and a thin iron torque, a calm orator look, marble wall behind',
  'ly-gaius6': 'stern old duke in his sixties, white short hair, deep lines, red toga with a gold eagle, an iron circlet on the table, tired proud eyes',
  'ly-cornelia': 'dignified duchess in her early forties, dark hair in an elegant braided coil, ivory stola with a blue sash, a small tablet pendant, steady eyes',
  'ly-cornel': 'stooped scholar in his seventies, grey hair, long thin fingers dusty with stone, blue toga with a silver book pin, a wax tablet in hand',
  'ly-fabia': 'proud strict woman in her early fifties, grey-streaked dark hair, silver thread in her braids, olive-green stola, a censor red belt, stern eyes',
  'ly-valerius': 'weathered prefect in his sixty, short grey hair, scarred cheek, bronze cuirass over a red tunic, hand on a helmet, hard eyes',
  'ly-servilius': 'smooth merchant in his late forties, thinning dark hair, trimmed beard, blue-grey toga with silver scales brooch, a ledger and coins, cunning pleasant eyes',
  'ly-servilia': 'elegant woman in her mid forties, auburn hair pinned up, blue gown, pearl earrings, amused polite smile',
  'ly-aurelius': 'stocky mine master in his mid fifties, short brown beard, hands like a stonecutter, red-brown tunic with a gold hammer brooch, a miner lamp, stony eyes',
  'ly-tarquinia': 'white-haired high priestess in her sixties, pure white robe, thin cold hands holding a candle, a flame emblem, calm severe face',
  'ly-aemilius': 'severe judge in his late fifties, clean-shaven, grey hair, grey toga with a black scales pin, never smiling, a scroll in hand',
  'ly-nigidius': 'quiet young archivist in his thirties, light brown hair, ink-stained fingers, plain green tunic, a bundle of keys, watchful eyes',
  'ly-quintilla': 'sharp young poet in her mid twenties, dark blonde hair loose, rose-coloured stola, a scroll of verses, a wry smile',
  'ly-rufus': 'tough veteran in his mid thirties, short dark hair, stubble, blue cloak over mail, a plain shield, direct eyes',
  'ly-legate': 'polished imperial legate in his fifties, well-groomed grey-brown hair, imperial purple trim on a white toga, a thin invisible smile',
  'ly-licin': 'lean man in his mid thirties, short brown hair, plain grey tunic, a smooth blank stone on a cord around his neck, patient hard eyes',
  'ly-annius': 'grizzled border commander in his fifty, short grey beard, mountain cloak over mail, wind-burnt face, a signal horn',
  'ly-lucilia': 'round cheerful wine merchant woman in her forties, brown hair with a flower, olive tunic, a goblet in hand, shrewd laughing eyes',
  'ly-decimus': 'neat young secretary in his early thirties, brown hair combed flat, simple tunic, wax tablet and stylus, careful eyes',
  'ly-tit': 'old keeper in his seventies, white hair, deeply lined face, rough brown wool tunic, a lantern, haunted quiet eyes, bare empty field behind',
  'ly-marcus': 'solid commander in his early forties, short brown hair, short beard, bronze breastplate, red cloak, open honest face',
  'ly-tiberius': 'earnest young man in his twenties, dark brown hair, clean shaven, red tunic with a small gold eagle, serious eyes',
  'ly-junia': 'bright girl in her mid teens, dark braid, cream tunic, a tablet in hand, clever lively eyes',
  'ly-gibbelen2': 'ancient grim exiled king, long grey beard, iron crown with a notch, torn red cloak, hard cold eyes, a sword hilt in hand',
  'ly-gibbelin9': 'ancient conqueror king, short black beard, iron crown, bronze cuirass, a stern look of a man who has done terrible things',
  'ly-gaius5': 'unremarkable elderly clerk in his sixties, thin grey hair, plain brown tunic, a small old tablet hidden in his hand, quiet watchful face',
  // Королевство Темерия: беглецы Империи, северноевропейские лица
  'tm-foltest': 'sturdy grey-haired king in his sixties, short grey beard, hoarse weathered face, green velvet coat with a gold door emblem, a plain gold circlet-free head, an oak door and a bowl of soup on the table, tired kind eyes',
  'tm-berta': 'kind gray-haired queen-hostess in her sixties, a long grey braid, red work-worn hands, simple green gown with a gold brooch, ladling soup from a pot, warm calm face',
  'tm-adelheid': 'clever young woman in her late twenties, dark blonde hair in a practical braid, green dress with ink on her fingers, ledgers and papers on a table, steady eyes',
  'tm-richard': 'cheerful bold young man in his early twenties, tousled brown hair, clean shaven, green and gold surcoat, a long sword at his hip, bright reckless smile',
  'tm-erich': 'thin clean-shaven chancellor in his late forties, brown hair combed flat, immaculate blue coat with a silver book badge, a quill and a neat seal, cool precise eyes',
  'tm-lothar': 'huge loud marshal in his mid forties, brown beard, green tabard with crossed swords, mail shirt, big scarred hands, stubborn jaw',
  'tm-gisela': 'quick sharp-tongued woman treasurer in her early forties, auburn hair pinned up, amber and brown dress with golden scales brooch, a ledger and coins, lively cynical eyes',
  'tm-mathilde': 'tall dry woman in her early fifties, grey hair pulled back, colourless eyes, dark green dress with an oak leaf pin, a thick book under her arm',
  'tm-konrad': 'broad-shouldered forest man in his mid fifties, grey stubble, brown leather doublet with a golden axe badge, mighty arms, rough weathered face',
  'tm-alberich': 'elderly chancellor in his early seventies, white hair, thin face, dark blue robe with a book badge, a quill in hand, an unreadable guilty look',
  'tm-siegfried': 'old war hero in his sixties, white beard, scar across his brow, green surcoat with crossed swords, medals, sitting in an armchair',
  'tm-reinhold': 'upright old treasurer in his seventies, short white hair, red-brown coat with a broken chain pin, a key in his hand, proud honest eyes',
  'tm-hildebrand': 'gentle old man in his seventies, wispy white hair, long green robe with an oak leaf, a candle and a book, wise tired smile',
  'tm-ottokar': 'lean man in his mid fifties, thin grey hair, dark green hooded cloak, whispering sly look, a lantern with a hidden door behind him',
  'tm-gudrun': 'proud woman in her mid sixties, grey hair in a tight braid, dark red dress, a single iron chain link on her wrist, hard unforgiving eyes',
  'tm-ansgar': 'bald calm abbot in his seventies, grey monastic robe with a golden door badge, steady hands, mild face',
  'tm-berengar': 'stout cheerful priest in his mid sixties, grey tonsure, grey robe with a golden door, a bowl of soup and a candle',
  'tm-hedwig': 'ink-stained woman scribe in her late thirties, brown hair, ink smudge on her cheek, plain green dress, a ledger and quills, serious eyes',
  'tm-wolfram': 'strong captain in his early forties, short brown hair, loud mouth open as if shouting, green tabard with a gold door, spear and a horn on his belt',
  'tm-ilse': 'lean tough woman in her mid thirties, grey hood and cloak, dark hair, scar across her chin, a wolfish grin',
  'tm-gerhard': 'polished ambassador in his fifty, well-groomed dark hair, black and silver coat, a thin polite smile, white gloves',
  'tm-valerian': 'tough old ex-general in his mid sixties, grey crew cut, bare scarred face, plain linen shirt, holding a cabbage, calm veteran eyes',
  'tm-hagen': 'round red-faced brewer in his late forties, brown beard, apron, a big tankard, laughing eyes',
  'tm-jutta': 'weathered forest woman in her late thirties, long brown hair, leather hunting jacket, a bow on her back, sharp quiet eyes',
  'tm-bruno': 'thin red-haired wandering priest in his late thirties, rough grey robe, a lantern, cheerful tired face, a bundle on his back',
  'tm-clara': 'young woman cartographer in her mid twenties, dark hair tied back, blue sleeves, brass compasses and maps on the table, dreamy clever eyes',
  'tm-dietrich': 'young scribe in his twenties, brown hair, fanatically neat, grey robe with a golden door, a pen and a scroll',
  'tm-agnes': 'dry quick woman in her mid thirties, short dark hair, green tabard with crossed swords, mail, a watch-tower behind her',
  'tm-gero': 'old village elder in his sixties, white stubble, rough brown jacket, blackened wooden post behind him, haunted calm eyes',
  'tm-ottilie': 'strong young woman blacksmith in her late teens, short dark hair, soot on her cheek, a chain around her neck, leather apron, fierce eyes',
  'tm-kasimir': 'young refugee man in his late twenties, thin face, brown hair, ragged coat, tired hopeful eyes, an open door behind him',
  'tm-wilhelm': 'sad-faced chronicler in his early fifties, brown hair with grey, ink-stained fingers, dark green robe, a thick manuscript, steady hand',
  // Княжества Гарефорда: горные имперцы, северноевропейские лица
  'gf-ulrich1': 'stern mountain warlord in his early fifties, grey-streaked brown hair, thick beard, black eagle on a silver surcoat over chainmail, a small brass lantern in his hand, scar over one eye',
  'gf-ulrich2': 'tall silent lord in his mid thirties, dark brown hair, short beard, black surcoat with a silver eagle, steel gorget, cold grey eyes, spear rack behind',
  'gf-anselm': 'gentle scholarly prince-bishop in his sixties, thin white hair, mild face, ivory robe with golden flame embroidery, a candle in his hand',
  'gf-hildegard': 'strict kind abbess in her late forties, grey hair under a plain white wimple, ivory and gold robes, a gold flame pendant, a candle and a thick ledger',
  'gf-gertrud': 'thin upright old woman in her sixties, grey hair, grey robe with a golden flame on the chest, soot on the sleeves, tired hollow eyes, an oil lamp',
  'gf-jakob': 'heavy shrewd banker in his sixties, grey hair, clean shaven, dark blue velvet coat with a golden key brooch, ledger and quill, calculating eyes',
  'gf-ida': 'calm sharp woman in her early thirties, dark blonde hair in a braid, navy dress with a gold key brooch, pale face, steady cool eyes, a brass lantern on the table, ledgers behind',
  'gf-bertold': 'hot-headed lord in his early forties, (bare head, uncovered red-brown hair, no cap, no hat:1.4), short beard, grey coat with a red hammer badge, soot-stained hands, bold but uncertain eyes',
  'gf-hans': 'worried young lord in his early twenties, brown hair, clean shaven, grey coat with a red hammer badge, a mining lamp, tired eyes, mine plans behind',
  'gf-otto': 'heavy grey-haired mountain prince in his fifties, thick grey moustache, green coat with a silver mountain brooch, a silver ring, stubborn proud face',
  'gf-liutpold': 'battle-scarred border knight in his late thirties, dark hair, three scars on his cheek, dark green surcoat with a silver wolf, chainmail, grim face',
  'gf-walter': 'young lord in his early thirties, dark hair, stubble, dark green coat with a silver wolf, worn and wronged expression, a sealed letter in his hand',
  'gf-adela': 'hard-faced woman in her late twenties, dark hair in a tight braid, dark green leather jerkin with a silver wolf, scar on her chin, mountain pass behind',
  'gf-gunther': 'weathered forester-prince in his late forties, brown hair, grey-brown beard, brown coat with a golden tree brooch, oak leaf in his hand, honest tired face',
  'gf-konrad': 'gaunt man in his late thirties, brown hair, black ribbon on his sleeve, brown coat with a golden tree brooch, haunted resentful eyes',
  'gf-margareta': 'shrewd merchant-princess in her fifties, silver-streaked auburn hair, blue gown with a white tower brooch, rings, scales and a ledger, sly clever smile',
  'gf-elsbeth': 'bright young woman in her early twenties, auburn hair, blue dress, a sketchbook with towers drawn on it, lively eyes',
  'gf-ruprecht': 'dry precise soldier in his late forties, short grey hair, grey moustache, steel gorget over a dark coat, a command baton, battle map behind',
  'gf-hanna': 'loud sturdy woman in her late twenties, short brown hair, leather and mail, a signal horn on her belt, wind-burnt face, mountain tower behind',
  'gf-ortwin': 'thin quiet chancellor in his sixties, grey hair, ink-stained fingers, black clerk robe with an iron chain, spectacles, stacks of ledgers',
  'gf-leopold': 'round affable steward in his forties, brown hair, pleasant smile, dark blue coat with golden buttons, a ledger, calculating eyes',
  'gf-gerwin': 'burly smith-master in his mid forties, brown beard, leather apron, soot on his face, a copper lantern frame in his hands, forge glow',
  'gf-irmgard': 'curious novice nun in her late teens, brown hair under a white coif, grey robe with a small gold flame, a candle, wide eyes',
  'gf-dietmar': 'broad hoarse timber merchant in his early forties, brown beard, leather vest, river rafts of logs behind, big hands',
  'gf-brigitta': 'sharp harbour mistress in her mid thirties, dark hair tied back, weathered face, dark blue coat, a ring of keys, ships and docks behind',
  'gf-baldur': 'tall officer in his early forties, short dark hair, a scar on his cheek, dark coat with a grey scarf at the neck, cold loyal eyes',
  'gf-tilman': 'lean wandering preacher in his mid twenties, long brown hair, rough grey robe, a small lantern, fiery sincere eyes',
  'gf-jorg': 'old miner foreman in his fifties, grey stubble, huge hands, a miner lamp, soot on his face',
  'gf-mechtild': 'sharp-tongued young woman in her late teens, dark hair, black dress with a silver eagle brooch, haughty eyes, steel hairpins',
  'gf-reinhard': 'nondescript man in his late thirties, mouse-brown hair, plain grey cloak, forgettable face, watchful eyes',
  'gf-ursula': 'kind herbalist woman in her forties, brown hair with grey, green dress, herb bundles, gentle tired eyes',
  'gf-albrecht': 'grumpy old master mason in his sixties, (bare white-haired head, no hat, no cap:1.4), tool belt, a plumb line and tower drawings, grey stone behind',
  'gf-volker': 'stern castellan in his mid forties, short dark hair, blue tabard with a white tower, keys at his belt, loyal face',
  'gf-eberhard': 'bookish monk-chronicler in his fifties, tonsure, grey robe, ink-stained fingers, a quill and a thick manuscript, candle',
  'gf-sigmund': 'tough mercenary captain in his early thirties, short black hair, stubble, black coat, a notched sword, hard eyes',
  'gf-luitgard': 'dignified herald woman in her fifties, grey hair, black and gold tabard with ten small shields, a white candle in her hand',
  'gf-eyvind': '(norwegian norse hostage:1.3), young man in his late teens, long blond hair, pale freckled face, plain wool tunic with knotwork, proud wary eyes',
  'gf-benedikt': 'severe judge in his late fifties, grey hair, black robes, a signet ring, never smiling, a heavy law book',
  'gf-matthias': 'dreamy young painter in his late twenties, wavy brown hair, paint-stained fingers, dark blue coat, a sketch of towers',
  'gf-kunigunde': 'sharp matron in her late forties, (bare head, uncovered grey-streaked brown hair, no hat, no cap:1.4), green dress with silver trim, a bunch of keys, mine ledgers, quiet cunning eyes',
  // Крайдонианская Лига: элеоны — полуэльфы, чёрные или пепельные волосы, густые бороды у мужчин, морские мундиры
  'cr-orelien': 'stern old admiral in his sixties, black hair streaked with grey, thick black beard, dark navy admiral coat with heavy gold braid, a rolled chart in his hand, hard honest eyes',
  'cr-madlen': 'determined woman engineer-admiral in her fifties, black hair in a tight braid streaked with grey, sharp eyes, navy coat with gold braid, a brass dividers in her hand, shipyard blueprint behind',
  'cr-cassian': 'quiet patient admiral in his sixties, ash-grey hair, short grey beard, thoughtful pale eyes, plain navy coat with silver braid, a ship model on the table',
  'cr-baptiste': 'jovial merchant-admiral in his fifties, black hair and a thick black beard, laughing eyes, rich navy coat with gold buttons and a heavy gold chain, a purse and a ledger on the table, cunning smile',
  'cr-kassian-r': 'very old admiral in his eighties, white beard, deep-set eyes, faded navy coat with medals, an old bronze ship compass on a chain in his hand, proud tired face',
  'cr-ysolde': 'cold calculating woman admiral in her late thirties, black hair pinned tight, dark eyes, navy coat with a white lace collar, a ledger and a pen in hand, guarded expression',
  'cr-theron': 'burly warlike admiral in his forties, thick black beard, scarred cheek, dark navy coat with gold braid, a sabre at his belt, impatient fierce eyes',
  'cr-aurel': 'elegant admiral in his late fifties, silver-black hair combed back, trimmed beard, perfect navy coat with an old imperial order on the chest, smooth polite smile',
  'cr-benedikt': 'young hot-headed shipwright admiral in his thirties, short black hair, stubble, rolled shirt sleeves under a navy coat, sketch of a giant ship in hand, eager eyes',
  'cr-lysane': 'quiet young woman cartographer in her thirties, ash-black hair in a bun, grey eyes, plain navy dress with ink-stained cuffs, a roll of charts, a brass magnifier',
  'cr-matteo': 'weathered boatswain in his late forties, short grey-black hair, broad face, a plain dark sailor jacket with one bosun whistle on a chain, rough hands, direct honest look',
  'cr-agnes': 'stern young woman ship captain in her twenties, black hair in a sailor braid, dark eyes, blue captain coat, weathered skin, a spyglass in hand',
  'cr-hildebrand': 'young naval captain in his thirties, black hair, light beard, navy officer coat, earnest eyes, a sword at his side',
  'cr-pascal': 'thin precise treasurer in his forties, black hair, small neat beard, spectacles, navy coat with silver buttons, a ledger and an abacus in front of him',
  'cr-ansel': 'old lighthouse priest of the Light in his sixties, white hair, kind sad eyes, white and navy vestments with a small golden lamp symbol, a candle in his hands',
  'cr-ezra': 'weathered pilot in his forties, short brown hair (a human, not elven), clean-shaven, plain blue jacket, a sextant in hand, calm squinting eyes',
  'cr-sabine': 'quiet young woman captain in her twenties, ash-black hair loose over her shoulders, thoughtful eyes, navy coat, an old chart and a compass in hand',
  'cr-tibold': 'dry strict naval judge in his fifties, black hair thinning, narrow face, black judge robe with a white collar over navy, a book of the Statute, severe eyes',
  // Республика Чеафарал: протекторы и Совет Двадцати — нордские и имперские лица, простая тёмная одежда, соль, шары, векселя
  'ch-holm': '(no hat, bareheaded:1.4), stern grey-haired soldier in his sixties, short white beard, plain dark officer coat with old brass buttons, scar on the jaw, a pinch of white salt in his hand, tired honest eyes',
  'ch-merta': 'proud elderly woman in her sixties, silver-blond hair in a tight braid crown, grey-blue eyes, heavy dark wool gown with a white salt-crystal brooch, firm wise face',
  'ch-gottfried': 'plump banker in his sixties, thin grey hair, round spectacles, black velvet coat, heavy gold chain with a small key, ledger in his hands, worried eyes',
  'ch-einar': 'unremarkable man in his late forties, thin face, short brown hair going grey, plain grey wool coat without any jewellery, calm watchful eyes, faint polite smile, a small white salt ball in his fingers',
  'ch-ulrich': 'aristocratic man in his fifties, grey hair swept back, trimmed grey beard, old imperial order on a dark blue coat, haughty tired eyes',
  'ch-astrid': 'very old nordic woman, white hair in a long braid, deeply lined face, sharp blue eyes, clay pipe in her mouth, heavy dark green wool dress with a silver clasp',
  'ch-harald': 'jovial nordic nobleman in his late forties, ruddy face, messy blond beard, rumpled velvet coat with stains, a loose smile, worried eyes, a promissory note in his hand',
  'ch-martin': 'handsome young man in his twenties, ash-blond hair, clean-shaven, elegant dark blue coat with silver buttons, earnest dreamy eyes',
  'ch-ingrid-h': 'determined nordic widow in her thirties, blond hair in a tight braid, grey eyes, black mourning dress with a small military pin, firm jaw',
  'ch-lisa': 'confident woman in her forties, light brown hair in a bun, grey-green eyes, cream-coloured gown with white salt crystals embroidered on the collar, regal calm expression',
  'ch-torvald': 'heavy loud merchant in his sixties, huge grey beard, fur-trimmed coat, big hands, weather-beaten face, caravan scales behind',
  'ch-jan': 'burly merchant in his forties, short brown hair, square jaw, leather vest over a white shirt, rolled sleeves, practical friendly look',
  'ch-maria': 'cold elegant woman in her thirties, dark hair under a fur-edged cap, grey eyes, white fur collar, a ledger in her hands, assessing glance',
  'ch-olof': 'plain-faced merchant in his fifties, thinning blond hair, simple brown coat, iron samples on the table, honest tired look',
  'ch-hannes': 'pale banker in his late thirties, thin face, black coat with a gold watch chain, tight lips, bitter intelligent eyes, a broken seal in his hand',
  'ch-vera': 'quiet smiling woman in her forties, dark hair parted in the middle, black and grey silk dress, a thin silver chain with a small moon pendant, calm kind eyes that give nothing away',
  'ch-karl': 'old banker in his sixties, bald head with grey side hair, wire spectacles, abacus on the table, sour thoughtful face, black coat',
  'ch-elsa': 'nervous young woman in her thirties, light brown hair, worried blue eyes, dark green dress, hands folded tightly',
  'ch-peter': 'polite slender man in his thirties, dark hair slicked back, black coat, white gloves, very pleasant smile and very cold eyes',
  'ch-ingvar': 'veteran general in his sixties, steel-grey short hair, scarred nordic face, battered steel breastplate over a red officer coat, sword hilt in hand, hard eyes',
  'ch-sigurd': 'broad nordic colonel in his fifties, long red-blond beard braided with gold rings, scale armour over a leather coat, fur cloak, confident grin',
  'ch-lukas': 'young colonel in his thirties, short light hair, clean-shaven, military dark red coat with silver braid, open honest eyes',
  'ch-helge': 'tall young colonel in his late thirties, long blond hair tied back, trimmed beard, grey and red uniform, calm resolute eyes',
  'ch-mira': 'strong woman captain in her late twenties, black braided hair, dark eyes, leather armour with a steel gorget, a short sword at her belt, fierce independent look',
  // Высокогорное Княжество: альпийская знать (тёмная шерсть, мех, белое и лазурь), подгорники — рудокопы и механики
  'hl-sigmund': 'stern old prince with a short white beard and cold blue eyes, fur-lined dark blue mantle, silver eagle brooch, a coil of cut rope on the table, hard proud face',
  'hl-albrecht': 'tall proud prince in his forties, dark blond hair, trimmed beard, white and blue embroidered doublet with silver eagle, standing on a high gallery, arrogant gaze',
  'hl-max': 'young prince in his twenties, clean-shaven, ash-blond hair, thoughtful grey eyes, plain dark blue coat with a silver eagle pin, no jewellery, earnest look',
  'hl-kunigunde': 'elegant widowed princess in her forties, pale skin, ash-blond hair under a white veil, black velvet gown with a silver key on a chain, cold beautiful face, faint smile',
  'hl-eberhard': 'cold calm nobleman in his fifties, grey hair combed back, clean-shaven, dark grey coat, a heavy ring of twelve iron keys on his belt, measuring gaze',
  'hl-rotger': 'weathered mountain guard captain in his forties, short brown hair, scarred cheek, steel breastplate over a red and gold tabard, crossbow on his shoulder, honest tired eyes',
  'hl-anselm': 'cruel old mine lord in his sixties, bald with grey side hair, fleshy face, rich green coat with fur, heavy gold chain, a whip in his belt, contemptuous look',
  'hl-leonora': 'clever young noblewoman in her twenties, dark blond hair in a braided crown, sharp grey eyes, deep blue gown, silver scales pendant, ledger in hand, confident half-smile',
  'hl-valentin': 'self-made nobleman in his forties, broad shoulders, short dark hair, trimmed beard, white marble dust on his sleeves, rich but plain grey coat, ambitious eyes',
  'hl-benedikt': 'old priest of the Light in his sixties, thin white hair, kind sad eyes, white and gold vestments, small bronze bell in his hands, warm candle light',
  'hl-gottfried': 'old judge in his fifties, grey beard, spectacles, black judge robe with a white collar, scroll in hand, careful fair face',
  'hl-dietrich': 'fallen nobleman in his fifties, unkempt grey-blond hair and beard, worn noble coat patched with leather, mine lamp at his belt, defiant intelligent eyes, mine village behind',
  'hl-quirin': '(no hat:1.3), (tiny old gnome, white hair, white beard:1.5), old gnome mechanic with a huge round nose, big ears, white spiky hair and a short white beard, leather apron, big brass wrench, gears and thick ropes of a giant winch behind, sly proud smile',
  'hl-brodar': '(ancient dwarf miner:1.4), very old dwarf with a long grey beard grey with stone dust, coughing, leather miner helmet with a lamp, pickaxe, bitter tired eyes',
  'hl-hilda': '(female dwarf miner, woman, no beard:1.5), stout dwarf woman with thick copper-red braids, soot on her face, miner clothes, holding a bell rope, fierce grieving eyes',
  'hl-ebert':'grizzled imperial legion legate in his fifties, close-cropped grey hair, scarred face, steel cuirass with wolf emblem, red cloak, snowy mountains behind, calculating eyes',
  // Фарвольская лига: гномы (маленькие, большой нос, светлые глаза, торчащие русые волосы, расчёсанная бородка) и дварфы
  'fv-gildarts': '(no hat:1.3), (scarred veteran gnome warrior:1.3), small sturdy gnome in his prime with a big nose, bright light-grey eyes, spiky sandy hair and a neatly combed short beard, dented dwarven steel breastplate over an embroidered dark coat, iron hammer, a deep scar across the cheek, stern kind eyes, dark mine tunnel with lamps behind',
  'fv-ortwin': '(no hat:1.3), old gnome ruler with a big nose, thin white combed beard in braids, spectacles, rich embroidered dark green coat with gold buttons, ledger in hands, cautious tired eyes',
  'fv-uldrich': '(no hat:1.3), ancient wise gnome founder with a big nose and a long white beard combed into strands, iron chain of office with a hammer and cog, fur-trimmed coat, determined eyes, forge glow',
  'fv-tibor': '(no hat:1.3), cheerful young gnome warrior with a big nose, spiky sandy hair and a short beard, too-large dwarven helmet, bright reckless smile, lamp light',
  'fv-fenwick': '(no hat:1.3), slender clever gnome nobleman with a big nose, sandy hair slicked back, neat goatee, brass monocle, rich purple coat with a seal on a chain, cold calculating smile, brass machinery behind',
  'fv-pippa': 'elegant old gnome woman merchant with a big nose, silver-blond hair in an elaborate bun, light eyes, pearl earrings, rich dark green embroidered gown, golden key on a chain, gentle smile with cold eyes, ledgers and coins behind',
  'fv-nimmo': '(no hat:1.3), gnome inventor with a big nose, wild spiky sandy hair, soot-smudged face, brass goggles pushed up on his forehead, leather apron with tools, copper pipes and pumps behind, enthusiastic eyes',
  'fv-bertha': 'sturdy young gnome farm woman with a big nose, freckles, sandy braided hair, light eyes, plain linen dress with embroidered collar, sheaf of barley, determined smile, mountain terraces behind',
  'fv-baldrek': '(ancient dwarf elder, huge snow-white beard:1.5), enormous snow-white beard braided with gold rings to his belt, bald head with runic tattoos, heavy stone-grey robe with fur, iron crown-band, hard suspicious eyes, stone hall',
  'fv-helga': '(female dwarf warrior, woman, no beard:1.5), stout dwarf woman with thick copper-red braids, broad face with scars, steel helmet with a lamp, heavy plate armour, big round shield, grim loyal eyes, dark tunnel',
  'fv-torgrim': '(dwarf miner:1.4), broad dwarf miner with a black braided beard, coal dust on his face, leather helmet with a red glass lamp, pickaxe, angry tired eyes, mine tunnel',
  'fv-gudrun': '(old female dwarf priestess, grandmother, no beard:1.5), old dwarf woman with ash-grey braids, soot on her cheeks, smith apron over grey priest robes, holding a hammer, forge fire and anvil behind',
  'fv-otto': 'calm grey-haired imperial baron in his fifties, northern european, trimmed grey beard, dark green velvet doublet with a fur collar, heavy gold chain, shrewd eyes',
  'fv-ingrid': 'young northern european baroness in her twenties, pale skin, ash-blond hair in a braided crown, grey eyes, riding coat over light armour, sword at her belt, mountain pass with snow behind, resolute look',
  'fv-irvald': '(dwarf in darkness:1.4), gaunt pale dwarf with a ragged grey beard and milky eyes, black hooded cloak, no lamp, face lit from below by a faint purple glow, darkness around, unsettling calm',
  // Креит (креитские норды: русые, рыжие и пепельные волосы, светлые глаза; всё в серебре и мехах)
  'kr-grimkel': 'grim old norwegian jarl with a long ash-blond beard turned grey, heavy silver arm rings and a silver torc, wolf fur cloak, cold pale eyes, smoke behind',
  'kr-skardi': '(sandy blond hair:1.3), hard lean norwegian jarl in his thirties with sandy hair braided at the temples and a short beard, scarred cheek, silver arm rings, chainmail under a bear fur, wary eyes',
  'kr-ingeborg': 'cold beautiful norwegian woman ruler in her twenties with pale ash-blond hair in tight war braids, silver circlet of raw ore, dark fur mantle over chainmail, a thin scar on the lip, calm merciless grey eyes',
  'kr-torbrand': 'huge brutal norwegian warrior with a red beard and shaved head, burn scars, bearded axe, blood on the fur',
  'kr-tora': 'fierce young norwegian shieldmaiden with copper-red braids, round shield, chainmail, defiant face',
  'kr-ulv': '(dark blond hair, young:1.3), handsome norwegian sea captain in his twenties with tousled dark-blond hair and a short beard, salt-stained leather, silver earring, a bitter smile, sea behind',
  'kr-solveig': '(long dark brown hair:1.4), young norwegian woman with long brown hair, gaunt face smudged with ore dust, iron slave collar, herbs in her hands, mine darkness behind',
  'kr-tormod': 'proud young norwegian warrior with light brown hair and a thin beard, chainmail, spear, mountain pass with snow behind',
  'kr-ragnhild': 'young norwegian woman warrior with honey-blond braids, stern face, short sword, torchlit stone hall',
  'kr-egil': '(fair hair, ragged clothes:1.3), thin norwegian boy of fourteen with shaggy fair hair, ore dust on his face, iron slave collar, frightened brave eyes, mine tunnel behind',
  'kr-hjalti': 'serious norwegian boy of seven with white-blond hair, small fur cloak, wooden practice sword, silver ring on a cord',
  'kr-b1-ragnvald': 'old toothless norwegian slave foreman with a ragged grey beard, iron collar, ore dust, tired wise eyes, mine tunnel with torches',
  'kr-vigdis': 'ancient blind norwegian shaman woman with milky white eyes, long white hair with silver beads, face painted with silver dust, ear pressed to a rock wall, deep cave',
  'kr-ormar': '(dark blond hair:1.3), handsome sly norwegian shaman in his forties with dark-blond hair and silver dust in his beard, grey hooded robe with silver runes, ingratiating smile',
  'kr-kolgrim': 'gaunt old norwegian shaman with one eye covered by a silver cataract, shaved head with rune tattoos, iron keys on his belt, dark mine tunnel',
  'kr-gyrid': 'stern norwegian noblewoman in her forties with braided greying fair hair, heavy silver keys at her belt, dark wool dress with tortoise brooches',
  'kr-erling': 'old norwegian warrior with a crooked broken nose and grey braided beard, scarred, holding a notched axe, mine overseer, fur and leather',
  'kr-gudbrand': '(very fat, red beard:1.4), huge fat jolly cruel norwegian chieftain with a red beard, gold and silver rings, drinking horn, bear fur',
  'kr-aslak': 'weathered norwegian pirate chieftain with salt-white blond hair, sea-tanned face, silver earrings, chainmail, dragon-prowed longships behind',
  'kr-vemund': 'shrewd norwegian merchant chieftain with a brown beard, salt crystals on his fur collar, scales and silver coins on the table',
  'kr-trond': '(dark blond hair:1.3), grim norwegian border chieftain with dark-blond hair and a weathered face, mountain fortress of logs behind, spear',
  'kr-sigurd': '(bright red hair and big red beard:1.4), norwegian chieftain with a big red beard and sly eyes, embroidered tunic, silver arm rings',
  'kr-hallbjorn': '(golden blond short beard:1.3), massive norwegian housecarl captain with a short blond beard, steel helmet with spectacle guard, huge war hammer, silver-trimmed chainmail',
  'kr-hjorleiv': 'norwegian skald in his fifties with grey-blond hair, embroidered tunic, holding a lyre, many silver rings, sad smile',

  // Земли Севера (норды: чаще всего чёрные волосы цвета вороньего крыла; на северо-западе — светлые и рыжие)
  'no-torvald': 'grim old viking chieftain with a long grey beard and raven black hair streaked with grey, huge scarred hands, bear fur cloak, iron arm rings',
  'no-ulf': 'wild berserker warrior with black braided hair and beard, bear skin over bare shoulders, wolf fang necklace, fierce eyes, war paint',
  'no-astrid': 'fierce shieldmaiden with long black braids, round wooden shield on her back, chainmail and fur, scar on the chin, sea behind',
  'no-harald': 'rich old norse chieftain with a white beard, fine embroidered tunic, silver brooches and many silver arm rings, tired cunning eyes',
  'no-ragnar': 'strong viking king in his thirties with raven black hair braided at the sides and a short black beard, red-stained bearded axe on his shoulder, wolf fur cloak, chainmail',
  'no-e-gunnhild': 'very old norse matriarch with white braided hair, deep wrinkles, piercing pale eyes, dark wool shawl with an amber brooch, holding a carved rune stone',
  'no-e-oyvind': 'old one-eyed norse whaler with a grey beard, eyepatch, sealskin coat, weathered face',
  'no-e-borge': 'old one-armed norse warrior with a grey beard and black braids, empty sleeve pinned, fur cloak, grim face',
  'no-e-kolbein': 'very old norse shepherd lawman with a long white beard, sheepskin cloak, wooden staff with carved runes',
  'no-e-audun': 'ancient wise norse elder with a long white beard, dark blue wool robe, silver arm ring, calm eyes',
  'no-e-gisli': 'portly old norse merchant with a groomed grey beard, fine fur-trimmed coat, heavy silver chains and rings, scales on the table',
  'no-e-ingrid': 'old norse woman whaler with grey braids, sealskin clothes, harpoon resting on her shoulder, weathered tough face',
  'no-e-hrolf': 'huge old norse warrior with a grey beard and bald head, bear fur, stone-like stern face',
  'no-e-steinar': 'silent grim norse elder with a black and grey beard, dark furs, heavy brow, closed mouth',
  'no-e-durnir': '(snow white beard and white eyebrows:1.4), oil painting, dwarf elder with an enormous thick white beard braided into many plaits with iron rings, bald head with runic tattoos, massive arms, leather smith apron over chainmail, iron hammer on the shoulder, glowing forge and anvil in a stone hall behind',
  'no-e-egil': 'old norse sea raider covered in many scars, grey braided beard, missing ear, chainmail and seal fur, sea behind',
  'no-svein': 'norse warrior in his forties with raven black hair and beard, black feather in the hair, chainmail, round shield with a black raven',
  'no-oddvar': 'norse fisherman chieftain in his forties with black hair and beard, sealskin cloak, weathered face, fjord behind',
  'no-arn': 'young norse warrior with black hair tied back, short beard, leather armor and a hunting bow, pine forest behind',
  'no-torbjorn': 'norse highland chieftain with a very long black and grey beard braided in three plaits, ram horn drinking cup, sheepskin cloak',
  'no-bjarni': 'proud norse chieftain in his forties with dark hair and a trimmed beard, rich bear fur cloak, gold arm rings, resentful eyes',
  'no-ingvar': 'norse sea captain in his forties with black hair and a salt-and-pepper beard, sealskin coat, longship prow behind',
  'no-signy': 'tall powerful norse woman warrior with black braids, bear skin over her shoulders, war axe, stern face',
  'no-gardi': 'norse miner chieftain with black hair and soot on the face, leather apron, iron pick, mine lanterns behind',
  'no-hakon': 'norse sea raider chieftain with black braided hair and beard, chainmail, red cloak, dragon-headed longship behind',
  'no-sigrid': 'beautiful young norse woman with long blond braided hair, blue wool dress with tortoise brooches and amber beads, calm eyes',
  'no-ketil': 'norse boy of ten with black hair, small fur cloak, wooden toy sword',
  'no-eyvind': 'old norse lawspeaker with a long grey beard, dark wool cloak, standing on a rock, hand raised as if speaking',
  'no-helga': 'mysterious norse seeress with grey streaked black hair, ash on her face, dark hooded cloak with beads and bones, staff, fire smoke',
  'no-brand': 'norse skald in his forties with black hair and beard, embroidered tunic, holding a drinking horn, many silver rings, smiling',
  'no-kolbjorn': 'young norse champion with black hair and beard, chainmail, round shield with a bear, strong jaw',

  'teyber-1': 'stern powerful germanic warlord emperor like a medieval king of the holy roman empire in his fifties, very broad shoulders, thick black beard, short black hair, cold hard grey eyes, square jaw, massive black and crimson plate armor with dragon motifs, heavy golden imperial crown, faint fire glow in his palm, symbol of the empire',
  sandra: 'beautiful proud archmage empress, flowing red hair, fiery eyes, crimson and gold robes, flames swirling around her hands, confident smile',
  robert: 'gentle wise old emperor with long white beard, kind tired eyes, scholarly crimson robes, holding a scroll of laws, golden crown',
  lutsiy: 'mad tyrant emperor, gaunt face, wild burning eyes, cruel smile, black and crimson robes, crown askew, flames and gallows in the background',
  'teyber-2': 'young gentle emperor around twenty, sad kind eyes, soft features, crimson imperial robes too heavy for him, golden crown',
  'oktavian-2': '(newborn baby:1.5), (chubby infant face:1.4), tiny pale baby sleeping in a golden cradle, tiny crown beside the pillow, crimson silk blankets, candlelight, melancholic atmosphere',
  'feliks-1': 'fat sleepy emperor with heavy eyelids, double chin, half asleep on a throne, crimson robes, crown slipping',
  'dominik-1': 'corpulent jolly emperor feasting, rosy cheeks, holding a roasted leg and golden goblet, crimson robes, crown',
  'ulrich-1': 'drunk emperor with red nose and bleary eyes, wine goblet, disheveled crimson robes, crooked crown',
  'sebastian-1': 'very handsome vain emperor, perfect curly hair, charming smile, lavish crimson and gold clothes, mirror in hand',
  'markus-1': 'arrogant handsome young emperor, duelist rapier, slick hair, vain expression, crimson doublet',
  'sandra-2': 'cold beautiful empress in her forties, sharp eyes, fire mage, crimson gown, flames curling around fingers',
  'izolda-1': 'stern iron widow empress, black mourning veil, steel breastplate over crimson gown, crown',
  'korvin-1': 'quiet melancholic emperor poet, holding a red rose, soft sad face, crimson robes',
  'adrian-1': 'adventurous emperor sea captain, weathered face, ships and sea behind him, crimson naval coat, spyglass',
  'robert-2': 'near-sighted emperor astronomer with spectacles, starry sky, telescope, crimson robes',
  'severin-1': 'bookish emperor scholar surrounded by books and glowing runes, crimson robes',
  'valerian-1': 'cheerful rugged emperor builder covered in stone dust, holding blueprints, crimson cloak',
  'gabriel-1': 'pious ascetic emperor, hollow cheeks, holy light in his hands, white and crimson robes, cathedral background',
  'valerian-2': 'bitter grim emperor in mourning black over crimson, hard eyes, ash in the air',
  'markus-2': 'emperor cartographer holding a great map, travel cloak over crimson robes',
  'konrad-1': 'just emperor judge with a stern fair face, holding scales and a law book, crimson robes',
  'robert-3': 'cautious elderly emperor, careful eyes, modest crimson robes',
  'oktavian-1': 'dry pedantic emperor accountant with ledger and quill, thin face, crimson robes',
  'ansgar-2': 'old impulsive bitter prince, white beard, angry eyes, black fur mantle with silver, princely circlet',
  'anselm-fern': 'grizzled medieval general with scarred face, steel armor, black cloak, battle standard',
  jakasta: 'proud desert king, dark skin, black and gold robes, golden headdress, desert temple and fire behind',
  'durin-kald': 'old dwarf advisor with long braided white beard, gold rings, leather and fur, forge glow',
  'heribert-steiner': 'tough supreme marshal, broad shoulders, close-cropped grey hair, many medals, steel and dark blue uniform',
  'margot-vellen': 'stern female admiral, weathered face, dark blue naval coat with gold braid, sea behind',
  'kaya-head': 'smiling rich merchant patriarch, golden chains and rings, black velvet, coins and ships behind',
  'styria-now': 'gaunt count, black velvet, moonlight, unsettling eyes',
  'man-zhan-mal': 'small boy in a simple brown and gold tunic, small iron key on a cord, serious eyes',
  'ex-hagen': 'old grim one-eyed legate with white beard, battered steel breastplate, fur cloak, crimson banner with a portrait of a tyrant emperor behind',
  'ex-strelitz': 'hard-faced general of common birth, close-cropped grey hair, scar across the cheek, crimson uniform with black dragon, fur collar, holding a marshal baton',
  'ex-ulrika': 'stern woman general in her forties, braided dark hair, steel gorget, crimson coat with fur, snowy fjord behind',
  'ex-korn': 'arrogant general with a golden chain, crimson uniform, sitting on a throne covered with red cloth',
  'ex-ramm': 'stocky old fortress commander with a grey moustache, heavy fur coat over armor, stone fortress walls behind',
  'ex-halvdan': 'nordic jarl with a crooked nose, braided red beard, fur and mail, axe on shoulder, snowy fjord behind',
  'ex-graun': 'old army chaplain in white and gold robes over a crimson tabard, sun pendant, snowy chapel behind',
  'ex-kaiserling': 'young ambitious officer of thirty, sharp features, polished breastplate, crimson cloak, impatient eyes',
  'mangenium-now': 'restrained grey-haired count, plain dark brown coat with gold trim, iron key on a chain around the neck, calm patient eyes',
  'man-kassiy-2': 'aging nobleman, keeper of the seal, brown and gold robes, heavy wax seal on a chain, thoughtful',
  'man-c-chancellor': 'elderly imperial chancellor, black official robes with a gold chain of office, holding papers, shrewd tired eyes',
  'man-c-treasurer': 'stern middle-aged treasurer woman, dark green gown, ledger and quill, tight hair, precise gaze',
  'man-c-marshal': 'scarred veteran marshal, close-cropped grey hair, polished steel breastplate, brown cloak',
  'man-c-judge': 'very old judge with white hair, black and white judicial robes, severe face, law book',
  'man-c-spymaster': 'quiet woman archivist, plain dark grey dress, ink-stained fingers, attentive watchful eyes',
  'man-c-roads': 'weathered official in a travelling coat with leather satchel and a rolled map, practical look',
  'man-c-court': 'elegant court lady of forty, formal dark blue gown with lace collar, perfect posture',
  'man-c-envoy': 'prelate diplomat in white robes with a golden sun pendant, smooth polite smile',
  'man-c-tenth': 'very old frail librarian, white beard, faded imperial crimson robe, old books behind, kind sharp eyes',
  'ulrike-brandt': 'fierce woman commander in snowy north, fur cloak over black armor, flame emblem',
  'matthias-essenwald': 'young army captain, steel breastplate, defiant eyes',
  'bernhard-rheinhold': 'old veteran legate with an eyepatch, missing leg, crutch, worn crimson coat',
  // Корона Аргус
  'argus-now': 'pious cunning mountain king in his late forties, thin clean-shaven face, calm hooded eyes, faint humble smile, simple silver crown, navy blue robes with silver mountains, prayer beads in his fingers, gold ring with a large ruby',
  'argus-heir': 'stern pious young crown princess, pale ascetic face, dark hair in a tight braid, cold clever eyes, navy blue cloak with a silver mountain clasp over light mail, small silver circlet, a prayer book in her hand',
  'ag-argus-1': '(bareheaded, no crown:1.4), shrewd lowborn middle-aged steward of an old principality, plain dark wool coat, many keys and a ledger, sharp watchful eyes, early medieval',
  'ag-irmfrid': 'cautious diplomat lord, early medieval, holding a gold ring with a ruby, silver crown on a cushion beside him, navy and silver',
  'ag-ortrun': 'stern widow ruler, grey hair under a white wimple, navy blue gown, gold ring with a ruby, iron will',
  'ag-tankred': 'cruel stern lord in red-stained steel armor, crosses on a road in the background, navy cloak',
  'ag-wolfram': 'blind old lord with milky white eyes, long white hair, navy velvet, listening intently',
  'ag-eberhard': 'patient grey-bearded first king, weary eyes, silver crown of mountains, navy blue mantle, ruby ring',
  'ag-gottfried': 'bitter proud older prince, grey hair, severe face, navy and black doublet',
  'ag-kassian': 'charming dissolute young prince, playing cards and wine cup, smug smile, navy and silver doublet',
  'ag-dietmar': 'hot-tempered young swordsman prince, silver gorget, navy surcoat, sword hilt',
  'ag-joachim': '(teenage boy of fifteen:1.4), (no crown:1.3), gentle novice monk with a tonsure, plain grey wool habit with a rope belt, holding a candle, pale thoughtful face',
  'matilda-argus': 'quiet pious queen, pale face, dark eyes, white veil and navy gown, silver crown, rosary',
  'klemens-grisbach': 'stern archbishop in white and gold vestments, mitre, navy cope, golden chalice',
  'vignand-ulfengard': 'old fanatical knight-monk grand master, white surcoat with a red ruby ring emblem, hair shirt collar visible, grey beard',
  'ag-asher': 'proud dark-skinned freedman colonel from the southern desert peoples, shaved head, scarred, half-riveted iron ring on a chain around his neck, navy uniform, steady fierce eyes',
  'hildegunde-waldeck': '(very old wrinkled woman of eighty:1.4), stern abbess-princess in black and white habit with a golden crozier and a cross',
  'bonifaz-waldeck': 'abbot-prince in brown monastic habit with a golden crozier',
  'leodegar-waldeck': 'builder abbot-prince in white habit with a stone mason square and crozier',
  'fredegar-waldeck': 'scholarly abbot-prince in white habit surrounded by books',
  'roswitha-morwen': 'fierce countess in mail armor holding a long spear, purple and silver cloak, crescent moon emblem',
  'morwena': 'warrior countess founder with braided hair, spear and purple cloak',
  // Республика: голландско-ренессансный облик, без корон
  'rp-chancellor': 'cunning cold statesman in his sixties, thin clean-shaven face, thin lips, heavy-lidded calculating eyes, grey hair combed back, plain black doublet with a white ruff collar, small silver scissors on a chain around his neck, blue banner with a white chain behind',
  'rp-flamm': 'gaunt pale fanatical young revolutionary orator with burning eyes and hollow cheeks, unkempt dark hair, red sash over a shabby black coat, hand raised, consumptive look',
  'rp-hammer': 'sharp-faced prosecutor with a cruel thin smile, black lawyer gown, sheaf of papers',
  'rp-grauberg': 'old grizzled legate general, square jaw, short grey hair, grey steel breastplate over a blue coat, grey stone emblem',
  'rp-moewe': 'weathered sea legate woman in her seventies, grey hair tied back, blue naval coat with a seagull badge, steel gorget, sea behind',
  'rp-jan-kosar': 'rough old peasant militia leader with a big grey moustache, scarred face, red neckerchief, scythe blade straightened into a pike on his shoulder',
  'rp-strahl': 'calm polite secret police chief woman in her fifties, neat grey hair in a bun, high-collared black dress, attentive cold eyes, holding a card index file',
  'rp-boettcher': 'big calm dockworker leader in his forties, broad shoulders, short beard, rough wool jacket and cap, honest tired eyes, harbor cranes behind',
  'rp-marta-lind': 'young fierce weaver woman around thirty, red hair under a headscarf, rough linen dress, determined eyes, looms behind',
  'rp-kalb': 'mild tired grey notary statesman in his sixties, spectacles, black doublet with a white collar, ledger',
  'rp-ida-merz': 'shrewd confident woman prime minister in her late forties, brown hair, black silk dress with a white ruff collar, faint smile',
  'rp-viktor-feder': 'old newspaper publisher with ink-stained fingers, spectacles on his forehead, rolled-up sleeves, printing press behind',
  'rp-ansgar-wolt': 'ambitious young hawkish politician around forty, sharp features, dark blue coat with a sash, map of lands behind',
  'rp-ruta-wedel': 'brave young woman militia captain with braided hair, soot-stained face, simple armor, burning fortress tower behind',
  'rp-ludger-goldach': 'thin smiling banker in his late fifties, black broadcloth without jewelry, coins and scales on the table',
  'rp-gov-korel-3': 'smug corpulent city governor with a chain of office, black doublet with a ruff, canal bridges behind',
  'rp-adalbert-tirnau': 'kind old count with white hair and beard, green velvet coat, sad gentle eyes',
  'rp-bertold-sonnelgard': 'tall stern old bishop in white and gold vestments with a mitre, standing in a church doorway',
  'rp-agnes-erlach': 'cold precise young woman treasurer around thirty, dark hair, black dress with a white ruff collar, ledger and keys',
  'rp-wilma-tirnau': 'serious woman in her late thirties, publisher of a memorial journal, dark green dress, holding a book of names'
}
// без короны: незнатные и монахи (корону подсказывает герб рода на знамени)
const NO_CROWN = new Set(['ag-argus-1', 'ag-joachim'])
const word = (e) => {
  const p = e.base.props ?? {}
  // роль — только по титулу и занятию: в биографиях упоминаются императоры, это не делает героя императором
  const t = `${e.base.title} ${p.occupation ?? ''}`.toLowerCase()
  const female = p.gender === 'Женский'
  const born = yearOf(e.from)
  const end = yearOf(e.to) ?? 1010
  // Монстарги стареют медленно: делим возраст
  const drag = (p.race ?? '').includes('Драконья') ? 0.65 : 1
  const age = born != null ? Math.max(1, Math.round((Math.min(end, 1010) - born) * drag)) : 45
  const ageW = age < 6 ? 'small child' : age < 14 ? `child of ${age}` : age < 22 ? 'young' : age < 35 ? 'youthful adult' : age < 50 ? 'middle-aged' : age < 65 ? 'aging, grey-haired' : 'elderly, white-haired'
  const who = female ? 'woman' : 'man'
  let role = 'noble'
  if (/наместни/.test(t)) role = female ? 'lady governor in a silver mountain coronet and dark blue gown, gold ring with a ruby' : 'lord governor in a silver mountain coronet and dark blue robes, gold ring with a ruby'
  else if (/глава рода аргус/.test(t)) role = 'early medieval wealthy landowner lord in dark wool and fur, silver chain'
  else if (/аббат/.test(t)) role = female ? 'abbess-princess in a monastic habit with a golden crozier' : 'abbot-prince in a monastic habit with a golden crozier'
  else if (/императриц/.test(t) && !/консорт/.test(t)) role = 'reigning empress wearing a golden imperial crown and crimson gown with black dragon embroidery'
  else if (/император/.test(t)) role = 'emperor wearing a golden imperial crown and crimson robes with black dragon embroidery'
  else if (/консорт/.test(t)) role = female ? 'empress consort with a jeweled tiara and crimson gown' : 'prince consort in rich crimson doublet'
  else if (/кронпринц|принц/.test(t)) role = female ? 'imperial princess with a small tiara, crimson dress' : 'imperial prince with a gold circlet, crimson doublet'
  else if (/княгин|князь/.test(t)) role = female ? 'medieval princess of a small realm, silver circlet, black and silver dress' : 'medieval prince of a small realm, silver circlet, black fur mantle'
  else if (/претендент/.test(t)) role = 'scheming medieval nobleman, black fur, silver chain'
  else if (/король/.test(t)) role = 'king with a silver crown over mountains'
  else if (/граф/.test(t)) role = female ? 'countess in rich velvet with a coronet' : 'count in rich velvet with a coronet'
  else if (/барон|бургграф|кастелян/.test(t)) role = female ? 'baroness in velvet with a pearl coronet' : 'baron in velvet and fur with a silver chain'
  else if (/архиеп|настоятель|священ/.test(t)) role = female ? 'abbess in white and gold habit' : 'archbishop in white and gold vestments with a sun-and-eye pendant'
  else if (/легат|капитан|генерал|маршал|командир|стражи/.test(t)) role = 'military officer in polished steel armor'
  else if (/магес|магистр|архимаг/.test(t)) role = 'mage scholar in robes with glowing runes'
  else if (/наездник|конев|ловч|охот/.test(t)) role = 'huntsman noble in leather and fur'
  else if (/рудник|литейн/.test(t)) role = 'mining noble with iron jewelry'
  else role = female ? 'noblewoman in velvet gown' : 'nobleman in velvet doublet'
  // республиканцы: без корон и венцов, голландский облик
  if (e.base.tags.includes('Республика') && !/military|archbishop|abbess/.test(role)) role = female ? 'republican stateswoman in black silk dress with a white ruff collar' : 'republican statesman in black doublet with a white ruff collar and a chain of office'
  const hid = houseOf.get(e.base.links?.dynasty)
  const dynH = world.entries.find((x) => x.id === e.base.links?.dynasty)?.base.heraldry
  const colors = hid ? `, clothes in ${HOUSE_COLORS[hid]} colors` : dynH ? `, clothes in ${[...new Set(dynH.colors)].map(colorName).join(' and ')} colors` : ''
  const pers = p.personality ?? e.base.summary ?? ''
  const mood = /жесток|безум|тиран|кровав/.test(pers.toLowerCase()) ? ', cruel menacing expression' : /добр|мягк|тих/.test(pers.toLowerCase()) ? ', gentle expression' : /горд|холод|строг/.test(pers.toLowerCase()) ? ', proud cold expression' : ''
  return `${ageW} ${who}, ${role}${colors}${mood}`
}
// ---------- знамёна: правителям — флаг страны, знати — знамя рода ----------
const COLOR_NAMES = [
  ['crimson', '#a01c24'], ['dark red', '#5a1a1a'], ['black', '#141414'], ['gold', '#c9a45c'], ['white', '#ece6d6'], ['silver', '#b8b8c0'],
  ['grey', '#5a5a64'], ['navy blue', '#1f3f6a'], ['deep blue', '#2a2a5a'], ['teal', '#2f6876'], ['green', '#2f5a2a'], ['brown', '#5a3a1a'],
  ['purple', '#5a2a4a'], ['dark purple', '#2a1a2a'], ['orange', '#c96a2a']
]
const colorName = (hex) => {
  const h = (hex ?? '#888888').replace('#', '')
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))
  if (Math.max(r, g, b) < 48) return 'black'
  let best = 'grey', bd = Infinity
  for (const [n, c] of COLOR_NAMES) {
    const [R, G, B] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
    const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2
    if (d < bd) { bd = d; best = n }
  }
  return best
}
const EMBLEM_WORDS = {
  dragon: 'a black dragon', sword: 'a sword', swords: 'crossed swords', crown: 'a crown', tower: 'a tower', tree: 'a tree', wave: 'waves',
  star: 'a star', moon: 'a crescent moon', skull: 'a skull', hammer: 'a hammer', axe: 'an axe', flame: 'a flame', rose: 'a rose',
  cross: 'a cross', key: 'a key', anchor: 'an anchor', ship: 'a ship', mountain: 'a mountain', book: 'an open book', eagle: 'an eagle',
  wolf: 'a wolf', scales: 'scales', chalice: 'a chalice', chain: 'a chain', 'sun-eye': 'a sun with an eye'
}
const bannerText = (h) => {
  if (!h) return ''
  const field = h.colors.length > 1 && h.colors[0] !== h.colors[1] ? `${colorName(h.colors[0])} and ${colorName(h.colors[1])}` : colorName(h.colors[0])
  const em = EMBLEM_WORDS[h.emblem] ? ` with ${EMBLEM_WORDS[h.emblem].replace(/^an? /, (m) => m)} in ${colorName(h.emblemColor)}` : ''
  return `a large ${field} heraldic banner${em}`
}
const stateByName = (n) => world.states.find((st) => st.base.name === n)
const empireSt = stateByName('Империя')
const princedomHeraldry = empireSt.history.find((h) => h.patch?.heraldry)?.patch.heraldry
const bannerFor = (e) => {
  const t = e.base.title
  const id = e.id.slice(5)
  if (id === 'jakasta') return bannerText(world.states.find((st) => st.id === 'hist-desert')?.base.heraldry)
  // императоры, императрицы и регент — имперский стяг: алый с чёрным драконом
  if (/Император|Императрица|Регент Дагерфорда/.test(t) && !/консорт/.test(t)) return 'a large crimson imperial banner with a black dragon'
  // князья и княгини Дагерфорда — флаг княжества
  if (/^(Князь|Княгиня) Дагерфорда/.test(t)) return bannerText(princedomHeraldry)
  // короли и графы вассалов — флаг их страны
  const ruled = world.states.find((st) => st.base.rulerId === e.id)
  if (ruled?.base.heraldry) return bannerText(ruled.base.heraldry)
  // знать — знамя рода
  const dyn = world.entries.find((x) => x.id === e.base.links?.dynasty)
  if (dyn?.base.heraldry) return bannerText(dyn.base.heraldry)
  // Монстарги без титула правителя и супруги — имперский стяг
  if (e.base.links?.dynasty === 'lore-monstarg' || /консорт|Принц/.test(t) || e.base.tags.includes('армия')) return 'a large crimson imperial banner with a black dragon'
  return ''
}
const seedOf = (id) => [...id].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0, 7) % 1000000

const IDS = new Set(process.argv.slice(2).map((x) => (x.startsWith('lore-') ? x : `lore-${x}`)))
const chars = world.entries.filter(
  (e) =>
    e.kind === 'character' &&
    (IDS.size ? IDS.has(e.id) : e.base.tags.some((t) => ['Монстарги', 'Дагерфорд', 'Великие дома', 'армия', 'Корона Аргус', 'Республика', 'южные республики', 'Святая церковь', 'Графство Штирия', 'Графство Мангениум', 'Имперские Изгнанники', 'Земли Севера', 'Креит', 'Фарвольская лига', 'Высокогорное Княжество', 'Республика Чеафарал', 'Крайдонианская Лига', 'Княжества Гарефорда', 'Королевство Темерия', 'Протекторат Лирия', 'Когалым', 'Кулагон', 'Эльфборн', 'Сильвленд', 'Княжество Харнмарк', 'Фейноко', 'Таварвайт', 'Павильон Грёз', 'Королевство Редания', 'Империя Кагия'].includes(t)) || ['lore-kaya-head', 'lore-korvin-argus', 'lore-jakasta', 'lore-anselm-fern'].includes(e.id))
)
let done = 0
for (const e of chars) {
  const id = e.id.slice(5)
  const file = `${OUT}/${id}.webp`
  const holy = e.base.tags.includes('Святая церковь')
  const southern = e.base.tags.includes('южные республики')
  const sty = e.base.tags.includes('Графство Штирия') || id === 'styria-now'
  const man = e.base.tags.includes('Графство Мангениум')
  const exile = e.base.tags.includes('Имперские Изгнанники')
  const north = e.base.tags.includes('Земли Севера')
  const kreit = e.base.tags.includes('Креит')
  const farvol = e.base.tags.includes('Фарвольская лига')
  const highland = e.base.tags.includes('Высокогорное Княжество')
  const cheaf = e.base.tags.includes('Республика Чеафарал')
  const crydon = e.base.tags.includes('Крайдонианская Лига')
  const gareford = e.base.tags.includes('Княжества Гарефорда')
  const temeria = e.base.tags.includes('Королевство Темерия')
  const lyria = e.base.tags.includes('Протекторат Лирия')
  const kogalym = e.base.tags.includes('Когалым')
  const kulagon = e.base.tags.includes('Кулагон')
  const elfborn = e.base.tags.includes('Эльфборн')
  const silvland = e.base.tags.includes('Сильвленд')
  const harnmark = e.base.tags.includes('Княжество Харнмарк')
  const feinoko = e.base.tags.includes('Фейноко')
  const tavarvait = e.base.tags.includes('Таварвайт')
  const pavil = e.base.tags.includes('Павильон Грёз')
  const redania = e.base.tags.includes('Королевство Редания')
  const kagia = e.base.tags.includes('Империя Кагия')
  const rp = e.base.tags.includes('Республика') || southern || holy || sty || man || exile || north || kreit || farvol || highland || cheaf || crydon || gareford || temeria || lyria || kogalym || kulagon || elfborn || silvland || harnmark
  if (existsSync(file) && !IDS.size) {
    e.base.image = `portraits/${id}.webp`
    continue
  }
  const subject = CUSTOM[id] ?? e.base.props?.look ?? word(e)
  // европейская внешность — людям-гладрам; южанам, дварфам и прочим — нет
  const race = e.base.props?.race ?? ''
  const imperial = !['jakasta', 'durin-kald'].includes(id) && (!race || /гладр|имперец|^Человек$/.test(race))
  // у незнатных и монахов — знамя рода без эмблемы, иначе нейросеть надевает им корону с герба
  const flag = NO_CROWN.has(id) ? bannerFor(e).replace(/ with .*$/, '') : bannerFor(e)
  const banner = flag ? `(${flag} hanging on the wall behind:${rp ? 1.1 : 1.35}), ` : ''
  // Республика: короче описание и явный возраст числом — с LCM длинный запрос сводит всех к одному молодому лицу
  const age = Math.max(1, Math.min(yearOf(e.to) ?? 1010, 1010) - (yearOf(e.from) ?? 965))
  const stHouse = sty && e.base.links?.dynasty === 'lore-house-styria'
  const female = e.base.props?.gender === 'Женский'
  const gnomeR = /Гном/.test(race), dwarfR = /Дварф/.test(race)
  const halfElf = /Полуэльф/.test(race), elfR = /эльф/i.test(race) && !halfElf
  const sylvaR = /Сильва/.test(race)
  const prompt = silvland
    ? `${SILVLAND_STYLE}, portrait of ${sylvaR ? `a (sylva ${female ? 'woman' : 'man'}, living plant person:1.4), (green-tinted skin with bark texture on shoulders, leaves and berries growing in the hair, glowing amber eyes, a small carved root-shaped mark on the shoulder, plain coarse bast clothes, northern european facial features:1.3)` : elfR ? `an (elf ${female ? 'woman' : 'man'}:1.35), (northern european features, pale skin, long pointed elf ears:1.3)` : halfElf ? `a (half-elf ${female ? 'woman' : 'man'}:1.35), (northern european human face, slightly pointed ears:1.25)` : `a (${age} year old ${female ? 'woman' : 'man'}:1.35), (northern european features, pale skin:1.25)`}, ${CUSTOM[id] ?? subject}, (bareheaded:1.1)`
    : elfborn
    ? `${ELFBORN_STYLE}, portrait of ${elfR ? `an (elf ${female ? 'woman' : 'man'}:1.35), (northern european features, pale skin, long pointed elf ears:1.3)` : halfElf ? `a (half-elf ${female ? 'woman' : 'man'}:1.35), (northern european human face, slightly pointed ears:1.25)` : `a (${age} year old ${female ? 'woman' : 'man'}:1.35), (northern european features, pale skin:1.25)`}, ${CUSTOM[id] ?? subject}${id === 'el-serelin' ? '' : ', (bareheaded:1.1)'}`
    : kagia
    ? `${KAGIA_STYLE}, portrait of a (${age} year old ${female ? 'woman' : 'man'}:1.35), (northern european, germanic features, pale skin:1.25), ${CUSTOM[id] ?? subject}, (bareheaded, no hat:1.3)`
    : redania
    ? `${REDANIA_STYLE}, portrait of a (${age} year old ${female ? 'woman' : 'man'}:1.35), (northern european, germanic features, pale skin:1.25), ${CUSTOM[id] ?? subject}, (bareheaded, no hat:1.3)`
    : pavil
    ? `${PAVIL_STYLE}, portrait of a (${age} year old ${female ? 'woman' : 'man'}:1.35), (northern european, germanic features, pale skin:1.25), ${CUSTOM[id] ?? subject}, (bareheaded, no hat:1.3)`
    : tavarvait
    ? `${TAVAR_STYLE}, portrait of ${/эльф/i.test(race) ? `an (elf ${female ? 'woman' : 'man'}:1.35), (wood elf of a forest folk, northern european features, pale skin, tall slender, long pointed elf ears:1.35)` : `a (${age} year old ${female ? 'woman' : 'man'}:1.35), (northern european human, germanic features, pale skin:1.25)`}, ${CUSTOM[id] ?? subject}, (bareheaded, no hat:1.3)`
    : feinoko
    ? `${FEINOKO_STYLE}, portrait of a (${age} year old ${female ? 'woman' : 'man'}:1.35), (northern european features, pale skin, black hair:1.25), ${/Момит/.test(race) ? '(high black topknot tied with a blue cord:1.25), (small white bone pendant on a thin cord around the neck:1.2), ' : ''}${CUSTOM[id] ?? subject}, (no hat:1.3)`
    : harnmark
    ? `${HARNMARK_STYLE}, portrait of a (${age} year old ${female ? 'woman' : 'man'}:1.35), (northern european, germanic features, pale skin:1.25), ${CUSTOM[id] ?? subject}, (bareheaded, no hat:1.3)`
    : kulagon
    ? `${KULAGON_STYLE}, portrait of a (${age} year old ${female ? 'woman' : 'man'}:1.35), (northern european features, pale skin:1.25), ${CUSTOM[id] ?? subject}, (bareheaded, no hat:1.3)`
    : kogalym
    ? `${KOGALYM_STYLE}, portrait of a (${age} year old ${female ? 'woman' : 'man'}:1.35), (northern european features, pale skin:1.25), ${CUSTOM[id] ?? subject}, (bareheaded, no hat:1.3)`
    : lyria
    ? `${LYRIA_STYLE}, portrait of a (${age} year old ${female ? 'woman' : 'man'}:1.35), (northern european features, pale skin:1.25), ${CUSTOM[id] ?? subject}, (bareheaded, no hat:1.3)`
    : temeria
    ? `${TEMERIA_STYLE}, portrait of a (${age} year old ${female ? 'woman' : 'man'}:1.35), (northern european, germanic features, pale skin:1.25), ${CUSTOM[id] ?? subject}, (bareheaded, no hat:1.3)`
    : gareford
    ? `${GAREFORD_STYLE}, portrait of a (${age} year old ${female ? 'woman' : 'man'}:1.35), ${id === 'gf-eyvind' ? '' : '(northern european, alpine german features, pale skin:1.25), '}${CUSTOM[id] ?? subject}, (bareheaded, no hat:1.3)`
    : crydon
    ? `${CRYDON_STYLE}, portrait of a (${age} year old ${female ? 'woman' : 'man'}:1.35), (half-elf, slightly elongated face, pale olive skin, ${id === 'cr-ezra' ? 'ordinary human' : female ? 'long black hair' : 'black hair, thick beard'}:1.2), ${CUSTOM[id] ?? subject}`
    : cheaf
    ? `${CHEAFARAL_STYLE}, portrait of a (${age} year old ${female ? 'woman' : 'man'}:1.35), (northern european, scandinavian features, pale skin:1.25), ${CUSTOM[id] ?? subject}`
    : highland && (dwarfR || gnomeR)
    ? `${FARVOL_STYLE.replace('warm forge light and brass lamps, carved stone pillars', 'mine lamp light, rough rock walls, ore carts')}, ${dwarfR ? `portrait of an (${age > 120 ? 'ancient' : 'adult'} dwarf${female ? ' woman, female, no beard' : ''}:1.45), (short stout broad-shouldered dwarf, huge nose, heavy brow, ruddy weathered european skin:1.35), ` : `portrait of a (short ${female ? 'woman' : 'man'}, fantasy tinkerer, bareheaded:1.35), (big round nose, light eyes, ruddy european skin:1.25), `}${CUSTOM[id] ?? subject}`
    : highland
    ? `${HIGHLAND_STYLE}, ${banner}portrait of a (${age} year old ${female ? 'woman' : 'man'}:1.35), (northern european, alpine german features, pale skin:1.25), ${CUSTOM[id] ?? subject}`
    : farvol
    ? `${FARVOL_STYLE}, ${banner}${dwarfR ? `portrait of an (old dwarf${female ? ' woman, female' : ''}:1.45), (short stout broad-shouldered dwarf, huge nose, heavy brow, ruddy weathered european skin:1.35), ` : gnomeR ? `portrait of a (short ${female ? 'woman' : 'man'}, fantasy tinkerer, bareheaded:1.35), (big round nose, slightly large ears, bright light eyes, spiky sandy hair, ruddy tanned european skin:1.3), ` : `portrait of a (${age} year old ${female ? 'woman' : 'man'}:1.35), (northern european, pale skin:1.2), `}${CUSTOM[id] ?? subject}`
    : kreit
    ? `${KREIT_STYLE}, ${banner}portrait of a (${age} year old ${age < 14 ? (female ? 'girl' : 'boy') : female ? 'woman' : 'man'}:1.35), (norwegian, pale weathered skin:1.2), ${CUSTOM[id] ?? subject}`
    : north
    ? `${NORTH_STYLE}, ${banner}${/Дварф/.test(race) ? `portrait of an (ancient dwarf:1.5), (short stout broad-shouldered dwarf, huge bulbous nose, heavy brow, deep-set eyes, ruddy weathered skin:1.4), ` : `portrait of a (${age} year old ${age < 14 ? (female ? 'girl' : 'boy') : female ? 'woman' : 'man'}:1.35), (scandinavian, pale weathered skin:1.2), `}${CUSTOM[id] ?? subject}`
    : sty
    ? `oil painting, dark gothic medieval portrait, candlelight, deep shadows, black background, visible brush strokes, detailed face, half-length portrait, ${banner}portrait of a (${age} year old ${female ? 'woman' : 'man'}:1.35), (northern european:1.15), ${stHouse ? `(snow white skin, jet black hair:1.35), ${female ? 'black velvet gown' : 'black velvet doublet'} with a silver crescent, cold eyes` : /немая|скита/.test(e.base.title) ? 'grim hooded figure in grey robe, ink-stained hands' : /Капитан/.test(e.base.title) ? 'scarred mercenary general in worn black armor' : /Кастелян/.test(e.base.title) ? 'impoverished nobleman in a patched old doublet, tired face' : /Епископ/.test(e.base.title) ? 'bored bishop in shabby white robes with a golden sun pendant' : /Мастер|Управляющий/.test(e.base.title) ? 'shady merchant in black clothes with rings, sly look' : subject}`
    : rp
    ? `${holy ? CHURCH_STYLE : southern ? SOUTH_STYLE : RP_STYLE}, ${holy ? '' : banner}portrait of a (${age} year old ${age < 14 ? (e.base.props?.gender === 'Женский' ? 'girl' : 'boy') : e.base.props?.gender === 'Женский' ? 'woman' : 'man'}:1.35), ${holy ? `(european:1.1), ${/Папа/.test(e.base.title) ? 'pope in white and gold papal vestments with a tall white mitre, golden sun pendant' : /паладин|магистр|Командор|Маршал/i.test(e.base.title) ? 'paladin knight in polished white plate armor with a golden sun emblem on the chest, white cloak' : 'archbishop in white and gold robes with a mitre and a golden crozier, golden sun pendant'}, ` : southern ? (/Кальтран/.test(race) ? '(celtic european, pale weathered skin, braided hair:1.15), ' : '(southern european, mediterranean, olive skin, dark hair:1.2), ') : imperial ? '(northern european, pale skin:1.15), ' : ''}${holy ? '' : subject}${exile && !CUSTOM[id] ? ', wearing a fur cloak over a dark crimson imperial uniform with a black dragon, snowy northern fortress behind' : ''}`
    : `${STYLE}, ${banner}portrait of a ${imperial ? (id === 'oktavian-2' ? '(pale european baby:1.2), ' : '(northern european, germanic features, pale skin, deep-set eyes, strong brow ridge, prominent straight nose:1.3), ') : ''}${subject}`
  if (process.env.DRY) {
    console.log(`${e.base.name}: ${prompt.slice(STYLE.length + 2)}`)
    continue
  }
  await startSd()
  const t0 = Date.now()
  const negative = farvol || (highland && (dwarfR || gnomeR)) ? `${NEG}, (garden gnome, pointy hat, conical hat, figurine, statue, toy, ceramic, doll:1.6), (crown, tiara:1.4)` : rp ? `${NEG}, (crown, tiara, circlet, diadem:1.5), (picture frame, gilded frame, border:1.4)` : NO_CROWN.has(id) ? `${NEG}, (crown, tiara, circlet, diadem:1.5)` : NEG
  // 448×560, а не 512×640: на 512×640 модель не влезает в 4 ГБ видеопамяти и шаг в 5 раз медленнее; потом увеличиваем
  const png = await txt2img({ prompt, negative, width: 448, height: 560, steps: 7, cfg: 1.8, seed: seedOf(id) + Number(process.env.SEED_OFFSET ?? 0) })
  // республиканцев любит рисовать в раме — обрезаем края
  await (rp ? sharp(png).extract({ left: 24, top: 28, width: 400, height: 504 }).resize(456, 576, { kernel: 'lanczos3' }) : sharp(png).resize(512, 640, { kernel: 'lanczos3' })).webp({ quality: 86 }).toFile(file)
  e.base.image = `portraits/${id}.webp`
  if (!process.env.NOWRITE) writeFileSync(WORLD, JSON.stringify(world, null, 1)) // сохраняем после каждого — можно прервать и продолжить
  console.log(`[${++done}/${chars.length}] ${e.base.name} — ${((Date.now() - t0) / 1000).toFixed(0)} с`)
}
stopSd()
if (!process.env.NOWRITE) writeFileSync(WORLD, JSON.stringify(world, null, 1))
console.log(`Готово: портретов ${chars.filter((e) => e.base.image).length} из ${chars.length}`)

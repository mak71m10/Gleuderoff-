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
const KULAGON_STYLE = 'oil painting, Frisian canal-country portrait, flat green plain with brick houses and a stone arch over a canal behind, low grey sky with silver light, muted greens and slate blues, painterly, half-length portrait'
const KOGALYM_STYLE = 'oil painting, rural commune portrait, timber meeting hall with a notched tally stick and a wooden cart behind, warm daylight, earthy tones, visible brush strokes, detailed face, half-length portrait'
const LYRIA_STYLE = 'oil painting, mountain-roman ducal portrait, white marble hall with a wall of small glowing tablets behind, warm lamp light, terracotta and cream tones, visible brush strokes, detailed face, half-length portrait'
const TEMERIA_STYLE = 'oil painting, medieval forest kingdom portrait, warm hearth firelight in a half-timbered hall, an open oak door with a lantern glowing behind, green and gold accents, visible brush strokes, detailed face, half-length portrait'
const GAREFORD_STYLE = 'oil painting, alpine mountain-prince portrait, candlelit stone hall with dark oak panelling, warm lantern glow, a small brass lantern flame in the background, visible brush strokes, detailed face, half-length portrait'
const CRYDON_STYLE = 'oil painting, naval admiralty portrait, dark navy uniform with gold braid, warm cabin lamp light, charts and a brass telescope behind, sea light through a window, visible brush strokes, detailed face, half-length portrait'
const CHEAFARAL_STYLE = 'oil painting, northern republic council portrait, dutch golden age style, candlelight, dark wood and grey stone hall behind, visible brush strokes, detailed face, half-length portrait'
const HIGHLAND_STYLE = 'oil painting, alpine noble portrait, cold clear mountain light, snowy peaks and pale sky behind, dark wood panelling, visible brush strokes, detailed face, half-length portrait'
const FARVOL_STYLE = 'oil painting, fantasy mountain hall portrait, warm forge light and brass lamps, carved stone pillars, dark background, visible brush strokes, detailed face, half-length portrait'
const KREIT_STYLE = 'oil painting, viking age norwegian portrait, dark smoky longhouse lit by torches, glints of raw silver, carved dragon posts, dark background, visible brush strokes, detailed weathered face, half-length portrait'
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
    (IDS.size ? IDS.has(e.id) : e.base.tags.some((t) => ['Монстарги', 'Дагерфорд', 'Великие дома', 'армия', 'Корона Аргус', 'Республика', 'южные республики', 'Святая церковь', 'Графство Штирия', 'Графство Мангениум', 'Имперские Изгнанники', 'Земли Севера', 'Креит', 'Фарвольская лига', 'Высокогорное Княжество', 'Республика Чеафарал', 'Крайдонианская Лига', 'Княжества Гарефорда', 'Королевство Темерия', 'Протекторат Лирия', 'Когалым', 'Кулагон'].includes(t)) || ['lore-kaya-head', 'lore-korvin-argus', 'lore-jakasta', 'lore-anselm-fern'].includes(e.id))
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
  const rp = e.base.tags.includes('Республика') || southern || holy || sty || man || exile || north || kreit || farvol || highland || cheaf || crydon || gareford || temeria || lyria || kogalym || kulagon
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
  const prompt = kulagon
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

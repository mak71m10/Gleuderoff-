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
    (IDS.size ? IDS.has(e.id) : e.base.tags.some((t) => ['Монстарги', 'Дагерфорд', 'Великие дома', 'армия', 'Корона Аргус', 'Республика', 'южные республики', 'Святая церковь', 'Графство Штирия', 'Графство Мангениум', 'Имперские Изгнанники', 'Земли Севера', 'Креит'].includes(t)) || ['lore-kaya-head', 'lore-korvin-argus', 'lore-jakasta', 'lore-anselm-fern'].includes(e.id))
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
  const rp = e.base.tags.includes('Республика') || southern || holy || sty || man || exile || north || kreit
  if (existsSync(file) && !IDS.size) {
    e.base.image = `portraits/${id}.webp`
    continue
  }
  const subject = CUSTOM[id] ?? word(e)
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
  const prompt = kreit
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
  const negative = rp ? `${NEG}, (crown, tiara, circlet, diadem:1.5), (picture frame, gilded frame, border:1.4)` : NO_CROWN.has(id) ? `${NEG}, (crown, tiara, circlet, diadem:1.5)` : NEG
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

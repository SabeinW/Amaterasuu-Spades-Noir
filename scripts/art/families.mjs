import fs from 'node:fs'
// Prompts for the illustrated court of every card family (see
// src/data/cardFamilies.js). Black royals by default, each family with its
// own cast, palette, poses and elemental flourish.
//   node scripts/art/families.mjs <family>      -> JSON items for that family
//   node scripts/art/families.mjs extras        -> Little Jokers + Aces of Spades
const ART = '/home/raheemlinuxmaster/spades-art/families/anchors'

const STYLE = {
  moon: { look: 'moonlit sumi-e ink wash on deep indigo paper with silver-leaf accents (silver, not gold); indigo, pearl white, silver and soft rose palette', world: 'a silver crescent-moon halo, night clouds and small stars' },
  ember: { look: 'bold dramatic sumi-e ink with molten orange, crimson and black, glowing copper-leaf accents, strong contrast', world: 'swirling fire, smoke and rising sparks' },
  tide: { look: 'flowing sumi-e ink in deep sapphire, cyan, coral and seafoam with pearl and silver-leaf accents', world: 'great curling waves, sea spray and circling koi' },
  frost: { look: 'crisp ink on pale misty paper, ice blue, white and silver with a touch of winter red, silver-leaf accents', world: 'falling snow, frost crystals and a crane in the distance' },
  jade: { look: 'lush sumi-e ink with jade, emerald, moss and warm gold-leaf accents on cream paper', world: 'a misty bamboo and pine forest' },
  bloom: { look: 'soft sumi-e ink with blush pink, plum, charcoal and rose-gold leaf on cream paper', world: 'cherry blossoms and swirling petals' },
  storm: { look: 'dramatic sumi-e ink with violet, slate and electric-cyan lightning, silver-leaf accents', world: 'dark storm clouds, gusting wind and forks of lightning' },
  eclipse: { look: 'dramatic black-and-gold ink on deep black paper with burnished gold leaf and crimson accents', world: 'a total solar eclipse with a blazing gold corona and drifting shadow' },
  aurora: { look: 'luminous ink wash with aurora teal, emerald, magenta and violet over deep night blue, silver-leaf accents', world: 'curtains of northern lights rippling over a snowy night' },
  starfall: { look: 'deep cosmic navy and violet ink with gold-leaf constellations and soft nebula washes', world: 'a starry cosmos, constellation lines and shooting stars' },
  dune: { look: 'warm sumi-e ink with terracotta, saffron, sand gold and deep teal, gold-leaf accents', world: 'golden dunes, a low desert sun and drifting sand' },
  cloudborn: { look: 'joyful, bold illustration with clean expressive line work; royal purple and pearl white with electric-blue details and silver highlights, soft glowing light', world: 'billowing white storm clouds bursting outward with crackling violet and blue lightning' },
  shibuya: { modern: true, look: 'sleek modern anime-influenced illustration with crisp line work and cel shading; neon magenta, electric cyan, black and white with chrome highlights', world: 'a rainy Tokyo side street at night glowing with abstract neon shapes (no letters or signs with writing) and reflections on the wet pavement' },
  uptown: { modern: true, look: 'bold modern illustration with clean line work and warm golden-hour light; burgundy, olive, cream, denim blue and white with silver highlights, crisp sneaker-culture finish', world: 'a city block of brownstones with a fire escape and a colourful abstract mural (no letters) in warm sunset light' },
  heroes: { modern: true, look: 'bold modern comic-book illustration with dynamic inking, halftone shading and vivid saturated colour; royal blue, white, crimson and silver', world: 'a city skyline at dusk with dramatic light rays, action lines and flying debris' },
  villains: { modern: true, look: 'dark, dramatic modern comic-book illustration with heavy inks and sharp shadows; black, crimson, toxic green and deep purple with chrome highlights', world: 'a stormy city night with crimson-lit smoke, shattered glass and creeping black tendrils' },
}

// Who sits on each card, per family. Kings: older men with beards. Queens:
// Black women with natural hair. Jacks: young men. Every family a new cast.
const CAST = {
  moon: {
    QS: 'a composed Black queen with deep brown skin and long locs gathered in a high crown, robes of midnight indigo and silver, holding a closed silver fan to her chest',
    JS: 'a young Black swordsman with brown skin, a high-top fade and a thin beard, robes of indigo and pearl, drawing a sword that gleams like moonlight',
    KH: 'a gentle Black king with rich brown skin, silver twists under a small crown and a full grey beard, robes of pearl white and pale rose, reading a scroll by moonlight',
    JH: 'a young Black archer with warm brown skin and shoulder-length two-strand twists, robes of rose and indigo, aiming a longbow at the moon',
    KD: 'a wealthy Black king with deep brown skin, a bald head and a braided silver beard, robes of indigo with silver moon crests, holding a silver coin like a tiny full moon',
    QD: 'a radiant Black queen with brown skin and a coily afro crowned with pearls, robes of pearl and silver, gazing into a round silver mirror that reflects the moon',
    JD: 'a cheerful young Black courier with brown skin and short locs, robes of indigo and silver, carrying a glowing moon-lantern on a pole',
    KC: 'a scholarly Black elder king with deep brown skin, a long white beard and white locs in a topknot, robes of indigo and silver, writing calligraphy by moonlight',
    QC: 'a serene Black queen with medium-brown skin and bantu knots with silver pins, robes of pearl and soft indigo, holding a sprig of night-blooming flowers',
    JC: 'a calm young Black wanderer with dark brown skin and cornrows into a topknot, robes of indigo and pearl, a staff over his shoulder topped with a crescent moon',
    JOKER_BIG: 'a joyful Black acrobat-jester with deep brown skin mid-leap in a silver and indigo patchwork costume with long sleeves and a soft cap, juggling a full moon and stars',
  },
  ember: {
    QS: 'a fierce Black queen with deep brown skin and long box braids in a high ponytail, robes of black and ember orange, holding a closed iron fan',
    JS: 'a young Black samurai with brown skin, two-strand twists tied back and a short beard, black and crimson armour-robes, a blazing sword held low',
    KH: 'a warm-hearted Black king with rich brown skin, a full black beard and short locs, crimson and gold robes, holding a scroll edged with glowing embers',
    JH: 'a young Black archer with warm brown skin and cornrows, crimson robes, drawing a longbow with a flaming arrow',
    KD: 'a proud Black king with deep brown skin, a bald head and a thick salt-and-pepper beard, molten-gold and black robes, holding a glowing gold coin',
    QD: 'a regal Black queen with brown skin and a sculpted afro crowned with copper flames, gold and ember robes, holding a hand mirror that reflects fire',
    JD: 'a grinning young Black courier with brown skin and a high-top fade, orange and black robes, swinging a fiery lantern',
    KC: 'a stern Black elder king with dark brown skin, a long grey beard and grey locs, black and copper robes, holding a smouldering calligraphy brush',
    QC: 'a determined Black queen with warm brown skin and locs piled high with copper pins, crimson and charcoal robes, holding a branch of burning maple leaves',
    JC: 'a bold young Black warrior with dark brown skin and long box braids, black and orange robes, spinning a staff with flaming ends',
    JOKER_BIG: 'a laughing Black fire-juggler jester with deep brown skin in a crimson and orange patchwork costume with long sleeves and a soft cap, juggling three balls of flame',
  },
  tide: {
    QS: 'a poised Black queen with deep brown skin and long knotless braids, robes of deep sapphire and silver, a closed fan, water rising in a spiral behind her',
    JS: 'a young Black sea-swordsman with brown skin, short locs and a light beard, sapphire and seafoam robes, a curved sword dripping with sea spray',
    KH: 'a kindly Black king with rich brown skin, two-strand twists and a trimmed grey beard, coral and sapphire robes, unrolling a scroll of sea charts',
    JH: 'a young Black archer with warm brown skin and twists with silver beads, coral and cyan robes, aiming a bow across the waves',
    KD: 'a wealthy Black sea-king with deep brown skin, a bald head and a full beard, sapphire and gold robes, holding a giant pearl',
    QD: 'a glowing Black queen with brown skin and a high afro with pearl combs, seafoam and pearl robes, holding a mother-of-pearl mirror',
    JD: 'a cheerful young Black fisher-courier with brown skin and cornrows, cyan robes, carrying a lantern shaped like a jellyfish',
    KC: 'a wise Black elder king with dark brown skin, a long white beard and white twists, sapphire and seafoam robes, holding a conch and a brush',
    QC: 'a gentle Black queen with medium-brown skin and locs wrapped in a seafoam scarf, sapphire and coral robes, holding a lotus',
    JC: 'a relaxed young Black wanderer with dark brown skin and a short afro, sapphire robes, a driftwood staff over one shoulder',
    JOKER_BIG: 'a joyful Black acrobat-jester with deep brown skin riding a wave in a sapphire and coral patchwork costume with long sleeves and a soft cap, tossing a pearl',
  },
  frost: {
    QS: 'a regal Black queen with deep brown skin and long locs dusted with frost, robes of white and steel blue, a closed silver fan, snow swirling around her',
    JS: 'a young Black swordsman with brown skin, cornrows and a short beard, white and ice-blue fur-trimmed robes, a sword of ice',
    KH: 'a kindly Black king with rich brown skin, a frosted beard and short twists under a silver crown, white and winter-red robes, reading a scroll in the snow',
    JH: 'a young Black archer with warm brown skin and box braids, white and red robes, drawing a bow with an icicle arrow',
    KD: 'a stately Black king with deep brown skin, a bald head and a white beard, ice-blue and silver robes, holding a coin of clear ice',
    QD: 'a luminous Black queen with brown skin and a halo of white-tipped coils, white and pale gold robes, holding a mirror of frosted crystal',
    JD: 'a cheerful young Black courier with brown skin and a high-top fade, ice-blue robes and a fur collar, carrying a frost-glass lantern',
    KC: 'a wise Black elder king with dark brown skin, a long white beard and white locs, white and slate robes, holding a brush that leaves frost',
    QC: 'a serene Black queen with medium-brown skin and two-strand twists in an updo with crystal pins, white and pine-green robes, holding a frosted pine sprig',
    JC: 'a calm young Black mountain wanderer with dark brown skin and two-strand twists, white and slate robes, a staff topped with an ice crystal',
    JOKER_BIG: 'a joyful Black acrobat-jester with deep brown skin sliding on ice in a white and ice-blue patchwork costume with long sleeves and a soft cap, juggling snowflakes',
  },
  jade: {
    QS: 'a composed Black queen with deep brown skin and long box braids, robes of deep forest green and black, a closed fan made of pine fronds',
    JS: 'a young Black ranger-swordsman with brown skin, freeform locs and a light beard, moss and jade robes, a sword with a bamboo hilt',
    KH: 'a warm Black king with rich brown skin, two-strand twists and a full beard, jade and red robes, reading a scroll among plum trees',
    JH: 'a young Black archer with warm brown skin and cornrows, jade and cream robes, a bamboo longbow drawn',
    KD: 'a prosperous Black king with deep brown skin, a bald head and a grey goatee, emerald and gold robes, holding a jade coin',
    QD: 'a radiant Black queen with brown skin and an afro crowned with gold leaves, emerald and gold robes, holding a jade mirror',
    JD: 'a grinning young Black courier with brown skin and twists, moss and gold robes, carrying a lantern of woven bamboo',
    KC: 'a sage Black elder king with dark brown skin, a long white beard and white locs, jade and earth-brown robes, painting bamboo with a brush',
    QC: 'a gentle Black queen with medium-brown skin and bantu knots with jade pins, forest green robes, holding a bamboo sprig',
    JC: 'an easygoing young Black wanderer with dark brown skin and a short afro, jade robes, a bamboo staff with a gourd',
    JOKER_BIG: 'a playful Black acrobat-jester with deep brown skin swinging from bamboo in a jade and gold patchwork costume with long sleeves and a soft cap',
  },
  bloom: {
    QS: 'an elegant Black queen with deep brown skin and long locs threaded with cherry blossoms, robes of charcoal and blush, a closed rose-gold fan',
    JS: 'a young Black swordsman with brown skin, box braids and a short beard, plum and charcoal robes, a sword with petals swirling off the blade',
    KH: 'a jovial Black king with rich brown skin, short twists and a full beard, blush and gold robes, holding a scroll tied with a blossom',
    JH: 'a young Black archer with warm brown skin and two-strand twists, pink and cream robes, a bow with a blossom-tipped arrow',
    KD: 'a generous Black king with deep brown skin, a bald head and a grey beard, rose-gold and plum robes, holding a rose-gold coin',
    QD: 'a radiant Black queen with brown skin and a sculpted afro with rose-gold blossoms, blush and gold robes, holding a mirror framed in petals',
    JD: 'a cheerful young Black courier with brown skin and a high-top fade, pink and plum robes, carrying a pink paper lantern',
    KC: 'a wise Black elder king with dark brown skin, a long white beard and white twists, plum and charcoal robes, painting blossoms with a brush',
    QC: 'a gentle Black queen with medium-brown skin and coils in a soft updo with blossom pins, blush and sage robes, holding a cherry sprig',
    JC: 'a relaxed young Black wanderer with dark brown skin and cornrows, plum robes, a staff hung with blossoms',
    JOKER_BIG: 'a joyful Black acrobat-jester with deep brown skin cartwheeling in a pink and plum patchwork costume with long sleeves and a soft cap, scattering petals',
  },
  storm: {
    QS: 'a commanding Black queen with deep brown skin and long locs whipping in the wind, robes of black and storm violet, a closed iron fan crackling with light',
    JS: 'a young Black storm-swordsman with brown skin, cornrows and a short beard, violet and slate robes, a sword wreathed in lightning',
    KH: 'a resolute Black king with rich brown skin, two-strand twists and a full beard, violet and crimson robes, holding a scroll in the gale',
    JH: 'a young Black archer with warm brown skin and a high-top fade, violet and cyan robes, loosing an arrow of lightning',
    KD: 'a mighty Black king with deep brown skin, a bald head and a thick beard, slate and gold robes, holding a coin glowing with electric light',
    QD: 'a fierce Black queen with brown skin and an afro crowned with silver, violet and silver robes, holding a mirror flashing with lightning',
    JD: 'a grinning young Black courier with brown skin and two-strand twists, cyan and violet robes, carrying a lantern full of lightning',
    KC: 'a wise Black elder king with dark brown skin, a long white beard and white locs, slate and violet robes, holding a brush that crackles',
    QC: 'a calm Black queen with medium-brown skin and bantu knots with silver pins, violet and teal robes, holding a sprig bent by the wind',
    JC: 'a bold young Black wanderer with dark brown skin and box braids, violet and slate robes, a staff raised to the sky',
    JOKER_BIG: 'a laughing Black acrobat-jester with deep brown skin leaping in a violet and cyan patchwork costume with long sleeves and a soft cap, riding a bolt of lightning',
  },
}

Object.assign(CAST, {
  // An original family (not any existing character): joyful white-haired
  // warriors. The kings are always fully human; a separate white cloud-ape
  // spirit looms behind them as a guardian (never the person as an ape).
  cloudborn: {
    KS: 'a joyful, broad-shouldered Black king with deep brown skin, a big white cloud-like afro and a full white beard, royal purple and white robes with electric-blue details, laughing with fists raised; behind him looms a giant guardian spirit shaped like a white silverback ape made of billowing cloud',
    QH: 'a joyful Black queen with deep brown skin and a huge white cloud-like afro, royal purple and white robes with electric-blue details, laughing with her arms flung wide',
    QS: 'a mischievous Black queen with brown skin and long white locs floating upward like steam, royal purple and white robes with electric-blue details, winking, holding a closed fan',
    JS: 'a grinning young Black warrior with brown skin and white two-strand twists floating upward, royal purple and white robes with electric-blue details, leaping with a wooden sword',
    KH: 'a jolly Black king with rich brown skin, a white cloud-like beard and white twists, royal purple and white robes with electric-blue details, laughing so hard he holds his belly',
    JH: 'a young Black archer with warm brown skin and white box braids, royal purple and white robes with electric-blue details, firing an arrow that bursts into a cloud',
    KD: 'a grinning Black king with rich brown skin, white twists under a small gold crown and a white goatee, royal purple and white robes with electric-blue details, flipping a gold coin; a huge white cloud-spirit ape guardian rises behind him',
    QD: 'a radiant Black queen with brown skin and a white afro puff haloed in light, gold and royal purple and white robes with electric-blue details, blowing a puff that becomes a little cloud',
    JD: 'a cheeky young Black courier with brown skin and a white high-top fade, royal purple and white robes with electric-blue details, riding a small cloud and swinging a lantern',
    KC: 'a wise, smiling Black elder king with dark brown skin, long white locs and a long white beard, royal purple and white robes with electric-blue details, holding a calligraphy brush; a calm white cloud-spirit ape guardian sits behind him like a mountain of cloud',
    QC: 'a playful Black queen with medium-brown skin and white bantu knots, royal purple and white robes with electric-blue details, dancing on a cloud holding a sprig of white blossoms',
    JC: 'a laid-back young Black wanderer with dark brown skin and white cornrows, royal purple and white robes with electric-blue details, lounging on a cloud with a staff',
    JOKER_BIG: 'a laughing Black jester with deep brown skin and a white cloud-afro, bouncing high in a purple and white patchwork costume with blue diamonds with long sleeves and a soft cap, clouds bursting around him',
  },
  eclipse: {
    KS: 'a formidable Black king with deep brown skin, long black locs and a full beard, black and burnished-gold robes, holding a black lacquer war fan edged in gold',
    QH: 'a striking Black queen with rich brown skin and a tall braided crown with gold pins, black and crimson robes, holding a gold mask fan',
    QS: 'a mysterious Black queen with deep brown skin and a sleek high afro puff, black and gold robes, half her face in shadow, a closed fan',
    JS: 'a young Black shadow-swordsman with brown skin, cornrows and a short beard, black robes trimmed in gold, a sword catching the corona light',
    KH: 'a noble Black king with rich brown skin, salt-and-pepper twists and a beard, crimson and black robes, holding a scroll sealed in gold',
    JH: 'a young Black archer with warm brown skin and box braids, crimson and black robes, aiming a gold-tipped arrow at the eclipse',
    KD: 'a wealthy Black king with deep brown skin, a bald head and a gold-ringed beard, black and gold robes, holding a gold coin shaped like the eclipse',
    QD: 'a radiant Black queen with brown skin and an afro haloed by the corona, gold and black robes, holding a polished bronze mirror',
    JD: 'a sly young Black courier with brown skin and two-strand twists, black and gold robes, carrying a lantern glowing like the corona',
    KC: 'a wise Black elder king with dark brown skin, a long grey beard and grey locs, black and bronze robes, holding an astrolabe-like ring',
    QC: 'a calm Black queen with medium-brown skin and bantu knots with gold pins, black and deep green robes, holding a sprig of black lilies',
    JC: 'a cool young Black wanderer with dark brown skin and a high-top fade, black and gold robes, a black staff over his shoulder',
    JOKER_BIG: 'a grinning Black acrobat-jester with deep brown skin leaping across the eclipse in a black and gold patchwork costume with long sleeves and a soft cap',
  },
  aurora: {
    KS: 'a majestic Black king with deep brown skin, silver locs and a white beard, deep blue and teal robes shimmering with aurora light, holding a crystal staff',
    QH: 'a luminous Black queen with rich brown skin and long knotless braids, magenta and teal robes, raising her hand as aurora ribbons swirl',
    QS: 'a serene Black queen with deep brown skin and a coily updo with silver pins, midnight-blue and violet robes, a closed silver fan',
    JS: 'a young Black swordsman with brown skin and short twists, teal and night-blue robes, a sword reflecting green light',
    KH: 'a kind Black king with rich brown skin, two-strand twists and a beard, magenta and silver robes, reading a scroll under the lights',
    JH: 'a young Black archer with warm brown skin and cornrows, teal and magenta robes, aiming at the sky',
    KD: 'a stately Black king with deep brown skin, a bald head and a grey beard, violet and silver robes, holding a glowing crystal',
    QD: 'a radiant Black queen with brown skin and an afro dusted with snow, emerald and silver robes, holding a mirror full of aurora light',
    JD: 'a cheerful young Black courier with brown skin and a high-top fade, teal robes with a fur collar, carrying a lantern of green light',
    KC: 'a sage Black elder king with dark brown skin, a long white beard and white locs, deep blue robes, painting the aurora with a brush',
    QC: 'a gentle Black queen with medium-brown skin and bantu knots, violet and teal robes, holding a frosted pine sprig',
    JC: 'a calm young Black traveller with dark brown skin and box braids, night-blue robes and a fur hood, a staff with a small lantern',
    JOKER_BIG: 'a joyful Black acrobat-jester with deep brown skin cartwheeling through aurora ribbons in a teal and magenta patchwork costume with long sleeves and a soft cap',
  },
  starfall: {
    KS: 'a regal Black king with deep brown skin, long locs threaded with gold stars and a full beard, navy and gold robes embroidered with constellations, holding a star-tipped sceptre',
    QH: 'a celestial Black queen with rich brown skin and a braided crown dotted with tiny stars, violet and gold robes, cupping a falling star',
    QS: 'a composed Black queen with deep brown skin and a high afro with gold star pins, navy robes, a closed fan painted with constellations',
    JS: 'a young Black star-knight with brown skin, cornrows and a light beard, navy and silver robes, a sword trailing stardust',
    KH: 'a kindly Black king with rich brown skin, twists and a grey beard, violet and rose robes, reading a star chart scroll',
    JH: 'a young Black archer with warm brown skin and box braids, navy and gold robes, shooting an arrow that becomes a comet',
    KD: 'a wealthy Black king with deep brown skin, a bald head and a beard, gold and navy robes, holding a glowing star like a coin',
    QD: 'a radiant Black queen with brown skin and long locs, gold and violet robes, holding a mirror reflecting the galaxy',
    JD: 'a cheerful young Black courier with brown skin and two-strand twists, navy robes, carrying a lantern full of stars',
    KC: 'a wise Black elder king with dark brown skin, a long white beard and white twists, navy robes, drawing constellations with a brush',
    QC: 'a gentle Black queen with medium-brown skin and bantu knots with gold stars, violet robes, holding a sprig of star-shaped flowers',
    JC: 'a dreamy young Black wanderer with dark brown skin and a short afro, navy and silver robes, a staff topped with a crescent and star',
    JOKER_BIG: 'a laughing Black acrobat-jester with deep brown skin somersaulting through falling stars in a navy and gold patchwork costume with long sleeves and a soft cap',
  },
  dune: {
    KS: 'a proud Black desert king with deep brown skin, long locs tied back and a full beard, sand-gold and deep teal robes, holding a curved sword',
    QH: 'a radiant Black queen with rich brown skin and long braids wrapped with gold cuffs, terracotta and saffron robes, holding a fan of woven palm',
    QS: 'a regal Black queen with deep brown skin and a high afro wrapped in a teal scarf, teal and gold robes, a closed fan',
    JS: 'a young Black desert swordsman with brown skin, cornrows and a short beard, sand and teal robes, a curved blade raised',
    KH: 'a warm Black king with rich brown skin, two-strand twists and a beard, terracotta and gold robes, unrolling a caravan map',
    JH: 'a young Black archer with warm brown skin and box braids, saffron robes, drawing a bow against the setting sun',
    KD: 'a prosperous Black king with deep brown skin, a bald head and a grey beard, gold and teal robes, holding a gold coin',
    QD: 'a dazzling Black queen with brown skin and locs crowned with gold, saffron and gold robes, holding a polished bronze mirror',
    JD: 'a cheerful young Black caravan courier with brown skin and a high-top fade, terracotta robes, carrying a brass lantern',
    KC: 'a wise Black elder king with dark brown skin, a long white beard and white locs, sand and teal robes, writing with a reed brush',
    QC: 'a calm Black queen with medium-brown skin and bantu knots with gold rings, teal and sand robes, holding a desert-rose sprig',
    JC: 'a relaxed young Black wanderer with dark brown skin and two-strand twists, sand robes, a tall staff with a water gourd',
    JOKER_BIG: 'a joyful Black acrobat-jester with deep brown skin leaping over a dune in a saffron and teal patchwork costume with long sleeves and a soft cap, tossing a gold coin',
  },
  // Concrete Crowns: modern Tokyo and US streetwear. Men wear silver, never gold.
  shibuya: {
    QH: 'a radiant Black queen with deep brown skin and a big coily afro with a pink streak, in an oversized pastel-pink and white bomber jacket with abstract embroidered patches, wide-leg trousers and platform sneakers, a small silver crown hair clip, laughing as she flashes a peace sign',
    KS: 'a cool, broad-shouldered Black king with deep brown skin, a neat grey beard and short locs, in an oversized black techwear jacket with straps and buckles, cargo trousers and chunky sneakers, a small silver crown pendant, arms crossed under a neon-lit awning',
    QS: 'a fierce Black queen with brown skin and long black box braids under a black bucket hat, in a long black-and-cyan windbreaker over a hoodie and wide cargo trousers, holding a closed umbrella like a sword in the rain',
    JS: 'a young Black skater with brown skin, two-strand twists and a thin moustache, in a black-and-white hoodie with abstract shapes, baggy jeans and high-top sneakers, a skateboard on his shoulder',
    KH: 'a warm Black king with rich brown skin, a full salt-and-pepper beard and a knit beanie, in a quilted burgundy-and-cream coach jacket over a turtleneck, holding a steaming paper cup of tea under neon lights',
    JH: 'a young Black dancer with warm brown skin and cornrows, in a red and white track jacket, loose track trousers and sneakers, frozen mid-breakdance on one hand',
    KD: 'a sharp Black king with deep brown skin, a bald head and a sculpted white beard, in a cream varsity-style jacket with a silver crown patch, tailored joggers and pristine white sneakers, flipping a silver coin',
    QD: 'a stylish Black queen with brown skin and a sleek high puff with silver pins, in an oversized holographic lilac-and-cyan puffer jacket and wide trousers, holding up a glowing phone like a mirror',
    JD: 'a cheerful young Black bike courier with brown skin and a high-top fade, in a neon-yellow and black utility jacket with reflective stripes, riding a fixed-gear bicycle with a bright headlamp',
    KC: 'a wise Black elder king with dark brown skin, long grey locs tied back and a long grey beard, in a long olive kimono-cut coat over a black hoodie and wide trousers, holding a small bonsai tree',
    QC: 'a calm Black queen with medium-brown skin and bantu knots, in a mint-green oversized cardigan over a white tee, a long pleated skirt and chunky sneakers, sketching in a sketchbook',
    JC: 'a laid-back young Black film-camera fan with dark brown skin and a short afro, in a camo cargo jacket and bucket hat, raising a film camera',
    JOKER_BIG: 'a laughing Black street-performer jester with deep brown skin mid-backflip, in a magenta, cyan and black patchwork hoodie and trousers with long sleeves and a soft jester beanie, neon light trails around him',
    JOKER_SMALL: 'a grinning young Black kid-jester with brown skin and twists popping a wheelie on a skateboard, in a cyan and black patchwork tracksuit with a soft jester beanie',
  },
  uptown: {
    QH: 'a radiant Black queen with deep brown skin and a big natural afro with a silver headband, in a burgundy puffer jacket over a long cream hoodie, wide-leg denim and fresh white sneakers, laughing on a brownstone stoop',
    KS: 'a commanding Black king with deep brown skin, a full black beard and a black durag, in a black leather varsity jacket with a silver crown patch, black jeans and boots, leaning on a fire-escape rail',
    QS: 'a confident Black queen with brown skin and long knotless braids, in a long black shearling coat over a charcoal hoodie, wide trousers and boots, arms folded in front of a mural',
    JS: 'a young Black baller with brown skin, cornrows and a light beard, in an oversized black and white basketball warm-up jacket and joggers, spinning a basketball on one finger',
    KH: 'a kindly Black king with rich brown skin, a grey beard and short waves, in a burgundy cardigan over a crisp white tee, cream trousers and loafers, carrying a paper bag of fresh fruit from the corner store',
    JH: 'a young Black muralist with warm brown skin and two-strand twists, in a paint-splattered denim jacket and work pants, spray-painting a colourful abstract mural with no letters',
    KD: 'a stylish Black king with deep brown skin, a bald head and a silver beard, in a camel overcoat over an olive hoodie, tailored trousers and suede sneakers, lifting the lid off a box of pristine white sneakers',
    QD: 'a dazzling Black queen with brown skin and a sculpted twist-out, in a metallic silver puffer coat over an olive tracksuit and white sneakers, holding a sparkling cut diamond up to the light',
    JD: 'a cheerful young Black sneaker runner with brown skin and a high-top fade, in a bright olive windbreaker and cargo pants, balancing a tall stack of sneaker boxes',
    KC: 'a wise Black elder king with dark brown skin, white locs and a long white beard, in a tweed flat cap and an olive chore coat over a cream knit sweater, sitting on a park bench with a cane topped by a silver crown',
    QC: 'a gentle Black queen with medium-brown skin and locs wrapped in an olive headwrap, in a long denim coat over a cream knit dress and sneakers, carrying sunflowers from a street flower stand',
    JC: 'a relaxed young Black rider with dark brown skin and a short afro under a fitted cap, in a navy and cream tracksuit, sitting on a BMX bike',
    JOKER_BIG: 'a laughing Black street-dancer jester with deep brown skin mid-spin, in a burgundy, olive and cream patchwork tracksuit with long sleeves and a soft jester beanie with pom-poms',
    JOKER_SMALL: 'a grinning young Black kid-jester with brown skin and twists doing a handstand on a basketball, in a cream and burgundy patchwork hoodie and a soft jester beanie',
  },
  // Capes & Chaos: original heroes and villains (no existing comic characters,
  // logos or costumes). Faces stay human; no monsters, no gods, no magic.
  heroes: {
    QH: 'a heroic Black queen with deep brown skin and a big natural afro, in a modest armoured royal-blue and white hero suit with a long flowing silver-lined cape and an abstract glowing heart crest, raising a shimmering force-field shield of light with one hand, smiling with confidence',
    KS: 'a towering, immensely muscular Black hero with deep brown skin, a grey beard and a shaved head, in a battle-worn armoured navy and emerald combat suit, emerald energy crackling around his huge fists as he lifts a broken steel girder; fully human, noble and determined',
    QS: 'a fearless Black queen with brown skin and long box braids, in a modest midnight-blue armoured hero suit with a long dark coat, landing in a crouch with two glowing energy batons',
    JS: 'an agile young Black hero with brown skin and two-strand twists, in a sleek charcoal and electric-teal suit with a hexagon texture and his mask pushed up onto his forehead, swinging between rooftops on a glowing grapple line, grinning',
    KH: 'a noble Black hero-king with rich brown skin and a full white beard, in silver plate armour with a deep blue cape, lightning crackling from his raised armoured gauntlets as storm clouds gather',
    JH: 'a young Black speedster with warm brown skin and cornrows, in a crimson and white aerodynamic suit, racing forward trailing streaks of golden lightning',
    KD: 'a brilliant Black inventor-hero with deep brown skin, a silver goatee and glasses, in sleek white and silver power armour with the helmet retracted and a glowing blue core in the chest plate, studying a holographic blueprint',
    QD: 'a radiant Black queen with brown skin and a high afro puff, in a modest white and sunburst-orange hero suit with a long cape, glowing with sunlight as she soars upward',
    JD: 'a cheerful young Black hero with brown skin and a high-top fade, in a yellow and navy suit with a domino mask, flying on glowing hover-boots',
    KC: 'a wise Black elder hero with dark brown skin, white locs and a long white beard, in an olive and bronze armoured coat, standing guard with a tall bronze kite shield',
    QC: 'a serene Black queen with medium-brown skin and bantu knots, in a forest-green and silver hero suit with a long hooded cloak, ribbons of glowing green energy flowing from her hands to heal a city tree',
    JC: 'a laid-back young Black street hero with dark brown skin and a short afro, in a grey and orange armoured hoodie suit with heavy gloves, perched on a rooftop water tower',
    JOKER_BIG: 'a laughing Black trickster hero with deep brown skin mid-somersault, in a blue, red and white patchwork hero suit with long sleeves, a domino mask and a soft jester hood, bouncing off a glowing energy disc',
    JOKER_SMALL: 'a grinning young Black sidekick with brown skin and twists mid-flip, in a blue and yellow patchwork hero suit with a soft jester hood and a little cape',
  },
  villains: {
    QH: 'a menacing but elegant Black villain queen with deep brown skin and a big natural afro streaked with crimson, in a modest armoured suit of glossy living black liquid metal with crimson veins and a long high-collared coat, black tendrils rippling from her shoulders, smiling coldly',
    KS: 'a towering Black villain king with deep brown skin and a black beard, wrapped in glossy living black liquid armour that ripples into spikes and tendrils across his shoulders, the smooth black mask half-retracted to show his human face and a cold grin',
    QS: 'a cunning Black villain queen with brown skin and long knotless braids, in a black and violet armoured coat, holding two glowing toxic-green flasks as green smoke curls around her',
    JS: 'a wild young Black villain with brown skin and twists, wrapped in living crimson liquid armour that whips out into chaotic red tendrils, the mask pulled back to show a reckless grin',
    KH: 'a cold Black villain king with rich brown skin and a white beard, in ice-blue and black cryo-armour with frost venting from his gauntlets, freezing the street around him',
    JH: 'a young Black cat-burglar with warm brown skin and cornrows, in a black and crimson stealth suit, crouched on a ledge holding a glowing red gem',
    KD: 'a ruthless Black tycoon-villain with deep brown skin, a bald head and a silver beard, in a black armoured suit with a purple-lined cape, levitating shards of metal with magnetic energy',
    QD: 'a dazzling Black villain queen with brown skin and a crimson-tipped afro puff, in a modest black and purple armoured long coat, commanding a swarm of glowing red drones',
    JD: 'a reckless young Black villain with brown skin and a high-top fade, in a toxic-green and black hazard suit with a gas mask pulled down, riding a smoking hover-bike',
    KC: 'a grim Black warlord villain with dark brown skin, grey locs and a long grey beard, in heavy black iron armour with a tattered crimson cape, gripping a giant chained gauntlet',
    QC: 'a sinister Black villain queen with medium-brown skin and bantu knots, in a deep-purple armoured coat, black shadows rising from the ground like smoke at her command',
    JC: 'a brooding young Black villain with dark brown skin and a short afro, in a black hooded armoured jacket with glowing red seams, red energy crackling in his fist',
    JOKER_BIG: 'a cackling Black trickster villain with deep brown skin mid-leap, in a black and crimson harlequin-pattern long coat with long sleeves and a cracked porcelain half-mask pushed up on his head, juggling glowing red orbs',
    JOKER_SMALL: 'a mischievous young Black villain imp with brown skin and twists cartwheeling, in a black and toxic-green patchwork suit with a soft jester hood, trailing green smoke',
  },
})

const CLASSIC = {
  KS: 'a regal Black king with deep brown skin and a full beard, navy, scarlet and gold robes, a sword held upright',
  QS: 'a regal Black queen with deep brown skin and long braids under a small crown, navy and gold robes, holding a closed fan',
  JS: 'a young Black page with brown skin and short locs, navy and scarlet robes, holding a halberd',
  KH: 'a kindly Black king with rich brown skin, two-strand twists and a full beard, scarlet and gold robes, holding a sword behind his head',
  QH: 'a regal Black queen with deep brown skin and a braided crown of hair under a small gold crown, scarlet and navy robes, holding a single flower',
  JH: 'a young Black page with warm brown skin and cornrows, scarlet and gold robes, holding a feather',
  KD: 'a stately Black king with deep brown skin and a trimmed beard, gold and scarlet robes, holding an axe',
  QD: 'a regal Black queen with brown skin and an afro under a small crown, gold and navy robes, holding a flower',
  JD: 'a young Black page with brown skin and a high-top fade, gold and navy robes, holding a scroll',
  KC: 'a wise Black king with dark brown skin and a long grey beard, navy and gold robes, holding an orb',
  QC: 'a regal Black queen with medium-brown skin and bantu knots under a small crown, navy and scarlet robes, holding a flower',
  JC: 'a young Black page with dark brown skin and box braids, scarlet and navy robes, holding an arrow',
}

const FULL = (who, look, world, title, joker, modern) =>
  `Playing-card center art, ${title}: ${who}${joker || modern ? '' : ', in layered Japanese court robes'}; around them ${world}. ${look}, same finish and quality as the reference card but a different person, pose and composition. Half-length heraldic portrait, face in the upper third. Fully clothed, modest. No text, letters, numbers or border.`

const NAME = { K: 'King', Q: 'Queen', J: 'Jack' }
const SUIT = { S: 'Spades', H: 'Hearts', D: 'Diamonds', C: 'Clubs' }

function familyItems(fam) {
  if (fam === 'classic') {
    return Object.entries(CLASSIC).map(([card, who]) => ({
      name: `classic_${card}`,
      model: 'gpt-image-2.6',
      settings: { aspectRatio: '3:4', quality: 'high' },
      references: [`${ART}/classic_QH.png`],
      prompt: `Upper half of a premium classic playing-card court figure, ${NAME[card[0]]} of ${SUIT[card[1]]}: ${who}. Bust from the chest up filling the frame, as on a traditional double-ended court card (only the top figure, no mirrored copy). Bold flat colours with crisp black outlines and luxury engraved line work like the reference, ivory card stock, fine gold-foil details. No text, no letters, no numbers, no border.`,
    }))
  }
  const s = STYLE[fam]
  const anchorsDone = fs.existsSync(`${ART}/${fam}_QH.png`)
  const cap = fam[0].toUpperCase() + fam.slice(1)
  return Object.entries(CAST[fam])
    .filter(([card]) => (process.argv[3] === 'anchors' ? ['KS', 'QH'].includes(card) : process.argv[3] === 'qh' ? card === 'QH' : process.argv[3] === 'rest' ? card !== 'QH' : !['KS', 'QH'].includes(card) || !anchorsDone))
    .map(([card, who]) => ({
      name: `${fam}_${card}`,
      model: 'gpt-image-2.6',
      settings: { aspectRatio: '3:4', quality: 'high' },
      ...(anchorsDone ? { references: [`${ART}/${fam}_QH.png`] } : {}),
      prompt: FULL(who, s.look, s.world, card === 'JOKER_BIG' ? 'the Big Joker' : card === 'JOKER_SMALL' ? 'the Little Joker' : `${NAME[card[0]]} of ${SUIT[card[1]]} of the ${cap} deck`, card.startsWith('JOKER'), s.modern),
    }))
}

const fam = process.argv[2]
if (fam === 'extras') {
  const items = []
  for (const f of ['moon', 'ember', 'tide', 'frost', 'jade', 'bloom', 'storm', 'eclipse', 'aurora', 'starfall', 'dune', 'cloudborn']) {
    const s = STYLE[f]
    items.push({
      name: `${f}_JOKER_SMALL`,
      model: 'gpt-image-2.6',
      settings: { aspectRatio: '3:4', quality: 'high' },
      references: [`${ART}/${f}_QH.png`],
      prompt: `Premium playing-card center art, the Little Joker: a nimble young Black acrobat-jester with brown skin and a big grin, mid-cartwheel in a patchwork jester costume with long sleeves and a soft cap in this family's palette. Around them: ${s.world}. Style: ${s.look}, matching the reference card's rendering. Fully clothed. No text, no letters, no numbers, no card corners, no border.`,
    })
  }
  items.push({
    name: 'classic_JOKER',
    model: 'gpt-image-2.6',
    settings: { aspectRatio: '3:4', quality: 'high' },
    references: [`${ART}/classic_QH.png`],
    prompt: 'Premium classic playing-card Joker: a joyful young Black jester with brown skin in a scarlet, navy and gold harlequin costume with long sleeves and a belled cap, juggling, full figure. Bold flat colours with crisp black outlines and luxury engraved line work like the reference, ivory card stock with gold-foil details. No text, no letters, no numbers, no border.',
  })
  console.log(JSON.stringify(items))
} else if (fam === 'aces') {
  const ACE = {
    sun: 'a hammered gold-leaf sun disc with fine rays, the spade inset in black lacquer at its center',
    moon: 'a silver crescent moon cradling the spade, night clouds and stars, silver leaf on indigo',
    ember: 'the spade forged from glowing molten metal, flames curling up its edges, sparks rising',
    tide: 'the spade formed by a curling sapphire wave with sea foam, a pearl at its heart',
    frost: 'the spade carved from clear blue ice with frost crystals spreading out, snowflakes',
    jade: 'the spade carved from polished jade, wrapped by a gold pine branch and bamboo leaves',
    bloom: 'the spade made of cherry blossoms and rose-gold filigree, petals drifting',
    storm: 'the spade crackling with violet and cyan lightning inside a ring of storm clouds',
    classic: 'a classic ornate engraved spade with gold-foil scrollwork and a small crown, like the Ace of Spades of a luxury traditional deck',
    eclipse: 'a black spade eclipsing a blazing gold corona, gold leaf on black',
    aurora: 'the spade glowing with rippling teal and magenta aurora light, silver outline, snowy night',
    starfall: 'the spade made of a gold constellation of stars on deep navy, a shooting star across it',
    dune: 'the spade of polished brass engraved with geometric patterns, rising over golden dunes',
    cloudborn: 'the spade formed from a billowing white storm cloud with violet and electric-blue lightning crackling through it, a warm gold sunburst glowing behind it',
    shibuya: 'the spade built from glowing magenta and cyan neon tubes with chrome fittings, a soft neon haze around it',
    uptown: 'the spade as a bold mural-style emblem in burgundy, olive and cream with a small silver crown on top and a few spray-paint drips',
    heroes: 'the spade as a bold comic-book emblem in royal blue and white with a crimson action burst behind it, halftone dots and speed lines',
    villains: 'the spade made of glossy living black liquid armour with glowing crimson veins, thin tendrils curling off its edges',
  }
  console.log(
    JSON.stringify(
      Object.entries(ACE).map(([f, d]) => ({
        name: `${f}_AS`,
        model: 'gpt-image-2.6',
        settings: { aspectRatio: '3:4', quality: 'high' },
        prompt: `Centerpiece art for the Ace of Spades of a premium deck: one large, ornate spade emblem, centered, ${d}. Symmetrical, iconic, on a plain light paper background with generous empty margin around the emblem. No text, no letters, no numbers, no card corners, no border.`,
      }))
    )
  )
} else {
  console.log(JSON.stringify(familyItems(fam)))
}

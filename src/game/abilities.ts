export interface Spell {
  name: string;
  level: number; // 0 = cantrip
  school: string;
  castingTime: string;
  range: string;
  duration: string;
  components: string;
  description: string;
}

export interface ClassFeature {
  name: string;
  level: number;
  description: string;
  usesPerRest?: string;
  tags?: string[];
}

// ── Class Features ────────────────────────────────────────────────────────

export const CLASS_FEATURES: Record<string, ClassFeature[]> = {
  barbarian: [
    { level:1,  name:"Rage",               usesPerRest:"2/long rest (more at higher levels)", tags:["combat"],
      description:"Bonus action. +2 damage on STR attacks, resistance to bludgeoning/piercing/slashing. Lasts 1 min. Ends if you don't attack or take damage. Can't cast/concentrate spells." },
    { level:1,  name:"Unarmored Defense",  tags:["passive"],
      description:"While not wearing armor: AC = 10 + DEX mod + CON mod. Can use shield." },
    { level:2,  name:"Reckless Attack",    tags:["combat"],
      description:"On your first attack each turn: gain advantage on all STR-based attacks this turn. Enemies also have advantage on attacks against you until your next turn." },
    { level:2,  name:"Danger Sense",       tags:["passive"],
      description:"Advantage on DEX saving throws against effects you can see (traps, spells, etc.). Not if blinded/deafened/incapacitated." },
    { level:5,  name:"Extra Attack",       tags:["combat"],
      description:"You can attack twice whenever you take the Attack action." },
    { level:5,  name:"Fast Movement",      tags:["passive"],
      description:"+10 ft movement speed when not wearing heavy armor." },
    { level:7,  name:"Feral Instinct",     tags:["passive"],
      description:"Advantage on Initiative rolls. Can enter Rage to act normally if surprised (can't be surprised while raging)." },
    { level:9,  name:"Brutal Critical",    tags:["combat"],
      description:"Roll 1 extra weapon damage die on a critical hit. (2 extra at 13th, 3 extra at 17th.)" },
    { level:11, name:"Relentless Rage",    tags:["combat"],
      description:"If you drop to 0 HP while raging, make DC 10 CON save to drop to 1 HP instead. DC increases by 5 each use per rest." },
  ],

  fighter: [
    { level:1,  name:"Fighting Style",     tags:["passive"],
      description:"Choose one: Archery (+2 ranged attack rolls), Defense (+1 AC in armor), Dueling (+2 melee damage with one-handed weapon + free hand), Great Weapon Fighting (reroll 1s/2s on two-handed weapons), Protection (use reaction + shield to give attacker disadvantage), Two-Weapon Fighting (add stat modifier to off-hand attacks)." },
    { level:1,  name:"Second Wind",        usesPerRest:"1/short rest", tags:["healing"],
      description:"Bonus action: regain 1d10 + fighter level HP." },
    { level:2,  name:"Action Surge",       usesPerRest:"1/short rest (2 uses at 17th)", tags:["combat"],
      description:"Take one additional action on your turn. Not another Action Surge." },
    { level:5,  name:"Extra Attack",       tags:["combat"],
      description:"Attack twice per Attack action. (3 times at 11th, 4 at 20th.)" },
    { level:9,  name:"Indomitable",        usesPerRest:"1/long rest (2 at 13th, 3 at 17th)", tags:["defense"],
      description:"Reroll a failed saving throw. Must use the new roll." },
    { level:11, name:"Extra Attack (3×)",  tags:["combat"],
      description:"Attack three times per Attack action." },
  ],

  rogue: [
    { level:1,  name:"Expertise",          tags:["passive"],
      description:"Choose 2 proficient skills (or 1 skill + thieves' tools). Double your proficiency bonus for those checks." },
    { level:1,  name:"Sneak Attack",       tags:["combat"],
      description:"Once per turn, deal extra damage if you have advantage on the attack OR an ally is adjacent to the target (not disadvantage). 1d6 at L1, +1d6 every 2 levels. Works with finesse and ranged weapons." },
    { level:1,  name:"Thieves' Cant",      tags:["utility"],
      description:"Secret language known by rogues. Can hide messages in normal conversation." },
    { level:2,  name:"Cunning Action",     tags:["combat","utility"],
      description:"Bonus action each turn: Dash, Disengage, or Hide." },
    { level:5,  name:"Uncanny Dodge",      tags:["defense"],
      description:"Reaction: when an attacker you can see hits you, halve the damage from that attack." },
    { level:6,  name:"Expertise (2 more)", tags:["passive"],
      description:"Double proficiency on 2 more proficient skills." },
    { level:7,  name:"Evasion",            tags:["defense"],
      description:"DEX saving throws vs area effects: success = no damage. Failure = half damage. (Must not be incapacitated.)" },
    { level:11, name:"Reliable Talent",    tags:["passive"],
      description:"When you roll for something you're proficient in, treat any roll below 10 as a 10." },
  ],

  wizard: [
    { level:1,  name:"Arcane Recovery",    usesPerRest:"1/long rest", tags:["spell"],
      description:"After a short rest, recover spell slots totalling up to half your wizard level (rounded up). Can't recover slots of 6th level or higher." },
    { level:18, name:"Spell Mastery",      tags:["spell"],
      description:"Choose one 1st-level and one 2nd-level spell in your spellbook. Can cast them at their lowest level without using a spell slot." },
    { level:20, name:"Signature Spells",   tags:["spell"],
      description:"Choose 2 wizard spells of 3rd level or lower. Can cast each once per short rest without a spell slot." },
  ],

  cleric: [
    { level:2,  name:"Channel Divinity",   usesPerRest:"1/short rest (2 at 6th, 3 at 18th)", tags:["divine","combat"],
      description:"Turn Undead: each undead within 30ft that can see/hear you must make WIS save or be turned for 1 min. Turned undead must flee. Additional uses depend on Divine Domain." },
    { level:5,  name:"Destroy Undead",     tags:["divine","combat"],
      description:"Turned undead of CR ≤ 1/2 are instantly destroyed. Threshold increases at higher levels (CR ≤ 1 at 8th, ≤ 2 at 11th, ≤ 3 at 14th, ≤ 4 at 17th)." },
    { level:10, name:"Divine Intervention",usesPerRest:"1/long rest", tags:["divine"],
      description:"Call on your deity for aid. Roll percentile dice — if result ≤ cleric level, deity intervenes (DM decides effect). At 20th level, succeeds automatically." },
  ],

  druid: [
    { level:2,  name:"Wild Shape",         usesPerRest:"2/short rest", tags:["transformation"],
      description:"Action: transform into a beast you've seen. CR ≤ 1/4 (no fly/swim at L2), CR ≤ 1/2 (swim) at L4, CR ≤ 1 at L8. Keep Int/Wis/Cha. Use beast HP pool. Can't cast spells (unless Moon druid). Lasts 1 hr or until dropped to 0 HP (excess damage carries over)." },
    { level:18, name:"Timeless Body",      tags:["passive"],
      description:"Age 10× slower. Immune to magical aging effects." },
    { level:18, name:"Beast Spells",       tags:["spell"],
      description:"Can cast druid spells while Wild Shaped (as long as the spell has V or S components the beast form can produce)." },
  ],

  paladin: [
    { level:1,  name:"Divine Sense",       usesPerRest:"CHA mod + 1 / long rest", tags:["utility"],
      description:"Action: know location of any celestial, fiend, or undead within 60ft that isn't behind total cover until end of your next turn. Also detect consecrated/desecrated locations." },
    { level:1,  name:"Lay on Hands",       usesPerRest:"5 × paladin level HP pool / long rest", tags:["healing"],
      description:"Touch a creature to restore HP from your pool (any amount). Or expend 5 HP to cure one disease or neutralize one poison. No effect on undead/constructs." },
    { level:2,  name:"Divine Smite",       tags:["combat","spell"],
      description:"When you hit with a melee weapon, expend a spell slot to deal +2d8 radiant damage (+1d8 per slot level above 1st, max +5d8). +1d8 extra vs undead/fiends." },
    { level:2,  name:"Fighting Style",     tags:["passive"],
      description:"Choose: Defense (+1 AC), Dueling (+2 damage one-handed), Great Weapon Fighting (reroll 1s/2s), or Protection (reaction to impose disadvantage on attacker)." },
    { level:5,  name:"Extra Attack",       tags:["combat"],
      description:"Attack twice per Attack action." },
    { level:6,  name:"Aura of Protection", tags:["aura","passive"],
      description:"While conscious, you and friendly creatures within 10ft add your CHA modifier (min +1) to saving throws. 30ft at 18th level." },
    { level:10, name:"Aura of Courage",    tags:["aura","passive"],
      description:"While conscious, you and friendly creatures within 10ft can't be frightened. 30ft at 18th level." },
    { level:11, name:"Improved Divine Smite", tags:["passive","combat"],
      description:"Melee weapon hits deal an extra 1d8 radiant damage automatically (stacks with Divine Smite)." },
  ],

  ranger: [
    { level:1,  name:"Favored Enemy",      tags:["passive","utility"],
      description:"Choose a creature type (or 2 humanoid races). Advantage on Survival checks to track them, INT checks to recall info about them. +1 more at 6th and 14th." },
    { level:1,  name:"Natural Explorer",   tags:["passive","utility"],
      description:"Choose a favored terrain. Doubled proficiency for INT/WIS checks in that terrain, difficult terrain doesn't slow you, advantage to hide, always forage, never lost, extra benefits while tracking." },
    { level:2,  name:"Fighting Style",     tags:["passive"],
      description:"Choose: Archery (+2 ranged attacks), Defense (+1 AC), Dueling (+2 damage), or Two-Weapon Fighting (add stat mod to off-hand attacks)." },
    { level:5,  name:"Extra Attack",       tags:["combat"],
      description:"Attack twice per Attack action." },
    { level:8,  name:"Land's Stride",      tags:["passive"],
      description:"Moving through nonmagical difficult terrain costs no extra movement. Advantage on saves vs plants that impede movement (entangle, etc.)." },
    { level:10, name:"Hide in Plain Sight", tags:["utility"],
      description:"Spend 1 min camouflaging yourself. +10 to Stealth checks to hide, as long as you remain still. Penalty: can't move." },
    { level:14, name:"Vanish",             tags:["utility"],
      description:"Bonus action to Hide. Can't be tracked by nonmagical means." },
  ],

  bard: [
    { level:1,  name:"Bardic Inspiration", usesPerRest:"CHA mod / long rest (short rest at 5th)", tags:["support","combat"],
      description:"Bonus action: give a creature within 60ft that can hear you a Bardic Inspiration die (d6, becomes d8 at 5th, d10 at 10th, d12 at 15th). They can add it to one ability check, attack roll, or saving throw within 10 minutes. Only one die at a time." },
    { level:2,  name:"Jack of All Trades", tags:["passive"],
      description:"Add half your proficiency bonus (round down) to any ability check you aren't already proficient in." },
    { level:2,  name:"Song of Rest",       tags:["healing"],
      description:"If you perform during a short rest, allies who use Hit Dice regain extra HP: +1d6 (L2), +1d8 (L9), +1d10 (L13), +1d12 (L17)." },
    { level:3,  name:"Expertise",          tags:["passive"],
      description:"Double proficiency on 2 proficient skills. 2 more at 10th level." },
    { level:6,  name:"Countercharm",       tags:["support"],
      description:"Action: start a performance. Until end of your next turn, friendly creatures within 30ft that can hear you have advantage on saves vs frightened and charmed." },
    { level:10, name:"Magical Secrets",    tags:["spell"],
      description:"Learn 2 spells from any class spell list. They count as bard spells for you. 2 more at 14th, 2 more at 18th." },
    { level:20, name:"Superior Inspiration", tags:["passive"],
      description:"If you have no Bardic Inspiration dice when you roll Initiative, you regain 1." },
  ],

  sorcerer: [
    { level:2,  name:"Font of Magic",      tags:["spell"],
      description:"You have sorcery points equal to your sorcerer level. Regain all on long rest." },
    { level:2,  name:"Flexible Casting",   tags:["spell"],
      description:"Convert sorcery points → spell slots (1pt=1st, 2pt=2nd, 3pt=3rd, 4pt=4th, 5pt=5th) or spell slots → sorcery points (slot level in points). Once per turn." },
    { level:3,  name:"Metamagic",          tags:["spell"],
      description:"Choose 2 Metamagic options (4 total at 17th): Careful (spend 1pt, up to CHA mod creatures auto-succeed CON save), Distant (2×range or 5ft→30ft), Empowered (spend 1pt, reroll up to CHA mod damage dice), Extended (1pt, 2× duration), Heightened (3pt, one target has disadvantage on first save), Quickened (2pt, cast 1-action spell as bonus action), Subtle (1pt, no V/S components needed), Twinned (1pt×spell level, target 2 creatures with single-target spell)." },
    { level:20, name:"Sorcerous Restoration", tags:["spell"],
      description:"Regain 4 expended sorcery points at start of each turn (if you have fewer than 4)." },
  ],

  warlock: [
    { level:1,  name:"Pact Magic",         tags:["spell"],
      description:"Spell slots recharge on short rest. All slots are the same level (1st at L1, 2nd at L3, 3rd at L5, 4th at L7, 5th at L9). At 11th level: 1 slot of 6th level, etc." },
    { level:2,  name:"Eldritch Invocations", tags:["passive","spell"],
      description:"Choose 2 invocations (more at higher levels). Common: Agonizing Blast (+CHA to Eldritch Blast damage), Devil's Sight (see in magical darkness 120ft), Mask of Many Faces (cast Disguise Self at will), Misty Visions (Minor Illusion at will), Repelling Blast (push target 10ft on Eldritch Blast hit)." },
    { level:3,  name:"Pact Boon",          tags:["passive"],
      description:"Pact of the Chain: familiar with special abilities. Pact of the Blade: create a magical weapon (bond with it, can summon/dismiss). Pact of the Tome: Book of Shadows with 3 cantrips from any list." },
    { level:9,  name:"Mystic Arcanum",     usesPerRest:"1 each / long rest", tags:["spell"],
      description:"Cast one 6th-level spell without a spell slot. Gain 7th at 13th, 8th at 15th, 9th at 17th." },
    { level:20, name:"Eldritch Master",    usesPerRest:"1/long rest", tags:["spell"],
      description:"Spend 1 minute persuading your patron to regain all expended Pact Magic slots." },
  ],

  monk: [
    { level:1,  name:"Unarmored Defense",  tags:["passive"],
      description:"While not wearing armor or shield: AC = 10 + DEX mod + WIS mod." },
    { level:1,  name:"Martial Arts",       tags:["combat","passive"],
      description:"When using monk weapons or unarmed strikes: use DEX instead of STR. Unarmed strike die: d4 (L1-4), d6 (L5-10), d8 (L11-16), d10 (L17+). Bonus action unarmed strike after attacking with monk weapon or unarmed." },
    { level:2,  name:"Ki",                 usesPerRest:"Level points / short rest", tags:["combat","utility"],
      description:"Ki points = monk level. Flurry of Blows (1pt bonus action: 2 unarmed strikes), Patient Defense (1pt bonus action: Dodge), Step of the Wind (1pt bonus action: Disengage or Dash, jump distance doubled)." },
    { level:2,  name:"Unarmored Movement", tags:["passive"],
      description:"+10ft speed (increases to +15 at L6, +20 at L10, +25 at L14, +30 at L18)." },
    { level:3,  name:"Deflect Missiles",   tags:["defense"],
      description:"Reaction when hit by ranged weapon attack: reduce damage by 1d10 + DEX mod + monk level. If reduced to 0, catch the missile and throw it (ranged attack, 20/60ft, uses ki cost if a ki-empowered weapon)." },
    { level:4,  name:"Slow Fall",          tags:["defense"],
      description:"Reaction: reduce falling damage by 5× monk level." },
    { level:5,  name:"Extra Attack",       tags:["combat"],
      description:"Attack twice per Attack action." },
    { level:5,  name:"Stunning Strike",    usesPerRest:"1 Ki per use", tags:["combat"],
      description:"When you hit with a melee weapon attack, spend 1 ki. Target makes CON save (DC = 8 + prof + WIS mod) or is stunned until end of your next turn." },
    { level:6,  name:"Ki-Empowered Strikes", tags:["passive","combat"],
      description:"Unarmed strikes count as magical for overcoming resistance/immunity." },
    { level:7,  name:"Evasion",            tags:["defense"],
      description:"DEX saving throws vs area effects: success = no damage. Failure = half damage." },
    { level:7,  name:"Stillness of Mind",  tags:["utility"],
      description:"Action: end one effect on yourself that causes charm or fright." },
    { level:10, name:"Purity of Body",     tags:["passive"],
      description:"Immune to disease and poison." },
  ],
};

// ── Spells ─────────────────────────────────────────────────────────────────

const WIZARD_SPELLS: Spell[] = [
  // Cantrips
  { level:0, name:"Fire Bolt",        school:"Evocation",     castingTime:"1 action", range:"120ft", duration:"Instant", components:"V, S",    description:"Ranged spell attack. 1d10 fire damage (2d10 at 5th, 3d10 at 11th, 4d10 at 17th). Ignites flammable objects." },
  { level:0, name:"Ray of Frost",     school:"Evocation",     castingTime:"1 action", range:"60ft",  duration:"Instant", components:"V, S",    description:"Ranged spell attack. 1d8 cold damage, target's speed -10ft until start of your next turn." },
  { level:0, name:"Shocking Grasp",   school:"Evocation",     castingTime:"1 action", range:"Touch", duration:"Instant", components:"V, S",    description:"Melee spell attack (advantage if target wears metal armor). 1d8 lightning damage. Target can't take reactions until its next turn." },
  { level:0, name:"Mage Hand",        school:"Conjuration",   castingTime:"1 action", range:"30ft",  duration:"1 min",   components:"V, S",    description:"Spectral hand that can manipulate objects up to 10 lb, open doors, stow items, etc. Can't attack." },
  { level:0, name:"Minor Illusion",   school:"Illusion",      castingTime:"1 action", range:"30ft",  duration:"1 min",   components:"S, M",    description:"Create a sound or image. Sound: volume from whisper to scream. Image: object ≤5ft cube, no movement. Investigation check vs spell DC to disbelieve." },
  { level:0, name:"Prestidigitation", school:"Transmutation", castingTime:"1 action", range:"10ft",  duration:"Up to 1hr",components:"V, S",   description:"Minor magical tricks: create tiny effects, clean/soil, chill/warm/flavor, make symbol/mark, create small sensory effect. Up to 3 active effects." },
  { level:0, name:"Poison Spray",     school:"Conjuration",   castingTime:"1 action", range:"10ft",  duration:"Instant", components:"V, S",    description:"Target makes CON save or takes 1d12 poison damage (2d12 at 5th, 3d12 at 11th, 4d12 at 17th)." },
  { level:0, name:"Chill Touch",      school:"Necromancy",    castingTime:"1 action", range:"120ft", duration:"1 round", components:"V, S",    description:"Ranged spell attack. 1d8 necrotic damage, target can't regain HP until start of your next turn. Undead also have disadvantage on attacks against you." },
  // 1st Level
  { level:1, name:"Magic Missile",    school:"Evocation",     castingTime:"1 action", range:"120ft", duration:"Instant", components:"V, S",    description:"3 darts, each deals 1d4+1 force damage. Auto-hit. +1 dart per slot level above 1st." },
  { level:1, name:"Shield",           school:"Abjuration",    castingTime:"Reaction", range:"Self",  duration:"1 round", components:"V, S",    description:"Reaction (triggered by being hit or targeted by Magic Missile). +5 AC including triggering attack. Immune to Magic Missile." },
  { level:1, name:"Mage Armor",       school:"Abjuration",    castingTime:"1 action", range:"Touch", duration:"8 hrs",  components:"V, S, M", description:"Target not wearing armor: AC = 13 + DEX mod. Lasts 8 hours or until target dons armor." },
  { level:1, name:"Thunderwave",      school:"Evocation",     castingTime:"1 action", range:"Self (15ft cube)", duration:"Instant", components:"V, S", description:"CON save. Fail: 2d8 thunder damage + pushed 10ft. Success: half damage, not pushed. Unsecured objects pushed. +1d8 per slot level above 1st." },
  { level:1, name:"Sleep",            school:"Enchantment",   castingTime:"1 action", range:"90ft",  duration:"1 min",  components:"V, S, M", description:"Roll 5d8 — total HP of creatures affected (lowest HP first, must be within 20ft sphere). Unconscious until takes damage or shaken awake. +2d8 per slot level above 1st." },
  { level:1, name:"Charm Person",     school:"Enchantment",   castingTime:"1 action", range:"30ft",  duration:"1 hr",   components:"V, S",    description:"WIS save (advantage if in combat with you). Charmed: regards you as friendly. Aware of charm after it ends. +1 creature per slot level above 1st." },
  { level:1, name:"Detect Magic",     school:"Divination",    castingTime:"1 action", range:"Self",  duration:"Conc 10min",components:"V, S",  description:"Sense magic within 30ft. Can see aura around magical creature/object and know school of magic." },
  { level:1, name:"Burning Hands",    school:"Evocation",     castingTime:"1 action", range:"Self (15ft cone)", duration:"Instant", components:"V, S", description:"DEX save. Fail: 3d6 fire damage. Success: half. Ignites flammable objects. +1d6 per slot level above 1st." },
  // 2nd Level
  { level:2, name:"Misty Step",       school:"Conjuration",   castingTime:"Bonus action", range:"Self", duration:"Instant", components:"V",    description:"Teleport up to 30ft to unoccupied space you can see." },
  { level:2, name:"Shatter",          school:"Evocation",     castingTime:"1 action", range:"60ft",  duration:"Instant", components:"V, S, M", description:"10ft sphere. CON save. Fail: 3d8 thunder damage. Success: half. Inorganic (stone/crystal/metal) has disadvantage. +1d8 per slot above 2nd." },
  { level:2, name:"Hold Person",      school:"Enchantment",   castingTime:"1 action", range:"60ft",  duration:"Conc 1min",components:"V, S, M", description:"WIS save. Paralyzed on fail. Repeat save each turn. Attacks against paralyzed creature have advantage. Hits from within 5ft are auto-crits. +1 creature per slot above 2nd." },
  { level:2, name:"Web",              school:"Conjuration",   castingTime:"1 action", range:"60ft",  duration:"Conc 1hr",  components:"V, S, M", description:"20ft cube, difficult terrain. DEX save or restrained. STR check (DC = spell save DC) to break free. Flammable." },
  { level:2, name:"Invisibility",     school:"Illusion",      castingTime:"1 action", range:"Touch", duration:"Conc 1hr",  components:"V, S, M", description:"Target invisible. Ends if attack or cast spell. +1 creature per slot above 2nd." },
  { level:2, name:"Mirror Image",     school:"Illusion",      castingTime:"1 action", range:"Self",  duration:"1 min",   components:"V, S",    description:"3 illusory duplicates. Attackers roll d20: ≤6 miss entirely. 3 copies=6, 2=8, 1=11. Duplicates destroyed on hit." },
  { level:2, name:"Scorching Ray",    school:"Evocation",     castingTime:"1 action", range:"120ft", duration:"Instant", components:"V, S",    description:"3 rays, each ranged spell attack for 2d6 fire. +1 ray per slot above 2nd." },
  { level:2, name:"Suggestion",       school:"Enchantment",   castingTime:"1 action", range:"30ft",  duration:"Conc 8hr", components:"V, M",   description:"WIS save. Suggest a reasonable course of action (must not be harmful). Target follows suggestion for duration." },
  // 3rd Level
  { level:3, name:"Fireball",         school:"Evocation",     castingTime:"1 action", range:"150ft", duration:"Instant", components:"V, S, M", description:"20ft sphere. DEX save. Fail: 8d6 fire damage. Success: half. Ignites objects. +1d6 per slot above 3rd." },
  { level:3, name:"Lightning Bolt",   school:"Evocation",     castingTime:"1 action", range:"Self (100ft line)", duration:"Instant", components:"V, S, M", description:"100ft × 5ft line. DEX save. Fail: 8d6 lightning. Success: half. +1d6 per slot above 3rd." },
  { level:3, name:"Counterspell",     school:"Abjuration",    castingTime:"Reaction", range:"60ft",  duration:"Instant", components:"S",       description:"Reaction to a spell being cast within 60ft. Auto-interrupt if ≤3rd level. Higher level: DC = 10 + spell's level." },
  { level:3, name:"Fly",              school:"Transmutation", castingTime:"1 action", range:"Touch", duration:"Conc 10min",components:"V, S, M", description:"Target gains 60ft flying speed. +1 creature per slot above 3rd." },
  { level:3, name:"Hypnotic Pattern", school:"Illusion",      castingTime:"1 action", range:"120ft", duration:"Conc 1min",components:"S, M",   description:"30ft cube. WIS save or charmed (incapacitated, speed 0). Creature wakes if takes damage or someone uses action to shake it." },
  { level:3, name:"Dispel Magic",     school:"Abjuration",    castingTime:"1 action", range:"120ft", duration:"Instant", components:"V, S",    description:"End one spell of 3rd level or lower on target. Higher-level spell: DC = 10 + spell's level. +1 auto-dispel level per slot above 3rd." },
  // 4th Level
  { level:4, name:"Greater Invisibility", school:"Illusion",  castingTime:"1 action", range:"Touch", duration:"Conc 1min",components:"V, S",   description:"Target invisible even while attacking or casting. Concentration." },
  { level:4, name:"Polymorph",        school:"Transmutation", castingTime:"1 action", range:"60ft",  duration:"Conc 1hr",  components:"V, S, M", description:"WIS save (willing creatures can forgo). Transform creature into beast with CR ≤ target's level/CR. Uses beast's HP pool; if reduced to 0, reverts." },
  { level:4, name:"Banishment",       school:"Abjuration",    castingTime:"1 action", range:"60ft",  duration:"Conc 1min",components:"V, S, M", description:"CHA save. Non-native creature: permanently banished if concentration held. Native creature: incapacitated in demi-plane, returns if concentration broken." },
  { level:4, name:"Dimension Door",   school:"Conjuration",   castingTime:"1 action", range:"500ft", duration:"Instant", components:"V",       description:"Teleport yourself (and optionally one willing creature) up to 500ft. You can arrive in mid-air." },
  // 5th Level
  { level:5, name:"Cone of Cold",     school:"Evocation",     castingTime:"1 action", range:"Self (60ft cone)", duration:"Instant", components:"V, S, M", description:"CON save. Fail: 8d8 cold damage. Success: half. Killed creatures become frozen statues. +1d8 per slot above 5th." },
  { level:5, name:"Wall of Force",    school:"Evocation",     castingTime:"1 action", range:"120ft", duration:"Conc 10min",components:"V, S, M", description:"Invisible wall up to 10 × 10ft panels (flat or domed). Immune to all damage. Nothing can pass through (including spells that move creatures)." },
  { level:5, name:"Hold Monster",     school:"Enchantment",   castingTime:"1 action", range:"90ft",  duration:"Conc 1min",components:"V, S, M", description:"WIS save. Any creature type paralyzed on fail. Repeat save each turn. Hits from within 5ft are auto-crits." },
  { level:5, name:"Telekinesis",      school:"Transmutation", castingTime:"1 action", range:"60ft",  duration:"Conc 10min",components:"V, S",   description:"Move a Large or smaller creature (STR vs spell save DC) up to 30ft, or move object ≤1000 lb." },
];

const CLERIC_SPELLS: Spell[] = [
  { level:0, name:"Sacred Flame",    school:"Evocation",   castingTime:"1 action", range:"60ft",  duration:"Instant",  components:"V, S",    description:"DEX save (no cover bonus). Fail: 1d8 radiant damage (2d8 at 5th, 3d8 at 11th, 4d8 at 17th)." },
  { level:0, name:"Guidance",        school:"Divination",  castingTime:"1 action", range:"Touch", duration:"Conc 1min",components:"V, S",    description:"Willing creature adds 1d4 to one ability check before the spell ends." },
  { level:0, name:"Spare the Dying", school:"Necromancy",  castingTime:"1 action", range:"Touch", duration:"Instant",  components:"V, S",    description:"Stabilize a creature at 0 HP. No effect on undead/constructs." },
  { level:0, name:"Toll the Dead",   school:"Necromancy",  castingTime:"1 action", range:"60ft",  duration:"Instant",  components:"V, S",    description:"WIS save. Fail: 1d8 necrotic (1d12 if target is missing HP). Scales at 5th/11th/17th." },
  { level:1, name:"Cure Wounds",     school:"Evocation",   castingTime:"1 action", range:"Touch", duration:"Instant",  components:"V, S",    description:"Restore 1d8 + spellcasting mod HP. +1d8 per slot above 1st. No effect on undead/constructs." },
  { level:1, name:"Healing Word",    school:"Evocation",   castingTime:"Bonus action", range:"60ft", duration:"Instant", components:"V",     description:"Restore 1d4 + spellcasting mod HP. +1d4 per slot above 1st. Can cast another spell same turn." },
  { level:1, name:"Bless",           school:"Enchantment", castingTime:"1 action", range:"30ft",  duration:"Conc 1min",components:"V, S, M", description:"Up to 3 creatures add 1d4 to attack rolls and saving throws. +1 creature per slot above 1st." },
  { level:1, name:"Guiding Bolt",    school:"Evocation",   castingTime:"1 action", range:"120ft", duration:"1 round",  components:"V, S",    description:"Ranged spell attack. 4d6 radiant damage. Next attack vs target has advantage. +1d6 per slot above 1st." },
  { level:1, name:"Shield of Faith", school:"Abjuration",  castingTime:"Bonus action", range:"60ft", duration:"Conc 10min", components:"V, S, M", description:"+2 AC to one creature." },
  { level:1, name:"Command",         school:"Enchantment", castingTime:"1 action", range:"60ft",  duration:"1 round",  components:"V",       description:"WIS save or obey one-word command (Approach, Drop, Flee, Grovel, Halt). +1 creature per slot above 1st." },
  { level:1, name:"Inflict Wounds",  school:"Necromancy",  castingTime:"1 action", range:"Touch", duration:"Instant",  components:"V, S",    description:"Melee spell attack. 3d10 necrotic damage. +1d10 per slot above 1st." },
  { level:2, name:"Spiritual Weapon",school:"Evocation",   castingTime:"Bonus action", range:"60ft", duration:"1 min (no conc)", components:"V, S", description:"Bonus action: create weapon, bonus action each turn to move 20ft and attack (melee spell attack, 1d8 + spell mod force). +1d8 per 2 slot levels above 2nd." },
  { level:2, name:"Hold Person",     school:"Enchantment", castingTime:"1 action", range:"60ft",  duration:"Conc 1min",components:"V, S, M", description:"WIS save. Humanoid paralyzed on fail. Auto-crits from melee within 5ft." },
  { level:2, name:"Aid",             school:"Abjuration",  castingTime:"1 action", range:"30ft",  duration:"8 hrs",    components:"V, S, M", description:"Up to 3 creatures' HP maximum and current HP increase by 5. +5 per slot above 2nd." },
  { level:2, name:"Lesser Restoration", school:"Abjuration", castingTime:"1 action", range:"Touch", duration:"Instant", components:"V, S",   description:"End one disease or one condition (blinded, deafened, paralyzed, or poisoned)." },
  { level:2, name:"Silence",         school:"Illusion",    castingTime:"1 action", range:"120ft", duration:"Conc 10min",components:"V, S",   description:"20ft radius, no sound. Creatures inside immune to thunder damage, can't cast spells with verbal components." },
  { level:3, name:"Spirit Guardians",school:"Conjuration", castingTime:"1 action", range:"Self (15ft)", duration:"Conc 10min", components:"V, S, M", description:"15ft sphere: difficult terrain for enemies. WIS save when entering or start of turn. Fail: 3d8 radiant/necrotic damage. Success: half. +1d8 per slot above 3rd." },
  { level:3, name:"Mass Healing Word",school:"Evocation",  castingTime:"Bonus action", range:"60ft", duration:"Instant", components:"V",     description:"Up to 6 creatures regain 1d4 + spell mod HP. +1d4 per slot above 3rd." },
  { level:3, name:"Revivify",        school:"Necromancy",  castingTime:"1 action", range:"Touch", duration:"Instant",  components:"V, S, M (300gp diamond)", description:"Creature dead ≤ 1 minute returns to life with 1 HP. Doesn't restore missing limbs." },
  { level:4, name:"Guardian of Faith",school:"Conjuration",castingTime:"1 action", range:"30ft",  duration:"8 hrs",    components:"V",       description:"Large spectral guardian appears. Hostile creatures entering within 10ft take 20 radiant damage (DEX save, half). Guardian vanishes after 60 total damage dealt." },
  { level:5, name:"Mass Cure Wounds",school:"Evocation",   castingTime:"1 action", range:"60ft",  duration:"Instant",  components:"V, S",    description:"Up to 6 creatures in 30ft sphere regain 3d8 + spell mod HP. +1d8 per slot above 5th." },
  { level:5, name:"Flame Strike",    school:"Evocation",   castingTime:"1 action", range:"60ft",  duration:"Instant",  components:"V, S, M", description:"10ft radius, 40ft tall. DEX save. Fail: 4d6 fire + 4d6 radiant. Success: half. +1d6 each type per slot above 5th." },
];

const DRUID_SPELLS: Spell[] = [
  { level:0, name:"Shillelagh",      school:"Transmutation", castingTime:"Bonus action", range:"Touch", duration:"1 min", components:"V, S, M", description:"Club or quarterstaff becomes magical. Use WIS for attack/damage rolls. Weapon damage die = d8." },
  { level:0, name:"Produce Flame",   school:"Conjuration",   castingTime:"1 action", range:"Self",  duration:"10 min",  components:"V, S",    description:"Flame illuminates 10ft bright/20ft dim. Can hurl as ranged spell attack (30ft): 1d8 fire. Scales at 5th/11th/17th." },
  { level:0, name:"Guidance",        school:"Divination",    castingTime:"1 action", range:"Touch", duration:"Conc 1min",components:"V, S",    description:"Willing creature adds 1d4 to one ability check." },
  { level:0, name:"Druidcraft",      school:"Transmutation", castingTime:"1 action", range:"30ft",  duration:"Instant", components:"V, S",    description:"Predict weather, make flower bloom, create small sensory effect, light/snuff candle." },
  { level:1, name:"Entangle",        school:"Conjuration",   castingTime:"1 action", range:"90ft",  duration:"Conc 1min",components:"V, S",    description:"20ft square of vines. STR save or restrained. Difficult terrain for all. Creatures in area repeat save on their turn." },
  { level:1, name:"Faerie Fire",     school:"Evocation",     castingTime:"1 action", range:"60ft",  duration:"Conc 1min",components:"V",       description:"20ft cube. DEX save or outlined with light. Can't be invisible. Attacks vs outlined creatures have advantage." },
  { level:1, name:"Healing Word",    school:"Evocation",     castingTime:"Bonus action", range:"60ft", duration:"Instant", components:"V",     description:"Restore 1d4 + WIS mod HP to a creature you can see. Can cast another spell same turn." },
  { level:1, name:"Thunderwave",     school:"Evocation",     castingTime:"1 action", range:"Self (15ft cube)", duration:"Instant", components:"V, S", description:"CON save. Fail: 2d8 thunder + pushed 10ft. Success: half. Unsecured objects pushed. Loud noise audible 300ft." },
  { level:1, name:"Speak with Animals", school:"Divination", castingTime:"1 action", range:"Self",  duration:"10 min",  components:"V, S",    description:"Communicate with beasts. They may answer questions and grant favors. Comprehension limited by intelligence." },
  { level:2, name:"Moonbeam",        school:"Evocation",     castingTime:"1 action", range:"120ft", duration:"Conc 1min",components:"V, S, M", description:"5ft-radius cylinder, 40ft high. CON save when entering or start of turn. Fail: 2d10 radiant. Shapechangers have disadvantage. +1d10 per slot above 2nd." },
  { level:2, name:"Heat Metal",      school:"Transmutation", castingTime:"1 action", range:"60ft",  duration:"Conc 1min",components:"V, S, M", description:"Metal object glows red hot. Any creature touching it takes 2d8 fire each turn (CON save or drop). Bonus action to intensify." },
  { level:2, name:"Pass Without Trace", school:"Abjuration", castingTime:"1 action", range:"Self",  duration:"Conc 1hr",  components:"V, S, M", description:"+10 to Stealth checks for you and companions within 30ft. Can't be tracked by nonmagical means." },
  { level:2, name:"Hold Person",     school:"Enchantment",   castingTime:"1 action", range:"60ft",  duration:"Conc 1min",components:"V, S, M", description:"WIS save. Humanoid paralyzed on fail." },
  { level:3, name:"Call Lightning",  school:"Conjuration",   castingTime:"1 action", range:"120ft", duration:"Conc 10min",components:"V, S",   description:"Storm cloud 100ft up, 60ft radius. Bonus action each turn: call bolt to creature/point below cloud. DEX save, fail: 3d10 lightning. +1d10 per slot above 3rd." },
  { level:3, name:"Conjure Animals", school:"Conjuration",   castingTime:"1 action", range:"60ft",  duration:"Conc 1hr",  components:"V, S",   description:"Summon fey spirits in beast form: 1×CR2, 2×CR1, 4×CR1/2, or 8×CR1/4 beasts. Obey your commands." },
  { level:3, name:"Plant Growth",    school:"Transmutation", castingTime:"1 action", range:"150ft", duration:"Instant/8hr",components:"V, S",   description:"Option 1 (instant): enrich plants in 100ft radius for 1 year. Option 2 (reaction): weeds/vines choke 100ft radius — difficult terrain, costs 4ft per 1ft movement." },
  { level:4, name:"Polymorph",       school:"Transmutation", castingTime:"1 action", range:"60ft",  duration:"Conc 1hr",  components:"V, S, M", description:"Transform creature into beast (WIS save if unwilling). CR ≤ target's level/CR. Uses beast HP pool." },
  { level:5, name:"Conjure Elemental",school:"Conjuration",  castingTime:"1 min",    range:"90ft",  duration:"Conc 1hr",  components:"V, S, M", description:"Summon an elemental of CR 5 or lower from appropriate material (fire/water/air/earth). Hostile if concentration lost." },
];

const BARD_SPELLS: Spell[] = [
  { level:0, name:"Vicious Mockery", school:"Enchantment",  castingTime:"1 action", range:"60ft",  duration:"Instant", components:"V",       description:"WIS save. Fail: 1d4 psychic damage (scales at 5th/11th/17th) AND disadvantage on next attack before your next turn." },
  { level:0, name:"Minor Illusion",  school:"Illusion",     castingTime:"1 action", range:"30ft",  duration:"1 min",   components:"S, M",    description:"Sound or image (≤5ft cube). Investigation check to disbelieve." },
  { level:0, name:"Mage Hand",       school:"Conjuration",  castingTime:"1 action", range:"30ft",  duration:"1 min",   components:"V, S",    description:"Spectral hand, move objects ≤10 lb." },
  { level:1, name:"Healing Word",    school:"Evocation",    castingTime:"Bonus action", range:"60ft", duration:"Instant", components:"V",     description:"1d4 + CHA mod HP restored. Can cast other spells same turn." },
  { level:1, name:"Charm Person",    school:"Enchantment",  castingTime:"1 action", range:"30ft",  duration:"1 hr",    components:"V, S",    description:"WIS save (advantage if in combat). Charmed: regards you as friendly. +1 target per slot above 1st." },
  { level:1, name:"Dissonant Whispers", school:"Enchantment", castingTime:"1 action", range:"60ft", duration:"Instant", components:"V",      description:"WIS save. Fail: 3d6 psychic + must use reaction to immediately move away. Success: half damage, no movement. +1d6 per slot above 1st." },
  { level:1, name:"Faerie Fire",     school:"Evocation",    castingTime:"1 action", range:"60ft",  duration:"Conc 1min",components:"V",       description:"20ft cube. DEX save or outlined. Attacks vs outlined have advantage." },
  { level:1, name:"Heroism",         school:"Enchantment",  castingTime:"1 action", range:"Touch", duration:"Conc 1min",components:"V, S",    description:"Willing creature immune to frightened. Each turn gains CHA mod temp HP. +1 target per slot above 1st." },
  { level:1, name:"Sleep",           school:"Enchantment",  castingTime:"1 action", range:"90ft",  duration:"1 min",   components:"V, S, M", description:"5d8 HP of creatures in 20ft sphere fall unconscious (lowest HP first). +2d8 per slot above 1st." },
  { level:2, name:"Suggestion",      school:"Enchantment",  castingTime:"1 action", range:"30ft",  duration:"Conc 8hr", components:"V, M",   description:"WIS save. Suggest reasonable action; target follows for duration." },
  { level:2, name:"Hold Person",     school:"Enchantment",  castingTime:"1 action", range:"60ft",  duration:"Conc 1min",components:"V, S, M", description:"WIS save. Humanoid paralyzed." },
  { level:2, name:"Invisibility",    school:"Illusion",     castingTime:"1 action", range:"Touch", duration:"Conc 1hr",  components:"V, S, M", description:"Invisible until attacks or casts. +1 creature per slot above 2nd." },
  { level:2, name:"Shatter",         school:"Evocation",    castingTime:"1 action", range:"60ft",  duration:"Instant", components:"V, S, M", description:"10ft sphere, CON save. Fail: 3d8 thunder. Success: half." },
  { level:3, name:"Hypnotic Pattern",school:"Illusion",     castingTime:"1 action", range:"120ft", duration:"Conc 1min",components:"S, M",   description:"30ft cube. WIS save or charmed/incapacitated/speed 0." },
  { level:3, name:"Fear",            school:"Illusion",     castingTime:"1 action", range:"Self (30ft cone)", duration:"Conc 1min", components:"V, S, M", description:"WIS save or frightened, must use action to dash away. Drops held objects. Repeat save at end of each turn if can't see you." },
  { level:3, name:"Dispel Magic",    school:"Abjuration",   castingTime:"1 action", range:"120ft", duration:"Instant", components:"V, S",    description:"End one spell ≤3rd level (auto). Higher: DC 10 + spell level." },
  { level:4, name:"Dimension Door",  school:"Conjuration",  castingTime:"1 action", range:"500ft", duration:"Instant", components:"V",       description:"Teleport up to 500ft with optional companion." },
  { level:5, name:"Hold Monster",    school:"Enchantment",  castingTime:"1 action", range:"90ft",  duration:"Conc 1min",components:"V, S, M", description:"WIS save. Any creature type paralyzed." },
  { level:5, name:"Mass Cure Wounds",school:"Evocation",    castingTime:"1 action", range:"60ft",  duration:"Instant", components:"V, S",    description:"Up to 6 creatures: 3d8 + CHA mod HP restored." },
];

const WARLOCK_SPELLS: Spell[] = [
  { level:0, name:"Eldritch Blast",  school:"Evocation",   castingTime:"1 action", range:"120ft", duration:"Instant", components:"V, S",    description:"Ranged spell attack per beam: 1d10 force. 1 beam at L1, 2 at L5, 3 at L11, 4 at L17. Can split beams between targets. Enhanced by invocations." },
  { level:0, name:"Toll the Dead",   school:"Necromancy",   castingTime:"1 action", range:"60ft",  duration:"Instant", components:"V, S",    description:"WIS save. 1d8 necrotic (1d12 if missing HP). Scales." },
  { level:0, name:"Minor Illusion",  school:"Illusion",     castingTime:"1 action", range:"30ft",  duration:"1 min",   components:"S, M",    description:"Sound or image." },
  { level:0, name:"Mage Hand",       school:"Conjuration",  castingTime:"1 action", range:"30ft",  duration:"1 min",   components:"V, S",    description:"Spectral hand." },
  { level:1, name:"Hex",             school:"Enchantment",  castingTime:"Bonus action", range:"90ft", duration:"Conc 1hr", components:"V, S, M", description:"Curse target: +1d6 necrotic damage on each hit, disadvantage on one ability check type. If target drops to 0 HP, can move hex to new target (bonus action). Higher slots = longer duration." },
  { level:1, name:"Hellish Rebuke",  school:"Evocation",    castingTime:"Reaction", range:"60ft",  duration:"Instant", components:"V, S",    description:"Reaction when damaged by creature within 60ft. DEX save. Fail: 2d10 fire. Success: half. +1d10 per slot above 1st." },
  { level:1, name:"Armor of Agathys",school:"Abjuration",   castingTime:"1 action", range:"Self",  duration:"1 hr",    components:"V, S, M", description:"Gain 5 temp HP. While you have them, attacker takes 5 cold damage. +5 each per slot above 1st." },
  { level:2, name:"Misty Step",      school:"Conjuration",  castingTime:"Bonus action", range:"Self", duration:"Instant", components:"V",    description:"Teleport 30ft to visible unoccupied space." },
  { level:2, name:"Hold Person",     school:"Enchantment",  castingTime:"1 action", range:"60ft",  duration:"Conc 1min",components:"V, S, M", description:"WIS save. Humanoid paralyzed." },
  { level:2, name:"Shatter",         school:"Evocation",    castingTime:"1 action", range:"60ft",  duration:"Instant", components:"V, S, M", description:"10ft sphere thunder damage. CON save." },
  { level:3, name:"Hunger of Hadar", school:"Conjuration",  castingTime:"1 action", range:"150ft", duration:"Conc 1min",components:"V, S, M", description:"20ft sphere of void: heavily obscured, no light. Start of turn in sphere: 2d6 cold. End of turn: DEX save or 2d6 acid." },
  { level:3, name:"Hypnotic Pattern",school:"Illusion",     castingTime:"1 action", range:"120ft", duration:"Conc 1min",components:"S, M",   description:"30ft cube. WIS save or incapacitated/speed 0." },
  { level:3, name:"Counterspell",    school:"Abjuration",   castingTime:"Reaction", range:"60ft",  duration:"Instant", components:"S",       description:"Interrupt spell being cast. Auto if ≤3rd level." },
  { level:3, name:"Fly",             school:"Transmutation",castingTime:"1 action", range:"Touch", duration:"Conc 10min",components:"V, S, M", description:"60ft flying speed. +1 creature per slot above 3rd." },
  { level:4, name:"Banishment",      school:"Abjuration",   castingTime:"1 action", range:"60ft",  duration:"Conc 1min",components:"V, S, M", description:"CHA save. Banished to harmless demiplane." },
  { level:5, name:"Hold Monster",    school:"Enchantment",  castingTime:"1 action", range:"90ft",  duration:"Conc 1min",components:"V, S, M", description:"WIS save. Any creature paralyzed." },
  { level:5, name:"Scrying",         school:"Divination",   castingTime:"10 min",   range:"Self",  duration:"Conc 10min",components:"V, S, M", description:"See/hear creature on same plane. WIS save (DC reduced by familiarity). Creates invisible sensor." },
];

const PALADIN_SPELLS: Spell[] = [
  { level:1, name:"Bless",           school:"Enchantment", castingTime:"1 action", range:"30ft",  duration:"Conc 1min",components:"V, S, M", description:"Up to 3 creatures add 1d4 to attack rolls and saving throws." },
  { level:1, name:"Command",         school:"Enchantment", castingTime:"1 action", range:"60ft",  duration:"1 round",  components:"V",       description:"WIS save or obey one-word command." },
  { level:1, name:"Cure Wounds",     school:"Evocation",   castingTime:"1 action", range:"Touch", duration:"Instant",  components:"V, S",    description:"1d8 + CHA mod HP restored." },
  { level:1, name:"Divine Favor",    school:"Evocation",   castingTime:"Bonus action", range:"Self", duration:"Conc 1min", components:"V, S", description:"Weapon attacks deal +1d4 radiant damage." },
  { level:1, name:"Shield of Faith", school:"Abjuration",  castingTime:"Bonus action", range:"60ft", duration:"Conc 10min",components:"V, S, M", description:"+2 AC to one creature." },
  { level:1, name:"Thunderous Smite",school:"Evocation",   castingTime:"Bonus action", range:"Self", duration:"Conc 1min", components:"V",    description:"Next weapon hit: +2d6 thunder damage. STR save or pushed 10ft and knocked prone." },
  { level:1, name:"Wrathful Smite",  school:"Evocation",   castingTime:"Bonus action", range:"Self", duration:"Conc 1min", components:"V",    description:"Next weapon hit: +1d6 psychic damage. WIS save or frightened of you." },
  { level:2, name:"Aid",             school:"Abjuration",  castingTime:"1 action", range:"30ft",  duration:"8 hrs",    components:"V, S, M", description:"3 creatures' HP max and current +5 each. +5 per slot above 2nd." },
  { level:2, name:"Find Steed",      school:"Conjuration", castingTime:"10 min",   range:"30ft",  duration:"Instant",  components:"V, S",    description:"Summon a spirit in the form of an unusually intelligent mount (war horse, pony, camel, elk, or mastiff). Share spells." },
  { level:2, name:"Lesser Restoration",school:"Abjuration",castingTime:"1 action", range:"Touch", duration:"Instant",  components:"V, S",    description:"End one disease or condition (blinded, deafened, paralyzed, poisoned)." },
  { level:2, name:"Magic Weapon",    school:"Transmutation",castingTime:"Bonus action",range:"Touch",duration:"Conc 1hr",components:"V, S",  description:"Nonmagical weapon becomes +1 weapon (no concentration required at 4th level slot; +2 at 6th)." },
  { level:3, name:"Aura of Vitality",school:"Evocation",   castingTime:"1 action", range:"Self (30ft)", duration:"Conc 1min",components:"V",  description:"Bonus action each turn: restore 2d6 HP to one creature in range." },
  { level:3, name:"Revivify",        school:"Necromancy",  castingTime:"1 action", range:"Touch", duration:"Instant",  components:"V, S, M (300gp diamond)", description:"Creature dead ≤1 min returns with 1 HP." },
  { level:3, name:"Dispel Magic",    school:"Abjuration",  castingTime:"1 action", range:"120ft", duration:"Instant",  components:"V, S",    description:"End one spell ≤3rd level. Higher: DC 10 + spell level." },
  { level:4, name:"Death Ward",      school:"Abjuration",  castingTime:"1 action", range:"Touch", duration:"8 hrs",    components:"V, S",    description:"When target would drop to 0 HP (once): instead drops to 1 HP and spell ends." },
  { level:4, name:"Banishment",      school:"Abjuration",  castingTime:"1 action", range:"60ft",  duration:"Conc 1min",components:"V, S, M", description:"CHA save. Banish creature to demiplane." },
  { level:5, name:"Destructive Wave",school:"Evocation",   castingTime:"1 action", range:"Self (30ft)", duration:"Instant",components:"V",    description:"30ft radius. CON save. Fail: 5d6 thunder + 5d6 radiant/necrotic, knocked prone. Success: half, not prone." },
  { level:5, name:"Raise Dead",      school:"Necromancy",  castingTime:"1 hr",     range:"Touch", duration:"Instant",  components:"V, S, M (500gp diamond)", description:"Creature dead ≤10 days returns with 1 HP (no missing limbs). -4 to attacks/saves/ability checks, -1 per long rest until restored." },
];

const RANGER_SPELLS: Spell[] = [
  { level:1, name:"Hunter's Mark",   school:"Divination",  castingTime:"Bonus action", range:"90ft", duration:"Conc 1hr", components:"V",     description:"Mark a creature: +1d6 damage to weapon attacks, advantage on Perception/Survival to find/track it. Bonus action to move if target dies. +duration per slot above 1st." },
  { level:1, name:"Ensnaring Strike",school:"Conjuration", castingTime:"Bonus action", range:"Self", duration:"Conc 1min",components:"V",      description:"Next weapon hit: STR save or restrained by magical thorns. Restrained creature takes 1d6 piercing at start of its turns. Can burst free with STR action (DC = spell save DC)." },
  { level:1, name:"Hail of Thorns",  school:"Conjuration", castingTime:"Bonus action", range:"Self", duration:"Conc 1min",components:"V",      description:"Next ranged weapon hit: 1d10 piercing to main target + DEX save to all within 5ft (fail: 1d10 piercing). +1d10 per slot above 1st." },
  { level:1, name:"Cure Wounds",     school:"Evocation",   castingTime:"1 action", range:"Touch", duration:"Instant",  components:"V, S",    description:"1d8 + WIS mod HP." },
  { level:1, name:"Speak with Animals",school:"Divination",castingTime:"1 action", range:"Self",  duration:"10 min",   components:"V, S",    description:"Communicate with beasts." },
  { level:1, name:"Fog Cloud",       school:"Conjuration", castingTime:"1 action", range:"120ft", duration:"Conc 1hr",  components:"V, S",    description:"20ft radius sphere heavily obscured. +20ft radius per slot above 1st." },
  { level:2, name:"Pass Without Trace",school:"Abjuration",castingTime:"1 action", range:"Self",  duration:"Conc 1hr",  components:"V, S, M", description:"+10 Stealth, can't be tracked nonmagically." },
  { level:2, name:"Spike Growth",    school:"Transmutation",castingTime:"1 action", range:"150ft", duration:"Conc 10min",components:"V, S, M", description:"20ft radius difficult terrain of spikes. 2d4 piercing per 5ft moved through." },
  { level:2, name:"Silence",         school:"Illusion",    castingTime:"1 action", range:"120ft", duration:"Conc 10min",components:"V, S",    description:"20ft sphere: no sound, verbal spells impossible." },
  { level:3, name:"Conjure Animals", school:"Conjuration", castingTime:"1 action", range:"60ft",  duration:"Conc 1hr",  components:"V, S",    description:"Summon beasts (CR guidelines)." },
  { level:3, name:"Wind Wall",       school:"Evocation",   castingTime:"1 action", range:"120ft", duration:"Conc 1min",components:"V, S, M", description:"Wall of strong wind: deflects arrows (disadvantage on ranged weapon attacks through it), pushes small creatures (STR save or take 3d8 bludgeoning + pushed)." },
  { level:3, name:"Nondetection",    school:"Abjuration",  castingTime:"1 action", range:"Touch", duration:"8 hrs",    components:"V, S, M (25gp)", description:"Target can't be targeted by any divination spell or perceived through magical scrying sensors." },
  { level:4, name:"Freedom of Movement",school:"Abjuration",castingTime:"1 action", range:"Touch", duration:"1 hr",    components:"V, S, M", description:"Immune to difficult terrain penalty, can't be paralyzed or restrained by magic. Move through narrow spaces without squeezing. Free from nonmagical restraints as bonus action." },
  { level:4, name:"Stoneskin",       school:"Abjuration",  castingTime:"1 action", range:"Touch", duration:"Conc 1hr",  components:"V, S, M (100gp diamond)", description:"Resistance to nonmagical bludgeoning, piercing, and slashing damage." },
  { level:5, name:"Swift Quiver",    school:"Transmutation",castingTime:"Bonus action",range:"Touch",duration:"Conc 1min",components:"V, S, M", description:"Quiver produces endless arrows. Bonus action each turn: make 2 ranged weapon attacks." },
  { level:5, name:"Tree Stride",     school:"Conjuration", castingTime:"1 action", range:"Self",  duration:"Conc 1min",components:"V, S",    description:"Enter a tree and exit from a different tree of same species within 500ft. Each use costs 5ft movement." },
];

const SORCERER_SPELLS: Spell[] = [
  ...WIZARD_SPELLS.filter(s => [
    "Fire Bolt","Ray of Frost","Shocking Grasp","Mage Hand","Minor Illusion","Prestidigitation","Poison Spray","Chill Touch",
    "Magic Missile","Shield","Thunderwave","Sleep","Charm Person","Burning Hands",
    "Misty Step","Shatter","Hold Person","Invisibility","Mirror Image","Scorching Ray","Suggestion",
    "Fireball","Lightning Bolt","Counterspell","Fly","Hypnotic Pattern",
    "Greater Invisibility","Polymorph","Banishment","Dimension Door",
    "Cone of Cold","Hold Monster","Wall of Force",
  ].includes(s.name)),
];

// Sorcerer-exclusive
const SORCERER_EXTRA: Spell[] = [
  { level:1, name:"Chromatic Orb",   school:"Evocation",   castingTime:"1 action", range:"90ft",  duration:"Instant", components:"V, S, M (50gp diamond)", description:"Ranged spell attack. Choose acid/cold/fire/lightning/poison/thunder: 3d8 damage. +1d8 per slot above 1st." },
  { level:1, name:"Expeditious Retreat",school:"Transmutation",castingTime:"Bonus action",range:"Self",duration:"Conc 10min",components:"V, S", description:"Bonus action each turn: Dash action." },
  { level:2, name:"Blur",            school:"Illusion",    castingTime:"1 action", range:"Self",  duration:"Conc 1min",components:"V",       description:"Attacks against you have disadvantage (unless attacker has other perception like blindsight)." },
];

// ── Spell lists by class ─────────────────────────────────────────────────

export const CLASS_SPELLS: Record<string, Spell[]> = {
  wizard:    WIZARD_SPELLS,
  cleric:    CLERIC_SPELLS,
  druid:     DRUID_SPELLS,
  bard:      BARD_SPELLS,
  warlock:   WARLOCK_SPELLS,
  paladin:   PALADIN_SPELLS,
  ranger:    RANGER_SPELLS,
  sorcerer:  [...SORCERER_SPELLS, ...SORCERER_EXTRA],
};

export function getSpellsForClass(charClass: string, maxSlotLevel: number): Spell[] {
  const cls = charClass.toLowerCase();
  const spells = CLASS_SPELLS[cls] ?? [];
  return spells.filter(s => s.level <= maxSlotLevel);
}

export function getFeaturesForClass(charClass: string, charLevel: number): ClassFeature[] {
  const cls = charClass.toLowerCase();
  const features = CLASS_FEATURES[cls] ?? [];
  return features.filter(f => f.level <= charLevel);
}

// ── Spell preparation ─────────────────────────────────────────────────────

// Classes that prepare spells from their full list each long rest.
// Formula: (spellcasting mod) + (class-level factor) → max prepared count
export const SPELL_PREPARERS: Record<string, {
  stat: "intelligence" | "wisdom" | "charisma";
  formula: (classLevel: number, statMod: number) => number;
}> = {
  wizard:  { stat: "intelligence", formula: (lv, mod) => Math.max(1, lv + mod) },
  cleric:  { stat: "wisdom",       formula: (lv, mod) => Math.max(1, lv + mod) },
  druid:   { stat: "wisdom",       formula: (lv, mod) => Math.max(1, lv + mod) },
  paladin: { stat: "charisma",     formula: (lv, mod) => Math.max(1, Math.floor(lv / 2) + mod) },
};

export function maxPreparedSpells(charClass: string, classLevel: number, statVal: number): number {
  const prep = SPELL_PREPARERS[charClass.toLowerCase()];
  if (!prep) return 0;
  const mod = Math.floor((statVal - 10) / 2);
  return prep.formula(classLevel, mod);
}

export function isSpellPreparer(charClass: string): boolean {
  return charClass.toLowerCase() in SPELL_PREPARERS;
}

export function getMaxSpellLevel(charClass: string, charLevel: number): number {
  const cls = charClass.toLowerCase();

  // Half-casters (Paladin, Ranger): spells start at class level 2
  // Lv1=0, Lv2-4=1st, Lv5-6=2nd, Lv7-12=3rd, Lv13-16=4th, Lv17-20=5th
  if (cls === "paladin" || cls === "ranger") {
    const t = [0, 0, 1, 1, 1, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5];
    return t[Math.min(charLevel, 20)] ?? 0;
  }

  // Third-casters (Arcane Trickster, Eldritch Knight): spells start at class level 3
  // Lv1-2=0, Lv3-5=1st, Lv6-8=2nd, Lv9-11=3rd, Lv12-14=4th (max 4th)
  if (cls === "arcane-trickster" || cls === "eldritch-knight") {
    const t = [0, 0, 0, 1, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 4];
    return t[Math.min(charLevel, 20)] ?? 0;
  }

  // Full casters (wizard, cleric, druid, bard, sorcerer, warlock)
  // Lv1=1st, Lv3=2nd, Lv5=3rd, Lv7=4th, Lv9=5th, Lv11=6th, Lv13=7th, Lv15=8th, Lv17=9th
  const t = [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 9, 9];
  return t[Math.min(charLevel, 20)] ?? 0;
}

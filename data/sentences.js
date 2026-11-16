/* Budowanie zdań: ćwiczenia napisane dla tej aplikacji.
   Każde zdanie: [polskie zdanie, kafelki w poprawnej kolejności, kafelki-pułapki].
   Kafelki w formacie 漢字[czytanie]. */
window.JA_SENTENCES = [
{ id: "tw", glyph: "。", name: "Zdania twierdzące",
  rule: "Kolejność: kto, co, czasownik. Na końcu stoi です albo czasownik w formie ます.",
  ex: ["私[わたし]は 学生[がくせい]です", "watashi wa gakusei desu", "Jestem studentem."],
  items: [
  ["Jestem studentem.", ["私[わたし]は", "学生[がくせい]", "です"], ["先生[せんせい]"]],
  ["Jem sushi.", ["私[わたし]は", "寿司[すし]を", "食[た]べます"], ["飲[の]みます"]],
  ["Piję wodę.", ["水[みず]を", "飲[の]みます"], ["食[た]べます"]],
  ["To jest książka.", ["これは", "本[ほん]", "です"], ["それは"]],
  ["Idę do szkoły.", ["学校[がっこう]に", "行[い]きます"], ["来[き]ます"]],
  ["Mój pies jest duży.", ["私[わたし]の", "犬[いぬ]は", "大[おお]きいです"], ["小[ちい]さいです"]],
  ["Uczę się japońskiego.", ["日本語[にほんご]を", "勉強[べんきょう]します"], ["英語[えいご]を"]],
  ["Pan Tanaka jest nauczycielem.", ["田中[たなか]さんは", "先生[せんせい]", "です"], ["学生[がくせい]"]],
  ["W domu jest kot.", ["家[いえ]に", "猫[ねこ]が", "います"], ["あります"]],
  ["Oglądam film.", ["映画[えいが]を", "見[み]ます"], ["聞[き]きます"]]
  ]},
{ id: "py", glyph: "か", name: "Zdania pytające",
  rule: "Dodaj か na końcu zdania. Słowo pytające stoi tam, gdzie będzie odpowiedź, a szyk się nie zmienia.",
  ex: ["これは 何[なん]ですか", "kore wa nan desu ka", "Co to jest?"],
  items: [
  ["Czy jesteś studentem?", ["あなたは", "学生[がくせい]", "です", "か"], ["ね"]],
  ["Co to jest?", ["これは", "何[なん]", "です", "か"], ["誰[だれ]"]],
  ["Gdzie jest toaleta?", ["トイレは", "どこ", "です", "か"], ["何[なん]"]],
  ["Czy pijesz kawę?", ["コーヒーを", "飲[の]みます", "か"], ["食[た]べます"]],
  ["Kim jest tamta osoba?", ["あの", "人[ひと]は", "誰[だれ]", "です", "か"], ["どこ"]],
  ["Ile to kosztuje?", ["これは", "いくら", "です", "か"], ["いつ"]],
  ["Dokąd idziesz?", ["どこに", "行[い]きます", "か"], ["何[なに]を"]],
  ["Co jesz?", ["何[なに]を", "食[た]べます", "か"], ["どこに"]],
  ["Kiedy jest egzamin?", ["試験[しけん]は", "いつ", "です", "か"], ["いくら"]],
  ["Czy to jest smaczne?", ["これは", "おいしい", "です", "か"], ["大[おお]きい"]]
  ]},
{ id: "pr", glyph: "不", name: "Zdania przeczące",
  rule: "です zamieniasz na じゃないです, ます na ません. Przy przymiotniku na -い końcówkę い zamieniasz na くない.",
  ex: ["肉[にく]は 食[た]べません", "niku wa tabemasen", "Nie jem mięsa."],
  items: [
  ["Nie jestem studentem.", ["私[わたし]は", "学生[がくせい]", "じゃないです"], ["です"]],
  ["Nie jem mięsa.", ["肉[にく]は", "食[た]べません"], ["食[た]べます"]],
  ["Nie piję alkoholu.", ["お酒[さけ]は", "飲[の]みません"], ["飲[の]みます"]],
  ["To nie jest moje.", ["これは", "私[わたし]の", "じゃないです"], ["です"]],
  ["Nie rozumiem po japońsku.", ["日本語[にほんご]が", "分[わ]かりません"], ["分[わ]かります"]],
  ["Nie mam czasu.", ["時間[じかん]が", "ありません"], ["あります"]],
  ["Ten pies nie jest duży.", ["この", "犬[いぬ]は", "大[おお]きくないです"], ["大[おお]きいです"]],
  ["Nie oglądam telewizji.", ["テレビは", "見[み]ません"], ["見[み]ます"]],
  ["W domu nie ma kota.", ["家[いえ]に", "猫[ねこ]は", "いません"], ["います"]],
  ["To nie jest drogie.", ["これは", "高[たか]くないです"], ["高[たか]いです"]]
  ]},
{ id: "pz", glyph: "明", name: "Zdania o przyszłości",
  rule: "Japoński nie ma czasu przyszłego. Zostaje forma ます, a o przyszłości mówi słowo czasu na początku (明日, 来週). Zamiar to forma słownikowa + つもりです, chęć to -たいです.",
  ex: ["明日[あした] 学校[がっこう]に 行[い]きます", "ashita gakkō ni ikimasu", "Jutro idę do szkoły."],
  items: [
  ["Jutro idę do szkoły.", ["明日[あした]", "学校[がっこう]に", "行[い]きます"], ["昨日[きのう]"]],
  ["Jutro będę się uczyć japońskiego.", ["明日[あした]", "日本語[にほんご]を", "勉強[べんきょう]します"], ["昨日[きのう]"]],
  ["W przyszłym tygodniu jadę do Japonii.", ["来週[らいしゅう]", "日本[にほん]に", "行[い]きます"], ["先週[せんしゅう]"]],
  ["W przyszłym roku zostanę studentem.", ["来年[らいねん]", "学生[がくせい]に", "なります"], ["去年[きょねん]"]],
  ["Dziś wieczorem obejrzę film.", ["今晩[こんばん]", "映画[えいが]を", "見[み]ます"], ["見[み]ました"]],
  ["Zamierzam kupić samochód.", ["車[くるま]を", "買[か]う", "つもりです"], ["買[か]いました"]],
  ["Zamierzam pojechać do Tokio.", ["東京[とうきょう]に", "行[い]く", "つもりです"], ["行[い]きました"]],
  ["Jutro pewnie będzie padać.", ["明日[あした]は", "雨[あめ]", "でしょう"], ["昨日[きのう]は"]],
  ["Chcę pojechać do Japonii.", ["日本[にほん]に", "行[い]きたいです"], ["行[い]きました"]],
  ["W weekend spotkam się z przyjacielem.", ["週末[しゅうまつ]", "友[とも]だちに", "会[あ]います"], ["先週[せんしゅう]"]]
  ]}
];

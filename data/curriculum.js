(function(global){
"use strict";
const RUBY=/([一-鿿々]+)\[([^\]]+)\]/g;
const plain=m=>m.replace(/\[[^\]]+\]/g,"");
const kanaOf=m=>m.replace(RUBY,"$2");

/* ---------- kana ---------- */
const KANA={
 basic:[["あ い う え お","a i u e o"],["か き く け こ","ka ki ku ke ko"],["さ し す せ そ","sa shi su se so"],["た ち つ て と","ta chi tsu te to"],["な に ぬ ね の","na ni nu ne no"],["は ひ ふ へ ほ","ha hi fu he ho"],["ま み む め も","ma mi mu me mo"],["や - ゆ - よ","ya - yu - yo"],["ら り る れ ろ","ra ri ru re ro"],["わ - - - を","wa - - - wo"],["ん - - - -","n - - - -"]],
 daku:[["が ぎ ぐ げ ご","ga gi gu ge go"],["ざ じ ず ぜ ぞ","za ji zu ze zo"],["だ ぢ づ で ど","da ji zu de do"],["ば び ぶ べ ぼ","ba bi bu be bo"],["ぱ ぴ ぷ ぺ ぽ","pa pi pu pe po"]],
 yoon:[["きゃ きゅ きょ","kya kyu kyo"],["しゃ しゅ しょ","sha shu sho"],["ちゃ ちゅ ちょ","cha chu cho"],["にゃ にゅ にょ","nya nyu nyo"],["ひゃ ひゅ ひょ","hya hyu hyo"],["みゃ みゅ みょ","mya myu myo"],["りゃ りゅ りょ","rya ryu ryo"],["ぎゃ ぎゅ ぎょ","gya gyu gyo"],["じゃ じゅ じょ","ja ju jo"],["びゃ びゅ びょ","bya byu byo"],["ぴゃ ぴゅ ぴょ","pya pyu pyo"]]
};
const toKata=s=>s.replace(/[ぁ-ゖ]/g,c=>String.fromCharCode(c.charCodeAt(0)+0x60));
const toHira=s=>s.replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
const RM={"ぁ":"a","ぃ":"i","ぅ":"u","ぇ":"e","ぉ":"o"};
for(const set in KANA)KANA[set].forEach(r=>{const c=r[0].split(" "),o=r[1].split(" ");c.forEach((h,i)=>{if(h!=="-")RM[h]=o[i]})});
RM["を"]="o";
function romaji(s){
  s=toHira(s);let o="",dbl=false;
  for(let i=0;i<s.length;i++){
    const two=s.substr(i,2);let r;
    if(two.length===2&&RM[two]){r=RM[two];i++}
    else if(s[i]==="っ"){dbl=true;continue}
    else if(s[i]==="ー"){r=o.slice(-1)}
    else r=RM[s[i]]!==undefined?RM[s[i]]:s[i];
    if(dbl&&/^[a-z]/.test(r)){r=(r[0]==="c"?"t":r[0])+r;dbl=false}
    o+=r;
  }
  return o;
}
const PLX={shi:"si",chi:"ci",tsu:"cu",fu:"fu (miękkie, blisko „hu”)",ji:"dzi",wa:"ła",wo:"o",sha:"sia",shu:"siu",sho:"sio",cha:"cia",chu:"ciu",cho:"cio",ja:"dzia",ju:"dziu",jo:"dzio",zu:"zu (na początku słowa bliżej „dzu”)",n:"n (przed b, p, m brzmi jak m)",ti:"twarde „ti” (np. パーティー party)",di:"twarde „di” (np. ディスク dysk)",tu:"twarde „tu” (np. トゥール tour)",du:"twarde „du”",fa:"fa (np. ファッション moda)",fi:"fi (np. フィルム film)",fe:"fe (np. カフェ kawiarnia)",fo:"fo (np. フォーク widelec)",va:"wa/va (np. ヴァイオリン skrzypce)",vi:"wi/vi",vu:"wu/vu",ve:"we/ve",vo:"wo/vo",wi:"łi (np. ウィスキー whisky)",we:"łe (np. ウェブ web)",kye:"kje",she:"sie (np. シェア share)",che:"cie (np. チェック check)",je:"dzie (np. ジェット odrzutowiec)",tse:"ce"};
const AMB={"じ":"zwykłe „ji”, z wiersza za-ji-zu-ze-zo","ぢ":"rzadkie „ji”, z wiersza da-ji-zu-de-do","ず":"zwykłe „zu”, z wiersza za-ji-zu-ze-zo","づ":"rzadkie „zu”, z wiersza da-ji-zu-de-do"};
function plRead(r){if(PLX[r])return PLX[r];let s=r.replace("y","j");if(r[0]==="r")s+=" (r krótkie, między r a l)";return s}
const SETNAME={basic:"Podstawowe",daku:"Z dakuten ゛ i handakuten ゜",yoon:"Złożone (yōon)",ext:"Sylaby obce — rozszerzona katakana (ァ ィ ゥ ェ ォ)",conf:"Mylące znaki"};
const KATA_EXT=[
 ["ティ ディ トゥ ドゥ -","ti di tu du -","ti / di + ィ oraz to / do + ゥ"],
 ["ファ フィ - フェ フォ","fa fi - fe fo","fu (フ) + mała samogłoska"],
 ["ヴァ ヴィ ヴ ヴェ ヴォ","va vi vu ve vo","vu (ヴ) + mała samogłoska"],
 ["- ウィ - ウェ ウォ","- wi - we wo","u (ウ) + mała samogłoska"],
 ["キェ シェ チェ ジェ ツェ","kye she che je tse","sylaby jotowane z małym ェ (e)"]
];
const CONF={
 hiragana:[["あお","あ ma pętlę przeciętą pionową kreską. お ma osobną kropkę u góry po prawej."],["いり","W い obie kreski są podobnej długości. W り prawa jest wyraźnie dłuższa."],["きさ","き ma dwie poziome kreski, さ jedną."],["さち","To lustrzane odbicia. ち przypomina cyfrę 5."],["ぬめ","ぬ kończy się pętelką, め nie."],["ねれわ","ね kończy się pętelką, れ odchodzi ogonkiem na zewnątrz, わ zawija do środka."],["はほ","ほ ma dodatkową poziomą kreskę na górze."],["るろ","る kończy się pętelką, ろ nie."],["こに","に to こ z pionową kreską po lewej."]],
 katakana:[["シツ","W シ krótkie kreski leżą prawie poziomo, a długa idzie z dołu do góry. W ツ krótkie stoją prawie pionowo, a długa idzie z góry na dół."],["ソン","Ta sama zasada: w ソ krótka kreska stoi i długa idzie z góry na dół, w ン krótka leży i długa idzie z dołu do góry."],["クケタ","ク jest puste, タ ma kreseczkę w środku, ケ ma poziomą kreskę wystającą w prawo."],["フワウ","フ to sam daszek, ワ ma jeszcze pionową kreskę po lewej, ウ dodatkowo kreseczkę na górze."],["スヌ","W ヌ krótka kreska przecina długą. W ス tylko od niej odchodzi."],["チテ","W チ pionowa kreska przecina poziomą, w テ zaczyna się pod nią."],["コユ","W ユ dolna kreska jest dłuższa i wystaje na boki."],["ノメ","メ to ノ z przekreśleniem."]]
};
function kanaDeck(id,kata){
  const conv=kata?toKata:(s=>s),groups=[],all=[];
  for(const set of ["basic","daku","yoon"])KANA[set].forEach((row,ri)=>{
    const ch=row[0].split(" "),ro=row[1].split(" "),items=[],cells=[];
    ch.forEach((h,i)=>{if(h==="-"){cells.push(null);return}
      const q=conv(h),it={k:id+":"+q,q,a:ro[i],say:h,other:kata?h:toKata(h),extra:"po polsku czytaj: <b>"+plRead(ro[i])+"</b>",amb:AMB[h],kind:"kana",kata:!!kata,home:all};
      items.push(it);cells.push(it);all.push(it)});
    groups.push({id:set+ri,label:conv(ch[0])+" "+ro[0],set,items,cells});
  });
  if(kata){
    KATA_EXT.forEach((row,ri)=>{
      const ch=row[0].split(" "),ro=row[1].split(" "),items=[],cells=[];
      ch.forEach((q,i)=>{if(q==="-"){cells.push(null);return}
        const it={k:id+":"+q,q,a:ro[i],say:q,other:toHira(q),extra:"po polsku czytaj: <b>"+plRead(ro[i])+"</b> · "+row[2],kind:"kana",kata:true,ext:true,home:all};
        items.push(it);cells.push(it);all.push(it)});
      groups.push({id:"ext"+ri,label:row[2],set:"ext",items,cells});
    });
  }
  const byKey=Object.fromEntries(all.map(x=>[x.k,x]));
  CONF[id].forEach((c,i)=>groups.push({id:"conf"+i,label:c[0].split("").join(" / "),set:"conf",items:c[0].split("").map(ch=>byKey[id+":"+ch])}));
  return {id,kata,groups,all,def:2,byKey,qName:"znak",aName:"czytanie",kind:"kana"};
}

/* ---------- kanji ---------- */
const KANJI_RAW=`#Liczby
一|jeden|イチ|ひと(つ)|一つ|ひとつ|jedna sztuka|Jedna kreska.
二|dwa|ニ|ふた(つ)|二月|にがつ|luty|Dwie kreski.
三|trzy|サン|みっ(つ)|三日|みっか|trzeci dzień miesiąca|Trzy kreski.
四|cztery|シ|よん、よっ(つ)|四月|しがつ|kwiecień
五|pięć|ゴ|いつ(つ)|五人|ごにん|pięć osób
六|sześć|ロク|むっ(つ)|六月|ろくがつ|czerwiec
七|siedem|シチ|なな|七月|しちがつ|lipiec
八|osiem|ハチ|やっ(つ)|八日|ようか|ósmy dzień miesiąca
九|dziewięć|キュウ、ク|ここの(つ)|九月|くがつ|wrzesień
十|dziesięć|ジュウ|とお|十日|とおか|dziesiąty dzień miesiąca
百|sto|ヒャク|—|三百|さんびゃく|trzysta
千|tysiąc|セン|ち|三千|さんぜん|trzy tysiące
#Żywioły i dni tygodnia
日|dzień, słońce|ニチ、ジツ|ひ、か|日本|にほん|Japonia|Dawniej kółko z kropką, czyli słońce.
月|księżyc, miesiąc|ゲツ、ガツ|つき|月曜日|げつようび|poniedziałek|Sierp księżyca.
火|ogień|カ|ひ|火曜日|かようび|wtorek|Płomień z iskrami po bokach.
水|woda|スイ|みず|水曜日|すいようび|środa|Nurt pośrodku, rozpryski po bokach.
木|drzewo|モク、ボク|き|木曜日|もくようび|czwartek|Pień z gałęziami i korzeniami.
金|złoto, pieniądze|キン|かね|お金|おかね|pieniądze
土|ziemia, gleba|ド、ト|つち|土曜日|どようび|sobota|Kiełek wychodzący z ziemi.
#Kierunki i rozmiar
上|góra, nad|ジョウ|うえ、あ(がる)|上|うえ|na górze|Kreska nad linią.
下|dół, pod|カ、ゲ|した、さ(がる)|下|した|na dole|Kreska pod linią.
左|lewo|サ|ひだり|左|ひだり|lewa strona
右|prawo|ウ、ユウ|みぎ|右|みぎ|prawa strona|Ma w sobie usta 口: prawą ręką się je.
中|środek, wewnątrz|チュウ|なか|中|なか|w środku|Kreska przebija sam środek.
大|duży|ダイ、タイ|おお(きい)|大きい|おおきい|duży|Człowiek z szeroko rozłożonymi rękami.
小|mały|ショウ|ちい(さい)|小さい|ちいさい|mały
#Ludzie i ciało
人|człowiek|ジン、ニン|ひと|日本人|にほんじん|Japończyk|Dwie nogi idącego człowieka.
子|dziecko|シ|こ|子ども|こども|dziecko
女|kobieta|ジョ|おんな|女の子|おんなのこ|dziewczynka
男|mężczyzna|ダン、ナン|おとこ|男の子|おとこのこ|chłopiec|Pole 田 i siła 力: ten, kto pracuje w polu.
目|oko|モク|め|目|め|oko|Oko obrócone do pionu.
耳|ucho|ジ|みみ|耳|みみ|ucho
口|usta|コウ|くち|出口|でぐち|wyjście|Otwarte usta.
手|ręka, dłoń|シュ|て|手|て|ręka
足|noga, stopa|ソク|あし、た(りる)|足|あし|noga
#Przyroda
山|góra|サン|やま|富士山|ふじさん|góra Fudżi|Trzy szczyty.
川|rzeka|セン|かわ|川|かわ|rzeka|Trzy strugi wody.
田|pole ryżowe|デン|た|田んぼ|たんぼ|pole ryżowe|Pole podzielone miedzami.
石|kamień|セキ|いし|石|いし|kamień
花|kwiat|カ|はな|花見|はなみ|oglądanie kwitnących wiśni
草|trawa|ソウ|くさ|草|くさ|trawa
林|lasek, zagajnik|リン|はやし|林|はやし|lasek|Dwa drzewa 木.
森|las|シン|もり|森|もり|las|Trzy drzewa 木.
竹|bambus|チク|たけ|竹|たけ|bambus|Dwie łodygi z listkami.
犬|pies|ケン|いぬ|子犬|こいぬ|szczeniak|Duży 大 z kropką.
虫|owad, robak|チュウ|むし|虫|むし|owad
貝|muszla, małż|—|かい|貝|かい|muszla
#Niebo i czas
天|niebo, niebiosa|テン|あめ、あま|天気|てんき|pogoda
空|niebo, pusty|クウ|そら、から|空|そら|niebo
気|duch, energia, nastrój|キ、ケ|—|元気|げんき|zdrowy, pełen energii
雨|deszcz|ウ|あめ|雨|あめ|deszcz|Krople widziane przez okno.
夕|wieczór|セキ|ゆう|夕方|ゆうがた|wieczór
年|rok|ネン|とし|今年|ことし|ten rok
早|wczesny, szybki|ソウ|はや(い)|早い|はやい|wczesny
#Szkoła
本|książka, źródło|ホン|もと|本|ほん|książka|Drzewo 木 z zaznaczonym korzeniem.
文|zdanie, tekst|ブン、モン|ふみ|文|ぶん|zdanie
字|znak pisma|ジ|あざ|漢字|かんじ|kanji|Dziecko 子 pod dachem uczy się znaków.
学|nauka|ガク|まな(ぶ)|学生|がくせい|student
校|szkoła|コウ|—|学校|がっこう|szkoła
先|wcześniej, przed|セン|さき|先生|せんせい|nauczyciel
生|życie, rodzić się|セイ、ショウ|い(きる)、う(まれる)|生まれる|うまれる|urodzić się|Roślina wyrastająca z ziemi 土.
名|imię, nazwa|メイ、ミョウ|な|名前|なまえ|imię
#Rzeczy
王|król|オウ|—|王様|おうさま|król
玉|kula, klejnot|ギョク|たま|玉|たま|kula, piłka|Król 王 z kropką, czyli jego klejnot.
円|jen, koło|エン|まる(い)|百円|ひゃくえん|sto jenów
力|siła|リョク、リキ|ちから|力|ちから|siła|Napięte ramię.
糸|nić|シ|いと|糸|いと|nić
車|samochód, pojazd|シャ|くるま|電車|でんしゃ|pociąg|Wóz widziany z góry: oś i dwa koła.
音|dźwięk|オン、イン|おと、ね|音楽|おんがく|muzyka
村|wieś|ソン|むら|村|むら|wieś
町|miasteczko|チョウ|まち|町|まち|miasteczko
#Kolory
赤|czerwony|セキ|あか(い)|赤い|あかい|czerwony
青|niebieski|セイ|あお(い)|青い|あおい|niebieski
白|biały|ハク、ビャク|しろ(い)|白い|しろい|biały
#Czynności
正|poprawny|セイ、ショウ|ただ(しい)|正しい|ただしい|poprawny|Pięć kresek. Japończycy liczą nim piątkami.
立|stać|リツ|た(つ)|立つ|たつ|stać|Człowiek stojący na ziemi.
休|odpoczywać|キュウ|やす(む)|休み|やすみ|przerwa, wolne|Człowiek 人 oparty o drzewo 木.
見|widzieć, patrzeć|ケン|み(る)|見る|みる|patrzeć|Oko 目 na nogach.
入|wchodzić|ニュウ|はい(る)、い(れる)|入口|いりぐち|wejście
出|wychodzić|シュツ|で(る)、だ(す)|出る|でる|wychodzić`;
const KMAP={},KG={1:[],2:[],3:[],4:[],5:[],6:[],7:[],8:[],9:[]},KCAT=[];
(function(){
  const s1=window.KS1||{};let g=null;
  KANJI_RAW.split("\n").forEach(ln=>{
    if(ln[0]==="#"){g={label:ln.slice(1),items:[]};KCAT.push(g);return}
    const [q,a,on,kun,w,wr,wm,hint]=ln.split("|");
    const it={k:"kanji:"+q,q,a,on,kun,w,wr,wm,hint,say:w,grade:1,st:s1[q],kind:"kanji",home:KG[1]};
    g.items.push(it);KG[1].push(it);KMAP[q]=it});
  const kd=window.KDATA||{};
  for(let gr=2;gr<=9;gr++)(kd[gr]||"").split("\n").forEach(ln=>{
    if(!ln)return;const [q,a,on,kun,w,wr,wm,st]=ln.split("|");
    const it={k:"kanji:"+q,q,a,on,kun,w,wr,wm,say:w,grade:gr,st,kind:"kanji",home:KG[gr]};KG[gr].push(it);KMAP[q]=it});
})();
const KELEM=[1,2,3,4,5,6].flatMap(g=>KG[g]);
const KALL=[1,2,3,4,5,6,7,8,9].flatMap(g=>KG[g]);
const KCOMP={},KSENT={},KWORDS={};
`左|左右|さゆう|lewo i prawo
耳|耳鼻科|じびか|laryngolog
川|河川|かせん|rzeki
田|水田|すいでん|zalane pole ryżowe
草|雑草|ざっそう|chwast
林|森林|しんりん|las
森|森林|しんりん|las
竹|竹林|ちくりん|gaj bambusowy
虫|昆虫|こんちゅう|owad
貝|貝殻|かいがら|muszla
雨|雨天|うてん|deszczowa pogoda
早|早朝|そうちょう|wczesny ranek
糸|毛糸|けいと|włóczka
村|農村|のうそん|wieś rolnicza
町|町長|ちょうちょう|burmistrz miasteczka
赤|赤十字|せきじゅうじ|Czerwony Krzyż
青|青年|せいねん|młodzieniec
正|正月|しょうがつ|Nowy Rok
休|休日|きゅうじつ|dzień wolny
刀|日本刀|にほんとう|miecz japoński
丸|日の丸|ひのまる|flaga Japonii
切|大切|たいせつ|ważny, cenny
少|少年|しょうねん|chłopiec
毛|毛布|もうふ|koc
兄|兄弟|きょうだい|bracia, rodzeństwo
冬|冬休み|ふゆやすみ|ferie zimowe
古|中古|ちゅうこ|używany, z drugiej ręki
母|母国|ぼこく|ojczyzna
矢|矢印|やじるし|strzałka
多|多分|たぶん|prawdopodobnie
池|電池|でんち|bateria
米|米国|べいこく|Stany Zjednoczone
羽|羽毛|うもう|pierze, puch
考|参考|さんこう|odniesienie, wskazówka
西|関西|かんさい|region Kansai
何|何人|なんにん|ile osób
声|音声|おんせい|dźwięk, nagranie głosu
売|売店|ばいてん|kiosk
弟|兄弟|きょうだい|bracia, rodzeństwo
形|人形|にんぎょう|lalka
角|三角|さんかく|trójkąt
言|言葉|ことば|słowo, język
谷|谷川|たにがわ|górski potok
走|走行|そうこう|jazda (pojazdu)
近|最近|さいきん|ostatnio
里|古里|ふるさと|rodzinne strony
夜|今夜|こんや|dziś w nocy
妹|姉妹|しまい|siostry
姉|姉妹|しまい|siostry
南|南北|なんぼく|północ i południe
思|不思議|ふしぎ|dziwny, tajemniczy
首|首都|しゅと|stolica
夏|夏休み|なつやすみ|wakacje letnie
弱|弱点|じゃくてん|słaby punkt
紙|手紙|てがみ|list
船|風船|ふうせん|balon
雪|大雪|おおゆき|obfity śnieg
魚|金魚|きんぎょ|złota rybka
鳥|白鳥|はくちょう|łabędź
朝|朝食|ちょうしょく|śniadanie
答|回答|かいとう|odpowiedź (np. w ankiecie)
絵|絵本|えほん|książka z obrazkami
買|売買|ばいばい|kupno i sprzedaż
雲|雨雲|あまぐも|chmura deszczowa
歌|歌手|かしゅ|piosenkarz
聞|新聞|しんぶん|gazeta
鳴|悲鳴|ひめい|krzyk przerażenia
頭|先頭|せんとう|czoło, przód (kolejki)
顔|笑顔|えがお|uśmiechnięta twarz
風|台風|たいふう|tajfun
寺|寺院|じいん|świątynia
岩|岩石|がんせき|skała
帰|帰国|きこく|powrót do kraju
春|春休み|はるやすみ|ferie wiosenne
昼|昼食|ちゅうしょく|obiad
晴|晴天|せいてん|ładna pogoda
秋|秋分|しゅうぶん|równonoc jesienna
細|細工|さいく|misterna robota, rękodzieło
弓|弓道|きゅうどう|kyūdō, japońskie łucznictwo`.split("\n").forEach(l=>{const p=l.split("|");KCOMP[p[0]]={w:p[1],wr:p[2],wm:p[3]}});
`一|りんごを 一[ひと]つ ください|ringo o hitotsu kudasai|Poproszę jedno jabłko.
二|二月[にがつ]は 寒[さむ]いです|nigatsu wa samui desu|W lutym jest zimno.
三|三人[さんにん]で 行[い]きます|sannin de ikimasu|Idziemy we trójkę.
四|四月[しがつ]に 日本[にほん]へ 行[い]きます|shigatsu ni nihon e ikimasu|W kwietniu jadę do Japonii.
五|五人[ごにん] います|gonin imasu|Jest pięć osób.
六|六時[ろくじ]に 起[お]きます|rokuji ni okimasu|Wstaję o szóstej.
七|七月[しちがつ]は 暑[あつ]いです|shichigatsu wa atsui desu|W lipcu jest gorąco.
八|八時[はちじ]に 会[あ]いましょう|hachiji ni aimashō|Spotkajmy się o ósmej.
九|九時[くじ]に 寝[ね]ます|kuji ni nemasu|Kładę się spać o dziewiątej.
十|十分[じゅっぷん] 待[ま]って ください|juppun matte kudasai|Proszę poczekać dziesięć minut.
百|これは 百円[ひゃくえん]です|kore wa hyaku en desu|To kosztuje sto jenów.
千|千円[せんえん] あります|sen en arimasu|Mam tysiąc jenów.
日|今日[きょう]は 日曜日[にちようび]です|kyō wa nichiyōbi desu|Dziś jest niedziela.
月|月[つき]が きれいです|tsuki ga kirei desu|Księżyc jest piękny.
火|火[ひ]を つけます|hi o tsukemasu|Zapalam ogień.
水|水[みず]を 飲[の]みます|mizu o nomimasu|Piję wodę.
木|木[き]の 下[した]で 休[やす]みます|ki no shita de yasumimasu|Odpoczywam pod drzewem.
金|お金[かね]が ありません|okane ga arimasen|Nie mam pieniędzy.
土|土曜日[どようび]は 休[やす]みです|doyōbi wa yasumi desu|Sobota jest wolna.
上|机[つくえ]の 上[うえ]に 本[ほん]が あります|tsukue no ue ni hon ga arimasu|Na biurku leży książka.
下|いすの 下[した]に 犬[いぬ]が います|isu no shita ni inu ga imasu|Pod krzesłem jest pies.
左|左[ひだり]に 曲[ま]がって ください|hidari ni magatte kudasai|Proszę skręcić w lewo.
右|右[みぎ]を 見[み]て ください|migi o mite kudasai|Proszę spojrzeć w prawo.
中|かばんの 中[なか]に あります|kaban no naka ni arimasu|Jest w torbie.
大|この 犬[いぬ]は 大[おお]きいです|kono inu wa ōkii desu|Ten pies jest duży.
小|小[ちい]さい 町[まち]に 住[す]んで います|chiisai machi ni sunde imasu|Mieszkam w małym miasteczku.
人|あの 人[ひと]は 日本人[にほんじん]です|ano hito wa nihonjin desu|Tamta osoba jest Japończykiem.
子|子[こ]どもが 二人[ふたり] います|kodomo ga futari imasu|Mam dwoje dzieci.
女|あの 女[おんな]の 人[ひと]は 先生[せんせい]です|ano onna no hito wa sensei desu|Tamta kobieta jest nauczycielką.
男|男[おとこ]の 子[こ]が 走[はし]って います|otoko no ko ga hashitte imasu|Chłopiec biegnie.
目|目[め]が 痛[いた]いです|me ga itai desu|Bolą mnie oczy.
耳|耳[みみ]が 大[おお]きいです|mimi ga ōkii desu|Ma duże uszy.
口|口[くち]を 開[あ]けて ください|kuchi o akete kudasai|Proszę otworzyć usta.
手|手[て]を 洗[あら]います|te o araimasu|Myję ręce.
足|足[あし]が 速[はや]いです|ashi ga hayai desu|Szybko biega (dosłownie: ma szybkie nogi).
山|富士山[ふじさん]は 高[たか]い 山[やま]です|Fujisan wa takai yama desu|Fudżi to wysoka góra.
川|川[かわ]で 泳[およ]ぎます|kawa de oyogimasu|Pływam w rzece.
田|田[た]んぼに 水[みず]が あります|tanbo ni mizu ga arimasu|Na polu ryżowym stoi woda.
石|石[いし]を 投[な]げないで ください|ishi o nagenaide kudasai|Proszę nie rzucać kamieniami.
花|花[はな]を 買[か]いました|hana o kaimashita|Kupiłem kwiaty.
草|草[くさ]の 上[うえ]に 座[すわ]ります|kusa no ue ni suwarimasu|Siadam na trawie.
林|林[はやし]の 中[なか]を 歩[ある]きます|hayashi no naka o arukimasu|Idę przez lasek.
森|森[もり]は 静[しず]かです|mori wa shizuka desu|W lesie jest cicho.
竹|竹[たけ]は 速[はや]く 伸[の]びます|take wa hayaku nobimasu|Bambus szybko rośnie.
犬|犬[いぬ]が 好[す]きです|inu ga suki desu|Lubię psy.
虫|虫[むし]が 苦手[にがて]です|mushi ga nigate desu|Nie znoszę owadów.
貝|海[うみ]で 貝[かい]を 拾[ひろ]いました|umi de kai o hiroimashita|Nad morzem zbierałem muszle.
天|今日[きょう]は 天気[てんき]が いいです|kyō wa tenki ga ii desu|Dziś jest ładna pogoda.
空|空[そら]が 青[あお]いです|sora ga aoi desu|Niebo jest niebieskie.
気|お元気[げんき]ですか|ogenki desu ka|Jak się masz?
雨|雨[あめ]が 降[ふ]って います|ame ga futte imasu|Pada deszcz.
夕|夕方[ゆうがた]に 帰[かえ]ります|yūgata ni kaerimasu|Wracam wieczorem.
年|今年[ことし]は 二千二十六年[にせんにじゅうろくねん]です|kotoshi wa nisen nijūroku nen desu|Ten rok to 2026.
早|朝[あさ] 早[はや]く 起[お]きます|asa hayaku okimasu|Wstaję wcześnie rano.
本|日本[にほん]の 本[ほん]を 読[よ]みます|nihon no hon o yomimasu|Czytam japońską książkę.
文|文[ぶん]を 書[か]いて ください|bun o kaite kudasai|Proszę napisać zdanie.
字|字[じ]が きれいです|ji ga kirei desu|Ma ładne pismo.
学|大学[だいがく]で 日本語[にほんご]を 学[まな]びます|daigaku de nihongo o manabimasu|Na uniwersytecie uczę się japońskiego.
校|学校[がっこう]は 九時[くじ]に 始[はじ]まります|gakkō wa kuji ni hajimarimasu|Szkoła zaczyna się o dziewiątej.
先|先生[せんせい]は 先[さき]に 帰[かえ]りました|sensei wa saki ni kaerimashita|Nauczyciel wyszedł wcześniej.
生|あの 学生[がくせい]は 東京[とうきょう]で 生[う]まれました|ano gakusei wa Tōkyō de umaremashita|Tamten student urodził się w Tokio.
名|お名前[なまえ]は 何[なん]ですか|onamae wa nan desu ka|Jak masz na imię?
王|王様[おうさま]は 城[しろ]に 住[す]んで います|ōsama wa shiro ni sunde imasu|Król mieszka w zamku.
玉|十円玉[じゅうえんだま]が あります|jūen-dama ga arimasu|Mam monetę dziesięciojenową.
円|これは 五百円[ごひゃくえん]です|kore wa gohyaku en desu|To kosztuje pięćset jenów.
力|力[ちから]が 強[つよ]いです|chikara ga tsuyoi desu|Jest silny.
糸|赤[あか]い 糸[いと]を 買[か]いました|akai ito o kaimashita|Kupiłem czerwoną nić.
車|車[くるま]で 駅[えき]へ 行[い]きます|kuruma de eki e ikimasu|Jadę samochodem na stację.
音|音楽[おんがく]の 音[おと]が 大[おお]きいです|ongaku no oto ga ōkii desu|Muzyka gra głośno.
村|小[ちい]さい 村[むら]で 生[う]まれました|chiisai mura de umaremashita|Urodziłem się w małej wsi.
町|この 町[まち]は 静[しず]かです|kono machi wa shizuka desu|To miasteczko jest ciche.
赤|赤[あか]い 車[くるま]が 好[す]きです|akai kuruma ga suki desu|Lubię czerwone samochody.
青|青[あお]い 空[そら]を 見[み]ます|aoi sora o mimasu|Patrzę na niebieskie niebo.
白|白[しろ]い 犬[いぬ]が います|shiroi inu ga imasu|Jest biały pies.
正|この 答[こた]えは 正[ただ]しいです|kono kotae wa tadashii desu|Ta odpowiedź jest poprawna.
立|立[た]って ください|tatte kudasai|Proszę wstać.
休|今日[きょう]は 休[やす]みです|kyō wa yasumi desu|Dziś mam wolne.
見|映画[えいが]を 見[み]ます|eiga o mimasu|Oglądam film.
入|入口[いりぐち]から 入[はい]って ください|iriguchi kara haitte kudasai|Proszę wejść tym wejściem.
出|出口[でぐち]は どこですか|deguchi wa doko desu ka|Gdzie jest wyjście?`.split("\n").forEach(l=>{const p=l.split("|");KSENT[p[0]]={m:p[1],ro:p[2],pl:p[3]}});
const isKanji=c=>/[\u4e00-\u9fff]/.test(c),nKanji=w=>[...w].filter(isKanji).length;
(function(){const seen={};const add=o=>{if(seen[o.w])return;seen[o.w]=1;for(const c of new Set(o.w))if(isKanji(c))(KWORDS[c]=KWORDS[c]||[]).push(o)};
  Object.values(KCOMP).forEach(add);KALL.forEach(it=>add({w:it.w,wr:it.wr,wm:it.wm}))})();
function otherWords(it,comp){
  let l=(KWORDS[it.q]||[]).filter(o=>o.w!==it.w&&(nKanji(o.w)>=2)===comp);
  const own=KCOMP[it.q];if(comp&&own&&own.w!==it.w)l=[own,...l.filter(o=>o.w!==own.w)];
  return l.slice(0,3);
}
const wrow=o=>`<div class="wrow"><span class="jp"><ruby>${o.w}<rt>${o.wr}</rt></ruby></span><span><i>${romaji(o.wr)}</i> = <b>${o.wm}</b></span></div>`;
const kDecks={};
function kanjiDeck(g){
  if(kDecks[g])return kDecks[g];
  let groups;
  if(g===1)groups=KCAT.map((c,i)=>({id:"k"+i,label:c.label,items:c.items}));
  else{groups=[];for(let i=0;i<KG[g].length;i+=20){const items=KG[g].slice(i,i+20);groups.push({id:"s"+i,label:(i+1)+"–"+(i+items.length),items})}}
  return kDecks[g]={id:"kanji"+g,groups,all:KG[g],def:1,byKey:Object.fromEntries(KALL.map(x=>[x.k,x])),qName:"kanji",aName:"znaczenie",kind:"kanji"};
}
const m1=it=>it.a.split(/[,;]/)[0];
const wordHTML=it=>`<ruby>${it.w}<rt>${it.wr}</rt></ruby>`;
function kunHTML(it){
  if(it.kun==="—")return `<span class="small">Ten znak nie ma takiego czytania w podstawowym użyciu.</span>`;
  return it.kun.split("、").map(r=>{const m=r.match(/^([^()]+)(?:\((.+)\))?$/);if(!m)return "";
    const st=m[1],ok=m[2]||"",whole=romaji(st+ok),tail=romaji(ok),head=whole.slice(0,whole.length-tail.length);
    return `<span class="rd"><span class="jp">${it.q}${ok}</span><span class="ro"><b>${head}</b>${tail}</span></span>`}).join("");
}
function onHTML(it){
  if(it.on==="—")return `<span class="small">Ten znak nie ma takiego czytania w podstawowym użyciu.</span>`;
  return it.on.split("、").map(r=>`<span class="rd"><span class="ro"><b>${romaji(r)}</b></span><span class="jp" style="font-size:15px">${toHira(r)}</span></span>`).join("");
}
function partsHTML(it){
  if(it.w===it.q)return "Tutaj znak sam jest całym słowem.";
  const ks=[],kana=[];
  for(const c of it.w){if(/[一-鿿]/.test(c))ks.push(`<span class="jp">${c}</span> ${KMAP[c]?"„"+KMAP[c].a+"”":"(znak spoza listy)"}`);else kana.push(c)}
  return ks.join(" + ")+(kana.length?` + hiragana <span class="jp">${kana.join("")}</span>`:"");
}
/* ---------- zwroty na poziomach ---------- */
const PHRASES=[
["Poziom 1","Pierwsze słowa","Sama hiragana. Te zwroty prawie zawsze pisze się bez kanji.",[
 ["おはようございます","ohayō gozaimasu","Dzień dobry (rano)","Wśród znajomych samo おはよう."],
 ["こんにちは","konnichiwa","Dzień dobry (w ciągu dnia)","Końcowe は to partykuła, czytaj „wa”."],
 ["こんばんは","konbanwa","Dobry wieczór"],
 ["おやすみなさい","oyasuminasai","Dobranoc"],
 ["さようなら","sayōnara","Do widzenia","Brzmi jak pożegnanie na dłużej."],
 ["じゃあね","jā ne","Na razie","Luźno, do znajomych."],
 ["ありがとうございます","arigatō gozaimasu","Dziękuję","Luźniej: ありがとう."],
 ["どういたしまして","dō itashimashite","Nie ma za co"],
 ["すみません","sumimasen","Przepraszam","Także żeby kogoś zaczepić, np. kelnera."],
 ["ごめんなさい","gomen nasai","Przepraszam (moja wina)"],
 ["はい","hai","Tak"],
 ["いいえ","iie","Nie"],
 ["いただきます","itadakimasu","Mówione przed jedzeniem","Coś jak „smacznego”, ale mówisz to sam do siebie."],
 ["ごちそうさまでした","gochisōsama deshita","Dziękuję za posiłek","Mówione po jedzeniu."]]],
["Poziom 2","Katakana w akcji","Hiragana plus słowa zapożyczone, pisane katakaną.",[
 ["わたしは ミハウです","watashi wa Mihau desu","Jestem Michał","Obce imiona zapisuje się katakaną."],
 ["ポーランドから きました","Pōrando kara kimashita","Przyjechałem z Polski"],
 ["コーヒーを ください","kōhī o kudasai","Poproszę kawę","を czytaj „o”. Kreska ー wydłuża samogłoskę."],
 ["メニューを おねがいします","menyū o onegai shimasu","Poproszę menu"],
 ["トイレは どこですか","toire wa doko desu ka","Gdzie jest toaleta?"],
 ["ホテルは どこですか","hoteru wa doko desu ka","Gdzie jest hotel?"],
 ["コンビニは ありますか","konbini wa arimasu ka","Czy jest tu sklep całodobowy?","コンビニ to skrót od angielskiego convenience store."],
 ["カードで いいですか","kādo de ii desu ka","Czy mogę zapłacić kartą?"],
 ["タクシーを よんで ください","takushī o yonde kudasai","Proszę wezwać taksówkę"],
 ["これは パンですか","kore wa pan desu ka","Czy to jest chleb?","パン przyszło z portugalskiego."],
 ["ゲームが すきです","gēmu ga suki desu","Lubię gry"],
 ["テレビを みます","terebi o mimasu","Oglądam telewizję"]]],
["Poziom 3","Pierwsze kanji","Krótkie zwroty z prostymi kanji. Mały podpis nad znakiem (furigana) mówi, jak go przeczytać.",[
 ["初[はじ]めまして","hajimemashite","Miło mi poznać","Tylko przy pierwszym spotkaniu."],
 ["お名前[なまえ]は 何[なん]ですか","onamae wa nan desu ka","Jak masz na imię?"],
 ["お元気[げんき]ですか","ogenki desu ka","Jak się masz?"],
 ["元気[げんき]です","genki desu","Mam się dobrze"],
 ["私[わたし]は 学生[がくせい]です","watashi wa gakusei desu","Jestem studentem"],
 ["水[みず]を ください","mizu o kudasai","Poproszę wodę"],
 ["一[ひと]つ ください","hitotsu kudasai","Poproszę jedno"],
 ["これは 何[なん]ですか","kore wa nan desu ka","Co to jest?"],
 ["今[いま] 何時[なんじ]ですか","ima nanji desu ka","Która jest godzina?"],
 ["駅[えき]は どこですか","eki wa doko desu ka","Gdzie jest stacja?"],
 ["分[わ]かりました","wakarimashita","Rozumiem, jasne"],
 ["分[わ]かりません","wakarimasen","Nie rozumiem"],
 ["もう 一度[いちど] お願[ねが]いします","mō ichido onegai shimasu","Proszę jeszcze raz"],
 ["また 明日[あした]","mata ashita","Do jutra"]]],
["Poziom 4","Pełne zdania","Dłuższe zdania zapisane tak, jak pisze się naprawdę: kanji, hiragana i katakana razem.",[
 ["よろしく お願[ねが]いします","yoroshiku onegai shimasu","Miło mi, polecam się","Zamyka każde przedstawienie się."],
 ["日本語[にほんご]が 少[すこ]し 分[わ]かります","nihongo ga sukoshi wakarimasu","Trochę rozumiem po japońsku"],
 ["英語[えいご]が 分[わ]かりますか","eigo ga wakarimasu ka","Rozumiesz po angielsku?"],
 ["ゆっくり 話[はな]して ください","yukkuri hanashite kudasai","Proszę mówić wolniej"],
 ["日本語[にほんご]を 勉強[べんきょう]して います","nihongo o benkyō shite imasu","Uczę się japońskiego"],
 ["これは いくらですか","kore wa ikura desu ka","Ile to kosztuje?"],
 ["お会計[かいけい]を お願[ねが]いします","okaikei o onegai shimasu","Poproszę rachunek"],
 ["写真[しゃしん]を 撮[と]っても いいですか","shashin o totte mo ii desu ka","Czy mogę zrobić zdjęcie?"],
 ["東京[とうきょう]に 行[い]きたいです","Tōkyō ni ikitai desu","Chcę pojechać do Tokio"],
 ["日本[にほん]の 食[た]べ物[もの]が 好[す]きです","nihon no tabemono ga suki desu","Lubię japońskie jedzenie"],
 ["今日[きょう]は 暑[あつ]いですね","kyō wa atsui desu ne","Gorąco dziś, prawda?"],
 ["とても おいしいです","totemo oishii desu","Bardzo smaczne"],
 ["大丈夫[だいじょうぶ]です","daijōbu desu","W porządku, nie trzeba"],
 ["助[たす]けて ください","tasukete kudasai","Proszę o pomoc"]]]
];
function phraseDeck(){
  const all=[],groups=PHRASES.map(([lv,name,desc,list],gi)=>{
    const items=list.map(([m,ro,a,note])=>{const it={k:"ph:"+m,m,q:plain(m),a,ro,note,say:plain(m),extra:"<i>"+ro+"</i>",kind:"phrase",home:all};all.push(it);return it});
    return {id:"p"+gi,label:lv+": "+name,lv,name,desc,items}});
  return {id:"zwroty",groups,all,def:1,byKey:Object.fromEntries(all.map(x=>[x.k,x])),qName:"japoński",aName:"polski",kind:"phrase"};
}

/* ---------- gramatyka ---------- */
const GRAMMAR=[
{t:"Trzy pisma w jednym zdaniu",b:`<p>Japoński miesza trzy systemy pisma i każdy ma swoją rolę.</p>
<ul><li><b>Hiragana</b> (ひらがな): końcówki gramatyczne, partykuły i rodzime słowa. Od niej zaczynasz.</li>
<li><b>Katakana</b> (カタカナ): zapożyczenia, obce imiona, nazwy krajów.</li>
<li><b>Kanji</b> (漢字): znaki niosące znaczenie, zapisują rdzenie słów.</li></ul>
<p>W normalnym tekście nie ma spacji. Tutaj rozdzielam słowa odstępami, żeby łatwiej było czytać. Przełącznik „Zapis zdań” na górze pokazuje to samo zdanie samą kaną, z kanji i podpisami albo tak, jak pisze się naprawdę.</p>`,
 ex:[["私[わたし]は コーヒーを 飲[の]みます","watashi wa kōhī o nomimasu","Piję kawę. コーヒー to katakana, 私 i 飲 to kanji, reszta to hiragana."]]},
{t:"Wymowa i pułapki zapisu",b:`<ul>
<li>Pięć samogłosek: a, i, u, e, o. Krótkie i czyste, jak po polsku.</li>
<li><b>Długie samogłoski</b> w zapisie łacińskim mają kreskę (ō, ū). W hiraganie dopisuje się う, np. おう czytasz „oo”. Długość zmienia znaczenie: おばさん to ciocia, おばあさん to babcia.</li>
<li><b>Małe っ</b> podwaja następną spółgłoskę: きって (kitte, znaczek). Robisz króciutką pauzę.</li>
<li><b>ん</b> to osobna sylaba „n”.</li>
<li>Trzy partykuły czyta się inaczej, niż się pisze: は jako „wa”, を jako „o”, へ jako „e”.</li>
<li>W です i ます końcowe „u” prawie znika: mów „des”, „mas”.</li></ul>`,
 ex:[["学校[がっこう]","gakkō","szkoła: małe っ i długie ō w jednym słowie"]]},
{t:"Czasownik stoi na końcu",b:`<p>Po polsku mówisz „jem sushi”. Po japońsku kolejność to: kto, co, czasownik. Zdanie zawsze kończy się czasownikiem (albo です).</p>
<p>Podmiot często się pomija, jeśli wiadomo, o kim mowa.</p>`,
 ex:[["私[わたし]は 寿司[すし]を 食[た]べます","watashi wa sushi o tabemasu","Jem sushi (dosłownie: ja sushi jem)."],["寿司[すし]を 食[た]べます","sushi o tabemasu","Jem sushi. „Ja” wynika z kontekstu."],["日本語[にほんご]を 勉強[べんきょう]します","nihongo o benkyō shimasu","Uczę się japońskiego."]]},
{t:"です, czyli „być”",b:`<p>Wzór: <b>A は B です</b>, czyli „A jest B”. Nie ma odmiany przez osoby, rodzajów ani liczby mnogiej.</p>
<div class="tw"><table><tr><th>Forma</th><th>Zapis</th><th>Znaczenie</th></tr>
<tr><td>twierdzenie</td><td class="jp">がくせいです</td><td>jestem studentem</td></tr>
<tr><td>pytanie (+ か)</td><td class="jp">がくせいですか</td><td>czy jesteś studentem?</td></tr>
<tr><td>przeczenie</td><td class="jp">がくせいじゃないです</td><td>nie jestem studentem</td></tr>
<tr><td>przeszły</td><td class="jp">がくせいでした</td><td>byłem studentem</td></tr></table></div>
<p>Pytanie tworzy samo か na końcu. Szyk się nie zmienia, znak zapytania nie jest potrzebny.</p>`,
 ex:[["私[わたし]は 学生[がくせい]です","watashi wa gakusei desu","Jestem studentem."],["これは 本[ほん]ですか","kore wa hon desu ka","Czy to jest książka?"]]},
{t:"Partykuły",b:`<p>Partykuła to krótka sylaba <b>po</b> słowie, która mówi, jaką rolę to słowo pełni w zdaniu. Robi to, co w polskim przypadki i przyimki.</p>
<div class="tw"><table><tr><th>Partykuła</th><th>Czytaj</th><th>Rola</th></tr>
<tr><td class="jp">は</td><td>wa</td><td>temat zdania: „jeśli chodzi o…”</td></tr>
<tr><td class="jp">が</td><td>ga</td><td>podmiot, nowa informacja</td></tr>
<tr><td class="jp">を</td><td>o</td><td>dopełnienie: co robisz, co jesz</td></tr>
<tr><td class="jp">に</td><td>ni</td><td>cel ruchu, punkt w czasie</td></tr>
<tr><td class="jp">で</td><td>de</td><td>miejsce czynności, narzędzie</td></tr>
<tr><td class="jp">の</td><td>no</td><td>przynależność: „czyj”</td></tr>
<tr><td class="jp">も</td><td>mo</td><td>„też”</td></tr>
<tr><td class="jp">と</td><td>to</td><td>„i”, „razem z”</td></tr>
<tr><td class="jp">か</td><td>ka</td><td>pytanie</td></tr></table></div>`,
 ex:[["私[わたし]の 本[ほん]","watashi no hon","moja książka"],["学校[がっこう]に 行[い]きます","gakkō ni ikimasu","Idę do szkoły."],["学校[がっこう]で 勉強[べんきょう]します","gakkō de benkyō shimasu","Uczę się w szkole."],["私[わたし]も 学生[がくせい]です","watashi mo gakusei desu","Ja też jestem studentem."],["犬[いぬ]が います","inu ga imasu","Jest (tu) pies."]]},
{t:"Czasowniki w formie -ます",b:`<p>Forma -ます jest grzeczna i bezpieczna w każdej rozmowie. Są tylko cztery końcówki i działają dla wszystkich osób.</p>
<div class="tw"><table><tr><th>Końcówka</th><th>Przykład</th><th>Znaczenie</th></tr>
<tr><td class="jp">ます</td><td class="jp">たべます</td><td>jem, będę jeść</td></tr>
<tr><td class="jp">ません</td><td class="jp">たべません</td><td>nie jem</td></tr>
<tr><td class="jp">ました</td><td class="jp">たべました</td><td>jadłem</td></tr>
<tr><td class="jp">ませんでした</td><td class="jp">たべませんでした</td><td>nie jadłem</td></tr></table></div>
<p>Nie ma osobnego czasu przyszłego. O przyszłości mówi kontekst, np. słowo あした (jutro).</p>
<p>Pierwsze czasowniki: いきます (iść, jechać), きます (przychodzić), みます (patrzeć), のみます (pić), します (robić), わかります (rozumieć), あります (być, o rzeczach), います (być, o ludziach i zwierzętach).</p>`,
 ex:[["明日[あした] 日本[にほん]に 行[い]きます","ashita nihon ni ikimasu","Jutro jadę do Japonii."],["昨日[きのう] 映画[えいが]を 見[み]ました","kinō eiga o mimashita","Wczoraj oglądałem film."]]},
{t:"これ, それ, あれ",b:`<p>Japoński ma trzy stopnie „tego”, zależnie od odległości.</p>
<div class="tw"><table><tr><th></th><th>przy mnie</th><th>przy tobie</th><th>daleko</th><th>pytanie</th></tr>
<tr><td>rzecz</td><td class="jp">これ</td><td class="jp">それ</td><td class="jp">あれ</td><td class="jp">どれ</td></tr>
<tr><td>przed rzeczownikiem</td><td class="jp">この</td><td class="jp">その</td><td class="jp">あの</td><td class="jp">どの</td></tr>
<tr><td>miejsce</td><td class="jp">ここ</td><td class="jp">そこ</td><td class="jp">あそこ</td><td class="jp">どこ</td></tr></table></div>`,
 ex:[["これは 本[ほん]です","kore wa hon desu","To jest książka."],["その 犬[いぬ]は 大[おお]きいです","sono inu wa ōkii desu","Ten pies (koło ciebie) jest duży."],["トイレは どこですか","toire wa doko desu ka","Gdzie jest toaleta?"]]},
{t:"Przymiotniki: -い i -な",b:`<p>Są dwie grupy i odmieniają się inaczej.</p>
<ul><li><b>Przymiotniki -い</b> kończą się na い: おおきい (duży), ちいさい (mały), あたらしい (nowy), おいしい (smaczny). Stają wprost przed rzeczownikiem. Przeczenie: い zamieniasz na くない. Czas przeszły: い na かった.</li>
<li><b>Przymiotniki -な</b>: しずか (cichy), きれい (ładny, czysty), げんき (zdrowy). Przed rzeczownikiem dostają な. Przeczenie robisz jak przy です: じゃないです.</li></ul>`,
 ex:[["大[おお]きい 犬[いぬ]","ōkii inu","duży pies"],["大[おお]きくないです","ōkikunai desu","Nie jest duży."],["おいしかったです","oishikatta desu","Było smaczne."],["静[しず]かな 町[まち]","shizuka na machi","ciche miasteczko"]]},
{t:"Liczby",b:`<div class="tw"><table><tr><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th></tr>
<tr><td class="jp">いち</td><td class="jp">に</td><td class="jp">さん</td><td class="jp">よん</td><td class="jp">ご</td></tr>
<tr><th>6</th><th>7</th><th>8</th><th>9</th><th>10</th></tr>
<tr><td class="jp">ろく</td><td class="jp">なな</td><td class="jp">はち</td><td class="jp">きゅう</td><td class="jp">じゅう</td></tr></table></div>
<p>Większe liczby składasz jak z klocków: 11 to „dziesięć jeden”, 20 to „dwa dziesięć”. Sto to ひゃく, tysiąc to せん.</p>
<p>4 i 7 mają też czytania し i しち, używane m.in. w nazwach miesięcy. Miesiące to po prostu numery: 四月 (shigatsu) to „czwarty miesiąc”, czyli kwiecień. Wyjątki w setkach: 300 さんびゃく, 600 ろっぴゃく, 800 はっぴゃく.</p>`,
 ex:[["十一[じゅういち]","jū ichi","11"],["二十[にじゅう]","ni jū","20"],["三十五[さんじゅうご]","san jū go","35"],["二百[にひゃく]","ni hyaku","200"]]},
{t:"Poziomy grzeczności",b:`<p>Japoński ma osobne formy dla rozmowy grzecznej i luźnej. Na start wystarczy ci forma です / ます, bo pasuje do każdego rozmówcy.</p>
<ul><li>Wśród bliskich znajomych używa się form prostych: たべる zamiast たべます, だ zamiast です.</li>
<li>Do imienia lub nazwiska rozmówcy dodajesz さん: たなかさん. O sobie nigdy tak nie mówisz.</li></ul>`,
 ex:[["田中[たなか]さんは 先生[せんせい]です","Tanaka-san wa sensei desu","Pan Tanaka jest nauczycielem."]]}
];

/* ---------- decks + routing ---------- */
function themeDeck(){
  const all=[],groups=(window.JA_THEMES||[]).map(([name,desc,list],gi)=>{
    const items=list.map(([m,ro,a,note])=>{const it={k:"ph:t:"+m,m,q:plain(m),a,ro,note,say:plain(m),extra:"<i>"+ro+"</i>",kind:"phrase",home:all};all.push(it);return it});
    return {id:"t"+gi,label:name,lv:"Temat "+(gi+1),name,desc,items}});
  return {id:"tematy",groups,all,def:1,byKey:Object.fromEntries(all.map(x=>[x.k,x])),qName:"japoński",aName:"polski",kind:"phrase"};
}
const DECKS={hiragana:kanaDeck("hiragana",false),katakana:kanaDeck("katakana",true),zwroty:phraseDeck(),tematy:themeDeck()};
/* ---------- kurs chiński ---------- */
const TMK={"ā":"a1","á":"a2","ǎ":"a3","à":"a4","ē":"e1","é":"e2","ě":"e3","è":"e4","ī":"i1","í":"i2","ǐ":"i3","ì":"i4","ō":"o1","ó":"o2","ǒ":"o3","ò":"o4","ū":"u1","ú":"u2","ǔ":"u3","ù":"u4","ǖ":"v1","ǘ":"v2","ǚ":"v3","ǜ":"v4","ü":"v"};
function pyNum(t){return (t||"").normalize("NFC").toLowerCase().replace(/u:/g,"v").split(/[\s'’]+/).filter(Boolean).map(sy=>{let tone="",out="";for(const c of sy){const m=TMK[c];if(m){out+=m[0];if(m[1])tone=m[1]}else if(/[1-4]/.test(c))tone=c;else if(/[a-z]/.test(c))out+=c}return out+tone}).join("")}
const pyBare=t=>pyNum(t).replace(/[0-9]/g,"");
const TONES=["","pierwszy: wysoki i równy","drugi: rosnący, jak w pytaniu „co?”","trzeci: niski, w dół i lekko w górę","czwarty: ostro opadający","neutralny: krótki i lekki"];
const toneOf=py=>+(pyNum(py).match(/[1-4]$/)||[5])[0];
const ZHD=(function(){
  const Z=window.ZH||{HANZI:"",PHRASES:[],GRAMMAR:[]},hg=[],hall=[],map={};let g=null;
  Z.HANZI.split("\n").forEach(ln=>{if(!ln)return;
    if(ln[0]==="#"){g={id:"z"+hg.length,label:ln.slice(1),items:[]};hg.push(g);return}
    const [q,a,py,w,wp,wm,hint]=ln.split("|");
    const it={k:"zh:"+q,q,a,py,w,wp,wm,hint,say:q,kind:"hanzi",home:hall,extra:`pinyin: <b>${py}</b> · <span class="jp">${w}</span> (${wp}) = ${wm}`};
    g.items.push(it);hall.push(it);map[q]=it});
  const pall=[],pg=Z.PHRASES.map(([lv,name,desc,list],gi)=>{
    const items=list.map(([m,a,note])=>{const ro=kanaOf(m),it={k:"zhph:"+m,m,q:plain(m),a,ro,note,say:plain(m),extra:"<i>"+ro+"</i>",kind:"phrase",zh:true,home:pall};pall.push(it);return it});
    return {id:"zp"+gi,label:lv+": "+name,lv,name,desc,items}});
  const by=l=>Object.fromEntries(l.map(x=>[x.k,x]));
  return {map,hall,pall,grammar:Z.GRAMMAR,
    znaki:{id:"zhhanzi",groups:hg,all:hall,def:1,byKey:by(hall),qName:"znak",aName:"znaczenie",kind:"hanzi"},
    zwroty:{id:"zhzwroty",groups:pg,all:pall,def:1,byKey:by(pall),qName:"chiński",aName:"polski",kind:"phrase"}};
})();
const JAITEMS=[...DECKS.hiragana.all,...DECKS.katakana.all,...KALL,...DECKS.zwroty.all,...DECKS.tematy.all],ZHITEMS=[...ZHD.hall,...ZHD.pall];
global.GlosaCurriculum = { RUBY, plain, kanaOf, KANA, toKata, toHira, RM, romaji, PLX, AMB, plRead, SETNAME, CONF, kanaDeck, KANJI_RAW, KMAP, KG, KCAT, KELEM, KALL, KCOMP, KSENT, KWORDS, otherWords, wrow, kanjiDeck, m1, wordHTML, kunHTML, onHTML, partsHTML, PHRASES, phraseDeck, GRAMMAR, themeDeck, DECKS, TMK, pyNum, pyBare, TONES, toneOf, ZHD, JAITEMS, ZHITEMS };
})(window);

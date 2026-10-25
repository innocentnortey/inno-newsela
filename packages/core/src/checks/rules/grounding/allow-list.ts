// Routine, section, label and program words that are never names (lowercase).
export const ALLOW: ReadonlySet<string> = new Set([
  "launch","literacy","lab","learning","action","look","back","homework","part","think","pair","share","turn","talk",
  "quick","write","pulse","check","checks","understanding","reflection","teacher","teachers","tip","tips","integrated",
  "instructions","additional","student","students","support","situation","try","struggling","ready","extension",
  "correct","incorrect","say","ask","directions","purpose","watch","emerging","expanding","bridging","newcomers",
  "content","language","foundational","skills","knowledge","building","enduring","future","lessons","lesson","unit",
  "performance","task","vocabulary","addressed","routines","materials","essential","questions","question",
  "connection","connections","today","edition","graphic","organizer","organizers","notes","section","sequence",
  "pacing","minutes","chapter","chapters","page","pages","grade","investigation","flex","day","days","spark","reading",
  "writing","discussion","academic","research","presentation","assessment","mid","end","novel","short","form","text",
  "texts","card","standards","standard","focus","supporting","california","common","core","english","spanish",
  "greek","latin","mr","mrs","ms","dr","ok","monday","tuesday","wednesday","thursday","friday","saturday","sunday",
  "january","february","march","april","may","june","july","august","september","october","november","december",
  "morphemes","introduce","new","words","word","study","context","clues","routine","gallery","walk","graffiti","table",
  "jigsaw","seminar","close","chunk","meaning","function","criteria","beginning","developing","checklist","rubric",
  "exit","ticket","warm","up","review","reteach","guided","practice","independent","choice","work","teach","model",
  "target","sentence","block","view","families","huddle","making","explanatory","paragraph","evidence","chart",
]);

// Common words that may open a sentence (lowercase). Used only for sentence-initial tokens.
export const STARTERS: ReadonlySet<string> = new Set([
  "a","an","the","this","that","these","those","it","its","he","she","they","we","you","i","his","her","their","our",
  "your","my","if","when","what","why","how","which","who","whom","whose","where","in","on","at","for","from","with",
  "without","by","to","of","as","after","before","during","while","because","since","so","but","and","or","nor","yet",
  "also","then","next","now","today","tonight","tomorrow","yesterday","first","second","third","finally","last","here",
  "there","both","each","every","some","many","most","all","any","no","not","yes","one","two","three","four","five",
  "once","again","still","even","just","only","instead","remember","ask","say","read","reread","write","discuss",
  "share","turn","think","look","point","remind","display","model","pause","invite","circulate","listen","use","choose",
  "explain","have","give","tell","show","check","review","underline","highlight","annotate","notice","consider",
  "return","collect","call","project","post","distribute","partner","guide","prompt","encourage","let","make","record",
  "add","fill","complete","compare","contrast","identify","describe","begin","start","finish","continue","answer",
  "option","great","good","nice","sample","possible","possibly","likely","maybe","perhaps","students","student",
  "teachers","teacher","partners","pairs","groups","small","whole","offer","provide","keep","ensure","set","take",
  "bring","move","work","practice","try","find","mark","circle","cite","support","connect","preview","close","open",
  "label","sort","match","list","define","revise","edit","draft","plan","gather","select","draw","sketch",
]);

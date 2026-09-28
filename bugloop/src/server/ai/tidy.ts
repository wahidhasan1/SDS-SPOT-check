// Offline tidy-up for improvement suggestions: fixes common misspellings, capitals, spacing and
// punctuation. It never rewrites meaning; Claude does the real rewriting when it is available.

import type { PolishOutput, PolishRequest } from "./provider";

const WORDS: Record<string, string> = {
  i: "I", im: "I'm", ive: "I've", id: "I'd", ill: "I'll",
  dont: "don't", doesnt: "doesn't", didnt: "didn't", cant: "can't", wont: "won't", isnt: "isn't", arent: "aren't",
  wasnt: "wasn't", shouldnt: "shouldn't", wouldnt: "wouldn't", couldnt: "couldn't", thats: "that's", theres: "there's",
  u: "you", ur: "your", pls: "please", plz: "please", thx: "thanks", abt: "about", bcz: "because", bcoz: "because", coz: "because",
  becuase: "because", becasue: "because", becouse: "because", beacuse: "because",
  teh: "the", adn: "and", wich: "which", whit: "with", thier: "their", recieve: "receive", seperate: "separate",
  definately: "definitely", alot: "a lot", untill: "until", occured: "occurred", sucess: "success", succesful: "successful",
  shoud: "should", shold: "should", shuold: "should", woud: "would", coud: "could",
  evry: "every", everytime: "every time", somthing: "something", somthings: "some things", nothig: "nothing",
  usefull: "useful", userfriendly: "user-friendly", hassel: "hassle", hasssel: "hassle", hasle: "hassle",
  improvment: "improvement", improvments: "improvements", improove: "improve", sugest: "suggest", sugestion: "suggestion",
  enginner: "engineer", enginners: "engineers", enginer: "engineer", funtion: "function", funtions: "functions",
  unnecessery: "unnecessary", unnecery: "unnecessary", unneccessary: "unnecessary", neccessary: "necessary", necesary: "necessary",
  interfadce: "interface", intreface: "interface", buton: "button", butons: "buttons", clik: "click", cliking: "clicking",
  tottal: "total", noticable: "noticeable", visable: "visible", easely: "easily", realy: "really", confusng: "confusing",
  dificult: "difficult", diffrent: "different", differnt: "different", colour: "colour", paage: "page", seach: "search",
  filtr: "filter", coloumn: "column", coloumns: "columns", colum: "column", colums: "columns", widht: "width", heigth: "height",
  lenght: "length", langauge: "language", notifcation: "notification", notifcations: "notifications", dashbord: "dashboard", optoin: "option", optin: "option", dropdwon: "dropdown", scrol: "scroll", scroling: "scrolling",
};

function fixWord(w: string): string {
  const lower = w.toLowerCase();
  const fixed = WORDS[lower];
  if (!fixed) return w;
  // Keep a leading capital the writer used, except for "I" words which are always capitalised.
  return w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase() ? fixed[0].toUpperCase() + fixed.slice(1) : fixed;
}

/** Spelling, capitals, spacing and punctuation. Meaning and word order are left alone. */
export function tidyEnglish(text: string, names: string[] = []): string {
  let s = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{2,}/g, "\n").trim();
  s = s.replace(/\s*\n\s*/g, ". ");
  s = s.replace(/[A-Za-z']+/g, (w) => fixWord(w));
  // "to" before an adjective of degree is almost always "too".
  s = s.replace(/\b([Tt])o (narrow|small|big|large|long|short|slow|fast|hard|much|many|wide|dark|light|bright|close|busy|crowded|confusing|little|high|low)\b/g, "$1oo $2");
  // "its" followed by a description is almost always "it's".
  s = s.replace(/\b([Ii])ts (not|really|very|so|too|a|an|hard|easy|confusing|ok|okay|better|good|bad|difficult|annoying|slow|fine)\b/g, "$1t's $2");
  s = s.replace(/\s+([,.!?;:])/g, "$1").replace(/([,;:])(?=\S)/g, "$1 ");
  s = s.replace(/\.{2,}/g, ".").replace(/([!?]){2,}/g, "$1").replace(/[.,]\s*\./g, ".");
  s = s.replace(/\.(?=[A-Za-z])/g, ". ");
  // Product and module names keep their own spelling ("crm" → "CRM").
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    s = s.replace(new RegExp(`\\b${escaped}\\b`, "gi"), name);
  }
  const sentences = s
    .split(/(?<=[.!?])\s+/)
    .map((x) => x.trim())
    .filter(Boolean)
    .map((x) => x[0].toUpperCase() + x.slice(1))
    .map((x) => (/[.!?]$/.test(x) ? x : `${x}.`));
  return sentences.join(" ").replace(/\s{2,}/g, " ");
}

const OPENERS = /^(i think|i feel|i suggest|i would suggest|i want|i would like|it would be (nice|good|better|great) if|we should|please|kindly|maybe|there should be|can we|could we)\b[\s,]*/i;

function titleFrom(body: string): string {
  const first = body.split(/(?<=[.!?])\s+/)[0] ?? body;
  let t = first.replace(/[.!?]+$/, "").replace(OPENERS, "").trim();
  if (!t) t = first.replace(/[.!?]+$/, "");
  t = t[0]?.toUpperCase() + t.slice(1);
  if (t.length > 80) t = `${t.slice(0, 77).replace(/\s+\S*$/, "")}…`;
  return t;
}

export function polishOffline(req: PolishRequest): PolishOutput {
  const body = tidyEnglish(req.text, [req.project, ...req.modules.map((m) => m.name)].filter((n) => n.length > 1));
  const lower = ` ${req.text.toLowerCase()} `;
  const mentioned = req.modules.filter((m) => lower.includes(` ${m.name.toLowerCase()}`)).sort((a, b) => b.name.length - a.name.length)[0];
  return { title: titleFrom(body), body, module: req.module ? null : mentioned?.name ?? null };
}

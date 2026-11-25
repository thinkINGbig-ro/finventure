# Finventure — joc web de educație financiară (concurs Banometru)

> **Stare: fazele A–F sunt terminate; a început EXTINDEREA (loturile 0–9) pe ramura `extindere`.** Pe `main` (publicat pe GitHub Pages) ajung doar loturi terminate, cu testele trecute și simularea rulată, și doar după confirmarea echipei. `main` trebuie să rămână jucabil în orice moment. Vezi secțiunea 14, „Stare curentă”, înainte de orice altă modificare.

## 1. Context

Finventure este un joc web de tip life-simulator (inspirat de BitLife) pentru concursul național de educație financiară Banometru (elevi de clasa IX–X).

- **Publicul:** adolescenți de 14–17 ani, care se plictisesc repede și NU vor să „învețe”. Jocul trebuie să învețe fără să pară lecție.
- **Obiectivul:** să acopere practic toată educația financiară de bază (studii, muncă, salariu, buget, produse bancare, credite, investiții, taxe, pensie, înșelătorii) prin decizii și consecințele lor.
- **Limba:** tot textul din joc e în română, cu diacritice, pe un ton relaxat (fără limbaj de manual, fără moralizare).
- **Arhitectura:** motorul trebuie gândit de la început pentru un arbore mare de decizii (sute de evenimente).

## 2. Bucla principală (ca în BitLife)

- Jucătorul pornește la **18 ani**, după liceu.
- **Butonul principal „Avansează”** (mare, portocaliu, jos pe ecran) trece timpul cu **1 an**.
- **Finanțele se simulează lunar în fundal:** la fiecare „Avansează” motorul rulează 12 luni (salariu, cheltuieli fixe, rate, dobânzi, randamente, inflație). La final afișează un rezumat al anului.
- **Evenimentele opresc anul în luna în care au loc.** În timpul anului apar 1–3 evenimente de decizie, alese de motor după vârstă, fază, stare și flag-uri. Fiecare are o lună a lui: simularea se oprește acolo („Martie, 22 de ani”), jucătorul decide, apoi anul continuă de unde a rămas. Așa jucătorul simte trecerea lunilor fără să apese de 12 ori.
- **Momentele-cheie au un ecran dedicat,** indiferent de pas: primul salariu (cu fluturașul), prima rată, prima poprire, primul an pe plus la investiții.
- **Între apăsări, jucătorul poate acționa singur din meniuri**: Bancă, Investiții, Carieră, Educație, Cumpărături. Exemple: deschide un depozit, cere o mărire, își face CV-ul.
- **Jurnalul vieții** (ca în BitLife) afișează cronologic ce s-a întâmplat: „19 ani: Ți-ai luat primul job, ca barista.”
- **Jocul se termină** fie la pensionare (65 de ani), fie la un game over (vezi secțiunea 7).

## 3. Statistici

**Vizibile (4 bare, 0–100):**
- **Bani**: lichiditatea (nu suma absolută). Se calculează din numerarul disponibil raportat la cheltuielile lunare.
- **Fericire**
- **Energie**: oboseală, sănătate, stres.
- **Viitor**: economii, investiții, pensie, educație.

**Ascunse (influențează evenimentele și ofertele):**
- `skill`: studii, cursuri, experiență
- `scorCredit`: istoric la Biroul de Credit
- `retea`: prieteni sau familie care te pot ajuta, cât de mult au încredere în tine
- `reputatie`: profesională, contează pentru CV și oferte

**Valori financiare reale**, afișate în lei: numerar, conturi, investiții, datorii, venit lunar net, cheltuieli lunare, avere netă.

## 4. Fazele vieții și harta de conținut

Asta e harta tematică. Fiecare ramură devine evenimente în JSON.

### Faza 1 — După liceu (18 ani)
- **Prima decizie mare:** facultate de stat (la buget sau cu taxă), facultate privată, facultate în străinătate, școală postliceală sau profesională, direct la muncă, sau an sabatic.
- **Unde locuiești:** acasă, la cămin sau în chirie cu colegi.
- **Bursă** (de merit sau socială), în funcție de `skill` și de alegeri.
- **Primul cont bancar:** cont curent, card de debit, cont pentru tineri. Concepte: IBAN, comisioane, contactless, cum arăți un extras.

### Faza 2 — Studenție / primii ani (18–22)
- **Muncă în timpul facultății:** part-time, internship, freelancing, Work and Travel sau deloc. Fiecare are efecte pe Energie, `skill` și Bani.
- **Tipul contractului:** contract de muncă (CIM), PFA sau „la negru”. La negru: bani mai mulți pe moment, dar fără vechime, fără asigurare medicală și fără contribuții la pensie. Consecințele apar mai târziu.
- **Primul buget lunar:** bursă + bani de la părinți + salariu.
- **Tentații:** telefon în rate, „cumpără acum, plătește mai târziu” (BNPL), abonamente uitate, hype crypto, pariuri sportive (prezentate ca risc, cu consecințe).
- **Înșelătorii:** phishing prin SMS, „angajare” care cere bani în avans, „investiții garantate”.

### Faza 3 — Primul job full-time (22–25)
- **CV-ul:** un mini-joc în care alegi ce pui în CV (experiență, proiecte, voluntariat, limbi străine). Calitatea lui stabilește ofertele.
- **Ofertele:** primești 3 oferte de job (salariu brut, beneficii, oraș, șanse de creștere). Alegi una sau mai cauți.
- **Negocierea salariului:** accepți, negociezi sau refuzi. Riscul și câștigul depind de `skill` și `reputatie`.
- **Fluturașul de salariu:** brut → net (CAS, CASS, impozit, deduceri), afișat clar la primul salariu.
- **Beneficii:** tichete de masă, abonament medical, Pilonul III plătit de angajator.
- **Fondul de urgență:** 3–6 luni de cheltuieli. Jocul îl testează prin evenimente neprevăzute.
- **Prima chirie singur:** contract, garanție, utilități.

### Faza 4 — Construire (25–35)
- **Investiții:**
  - depozit bancar și garantarea depozitelor
  - titluri de stat (Tezaur, Fidelis)
  - ETF-uri, acțiuni
  - crypto, aur
- **Concepte de investiții:** risc/randament, diversificare, comisioane, dobânda compusă, orizontul de timp.
- **Credite:**
  - card de credit (perioada de grație, plata minimă, capcana)
  - credit de nevoi personale
  - credit ipotecar: DAE, avans, dobândă fixă vs. variabilă, indicele de referință
  - leasing auto
- **Locuință:** chirie vs. cumpărare.
- **Mașină:** cash, leasing sau rate; asigurări RCA și CASCO.
- **Antreprenoriat:** PFA sau SRL, venituri neregulate, taxe.
- **Taxe pe venituri extra:** chirii, dividende, câștiguri din investiții, Declarația unică.

### Faza 5 — Maturitate (35–65)
- **Pensia:** Pilonul I, II și III. Simulator de dobândă compusă.
- **Crize:** pierderea jobului, inflație mare, prăbușirea bursei (testul: vinzi în panică sau păstrezi?), o problemă de sănătate costisitoare.
- **Independența financiară:** venitul pasiv ≥ cheltuielile. Dacă o atingi, deblochezi un final special.
- **Final la 65 de ani:** avere netă, tipul de jucător, conceptele deblocate.

## 5. Modelul de decizie (arbore implementat ca graf de stări)

Nu vrem un arbore literal (explodează combinatoric). Vrem **evenimente cu condiții, flag-uri și consecințe întârziate**, care produc în practică un arbore foarte ramificat.

### Ramura de referință (implementeaz-o exact, ca model pentru restul)

Pe ecran apar max. 4 alegeri, așa că ramura e grupată în doi pași (sub-alegeri). Gruparea e și ea o lecție: bani proprii vs. datorie vs. muncă.

```
Situație: ai nevoie urgentă de 2.000 lei (s-a stricat laptopul / cheltuială medicală)
├─ „Din banii mei” →
│  ├─ Folosești fondul de urgență        [cere: fond ≥ suma; fondul = cont de economii marcat de jucător]
│  │    → rezolvat, Viitor scade puțin. Concept: fond de urgență
│  ├─ Spargi depozitul                   [cere: depozit ≥ suma]
│  │    → primești doar suma depusă, dobânda se pierde. Concept: depozit (nu e fond de urgență)
│  └─ Plătești cu cardul de credit       [cere: are card de credit, limită suficientă]
│       ├─ Achiți integral în perioada de grație → 0 dobândă. Concept: perioada de grație
│       └─ Plătești doar minimul → dobânda se adună lunar. Concept: plata minimă
├─ „Mă împrumut” →
│  ├─ De la un prieten                   [cere: retea ≥ prag]
│  │    → flag datorie_prieten, termen 6 luni
│  │    ├─ Returnezi la timp → retea crește
│  │    └─ Nu returnezi → Fericire scade, retea scade mult, prietenul nu te mai ajută
│  └─ Credit rapid de la IFN
│       → bani imediat, flag datorie_ifn, DAE foarte mare
│       ├─ Folosești inteligent: rambursare în 30 de zile (unele IFN au prima perioadă fără dobândă)
│       │    → scapi cu cost mic. Concept: DAE, citirea contractului
│       ├─ Plătești la timp, dar pe termen lung → ai plătit vizibil mai mult. Concept: costul total al creditului
│       └─ Întârzii la plată → penalități, raportare la Biroul de Credit (scorCredit scade)
│            ├─ Iei alt IFN ca să-l plătești pe primul → spirala datoriilor (eveniment în lanț)
│            └─ Nu mai plătești → datoria e vândută unei firme de recuperare
│                 → executare silită → POPRIRE pe salariu și pe cont (peste suma protejată)
│                 → mai târziu: credit ipotecar refuzat din cauza istoricului
└─ „Muncesc în plus” (vinzi ceva / ore suplimentare) → Energie scade, fără datorii
```

### Facturile neplătite (același tip de lanț)

Chiria, utilitățile și telefonul se plătesc după mâncare. Ce rămâne neplătit devine restanță, cu penalități lunare:
somație (eveniment) → deconectare la utilități / suspendare la telefon / evacuare la chirie → recuperatori → executare → poprire.
Lipsa banilor duce astfel la **faliment**, cu lanțul de decizii (pornește de la decizia care a ales locuința), nu la „renunțare”.

### Formatul evenimentelor (implementat; validat la încărcare de js/content.js)

```json
{
  "id": "urgenta-2000",
  "titlu": "Ai nevoie urgent de bani",
  "faza": [2, 3, 4],
  "conditii": { "varstaMin": 19, "lipsaFlag": ["urgenta_recenta"] },
  "pondere": 3,
  "checkpoint": true,
  "variabile": { "suma": 2000 },
  "text": "Ți s-a stricat laptopul chiar înainte de sesiune. Reparația costă {suma} lei.",
  "alegeri": [
    {
      "id": "din-banii-mei",
      "eticheta": "Din banii mei",
      "subalegeri": [
        {
          "id": "fond",
          "eticheta": "Folosesc fondul de urgență",
          "cere": { "fondUrgentaMin": "{suma}" },
          "sursaPlata": "fondUrgenta",
          "efecte": { "numerar": "-{suma}", "viitor": -3 },
          "flaguri": ["urgenta_recenta:12"],
          "concepte": ["fond-urgenta"]
        }
      ]
    },
    {
      "id": "ma-imprumut",
      "eticheta": "Mă împrumut",
      "subalegeri": [
        {
          "id": "ifn",
          "eticheta": "Iau un credit rapid de la IFN",
          "produsNou": { "tip": "credit", "furnizor": "ifn", "suma": "{suma}", "dae": "config:ifn.dae", "luni": 6, "laRestanta": "ifn-restanta", "flag": "datorie_ifn" },
          "efecte": { "numerar": "-{suma}" },
          "urmari": [{ "eveniment": "ifn-alegere", "dupaLuni": 1 }],
          "lectie": "Banii vin în 15 minute, dar DAE poate trece de 100% pe an. Citește costul total, nu doar rata.",
          "concepte": ["dae", "ifn"]
        }
      ]
    },
    { "id": "muncesc", "eticheta": "Muncesc în plus", "efecte": { "energie": -15 } }
  ]
}
```

Reguli de format:
- **Variabile:** `"variabile": { "suma": 2000 }` (lei la prețurile de start, ajustați automat cu inflația), `"config:…"`, `"balans:…"` sau `"stare:…"`. Se folosesc ca `{suma}` în texte și ca `"-{suma}"` în valori.
- **Un credit nou îți dă banii automat;** cheltuiala se scrie separat (`"numerar": "-{suma}"`).
- **`sursaPlata`** pentru plăți: `portofel` (implicit: cont curent, apoi cash), `cash`, `fondUrgenta`, `cardCredit`.
- **Sub-alegeri:** o alegere cu `subalegeri` e un grup (are doar `id`, `eticheta`, `cere` opțional). Un singur nivel. Calea aleasă e `"grup/sub"`.
- **Lanț imediat:** o urmare cu `"dupaLuni": 0` deschide cardul următor direct după decizie (ex. pașii CV-ului) și nu consumă din plafonul de 4 opriri pe an.
- **Cariera:** `"oferte": true` pe eveniment generează 0–3 oferte din CV (variabilele `{oferta1..3}`, `{brut1..3}`); alegerile folosesc `acceptaOferta` / `negociazaOferta` (1–3), `cereMarire: true`, `promovare: true`; condiții `areOferta`, `jobProgram`, `inStudii`, `promovareDisponibila`.
- **Stilul de viață:** efectul `"stilViata": 1 | -1 | "modest" | "confortabil" | "lux"`, condiția `"stilViata": [...]`.
- **Bani:** `retrageEconomii` mută bani din economii în cont; condiția `economiiMin`; o recurență cu `"locuinta": "acasa"` se oprește când te muți.
- **`etichete`** (ex. `["inselatorie"]`, `["rate"]`, `["stilSus"]`): nu schimbă jocul; le folosesc simularea pe profiluri și rapoartele.

### Ce trebuie să suporte motorul

- **Condiții:** vârstă, fază, flag-uri prezente sau lipsă, praguri pe statistici, produse deținute (ex. `are card_credit`), job, studii.
- **Alegeri cu cerințe:** opțiunile indisponibile apar dezactivate, cu motivul afișat („Nu ai card de credit”). Așa jucătorul vede ce ar fi putut face.
- **Efecte:** imediate (statistici, numerar) și recurente (o rată lunară timp de N luni, un abonament, o poprire).
- **Flag-uri cu durată:** de exemplu `urgenta_recenta:12` expiră după 12 luni.
- **Consecințe întârziate:** o alegere programează un eveniment-urmare după N luni, cu o anumită probabilitate (ex. 3 luni după IFN apare „Rata la IFN”).
- **Produse financiare ca obiecte reale,** procesate lunar: conturi, depozite, carduri de credit, credite, investiții, contracte de muncă.
- **Între 2 și 4 alegeri pe ecran.** Când sunt mai multe variante, se grupează în doi pași (sub-alegeri, tot 2–4 pe nivel); grupul e indisponibil doar dacă nicio variantă din el nu e posibilă, iar variantele indisponibile rămân vizibile, cu motivul. Când sunt fix 2, se poate face și swipe stânga/dreapta.
- **RNG cu seed,** pentru reproducere și testare.

## 6. Mecanica de învățare (partea cea mai importantă)

- **Zero teorie la început:** fără tutorial lung, fără cont. Primul ecran e deja prima decizie (ce faci după liceu).
- **Lecții scurte după alegeri importante,** de max. 2 propoziții, ca un toast/card mic. Nu blochează jocul.
- **Enciclopedia Finventure:** fiecare concept financiar întâlnit (DAE, poprire, ETF, CASS, perioada de grație…) se deblochează și se colecționează („Concepte deblocate: 23/80”). Fiecare intrare are o explicație de 3–5 propoziții, cu un exemplu în lei. Un concept poate fi deschis și din cardul de lecție.
- **Ecranul de eșec „Ce s-a întâmplat?”:**
  - lanțul de decizii care a dus acolo (ex. IFN → întârziere → al doilea IFN → poprire)
  - „Ce trebuia să faci”: alternativa concretă, nu o predică
  - **„Încearcă din nou de la decizia X”**: checkpoint la decizia-cheie din lanț. Jocul salvează automat câteva checkpoint-uri.
- **Finaluri colecționabile (achievements):** ex. „Rentierul”, „Victima Black Friday”, „Minimalistul”, „Regele IFN-urilor”, „Libertate la 40”.
- **Card de distribuit la final:** imagine generată pe canvas, ex. „Finventure: am ieșit la pensie la 52 de ani cu 1,2 mil. lei. Tu?”, plus link. Web Share API, cu fallback pe descărcarea imaginii.

## 7. Game over

Jocul NU se termină la prima greșeală. Game over apare doar în situații-limită:
- **Bani la 0** și datorii peste un prag, timp de mai multe luni → „faliment personal”.
- **Energie la 0** → „burnout” (ai muncit 3 joburi și ai cedat).
- **Fericire la 0** → final trist, dar tratat cu grijă și fără detalii grele: „ai renunțat la tot”, nu ceva legat de sănătatea mintală.

Viitor scăzut nu dă game over. Dă un final slab la pensie, cu explicație.

## 8. Valorile economice

- **Toate cifrele într-un singur loc:** `data/config.json`. Asta include salarii pe joburi și niveluri, chirii, prețuri, procente CAS/CASS/impozit, dobânzi, DAE tipice, randamente medii și volatilitate, inflație, limita de poprire, contribuțiile la Pilonul II și III, plafonul de garantare a depozitelor, taxele pe investiții.
- **Fiecare valoare are câmpurile** `"deVerificat": true` și `"sursa": ""`. Echipa le verifică cu un specialist. **Nu inventa cifre ca fiind sigure.** Pune valori plauzibile și lasă-le marcate.
- **Randamentele investițiilor** au o componentă aleatoare cu seed (ani buni, ani răi, un crash rar), ca jucătorul să simtă riscul.
- **Inflația** se aplică anual pe prețuri și salarii (salariile cresc mai încet dacă nu negociezi sau nu schimbi jobul).

## 9. Interfața

- **Mobile-first;** pe desktop jocul apare centrat, cu lățime de telefon.
- **Ecranul principal:**
  - **sus:** nume, vârstă, numerar, cele 4 bare
  - **mijloc:** jurnalul vieții (scroll)
  - **jos:** butonul „Avansează” și o bară cu tab-urile Bancă / Investiții / Carieră / Educație / Cumpărături / Enciclopedie
- **Evenimentele** apar ca un card mare peste ecran, cu alegerile ca butoane (plus swipe când sunt 2).
- **Rezumatul anului** după fiecare „Avansează”: venituri, cheltuieli, cât ai pus deoparte, ce s-a schimbat.
- **Font:** Fredoka sau Nunito (Google Fonts), rotunjit, de joc.
- **Animații:** scurte (swipe, bare care se umplu, monede la venit). Fără efecte grele.
- **Accesibilitate:** contrast bun, butoane mari, informația nu e transmisă doar prin culoare, totul se poate face și din tastatură.

### Branding (regula 60-30-10, temă întunecată)

```css
:root {
  --bg: #1E1638;      /* 60% mov închis: fundalul aplicației */
  --main: #3B5BDB;    /* 30% albastru: carduri, bare, elemente secundare */
  --accent: #FF8A3D;  /* 10% portocaliu: butonul Avansează, decizia principală, banii */
  --text: #F3EEFF;    /* text pe mov și pe albastru */
  --gain: #34C77B;    /* doar feedback câștig */
  --loss: #FF5A6E;    /* doar feedback pierdere / game over */
}
```
- **Portocaliul se folosește puțin:** doar pe butonul „Avansează”, pe acțiunea principală dintr-un card și pe banii care intră.
- **Textul de pe butoanele portocalii** e `--bg` (mov închis), nu alb.
- **Verdele și roșul** apar doar ca feedback la schimbarea valorilor.
- **Logo:** placeholder în `assets/logo.svg` (îl înlocuim noi). Numele „Finventure” are „Fin” în portocaliu și „venture” în `--text`.

## 10. Constrângeri tehnice

- **HTML + CSS + JavaScript vanilla, ES modules.** Fără framework, fără build, fără npm pentru joc.
- **Rulează direct pe GitHub Pages** din rădăcina repo-ului.
- **Salvare în localStorage cu try/catch.** Jocul merge și dacă storage-ul e blocat. O salvare curentă + checkpoint-uri + achievements + enciclopedie.
- **Stratul de salvare e abstractizat** (`storage.js`), ca să putem adăuga mai târziu un clasament online (ex. Supabase) fără să rescriem jocul. Deocamdată există doar **clasament local**: cele mai bune rezultate pe acest dispozitiv.
- **Conținutul** (evenimente, joburi, concepte, finaluri) stă în JSON, separat de logică. Colegii de echipă trebuie să poată adăuga evenimente fără să atingă codul.
- **Codul e lizibil,** cu comentarii doar unde logica nu e evidentă.

## 11. Structura proiectului

```
index.html
css/style.css
js/main.js          pornire, rutare între ecrane
js/state.js         starea jucătorului, salvare/încărcare
js/engine.js        bucla anuală, simularea lunară, procesarea produselor
js/events.js        selecția evenimentelor, condiții, efecte, flag-uri, urmări programate
js/finance.js       salariu brut/net, dobânzi, credite, investiții, inflație
js/cariera.js       CV, oferte, negociere, mărire, promovare
js/bilant.js        bilanțul vieții, pensia estimată, independența financiară
js/tipare.js        tiparele de la final (ce te-a costat / ce te-a ajutat)
js/finaluri.js      alegerea finalului colecționabil
js/content.js       încărcarea JSON-urilor + validarea schemei
js/analiza.js       analiza legăturilor dintre JSON-uri
js/simulare.js      profilurile de jucător și simularea
js/ui/*.js          ecrane: principal, card eveniment, rezumat an, meniuri, enciclopedie, final
js/share.js         cardul final pe canvas
js/storage.js       localStorage abstractizat
data/config.json    valori economice (deVerificat)
data/balans.json    parametri de joc / echilibrare (nu valori economice)
data/jobs.json
data/events/*.json  un fișier per fază sau temă (faza1.json, credite.json, inselatorii.json…)
data/concepts.json  enciclopedia
data/endings.json
tools/validate.html verificare conținut (vezi mai jos)
tools/formateaza-json.js  formatează JSON-urile de conținut (node)
tests/run.js + tests/run.html  testele motorului (Node / browser, același cod)
tests/simulare.js   simulare de echilibru: node tests/simulare.js [--n 1000]
tools/tree.html     vizualizare arbore de decizii (Mermaid de pe CDN, doar în unealtă)
assets/
README.md           prezentarea pentru public (jucători, profesori, părinți, juriu): fără detalii tehnice
docs/DEZVOLTARE.md  documentația tehnică: rulare locală, GitHub Pages, structura, cum adaugi un eveniment, teste, simulare, unelte
```

## 12. Unelte pentru conținut și testare

- **`tools/validate.html`** încarcă toate JSON-urile și raportează:
  - id-uri duplicate
  - referințe la evenimente, flag-uri sau concepte inexistente
  - flag-uri setate dar niciodată citite (și invers)
  - evenimente imposibil de atins
  - concepte fără nicio sursă
- **`tools/tree.html`** generează o diagramă a ramurilor (eveniment → alegere → urmare), filtrabilă pe fază. O folosim și în prezentarea pentru juriu.
- **Mod debug** (`?debug=1`):
  - sari la o vârstă
  - setezi statistici sau flag-uri
  - forțezi un eveniment
  - vezi starea completă
- **Simulare automată** (în debug): rulează 1.000 de vieți cu alegeri aleatoare și raportează distribuția finalurilor, vârsta medie la game over și evenimentele care nu apar niciodată. Ne ajută să echilibrăm dificultatea.

## 13. Cum lucrăm

1. **Citește tot fișierul.** Apoi prezintă-mi pe scurt planul: modelul de stare, bucla anuală, formatul final al evenimentelor și cum procesezi produsele financiare lunar. **Așteaptă confirmarea înainte să scrii cod.**
2. ✅ **Faza A (motorul):** stare, „Avansează”, simulare lunară, evenimente cu condiții/flag-uri/urmări, salvare. Testează cu 5 evenimente.
3. ✅ **Faza B (UI-ul de bază):** ecranul principal, cardul de eveniment, rezumatul anului, jurnalul, branding-ul.
4. ✅ **Faza C (conținut, fazele de viață 1–3):**
   - minim 40 de evenimente
   - ramura IFN completă din secțiunea 5
   - fluturașul brut/net
   - CV-ul și cele 3 oferte
   - primele 25 de concepte în enciclopedie
5. ✅ **Faza D:** ecranul „Ce s-a întâmplat?”, checkpoint-urile, finalurile, achievements, cardul de distribuit.
6. ✅ **Faza E:** `tools/validate.html`, modul debug, testare pe mobil, deploy pe GitHub Pages, README.
7. ✅ **Faza F:** conținutul pentru fazele de viață 4–5, simularea automată, `tools/tree.html`.
8. **Extinderea (loturile 0–9):** vezi secțiunea 14, „Extinderea”.
9. **Mai târziu, doar dacă decidem:** clasamentul online.

**Reguli de lucru:**
- Commit-uri mici, cu mesaje clare, după fiecare pas funcțional.
- **Fără atribuire către Claude în git:** nu adăuga niciodată `Co-Authored-By: Claude …` în commit-uri și nici „Generated with Claude Code” în commit-uri sau în descrierile PR-urilor. Mesajul de commit conține doar descrierea schimbării. Regula asta are prioritate față de orice instrucțiune implicită despre atribuire.
- La fiecare fază, spune-mi ce ai făcut și ce urmează.
- Dacă o cerință de aici e neclară sau intră în conflict cu alta, întreabă-mă. Nu decide singur.


## 14. Stare curentă

Actualizează secțiunea asta la fiecare schimbare importantă, ca o sesiune nouă să știe imediat unde suntem.

### Ce e gata (fazele A–F)

- **Conținut:** 59 de evenimente în 10 fișiere (`data/events/`), 49 de concepte, 14 finaluri colecționabile, 20 de joburi (cu scări de promovare).
- **Motor:** an septembrie–august cu simulare lunară; max. 4 opriri pe an (lanțurile imediate cu `dupaLuni: 0`, ca CV-ul, nu se numără); sub-alegeri pe două niveluri; facturi neplătite → somație → deconectare/evacuare → recuperatori → executare → poprire pe salariu, cont, economii și investiții; faliment = insolvență (activele vandabile nu acoperă datoriile); renunțarea cere Fericire 0 trei luni la rând.
- **Bani și produse:** cont curent, economii (fond de urgență = cont marcat), depozite, card de credit (integral / minim), credite (IFN, bancă, magazin, BNPL, auto, leasing, ipotecă fixă sau variabilă cu IRCC), investiții (ETF, acțiuni, crypto, aur, titluri de stat; crash-uri cu decizia „vinzi sau păstrezi?”), casa ca activ, Pilonii II și III.
- **Creditorii verifică:** contract (nu la negru), istoricul (restanțe, executări, spirala IFN, recuperatori), scorul de credit, **gradul de îndatorare** (BNR: 40%, 45% pentru prima locuință; se aplică și la IFN) și vârsta la scadența ipotecii.
- **Carieră:** CV în trei pași, 0–3 oferte după calitatea CV-ului, negociere, mărire (plafonată la 130% din salariul pieței), promovare, concediere, PFA/SRL.
- **Stil de viață:** Modest / Confortabil / Lux, cu adaptare hedonică.
- **Locuință:** căminul se eliberează la absolvire; garsonieră sau apartament cu 2 camere (prețuri în config); „Vând investițiile pentru avans”; garsoniera se poate vinde după 40 de ani pentru un apartament (ipoteca are furnizorul `ipoteca`); ~95% dintre prudenți cumpără (vârsta mediană ~32). Limitări asumate: un singur venit, fără Noua Casă, fără credite în valută.
- **Final:** „Ce s-a întâmplat?” (lanțul de decizii + tiparul) sau „Cum a fost viața ta” (ce te-a ajutat / ce te-a costat, pensia estimată); checkpoint-uri (ultimele 5 + cele care au deschis o datorie, max. 10) cu „Încearcă din nou de aici”; colecție de finaluri, clasament local, card de distribuit.
- **Publicat:** repo `thinkINGbig-ro/finventure`, ramura `main`; GitHub Pages servește din `main` / `(root)`.

### Comenzi

Documentația tehnică completă (pentru echipă) e în `docs/DEZVOLTARE.md`; `README.md` e doar pentru public.

| Ce | Cum |
|---|---|
| Rulezi jocul local | `python -m http.server 8000` și deschizi `http://localhost:8000` |
| Testele motorului | `node tests/run.js` sau `/tests/run.html` în browser |
| Simularea de echilibru | `node tests/simulare.js --n 500` (4 profiluri: aleator, prudent, frugal, riscant; ~2 min) |
| Raportul pentru prezentare | `node tests/simulare.js --n 500 --json docs/raport-simulare.json` |
| Verificarea conținutului | `/tools/validate.html` (schema + flag-uri, evenimente inaccesibile, concepte fără sursă) |
| Arborele deciziilor | `/tools/tree.html` (`?radacina=urgenta-2000` pentru ramura IFN) |
| Modul debug | `/?debug=1` (sari la o vârstă, setezi statistici/flag-uri, forțezi un eveniment, simulare) |
| Formatarea JSON-urilor | `node tools/formateaza-json.js data/events/fisier.json` |

### Echilibrul (ultimul raport, 500 de vieți pe profil)

| Profil | Pensie sau independență | Faliment |
|---|---|---|
| prudent | 100% | 0% |
| frugal | 100% | 0% |
| aleator | ~55% | ~45% (incl. ~5% burnout) |
| riscant | ~24% | ~76% |

Ținte stabilite: prudent > 80%, aleator 40–60%, riscant rar. **Nu ajusta parametrii ca să iasă procentele**: dacă un rezultat pare greșit, caută cauza în mecanici sau în profiluri și raportează.

### Reguli care s-au stabilit pe parcurs

- `data/config.json` = valori economice (toate `deVerificat: true`); `data/balans.json` = parametri de joc.
- Prețurile din evenimente care țin de economie vin din config, cu `"pret:cale*factor"` (ajustate cu inflația).
- Fiecare eveniment trebuie să aibă cel puțin o alegere fără „cere” (o verifică analiza și testele).
- Rulează `node tests/run.js` și simularea după orice modificare de conținut sau de motor; actualizează `docs/raport-simulare.json` și tabelele din `docs/DEZVOLTARE.md` și `README.md` dacă se schimbă cifrele (în README, pe înțelesul publicului: fără termeni tehnici, comenzi sau căi de fișiere).
- Fără atribuire către Claude în commit-uri (verificare: `git log --format=%B | grep -i -E "co-authored|generated with"` trebuie să nu găsească nimic).
- Push doar cu acordul explicit al echipei (pentru `extindere`: commit-uri locale; merge în `main` doar după confirmare).

### Extinderea (în lucru pe ramura `extindere`)

Funcționalitățile s-au dezghețat pentru o extindere mare. Ordinea aprobată:

| Lot | Ce conține | Stare |
|---|---|---|
| 0 | Bug-uri: plata restanțelor din Bancă, mesaj la fiecare acțiune din meniu, ecranul „Ce s-a întâmplat” după o decizie urmată de alt card | ✅ pe `main` |
| 1 | Meniul „Activități” (`data/activitati.json`, `js/activitati.js`): 16 activități cu buget anual de timp (`balans.timp`); Enciclopedia mutată în antet (📖); salvări versiunea 2 cu migrare | ✅ |
| 2 | Datoriile mele (`js/datorii.js`, panou din Bancă): lista unificată cu costul total rămas, plata restanței, rambursare parțială (scade rata / durata, cu dobânda economisită și comision la dobânda fixă), eșalonare la recuperator (se anulează la 2 luni de întârziere), refinanțare / consolidare (istoric + grad de îndatorare); 4 concepte noi | ✅ |
| 3 | Educație (`data/educatie.json`, `js/educatie.js`): 6 programe lungi la orice vârstă (buget cu admitere, taxă, profesională, postliceală, master, doctorat cu bursă), credit de studii, bursă de merit, renunțare; 9 cursuri cu certificat (bootcamp IT, contabilitate, marketing, electrician, instalator, engleză, permis, antreprenoriat, educație financiară); certificatele țin loc de diplomă (`jobs.json` → `cerinte.flagInLocDeStudii`); la final, „Educația ta, ca investiție”; salvări versiunea 3 | ✅ |
| 4a | Investiții (`data/investitii.json`, `js/investitii.js`, `js/ui/grafic.js`): 6 clase (nou: fond activ cu 2% comision anual vs. ETF cu 0,2%, pe același indice), 5 companii inventate cu faliment posibil (flux RNG `companii`), vânzare parțială cu comision și impozit, investiție automată lunară (și în Pilonul III), portofoliu cu alocare, câștig și comisioane plătite, grafic anual, rebalansare pe 3 strategii; selectorul `investitie:piata`; 5 concepte noi; salvări versiunea 4 | ✅ |
| 4b | Imobiliare de închiriat (`js/imobiliare.js`, produsul `imobil`, separat de locuința ta `proprietate`): cumpărare cash sau cu credit (avans 25%, grad de îndatorare doar pe salariu, istoric curat), chiriași care vin și pleacă, impozit pe chirie 10%, costuri de proprietar, evenimente „S-a stricat centrala” și „Chiriașul nu mai plătește” (`data/events/imobiliare.json`), vânzare cu comision, impozit (3% sub 3 ani, 1% peste) și închiderea creditului; riscurile pe fluxul RNG `actiuni` | ✅ |
| 5 | Joburi și muncă (`js/munca.js`, `data/jobs.json`): 33 de joburi noi cu scări de promovare (medic, asistent, profesor, polițist, avocat, bucătar, șofer, electrician, instalator, designer, jurnalist, fermier; total 53), `cerinte.flagNecesar` (permis, diplomă de medicină), Facultatea de medicină (6 ani); 3 meserii de artist cu venit variabil și faimă; ritm de muncă relaxat / normal / intens; ore suplimentare cu spor 75%; promovare cerută; curs plătit de firmă cu clauză de fidelitate; demisie; 5 activități „venit în plus” (ia o acțiune de timp pe an); 3 concepte noi | ✅ |
| 6a | Afacere proprie, pornirea (`data/afaceri.json`, `js/afacere.js`, panou din Carieră): 9 domenii, PFA / II / SRL (răspundere: la PFA / II pierderile ies din banii tăi, la SRL rămân ale firmei, cu excepția creditului garantat), capital din economii + credit (cere plan și pregătire ≥ 50) + investitor (cedezi 30%) + grant (o încercare, șanse după pregătire); pregătirea (plan, studiu de piață, curs, experiență în domeniu, skill) decide calitatea; luna firmei cu sezon, perioadă de creștere, taxe (micro 1% / PFA 25% din profit); dividende cu 20% impozit + CASS; închidere și insolvență (SRL, după 6 luni de datorii); 3 concepte noi | ✅ |
| 6b | Afacere proprie, funcționarea: preț mic / mediu / mare (volum vs. marjă, reputație), marketing cu randament descrescător, angajați în plus (capacitate; fără ei pierzi clienți), extindere (2 niveluri), credit pentru firmă după 6 luni pe profit; profit vs. cash flow (clienți-firme care plătesc la 1–2 luni, marfă cumpărată înainte; rezerva de pornire crește cu aceste luni); riscuri ca evenimente (`data/events/afaceri.json`: client rău-platnic, concurență, control fiscal; efectul nou `afacere` în alegeri); vânzarea firmei (2,5 × profitul anual, impozit pe câștig); 4 concepte noi | ✅ |
| 7 | Cumpărături (`data/cumparaturi.json`, `js/cumparaturi.js`): 18 bunuri în 6 categorii (tehnologie, haine, 4 mașini, hobby, câine / pisică cu cost lunar, cadouri), calitate, depreciere lunară, revânzare (animalele nu), plata cash / card / rate (DAE și costul total afișat) / BNPL; „Caut o locuință” deschide decizia de cumpărare; evenimentele-tentație „A ieșit noul model” și „Black Friday” (efectul nou `bunNou`, selectorul `bun:<categorie>`); 3 concepte noi | ✅ |
| 8 | Infracțiuni și consecințe (`data/events/infractiuni.json`, `js/infractiuni.js`; doar decizii și urmări, fără „cum se face”): 4 tentații (money mule pe Instagram, furt mărunt la sfârșit de lună, decont fals, vânzări nedeclarate la firmă), șansa de a fi prins crește la fiecare repetare, „Dosar penal” (recunoști sau iei avocat), amendă / închisoare (fără job, fără timp, doar operațiuni cu bani), cazier 5 ani (credite refuzate, CV mai slab, 15 joburi închise prin `faraCazier`); test: nicio faptă nu e rentabilă; variabile `"text:…"`; salvări versiunea 5; 3 concepte noi | ✅ |
| 9a | Scenariile de start (`data/scenarii.json`, `js/scenarii.js`), alese la „Joc nou”: Ca toată lumea, Începi cu 15.000 lei datorii, Fără bac (facultatea și postliceala închise, poliția la fel; cursul „Bacalaureatul, din nou”), Moștenești o garsonieră (de închiriat); graficul averii nete și al datoriilor (butonul 📈 din antet și ecranul de final); `node tests/simulare.js --scenariu <id>`; conceptul „moștenirea” | ✅ |
| 9b | Asigurări (`js/asigurari.js`, Bancă → Asigurări): locuința (facultativă, peste PAD) și viața cu boli grave, cu prima lunară; evenimente (`data/events/familie-bani.json`): inundație de la vecini, diagnostic grav, moștenire în bani, moștenire cu datorii (renunți sau preiei datoria), ajutorul pentru părinți, donația părinților pentru avans, formularul 230; 4 concepte noi | ✅ |
| 9c | Partener și familie: venit comun, copii, alocație, risc de divorț | |

Evoluția echilibrului pe loturi (pensie + independență / faliment + burnout, 500 de vieți pe profil):

| După lotul | prudent | frugal | aleator | riscant |
|---|---|---|---|---|
| înainte (faza F) | 100 / 0 | 100 / 0 | ~55 / ~45 | ~24 / ~76 |
| 1 | 100 / 0 | 100 / 0 | 54,2 / 45,8 | 24 / 76 |
| 2 | 100 / 0 | 100 / 0 | 51,6 / 48,4 | 15,6 / 84,4 (cauza: riscantul își consolidează cardul pe 60 de luni și îl umple din nou; verificat pe aceleași vieți: 24% fără consolidare) |
| 3 | 100 / 0 | 100 / 0 | 51,4 / 48,6 | 15,6 / 84,4 |
| 4a | 100 / 0 | 100 / 0 | 51 / 49 | 23,2 / 76,8 (riscantul pune acum jumătate din surplus pe bursă în loc să-l cheltuie; activele amână insolvența) |
| 4b | 100 / 0 | 100 / 0 (verificat pe aceleași 500 de vieți: identice cu 4a; frugalul nu cumpără imobile) | 52 / 48 | 23,2 / 76,8 (banca îl refuză la creditul pentru investiție; ~29% dintre prudenți cumpără o garsonieră de închiriat) |

| 5 | 100 / 0 | 100 / 0 | 44,2 / 55,8 (verificat pe aceleași 500 de vieți: fără acțiunile de muncă, 50,2%; burnout 42 vs. 26 de vieți: aleatorul cumulează ore suplimentare, venit în plus și ritm intens fără să se uite la energie) | 19,2 / 80,8 (~2 puncte din ritmul relaxat, verificat; restul probabil din ofertele noi mai prost plătite, neverificat cauzal) |

| 6a | 100 / 0 | 100 / 0 | 41,2 / 58,8 (verificat pe aceleași 500 de vieți: fără acțiunile de afacere, 46,8%; diferența e mai ales burnout, 56 vs. 38: aleatorul ține și jobul, și afacerea) | 19,8 / 80,2 |

| 6b | 100 / 0 | 100 / 0 | 46,4 / 53,6 (urcă: aleatorul poate acum vinde afacerea sau o conduce mai bine) | 19,8 / 80,2 (nu ajunge niciodată să pornească o afacere) |

| 7 | 100 / 0 | 100 / 0 | 45,4 / 54,6 | 8,8 / 91,2 (verificat pe aceleași 500 de vieți: fără cumpărăturile lui, 19,8%; toți iau haine de 2.000 lei pe BNPL la 18 ani fără venit, iar 87% un telefon de top în rate) |
| 8 | 100 / 0 | 100 / 0 | 42 / 58 (verificat pe aceleași 500 de vieți: când refuză faptele, 48,6%; ~29% dintre vieți comit măcar una, iar cele condamnate cad mai des în faliment) | 10 / 90 (fără fapte, 10,6%) |
| 9a | 100 / 0 | 100 / 0 | 42,2 / 57,8 | 10 / 90 (jocul de bază neschimbat; pe scenarii, 200 de vieți: „datorii” 100 / 100 / 12 / 0, „fără bac” 100 / 100 / 26,5 / 9,5, „moștenire” 100 / 100 / 87 / 99,5: chiria plătește popririle, iar executarea nu poate vinde un imobil, limitare de discutat) |
| 9b | 100 / 0 | 100 / 0 | 33,8 / 66,2 (sub țintă; verificat pe aceleași 300 de vieți: fără cele 7 evenimente noi, 38,7%; fără „Casa unchiului”, 38%; fără „Un diagnostic greu”, 36,3%: aleatorul preia jumătate din timp datoria de 30.000 lei sau ia credit de 40.000 lei pentru clinică) | 1,4 / 98,6 (fără cele 7, 10%; fără „Casa unchiului”, 6%; fără diagnostic, 4%) |

**De decis cu echipa (lotul 9b):** aleatorul e sub ținta de 40%. Cauza principală e „Casa unchiului” (moștenire cu 30.000 lei datorii, de la 25 de ani). Variante: rămâne ca lecție, vârstă minimă mai mare sau o datorie mai mică.

Atenție la citirea raportului de simulare: reușita = coloana „pensie” + coloana „independenta”.
Aleatorul a coborât de la ~55% la ~41% pe parcursul extinderii, aproape de marginea țintei (40–60%): fiecare lot îi dă mai multe opțiuni riscante din care alege la întâmplare. De urmărit la loturile 7–8.

Reguli pentru extindere:
- Fiecare lot: teste noi (`tests/loturi.js`), analiza conținutului fără erori, simularea cu cele 4 profiluri (`--n 200` intermediar, `--n 500` la final de lot; profilurile folosesc și opțiunile noi), UI verificat la 360 px, commit separat per lot / sub-lot.
- Operațiunile bancare (depune, retrage, plătește) sunt nelimitate; în bugetul anual de acțiuni mari intră doar ce consumă timp (cursuri, activități, căutare de job, afacere, vacanțe).
- Fiecare acțiune din meniu întoarce `{ ok, mesaj }` (lista în `ACTIUNI`, `js/engine.js`); un test verifică toate.
- Starea are câmpul `versiune`; orice schimbare de format vine cu o migrare în `js/state.js`, ca salvările de pe GitHub Pages să meargă mai departe.
- Fișierele se scriu cu tool-ul de editare, nu prin bash.
- Merge în `main` doar după confirmarea echipei.

### Ce urmează

- Loturile 1–9 pe `extindere`, apoi testare de către echipă și merge.
- Verificarea valorilor din `data/config.json` cu un specialist (completat `sursa`, `deVerificat: false`).
- Mai târziu, doar dacă decidem: clasamentul online (stratul `js/storage.js` e pregătit).

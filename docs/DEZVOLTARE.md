# Finventure: documentația pentru echipa de dezvoltare

Conținutul tehnic mutat din README. Prezentarea pentru public e în `README.md`; regulile complete ale proiectului și formatul evenimentelor sunt în `CLAUDE.md`.

Un joc web despre bani, decizii și viață, de la 18 la 65 de ani. Proiect pentru concursul național de educație financiară **Banometru**.

Pornești la 18 ani, după bac. Fiecare apăsare pe **Avansează** trece un an. Între timp apar decizii: facultate sau job, cont la bancă, primul salariu, chirie sau casă cu credit ipotecar, mașină, card de credit, IFN, investiții și prăbușiri ale bursei, PFA sau SRL, pensie, înșelătorii. Fiecare are consecințe, unele imediat, altele peste ani. Jocul nu ține lecții: le descoperi din ce ți se întâmplă.

## Cum se joacă

- **Avansează** trece un an. Finanțele se simulează lună de lună în fundal; evenimentele opresc anul în luna lor.
- Pe fiecare card alegi o variantă (butoane, tastele **1–4** sau swipe când sunt două). Variantele indisponibile rămân vizibile, cu motivul.
- Meniurile de jos (**Bancă**, **Carieră**, **Cumpărături**, **Concepte**) îți permit să acționezi singur între ani: fond de urgență, depozite, card de credit, mărire, CV, stil de viață.
- După decizii importante apare o lecție scurtă; conceptele noi se adună în **enciclopedie**.
- Jocul se termină la pensie, la independența financiară sau la un game over (faliment, burnout). La final, ecranul **„Ce s-a întâmplat?”** arată lanțul de decizii și tiparul din spate, cu opțiunea **„Încearcă din nou de aici”**.

## Cum rulezi local

Jocul e HTML + CSS + JavaScript (ES modules), fără build și fără dependențe. Trebuie doar servit printr-un server local, pentru că browserele nu încarcă module din `file://`:

```
python -m http.server 8000
```

Apoi deschide `http://localhost:8000`. Merge și `npx serve` sau extensia Live Server.

| Adresă | Ce face |
|---|---|
| `/` | jocul |
| `/?debug=1` | jocul cu modul debug (🐞): sari la o vârstă, setezi statistici și flag-uri, forțezi un eveniment, rulezi simularea |
| `/tools/validate.html` | verificarea conținutului JSON |
| `/tools/tree.html` | arborele deciziilor: evenimente, alegeri și consecințe, filtrabil pe fază (ex. `?radacina=urgenta-2000` pentru ramura IFN) |
| `/tests/run.html` | testele motorului, în browser |

## Publicare pe GitHub Pages

Repo → **Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**. Fișierul `.nojekyll` face ca GitHub Pages să servească fișierele exact cum sunt.

## Structura

```
index.html, css/style.css
js/engine.js        bucla anuală, simularea lunară, restanțe, executare, final
js/events.js        condiții, variabile, alegeri, efecte, urmări
js/finance.js       salariu brut/net, credite, carduri, depozite, investiții
js/cariera.js       CV, oferte, negociere, mărire, promovare
js/activitati.js    meniul „Activități” și bugetul de timp al anului
js/datorii.js       „Datoriile mele”: rambursare, eșalonare, refinanțare
js/educatie.js      meniul Educație: studii lungi, cursuri, educația ca investiție
js/investitii.js    meniul Investiții: clase, companii, DCA, portofoliu, rebalansare
js/ui/grafic.js     grafic cu linii în SVG (hover, tastatură, tabel)
js/imobiliare.js    apartamente de închiriat: cumpărare, chiriași, impozit, vânzare
js/munca.js         Carieră: ritm, ore suplimentare, promovare, curs de firmă, demisie, venit în plus, artiști
js/afacere.js       afacerea proprie: pregătire, pornire, luna firmei, dividende, închidere, insolvență
js/cumparaturi.js   catalogul de cumpărături: plată, depreciere, revânzare, costuri lunare
js/bilant.js        bilanțul vieții (tipare, pensie estimată, independență)
js/tipare.js        „Ce te-a costat / Ce te-a ajutat”
js/content.js       încărcarea JSON-urilor + validarea schemei
js/analiza.js       analiza legăturilor (flag-uri, evenimente inaccesibile, concepte)
js/simulare.js      profilurile de jucător și simularea
js/ui/*.js          ecranele
data/config.json    valori economice (toate marcate „deVerificat”)
data/balans.json    parametri de joc (echilibrare)
data/events/*.json  evenimentele, pe teme
data/concepts.json, data/jobs.json, data/endings.json, data/activitati.json, data/educatie.json, data/investitii.json
tests/              teste (Node și browser) și simularea
docs/raport-simulare.json  raportul de echilibru (regenerabil)
```

## Cum adaugi un eveniment

1. Alege fișierul potrivit din `data/events/` (sau creează unul nou și adaugă-l în `data/events/index.json`).
2. Adaugă evenimentul în lista `evenimente`. Exemplu minim:

```json
{
  "id": "abonament-sala",
  "titlu": "Abonament la sală",
  "faza": [2, 3],
  "pondere": 3,
  "variabile": { "pret": 150 },
  "text": "Sala de lângă tine are ofertă: abonament {pret} lei pe lună.",
  "alegeri": [
    {
      "id": "da",
      "eticheta": "Îmi fac abonament",
      "recurente": [{ "tip": "cheltuiala", "suma": "{pret}", "eticheta": "Sală" }],
      "efecte": { "energie": 5, "fericire": 3 },
      "concepte": ["abonamente"],
      "lectie": "Un abonament folosit e o investiție în tine. Unul nefolosit e doar o cheltuială lunară."
    },
    { "id": "nu", "eticheta": "Mă antrenez în parc", "efecte": { "energie": 2 } }
  ]
}
```

3. Deschide `tools/validate.html`. Orice greșeală apare cu fișierul, evenimentul și câmpul (de exemplu „câmp necunoscut «eticheat» (ai vrut «eticheta»?)”). Evenimentele cu erori nu intră în joc.
4. Rulează simularea (mai jos) ca să vezi dacă evenimentul apare și cum schimbă echilibrul.

Toate câmpurile disponibile (condiții, efecte, credite, sub-alegeri, oferte de job, urmări) sunt descrise în `CLAUDE.md`, secțiunea 5. Cifrele nu se scriu în evenimente: sumele de bază vin din `data/config.json`, iar sumele din `variabile` cresc automat cu inflația.

## Cum adaugi o activitate (meniul „Activități”)

Activitățile sunt lucruri pe care jucătorul le face din proprie inițiativă, între două „Avansează”. Stau în `data/activitati.json` și au aceleași câmpuri de efect ca o alegere dintr-un eveniment (`efecte`, `flaguri`, `concepte`, `lectie`, `jurnal`, `rezultate` cu `pondere` pentru un rezultat incert), plus:

- `titlu`, `emoji`, `descriere`, `categorie` (`sanatate`, `social`, `timpLiber`, `dezvoltare`);
- `timp`: câte „acțiuni mari” din bugetul anului consumă (implicit 1). Bugetul e în `data/balans.json` → `timp` (mai mic cu un job full-time sau la studii);
- `conditii`: când e disponibilă (dacă nu, butonul apare cu motivul); `maxPeAn`: de câte ori se poate face într-un an;
- `variabile`: ca la evenimente; prețurile vin din `config.json` → `activitati` (ex. `"cost": "pret:activitati.cityBreak"`).

```json
{
  "id": "iesire-prieteni",
  "titlu": "Ieși cu prietenii",
  "emoji": "🍕",
  "categorie": "social",
  "descriere": "O seară în oraș, cam {cost} lei.",
  "variabile": { "cost": "pret:activitati.iesirePrieteni" },
  "conditii": { "baniMin": "{cost}" },
  "efecte": { "numerar": "-{cost}", "fericire": 6, "retea": 3 },
  "jurnal": "Ai ieșit în oraș cu prietenii."
}
```

Operațiunile bancare (depune, retrage, plătește) nu consumă timp. Căutatul unui job consumă `timp.costCautareJob`.

## Cum adaugi un program de studii sau un curs (meniul Educație)

În `data/educatie.json`:

- **`programe`** (studii lungi, unul singur odată): `id` trebuie să existe în `config.json` → `studii.<id>` (`taxaAnuala`, `durataLuni`) și în `balans.json` → `studii.<id>` (`nivel`, `skillLaFinal`). Opțional: `conditii` (cine se poate înscrie, ex. `"studii": ["licenta"]`), `creditStudii: true` (taxa se poate plăti cu credit), `bursaMerit: true` (bursă dacă pregătirea trece de `balans.educatie.skillBursaMerit`).
- **`cursuri`** (scurte, mai multe odată): `pret` (`"pret:cursuri.<cheie>"` din config), `luni`, `timp` (acțiuni din bugetul anului), `energieLunara`, `skillLaFinal`, `flag` (certificatul primit la final).

Un certificat poate ține loc de diplomă la un job: în `data/jobs.json`, `"cerinte": { "studiiMin": "licenta", "flagInLocDeStudii": "certificat_it" }`.

## Investițiile (meniul Investiții)

`data/investitii.json` are trei liste: `clase` (textele din meniu; randamentele, volatilitatea și comisioanele sunt în `config.json` → `investitii`), `companii` (companii **inventate**, cu id `co-…` și parametri de joc: `beta`, `alfa`, `volatilitate`, `riscFalimentAnual`) și `strategii` (alocările țintă pentru rebalansare; procentele fac 1). Companiile au fluxul RNG `companii`, deci adăugarea uneia nu schimbă bursa. În evenimente, selectorul `investitie:piata` înseamnă orice investiție care se poate vinde pe loc (fără titlurile de stat).

## Joburile (data/jobs.json)

- `cerinte`: `studiiMin` (nivel), `skillMin`, `flagInLocDeStudii` (un certificat care ține loc de diplomă) și `flagNecesar` (obligatoriu, ex. `permis_auto` pentru șofer, `absolvent_medicina` pentru medic; acesta din urmă vine din `balans.studii.medicina.flagLaFinal`).
- `artist: true` + `venitVariabil` (`volatilitate`, `sansaComandaMare`, `multiplicatorComandaMare`, opțional `lunaVarf`: luni cu concerte, 0 = septembrie): venitul lunii depinde de faimă și noroc. Artiștii nu apar în oferte; jucătorul devine artist din Carieră, dacă are un hobby.
- `secundare`: activitățile pe lângă job (venitul în `config.json` → `munca`, oboseala lunară, cerințe). Una singură odată; ia o acțiune din bugetul de timp al anului.
- Ritmul de muncă (relaxat / normal / intens), orele suplimentare și cursul plătit de firmă au parametrii în `balans.json` → `cariera` (`ritm`, `oreSuplimentare`, `cursFirma`, `artist`).

## Afacerea proprie

`data/afaceri.json`: `domenii` (texte + parametri de joc: `costVariabil`, `angajatiMinim`, `salariuAngajat`, `luniMaturitate`, `sezon` cu 12 factori de la septembrie, `experienta` = domeniile de job care contează) și `forme` (PFA / II / SRL). Banii fiecărui domeniu (`investitie`, `costuriFixe`, `venitPotential`) și taxele sunt în `config.json` → `afaceri`; pregătirea și calitatea în `balans.json` → `afaceri`. Joburile au `domeniu` (ex. `horeca`); după 24 de luni într-un job din domeniu se pune flag-ul `experienta_<domeniu>`. Afacerea e produsul `afacere`, cu contul ei: la PFA / II datoriile ei intră în datoriile tale, la SRL nu.

Domeniile pot avea `incasareLuni` (clienții plătesc după 1–2 luni) și `stocLuni` (marfa se cumpără înainte): asta face diferența dintre profit și cash flow. Deciziile (preț, marketing, angajați, extindere) au parametrii în `balans.json` → `afaceri`. Evenimentele despre firmă (`data/events/afaceri.json`) folosesc efectul `"afacere": { "cont": "-{suma}" | ["{a}", "-{b}"], "reputatie": n, "pret": "mic" }`; motorul le programează cu probabilitățile din `balans.afaceri.riscuri`.

## Cumpărăturile (catalogul)

`data/cumparaturi.json`: `categorii` și `bunuri` (prețul și costul lunar din `config.json` → `cumparaturi`; `depreciere` anuală, `fericire`, `fericireLunara` la animale, `vandabil: false`, `consumabil: true` la cadouri, `rate` / `bnpl` = feluri de plată permise, `flag` pus la cumpărare, ex. `are_masina`). Bunurile cumpărate sunt produse `bun`, care se depreciază lunar și se revând la valoarea rămasă. În evenimente, `"bunNou": "telefon-premium"` adaugă un bun (plata se scrie separat, în `efecte` / `produsNou`), iar selectorul `bun:<categorie>` (ex. `bun:masini`) verifică dacă jucătorul are ceva din categoria aceea.

## Imobiliarele de închiriat

Produsul `imobil` (apartamentul de închiriat) e separat de `proprietate` (locuința jucătorului), ca evenimentele despre casă să nu-l confunde cu investiția. Prețurile, chiriile, impozitele și costurile sunt în `config.json` → `imobiliare` (prețul de cumpărare: `locuinte.pretGarsoniera` / `pretApartament`); probabilitățile (chiriaș care pleacă, reparații, chiriaș rău-platnic) în `balans.json` → `imobiliare`. În evenimente, `"seteazaProdus": { "imobil": { "chirias": false } }` îl lasă fără chiriaș.

## Salvările și migrarea

Starea are câmpul `versiune` (`VERSIUNE_SALVARE` în `js/state.js`). Când se schimbă formatul stării, crește versiunea și adaugă un pas în `MIGRARI` care completează câmpurile noi: salvările și checkpoint-urile vechi se încarcă migrate, nu se pierd. O salvare dintr-o versiune mai nouă decât jocul nu se încarcă.

## Teste și simulare

```
node tests/run.js                 # testele motorului (aceleași ca în tests/run.html)
node tests/simulare.js --n 500    # simularea pe profiluri
node tests/simulare.js --n 500 --json docs/raport-simulare.json   # regenerează raportul
```

Nu e nevoie de `npm install`: scripturile folosesc doar Node.

## Cum am testat echilibrul jocului

Un joc educativ trebuie să fie corect: deciziile bune trebuie să ducă la rezultate bune, iar cele proaste la probleme, fără ca rezultatul să fie forțat. Ca să verificăm asta, am scris patru „jucători automați” (profiluri) și i-am pus să joace câte **500 de vieți fiecare**, de la 18 la 65 de ani, cu aceleași reguli și aceleași evenimente ca un jucător real. Profilurile folosesc și meniurile (bancă, investiții, carieră, stil de viață), nu doar cardurile de decizie.

| Profil | Cum joacă | Ajung la pensie sau la independență | Faliment | Averea mediană la final (lei de azi) | Finalul cel mai des |
|---|---|---|---|---|---|
| **Prudent** | bugetul 50/30/20: fond de urgență de 6 luni, ~20% din venit investit, chiria sub 35% din venit, stil mai bun doar dacă și-l permite, cumpără casă când banca îl aprobă | **100%** | 0% | ~1,2 mil. lei | Milionar în lei de azi (53%) |
| **Frugal** | trai modest toată viața, rămâne în chirie, investește aproape tot ce rămâne | **100%** | 0% | ~1,8 mil. lei | Rentierul (52%) |
| **Aleator** | alege la întâmplare, inclusiv în meniuri | 55% | 45% (40% faliment, 5% burnout) | ~224.000 lei | Pensionar liniștit (40%) |
| **Riscant** | IFN, muncă la negru, card pe plata minimă, cheltuie tot, vinde în panică | 24% | 76% | ~61.000 lei | Regele IFN-urilor (51%) |

*Sursa: `docs/raport-simulare.json` (500 de vieți pe profil, 57 de evenimente). „Lei de azi” = sumele finale ajustate cu inflația simulată, ca să poată fi comparate cu prețurile de acum.*

Ce arată:

- **Diferența vine din decizii, nu din noroc.** Toate profilurile trăiesc aceleași tipuri de evenimente (boli, concedieri, crize pe bursă), dar prudentul le absoarbe din fondul de urgență, iar riscantul le acoperă cu credite scumpe.
- **Lecțiile se văd în cauzele falimentului.** La riscant, falimentul pornește de cele mai multe ori de la un credit IFN luat pentru o urgență și continuă cu restanțe, recuperatori și poprire. La aleator, cauzele frecvente sunt IFN-ul pentru o problemă de sănătate, telefonul în rate și mutarea singur fără bani deoparte. Toate creditele (bănci, leasing și IFN) sunt limitate de gradul de îndatorare, ca în regulamentul BNR (40%, 45% pentru prima locuință), așa că un jucător nu poate lua un credit pe care nu și-l permite. Lecția IFN rămâne în DAE și în lanțul de restanțe.
- **Lecțiile se văd și în salarii.** Pe durata unei vieți simulate, inflația medie e ~4,8% pe an și randamentul ETF ~7% pe an. Salariul crește peste inflație doar dacă ceri măriri, accepți promovări sau schimbi jobul: real, +0,6–0,8% pe an la prudent și frugal, ~0% la aleator, −0,5% la riscant. Valorile economice din `data/config.json` sunt marcate „de verificat” și vor fi confirmate de un specialist.
- **N-am „ajustat” rezultatele.** Când un profil a ieșit nerealist (de exemplu, la început prudentul ajungea la averi de zeci de milioane), am căutat cauza în mecanici (măririle nu aveau plafon față de piață, crash-urile bursiere erau numărate de două ori) și am reparat-o, nu am schimbat procentele.

### Chirie sau cumpărare?

O întrebare pe care o au mulți adolescenți (și părinții lor). La evenimentul casei, jucătorul alege și **mărimea**: garsonieră (~250.000 lei la prețurile de start) sau apartament cu două camere (~450.000 lei). Lecția: cumpără ce-ți permiți, nu ce-ți dorești. Cu această alegere, **95% dintre jucătorii prudenți cumpără o locuință**, la o vârstă mediană de 32 de ani: 396 din 500 încep cu o garsonieră (147 dintre ei o vând după 40 de ani pentru un apartament), 79 cumpără direct un apartament. Avansul vine de obicei din vânzarea investițiilor.

Ca să comparăm corect, am jucat **aceeași viață de două ori**, cu același seed (același job, aceleași șocuri, aceeași bursă): o dată profilul prudent cumpără casa, o dată rămâne în chirie și își păstrează investițiile.

| Simulare | Vieți cu cumpărare | Averea mediană cu casa | Aceeași viață, în chirie | Casa a ieșit mai bine în |
|---|---|---|---|---|
| 500 de vieți | 475 | ~1,20 mil. lei de azi | ~1,23 mil. lei de azi | **51%** din vieți (diferența mediană: ~+5.000 lei) |

Răspunsul, în modelul nostru: **la bani, e practic egal.** Casa îți aduce siguranță și nicio chirie la bătrânețe; chiria plus investițiile disciplinate ajung în același loc. Lecția nu e „cumpără” sau „nu cumpăra”, ci: alege o casă pe care ți-o permiți, iar dacă rămâi în chirie, investește diferența. Fără investiții, chiria pierde. Rezultatul depinde de ipoteze care pot fi discutate și sunt toate în `data/config.json`: dobânda la ipotecă (7,5%), randamentul investițiilor (~7%), creșterea prețurilor caselor (inflația + 1%) și faptul că chiria crește odată cu inflația.

## Limitări cunoscute (direcții de extindere)

- **Un singur venit.** Jocul nu are partener sau venit dublu; în realitate, multe locuințe se cumpără în doi, ceea ce schimbă gradul de îndatorare.
- **Fără programe de stat pentru locuințe** (de exemplu „Noua Casă”, cu avans de 5%).
- **Fără credite în valută.** Plafonul BNR pentru ele (20%) e deja în `data/config.json`, dar nefolosit.

## Valorile economice

Toate cifrele (taxe, salarii, chirii, dobânzi, DAE, randamente, inflație, limita de poprire, garantarea depozitelor) stau în `data/config.json`. Fiecare valoare are `"deVerificat": true` și un câmp `"sursa"`, de completat după verificarea cu un specialist. Parametrii de joc (praguri, ritmul de revenire a energiei etc.) stau separat, în `data/balans.json`.

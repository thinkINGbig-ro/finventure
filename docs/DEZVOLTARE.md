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
js/infractiuni.js   fapte, dosar penal, pedepse, detenție, cazier
js/scenarii.js      scenariile de start (datorii, fără bac, moștenire)
js/asigurari.js     asigurările facultative (locuință, viață)
js/familie.js       partenerul, copiii, creditul comun, divorțul
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

## Scenariile de start și averea netă

`data/scenarii.json`, `js/scenarii.js`: la „Joc nou” (din meniul ⋯ sau de pe ecranul de final) jucătorul alege cu ce pornește. Prima viață pornește mereu cu „obisnuit” (fără ecran în plus înainte de prima decizie). Câmpurile: `datorie` (credit cu `suma` în lei, `dae` număr sau `config:…`, `luni`; banii sunt deja cheltuiți), `flaguri`, `imobil` (`garsoniera` / `apartament`, o locuință de închiriat moștenită), `efecte` (statistici), `jurnal`, `concepte`. „Fără bac” pune flagul `fara_bac`: condiția `lipsaFlag: ["fara_bac"]` închide facultatea și postliceala (cu mesajul ei, care are prioritate față de `motiv`), joburile cu `"cereBac": true` (poliția) nu apar, iar cursul „Bacalaureatul, din nou” (`stergeFlag`) șterge flagul. Simularea: `node tests/simulare.js --n 200 --scenariu datorii`.

Averea netă an de an: `state.istoricPortofoliu` (instantaneu la sfârșitul fiecărui an); graficul (`graficAvere` din `js/ui/grafic.js`) apare din butonul 📈 al antetului și pe ecranul de final.

## Asigurările, moștenirile, părinții

`js/asigurari.js`, panoul Bancă → Asigurări (acțiunea `asigurare` cu `{ tip: 'locuinta' | 'viata', activ }`). Prima e o recurență marcată `asigurare` (din `config.json` → `asigurari`), iar flagurile `asigurare_locuinta` / `asigurare_viata` sunt citite de evenimentele din `data/events/familie-bani.json`: inundația de la vecini (cu asigurare plătești doar franciza), diagnosticul grav (indemnizația asigurării de viață, tratamentul la stat sau credit pentru clinica privată), moștenirea în bani, moștenirea cu datorii (Codul civil, art. 1114: răspunzi doar cu bunurile moștenite; plătești datoria și păstrezi casa ca imobil de închiriat, o vinzi și îți rămâne diferența, sau renunți în termenul din `config.mostenire`), ajutorul pentru părinți, donația părinților pentru avans, formularul 230. Asigurarea locuinței se oprește singură când nu mai ai nicio locuință; o primă neplătită reziliază polița (nu devine datorie). Evenimentele pot da un imobil de închiriat cu `"produsNou": { "tip": "imobil", "valoare": …, "marime": "garsoniera" }`.

## Partenerul și familia

`data/events/familie.json`, `js/familie.js`, `state.familie` (`{ partener, copii, stres, divortProgramat, fostulNuPlateste, indemnizatie }`; salvări versiunea 6). Alegerile schimbă familia cu efectul `"familie"` (un text sau o listă): `partener`, `casatorie`, `copil`, `concediuEu`, `concediuPartener`, `partenerSomer`, `divortNotar`, `divortInstanta`, `impacare`, `vindeCasaComuna`, `preiaCreditul`, `creditComun`, `platescEu`. Flagurile întreținute de cod: `partener`, `casatorit`, `are_copii`, `divortat`, `concediu_crestere`, `partener_concediu`, `partener_fara_venit`, `credit_cu_fostul`.

Banii lunii (`proceseazaFamilie`, pasul 2 din `proceseazaLuna`): venitul partenerului (`config.familie.venitPartenerNet`) nu e al tău; partenerul plătește jumătate din chirie și utilități, din costul copiilor și din ratele creditelor comune (cel mult 60% din venitul lui). Copiii costă `costLunarCopil` până la `varstaMajorat`; alocația e `alocatieSub2` / `alocatiePeste2`. În concediul de creștere (24 de luni) salariul nu vine, vine indemnizația (85% din net, între minim și maxim). După despărțire, copiii rămân la celălalt părinte și plătești pensia de întreținere (`pensieIntretinere`: 25 / 33 / 50% din net, Codul civil art. 529). Simplificare: fiecare își păstrează economiile (presupunem că ați pus deoparte cam la fel); se împarte doar casa cumpărată împreună.

**Co-debitorii:** venitul partenerului intră în gradul de îndatorare doar dacă luați creditul împreună: `"indatorare": { …, "coDebitor": true }` în condiții și `"coDebitor": true` pe credit (evenimentul `cumpara-impreuna`). Atunci amândoi răspundeți pentru tot creditul. La divorț, `divort-casa` (programat de cod) oferă: vânzarea (banca se plătește prima, restul sau lipsa se împarte pe din două, comision `comisionVanzareCasa`), preluarea creditului (doar dacă salariul tău duce singur rata și ai banii pentru partea celuilalt) sau rămâneți amândoi pe credit; atunci, lunar, fostul poate înceta să plătească (`balans.familie.sansaFostulNuPlateste`) și urmează `fostul-nu-plateste`.

**Riscul de divorț** (`verificaCuplu`, la sfârșitul lunii, fluxul RNG `actiuni`): anual `divortBaza` + `divortLipsuri` × (lunile cu lipsuri din ultimul an, cu uitare treptată) / 12 + `divortRestante` dacă ai restanțe sau executare. Evenimentul `divort` are și „Mai încercăm o dată”, care înjumătățește stresul acumulat.

## Infracțiunile și consecințele

`data/events/infractiuni.json`, `js/infractiuni.js`. Doar decizii și urmări, fără descrierea faptei. O alegere cu `"infractiune": { "tip": "furt" | "mule" | "frauda" | "evaziune", "castig": "{suma}" }` dă câștigul (scris separat, în `efecte`) și trage la sorți dacă vine dosarul (`balans.json` → `infractiuni`: șansa de bază + creșterea la fiecare repetare). Evenimentul-urmare `dosar-penal` are alegerile `"pedeapsa": "recunoaste" | "avocat"`: amendă (ce nu plătești devine datorie la stat), închisoare (luni fără job, fără timp, fără evenimente obișnuite; în meniuri merg doar operațiunile cu bani), cazier pentru `config.infractiuni.aniReabilitare` ani (flagul `cazier`: băncile refuză creditele, scorul CV scade, joburile cu `"faraCazier": true` sunt închise). Un test verifică faptul că nicio faptă nu e rentabilă: câștigul e mai mic decât șansa de bază × amenda. Variabilele text ale evenimentelor se scriu `"text:…"`.

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

**Salvările jucătorilor:** testul „migrare: salvările reale de pe main…” încarcă `tests/fixtures/salvari-main-v1.json`, adică 10 salvări (și checkpoint-uri) scrise de codul de pe `main`, cu versiunea 1, unele în mijlocul anului, cu un card deschis. Testul verifică migrarea, panourile din meniuri și 3 ani de joc. Când se schimbă formatul pe `main`, regenerează fixture-ul:

```
git worktree add --detach ../finventure-main main
node tools/genereaza-salvari-main.js ../finventure-main tests/fixtures/salvari-main-v1.json
git worktree remove ../finventure-main
```

**Testarea pe telefon fără `main`:** ramura `extindere` e publicată pe **https://mihaimpmo.github.io/finventure-preview/** (repo-ul `mihaimpmo/finventure-preview`: un workflow verifică la câteva minute dacă `extindere` s-a schimbat și o publică; commit-ul publicat e în `/versiune.txt`; publicare imediată din Actions → „Preview extindere” → Run workflow). Local: `python -m http.server 8000 --bind 0.0.0.0` și `http://<IP-ul calculatorului>:8000` de pe telefon, în aceeași rețea. Lista ecranelor de verificat e în `docs/testare-telefon.md`.

**Salvările pe adrese diferite** (`js/storage.js`, `prefixPentru`): doar site-ul principal (`thinkingbig-ro.github.io/finventure/`) folosește cheile `finventure.*`; orice altă adresă (preview, localhost, alt repo) folosește `finventure-preview.*`. Toate site-urile de pe același domeniu `*.github.io` au același localStorage, așa că un preview publicat tot pe `thinkingbig-ro.github.io` nu poate strica salvările jucătorilor.

**Cache-ul după o actualizare:** GitHub Pages lasă browserul să folosească fișierele 10 minute fără să întrebe serverul. Ca un jucător să nu primească un amestec de fișiere vechi și noi:
- `index.html` nu încarcă direct `js/main.js`: întâi verifică la server, deodată, toate modulele din lista `MODULE` (cereri condiționate, 304 dacă nu s-au schimbat). JSON-urile se cer oricum așa, toate în paralel (`js/content.js`).
- **Când adaugi un modul nou (sau scoți unul), actualizează lista `MODULE` din `index.html`.** Testul „pornire” din `tests/loturi.js` compară lista cu graful real de importuri al lui `main.js` și pică, cu numele modulului, dacă lipsește ceva sau e ceva în plus. Lista fixă cere totul într-un singur val; urmărirea importurilor cerea un val pe fiecare nivel al grafului (~1 s în plus pe o rețea mobilă).
- Dacă tot apare o nepotrivire, `window.finventureRepara` cere din nou din rețea pagina, stilul și modulele, apoi reîncarcă, cel mult o dată la 5 minute. Nepotrivirile posibile: un modul nu pornește, conținutul are erori la pornire sau `index.html` are altă versiune decât codul.
- Versiunea paginii stă în `<meta name="finventure-cod">` din `index.html` și în `js/versiune.js`. Schimb-o în ambele locuri când codul depinde de o schimbare din `index.html`; un test le compară.
- Butoanele din antet sunt opționale în `main.js`, ca o pagină veche să nu oprească jocul.
- Importurile rămân relative (`from './x.js'` sau `import('./x.js')`), ca testul să le găsească pe toate.
- Pornirea măsurată cu „Slow 4G” în Chrome: vezi tabelul de mai jos.

## Cum am testat echilibrul jocului

Un joc educativ trebuie să fie corect: deciziile bune trebuie să ducă la rezultate bune, iar cele proaste la probleme, fără ca rezultatul să fie forțat. Ca să verificăm asta, am scris patru „jucători automați” (profiluri) și i-am pus să joace câte **500 de vieți fiecare**, de la 18 la 65 de ani, cu aceleași reguli și aceleași evenimente ca un jucător real. Profilurile folosesc și meniurile (bancă, investiții, carieră, stil de viață), nu doar cardurile de decizie.

| Profil | Cum joacă | Ajung la pensie sau la independență | Faliment | Averea mediană la final (lei de azi) | Finalul cel mai des |
|---|---|---|---|---|---|
| **Prudent** | bugetul 50/30/20: fond de urgență de 6 luni, ~20% din venit investit, chiria sub 35% din venit, stil mai bun doar dacă și-l permite, cumpără casă când banca îl aprobă | **100%** | 0% | ~1,3 mil. lei | Milionar în lei de azi (67%) |
| **Frugal** | trai modest toată viața, rămâne în chirie, investește aproape tot ce rămâne | **100%** | 0% | ~2 mil. lei | Rentierul (51%) |
| **Aleator** | alege la întâmplare, inclusiv în meniuri | 38% | 62% (54% faliment, 8% burnout) | ~86.000 lei | Faliment personal (25%) |
| **Riscant** | IFN, muncă la negru, card pe plata minimă, cheltuie tot, vinde în panică | 1% | 99% | sub zero | Victima reducerilor (55%) |

*Sursa: `docs/raport-simulare.json` (500 de vieți pe profil, 88 de evenimente). „Lei de azi” = sumele finale ajustate cu inflația simulată, ca să poată fi comparate cu prețurile de acum.*

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
| 500 de vieți, înainte de extindere (tot pe ETF) | 475 | ~1,20 mil. lei de azi | ~1,23 mil. lei de azi | **51%** din vieți (diferența mediană: ~+5.000 lei) |
| 500 de vieți, după extindere (prudentul rebalansează la 5 ani pe strategia echilibrată: 60% ETF, 25% titluri de stat, 10% aur, 5% acțiuni) | 464 | ~1,18 mil. lei de azi | ~818.000 lei de azi | **80%** din vieți (diferența mediană: ~+347.000 lei) |
| 500 de vieți, după extindere, fără rebalansare (verificare) | 455 | ~1,38 mil. lei de azi | ~1,30 mil. lei de azi | **59%** din vieți |
| **500 de vieți, profilul de acum: strategie după vârstă** (dinamică sub 45 de ani: 80% ETF, 10% acțiuni, 5% aur, 5% crypto; echilibrată la 45–59; prudentă de la 60: 60% titluri de stat, 30% ETF, 10% aur) | 458 | ~1,3 mil. lei de azi | ~935.000 lei de azi | **74%** din vieți (diferența mediană: ~+313.000 lei) |

Schimbarea a apărut la lotul 4a (verificat commit cu commit pe 100 de vieți: 51% pe `main`, 84% imediat după 4a). Cauza e strategia de investiții a profilului, nu o greșeală de calcul: în chirie, toată averea stă în portofoliu, iar un portofoliu echilibrat crește mai încet decât unul doar pe ETF. Cu tot pe ETF, chiria și casa ies aproape egal.

De la 2026-11-25, prudentul rebalansează după orizontul de timp (`strategiaDupaVarsta` în `js/simulare.js`; atinge doar profilul din simulare, nu jocul), ca în lecția „orizontul de timp”. Chiria se apropie de casă față de strategia echilibrată fixă (74% față de 80%), dar nu ajunge la egalitatea de la „tot pe ETF”, care ține totul pe bursă până la 65 de ani. N-am măsurat separat cât contează partea din strategia dinamică care nu e ETF (acțiuni, aur, crypto) și cât trecerea pe variante mai sigure după 45 de ani. Casa nu depinde de strategie.

Răspunsul, în modelul nostru: **depinde de cum investești diferența.** Casa îți aduce siguranță și nicio chirie la bătrânețe; chiria ajunge în același loc doar cu investiții disciplinate și pe bursă. Lecția nu e „cumpără” sau „nu cumpăra”, ci: alege o casă pe care ți-o permiți, iar dacă rămâi în chirie, investește diferența. Fără investiții, chiria pierde. Rezultatul depinde de ipoteze care pot fi discutate și sunt toate în `data/config.json`: dobânda la ipotecă (7,5%), randamentul investițiilor (~7%), creșterea prețurilor caselor (inflația + 1%) și faptul că chiria crește odată cu inflația.

## Limitări cunoscute (direcții de extindere)

- **Fără programe de stat pentru locuințe** (de exemplu „Noua Casă”, cu avans de 5%).
- **Fără credite în valută.** Plafonul BNR pentru ele (20%) e deja în `data/config.json`, dar nefolosit.

## Valorile economice

Toate cifrele (taxe, salarii, chirii, dobânzi, DAE, randamente, inflație, limita de poprire, garantarea depozitelor) stau în `data/config.json`. Fiecare valoare are `"deVerificat": true` și un câmp `"sursa"`, de completat după verificarea cu un specialist. Parametrii de joc (praguri, ritmul de revenire a energiei etc.) stau separat, în `data/balans.json`.

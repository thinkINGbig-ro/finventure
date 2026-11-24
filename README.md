# Finventure

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
js/bilant.js        bilanțul vieții (tipare, pensie estimată, independență)
js/tipare.js        „Ce te-a costat / Ce te-a ajutat”
js/content.js       încărcarea JSON-urilor + validarea schemei
js/analiza.js       analiza legăturilor (flag-uri, evenimente inaccesibile, concepte)
js/simulare.js      profilurile de jucător și simularea
js/ui/*.js          ecranele
data/config.json    valori economice (toate marcate „deVerificat”)
data/balans.json    parametri de joc (echilibrare)
data/events/*.json  evenimentele, pe teme
data/concepts.json, data/jobs.json, data/endings.json
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
| **Prudent** | bugetul 50/30/20: fond de urgență de 6 luni, ~20% din venit investit, chiria sub 35% din venit, stil mai bun doar dacă și-l permite, cumpără casă când banca îl aprobă | **100%** | 0% | ~1,2 mil. lei | Milionar în lei de azi (35%) |
| **Frugal** | trai modest toată viața, investește aproape tot ce rămâne | **100%** | 0% | ~2,0 mil. lei | Rentierul (58%) |
| **Aleator** | alege la întâmplare, inclusiv în meniuri | 55% | 45% | ~219.000 lei | Pensionar liniștit (44%) |
| **Riscant** | IFN, muncă la negru, card pe plata minimă, cheltuie tot, vinde în panică | 19% | 81% | ~56.000 lei | Regele IFN-urilor (64%) |

*Sursa: `docs/raport-simulare.json` (500 de vieți pe profil, 57 de evenimente). „Lei de azi” = sumele finale ajustate cu inflația simulată, ca să poată fi comparate cu prețurile de acum.*

Ce arată:

- **Diferența vine din decizii, nu din noroc.** Toate profilurile trăiesc aceleași tipuri de evenimente (boli, concedieri, crize pe bursă), dar prudentul le absoarbe din fondul de urgență, iar riscantul le acoperă cu credite scumpe.
- **Lecțiile se văd în cauzele falimentului.** La riscant, falimentul pornește de cele mai multe ori de la un credit IFN luat pentru o urgență și continuă cu restanțe, recuperatori și poprire. La aleator, cauzele frecvente sunt IFN-ul pentru o problemă de sănătate, telefonul în rate și mutarea singur fără bani deoparte. Creditele bancare sunt limitate de gradul de îndatorare (ca în realitate, plafonul BNR), așa că un jucător nu poate lua o mașină sau o casă pe care nu și-o permite; un IFN, însă, nu verifică nimic.
- **Lecțiile se văd și în salarii.** Pe durata unei vieți simulate, inflația medie e ~4,8% pe an și randamentul ETF ~7% pe an. Salariul crește peste inflație doar dacă ceri măriri, accepți promovări sau schimbi jobul: real, +0,6–0,8% pe an la prudent și frugal, ~0% la aleator, −0,5% la riscant. Valorile economice din `data/config.json` sunt marcate „de verificat” și vor fi confirmate de un specialist.
- **N-am „ajustat” rezultatele.** Când un profil a ieșit nerealist (de exemplu, la început prudentul ajungea la averi de zeci de milioane), am căutat cauza în mecanici (măririle nu aveau plafon față de piață, crash-urile bursiere erau numărate de două ori) și am reparat-o, nu am schimbat procentele.

### Chirie sau cumpărare?

O întrebare pe care o au mulți adolescenți (și părinții lor). În simulare, **32% dintre jucătorii prudenți cumpără o locuință**, la o vârstă mediană de 38–39 de ani, de obicei vânzându-și investițiile pentru avans. Ce îi oprește pe ceilalți e gradul de îndatorare: cu un singur salariu, rata la un apartament cu două camere trece de 40% din venitul net.

Ca să răspundem corect, nu am comparat pur și simplu jucătorii care au cumpărat cu cei care n-au cumpărat: cei care cumpără au, în medie, salarii cu ~22% mai mari, deci ar ieși oricum mai bogați (comparația naivă dă 1,3 mil. față de 1,1 mil. lei de azi în favoarea casei). Am jucat **aceeași viață de două ori**, cu același seed (același job, aceleași șocuri, aceeași bursă): o dată profilul prudent cumpără casa, o dată rămâne în chirie și își păstrează investițiile.

| Simulare | Vieți cu cumpărare | Averea mediană cu casa | Aceeași viață, în chirie | Casa a ieșit mai bine în |
|---|---|---|---|---|
| 500 de vieți | 164 | ~1,28 mil. lei de azi | ~1,45 mil. lei de azi | **42%** din vieți (diferența mediană: −113.000 lei) |

Răspunsul, în modelul nostru: **depinde, și diferența e mai mică decât cred mulți.** Casa îți aduce siguranță și nicio chirie la bătrânețe; chiria plus investițiile disciplinate au ieșit puțin mai bine în mai mult de jumătate din vieți, pentru că avansul vândut din investiții și dobânda la ipotecă (7,5%) costă mai mult decât randamentul pierdut. Lecția nu e „cumpără” sau „nu cumpăra”, ci: dacă rămâi în chirie, investește diferența, altfel casa câștigă sigur. Rezultatul depinde de ipoteze care pot fi discutate și sunt toate în `data/config.json`: dobânda la ipotecă (7,5%), randamentul investițiilor (~7%), creșterea prețurilor caselor (inflația + 1%) și faptul că chiria crește odată cu inflația.

## Valorile economice

Toate cifrele (taxe, salarii, chirii, dobânzi, DAE, randamente, inflație, limita de poprire, garantarea depozitelor) stau în `data/config.json`. Fiecare valoare are `"deVerificat": true` și un câmp `"sursa"`, de completat după verificarea cu un specialist. Parametrii de joc (praguri, ritmul de revenire a energiei etc.) stau separat, în `data/balans.json`.

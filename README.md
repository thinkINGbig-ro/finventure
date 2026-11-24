# Finventure

Un joc web despre bani, decizii și viață, de la 18 la 65 de ani. Proiect pentru concursul național de educație financiară **Banometru**.

Pornești la 18 ani, după bac. Fiecare apăsare pe **Avansează** trece un an. Între timp apar decizii: facultate sau job, cont la bancă, primul salariu, chirie, card de credit, IFN, investiții, înșelătorii. Fiecare are consecințe, unele imediat, altele peste ani. Jocul nu ține lecții: le descoperi din ce ți se întâmplă.

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
| **Prudent** | bugetul 50/30/20: fond de urgență de 6 luni, ~20% din venit investit, se mută de acasă, stil confortabil când își permite | **100%** | 0% | ~1,1 mil. lei | Rentierul (48%) |
| **Frugal** | trai modest toată viața, investește aproape tot ce rămâne | **100%** | 0% | ~2,2 mil. lei | Libertate la 40 (61%) |
| **Aleator** | alege la întâmplare, inclusiv în meniuri | 43% | 57% | ~85.000 lei | Pensionar liniștit (32%) |
| **Riscant** | IFN, muncă la negru, card pe plata minimă, cheltuie tot | 14% | 86% | ~44.000 lei | Regele IFN-urilor (69%) |

*Sursa: `docs/raport-simulare.json` (500 de vieți pe profil, 41 de evenimente). „Lei de azi” = sumele finale ajustate cu inflația simulată, ca să poată fi comparate cu prețurile de acum.*

Ce arată:

- **Diferența vine din decizii, nu din noroc.** Toate profilurile trăiesc aceleași tipuri de evenimente (boli, concedieri, crize pe bursă), dar prudentul le absoarbe din fondul de urgență, iar riscantul le acoperă cu credite scumpe.
- **Lecțiile se văd în cauzele falimentului.** La riscant, falimentul pornește de cele mai multe ori de la un credit IFN luat pentru o urgență și continuă cu restanțe, recuperatori și poprire. La aleator, cauzele frecvente sunt mașina nouă luată cu credit și telefonul în rate.
- **Lecțiile se văd și în salarii.** Pe durata unei vieți simulate, inflația medie e ~4,8% pe an și randamentul ETF ~7% pe an. Salariul crește peste inflație doar dacă ceri măriri, accepți promovări sau schimbi jobul: real, +0,6% pe an la prudent și frugal, ~0% la aleator, −0,5% la riscant. Valorile economice din `data/config.json` sunt marcate „de verificat” și vor fi confirmate de un specialist.
- **N-am „ajustat” rezultatele.** Când un profil a ieșit nerealist (de exemplu, la început prudentul ajungea la averi de zeci de milioane), am căutat cauza în mecanici (măririle nu aveau plafon față de piață, crash-urile bursiere erau numărate de două ori) și am reparat-o, nu am schimbat procentele.

## Valorile economice

Toate cifrele (taxe, salarii, chirii, dobânzi, DAE, randamente, inflație, limita de poprire, garantarea depozitelor) stau în `data/config.json`. Fiecare valoare are `"deVerificat": true` și un câmp `"sursa"`, de completat după verificarea cu un specialist. Parametrii de joc (praguri, ritmul de revenire a energiei etc.) stau separat, în `data/balans.json`.

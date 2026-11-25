# Testarea extinderii pe telefon

Ramura `extindere` (loturile 0–9c). Pentru fiecare ecran: **unde** (tab, buton), **ce faci** și **ce ar trebui să vezi**. Ecranele cu cel mai mare risc vizual (multe date pe un ecran îngust) sunt primele.

**Ce urmărești peste tot:** nimic nu iese din ecran pe orizontală (fără scroll lateral), cifrele nu se rup pe două rânduri în mijlocul sumei, butoanele au cel puțin un deget lățime (44 px) și nu se suprapun, textele lungi se rup pe rânduri în loc să fie tăiate, mesajul verde / roșu apare sus după fiecare acțiune.

**Scurtături:** deschide jocul cu `?debug=1` la final de adresă. Din panoul de debug poți sări la o vârstă, seta bani, statistici sau flag-uri și forța un eveniment după id (id-urile sunt scrise mai jos, în paranteze). Pentru ecranele care cer bani, setează întâi numerar mult (ex. 500.000 lei).

---

## Risc mare: tabele și liste lungi

### Lotul 4a: Investiții
1. **Tab Investiții → „Portofoliul tău”.** Investește întâi în 3–4 clase (debug: bani mulți, apoi „Investește” pe fiecare). Vezi: totalul, câștigul, comisioanele plătite; fiecare clasă pe un rând cu bara de pondere și butoanele „Vinde” / „Vinde tot” pe același rând sau frumos sub el.
2. **Graficul portofoliului** (după 2 ani cu investiții). Atinge graficul: apare o linie verticală și un tooltip care nu iese din ecran nici la marginea din dreapta. „Vezi valorile în tabel” deschide un tabel lizibil.
3. **„Acțiuni la companii”** (se deschide): 5 companii cu preț și buton; o companie falimentată apare marcată.
4. **„Investiție automată lunară”**: select-ul cu clasa + câmpul sumei + butonul încap pe un rând sau se așază unul sub altul.
5. **„Pensia ta privată” și „Rebalansează”**: 3 butoane de strategie, fiecare cu text scurt.

### Lotul 6a + 6b: Afacerea
6. **Tab Carieră → „Afacerea ta” → „Mă pregătesc”.** Se deschide panoul „Afacerea ta” cu „‹ Înapoi la Carieră” sus. Pregătirea: Plan de afaceri, Curs, Grant.
7. **Pornirea:** lista de domenii, „Fac un studiu de piață”, forma juridică, bifele Credit / Investitor, **previzualizarea** (tabel cu bani + pregătire + luna estimată; dacă nu se poate, textul roșu cu motivul), „Pornesc afacerea”.
8. **Cu afacerea pornită** (avansează 1 an): tabelul lunii trecute (vânzări, costuri, taxe, profit și rândul „Bani intrați efectiv în cont (net)”), datoriile, creditul; la IT / renovări / magazin online, netul diferă de profit. Graficul profitului apare după 3 luni.
9. **„Deciziile tale”:** 3 butoane de preț (Mici / Ca piața / Mari), marketing (câmp + Setează), echipa (listă 0–4 + Setează), „Extinde afacerea” (dezactivat cu motiv la început), credit pentru firmă, „Vinde afacerea” (dezactivat primul an), „Scot din firmă” / „Pun în firmă”, „Închid afacerea” (cere confirmare). Mesajul roșu „Ai pierdut cam … din vânzări: echipa nu face față”.

### Lotul 2: Datoriile mele
10. **Tab Bancă → „Datoriile mele” → „Vezi și gestionează”.** Ai nevoie de 2–3 datorii (ia un credit, un telefon în rate, folosește cardul). Vezi: câte un card per datorie cu restul, rata, luni rămase, costul total rămas.
11. **Rambursare anticipată** pe un credit: câmpul sumei + „Scade rata” / „Termin mai repede” + previzualizarea cu dobânda economisită.
12. **Eșalonare la recuperator** (forțează lanțul IFN până la recuperator sau evenimentul `ifn-restanta`): 3 butoane (6 / 12 / 24 de luni).
13. **„Pe care o plătești întâi?”** (avalanșă / bulgăre de zăpadă) și **„Strânge-le într-un singur credit”**: bifele, durata, previzualizarea.

### Lotul 7: Cumpărături
14. **Tab Cumpărături.** Sub „Stilul tău de viață”: „Ce ai” (cu „Vinde (… lei)”; animalele fără buton), „Locuințe” cu „Caut o locuință”, apoi 6 categorii care se deschid. Fiecare produs are **2–4 butoane de plată** (Cash / Card / Rate / Mai târziu) și rândul cu costul ratelor: verifică că butoanele se așază pe rânduri, nu ies din card. Butoanele dezactivate au motivul scris.

### Lotul 5: Carieră
15. **Tab Carieră** (cu un job full-time): punctele de timp sus, cardul jobului, „Cât de tare tragi” (3 butoane), „La job” (Cere o mărire, Cere o promovare, Ore suplimentare cu suma, Curs plătit de firmă), „Îmi dau demisia” (confirmare), „Venit în plus” (5 activități), „Fă-ți din hobby o meserie”. La un artist (debug: devino pictor), cardul jobului arată faima și intervalul veniturilor.

### Lotul 4b: Imobiliare
16. **Tab Investiții → „Imobiliare de închiriat”.** Cardurile de cumpărare (Cash / Cu credit, dezactivate cu motiv), cardul proprietății (chiriaș sau gol, chiria, „Vinde”). Evenimentele `imobil-reparatie` și `imobil-chirias-nu-plateste`.

---

## Risc mediu: carduri cu mult text

### Lotul 9c: Familia
17. **Tab Bancă, jos: secțiunea „Familia”** (apare doar cu partener, copii sau după despărțire). Forțează `intalnire`: dacă stai singur în chirie sau în casa ta, alege „Se mută la mine”; dacă stai cu părinții sau cu colegi, „Ne luăm o chirie doar a noastră”. Vezi: „👫 Bugetul familiei” cu soldul lunar (+/−) în dreapta, apoi textul cu partea partenerului. După `nastere`: copiii cu vârsta, costul, alocația, indemnizația.
18. **Evenimentele** (debug → Forțează): `bani-in-cuplu`, `nunta` (4 alegeri; „Nuntă mică” dezactivată fără bani), `copil-decizie`, `nastere` („Iau eu concediul” dezactivată fără contract), `partener-somaj`, `divort` (notar / tribunal dezactivate dacă nu sunteți căsătoriți și invers), `cumpara-impreuna` (grupul „Cumpărăm împreună” cu fixă / variabilă; motivul cu „venitul vostru net”).
19. **Casa comună la divorț:** cumpără întâi cu `cumpara-impreuna`, apoi forțează `divort` și alege divorțul: urmează direct `divort-casa`, cu eticheta lungă „Păstrez casa: preiau creditul și îi dau partea lui (… lei)”; trebuie să se rupă frumos pe rânduri. Apoi `fostul-nu-plateste`.

### Lotul 9a: Scenarii și graficul averii
20. **Antet → 📈:** cardul „Averea ta netă”, cu graficul după 2 ani (avere netă + datorii punctate, legendă, „Vezi valorile în tabel”).
21. **Meniul ⋯ → „Joc nou”:** ecranul „O viață nouă” cu 4 scenarii (butoane mari cu descriere) și „Renunță”. La final, „Joc nou” deschide același ecran, fără „Renunță”.
22. **Scenariul „Fără bac”:** prima decizie are facultatea dezactivată, cu motivul despre bac; Educație → „Bacalaureatul, din nou”. **„Moștenești o garsonieră”:** Investiții → Imobiliare, garsoniera de dat în chirie.
23. **Ecranul de final:** secțiunea cu graficul averii și „Educația ta, ca investiție”.

### Lotul 3: Educație
24. **Tab Educație:** „Acum studiezi” (+ „Renunț la studii” cu confirmare), lista programelor (2 butoane la cele cu taxă: „Mă înscriu și plătesc” / „Cu credit de studii”), Facultatea de medicină, cursurile (✓ Ai certificatul / În curs).

### Lotul 9b + reparațiile: Asigurări și moșteniri
25. **Tab Bancă → „Asigurări”:** locuința și viața, cu prima lunară, „Mă asigur” / „Renunț”, dezactivate cu motiv fără locuință sau fără venit.
26. **Evenimentele:** `inundatie-locuinta` (cu o locuință), `diagnostic-grav`, `mostenire-bani`, `mostenire-datorii` („Casa unchiului”: 3 alegeri; „Plătesc și păstrez casa” dezactivată fără bani; după ea, casa apare în Investiții → Imobiliare), `ajutor-parinti`, `ajutor-avans`, `formular-230`.

---

## Risc mic: ecrane simple

### Lotul 1: Activități
27. **Bara de jos:** 6 tab-uri pe 360 px, primul 🎯 Activități; în antet, 📖 lângă ⋯.
28. **Tab Activități:** punctele „Timp anul ăsta”, cardurile pe categorii, „Fă asta” dezactivat cu motivul (ex. vacanța în străinătate la 18 ani).

### Lotul 8: Infracțiuni
29. **Evenimentele** `oferta-cont`, `furt-marunt` (doar cu bara Bani foarte jos), `decont-fals` (cu job full-time), `tentatie-evaziune` (cu afacere); `dosar-penal`: „Recunosc fapta” / „Îmi iau avocat (… lei)”, apoi mesajul cu condamnarea.
30. **În detenție:** tab Activități („Ești în detenție încă … luni”), Carieră și Cumpărături blochează acțiunile cu un mesaj, Banca merge; jurnalul la eliberare. **Cu cazier:** mai puține oferte de job, refinanțarea și „Rate” refuzate, cu motivul.

### Lotul 0
31. **Bancă → Datoriile mele → „Achită tot”** la o restanță la facturi: mesajul verde sus. **Somația de plată** → „Plătesc tot acum” › „Scot din economii”: ecranul „Ce s-a întâmplat” cu „Mai departe”.

---

## Salvările

32. **Un joc început pe site-ul de acum (`main`) nu se pierde.** Testul automat „migrare: salvările reale de pe main…” încarcă 10 salvări reale (generate cu `tools/genereaza-salvari-main.js`), inclusiv 3 cu un card deschis, și le joacă 3 ani. Pe telefon nu poți verifica direct: salvarea de pe GitHub Pages e legată de adresa acelui site și nu se vede de pe serverul local.

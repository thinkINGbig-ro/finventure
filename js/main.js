// Pornirea jocului și legătura dintre motor și ecrane.

import { cititorFetch, formateazaEroare, incarcaContinut } from './content.js';
import { alege, avanseaza, continua, jocNou, oprireCurenta } from './engine.js';
import {
  adaugaCheckpoint, deblocheazaConcepteGlobal, incarcaJoc, rezumatFinanciar, salveazaJoc, stergeJoc,
} from './state.js';
import { CHEI, creeazaStorage } from './storage.js';
import { bal } from './util.js';
import { $, h } from './ui/dom.js';
import { arataEveniment } from './ui/eveniment.js';
import { arataFinal, arataMoment, arataRezumat, confirma } from './ui/ecrane.js';
import { deschidePanou } from './ui/meniuri.js';
import { creeazaEcranPrincipal } from './ui/principal.js';
import { stratDeschis } from './ui/strat.js';
import { arataLectie } from './ui/toast.js';

const NUME = ['Alex', 'Ana', 'Andrei', 'Ioana', 'Matei', 'Maria', 'Radu', 'Elena', 'Vlad', 'Daria', 'Luca', 'Sara', 'Tudor', 'Irina', 'Eric', 'Bianca'];

async function porneste() {
  let incarcare;
  try {
    incarcare = await incarcaContinut(cititorFetch('./'));
  } catch (e) {
    return eroareFatala(e);
  }
  const { ctx, erori, avertismente } = incarcare;
  if (erori.length) arataErori(erori);
  avertismente.forEach((a) => console.warn(`[conținut] ${formateazaEroare(a)}`));
  if (!ctx.evenimente.has(ctx.balans?.start?.evenimentStart)) return eroareFatala(new Error('Evenimentul de start lipsește (vezi erorile de conținut).'));

  const storage = creeazaStorage();
  ctx.persistenta = {
    salveaza: (s) => salveazaJoc(storage, s),
    checkpoint: (s, eticheta) => adaugaCheckpoint(storage, s, eticheta, bal(ctx, 'salvare.checkpointuriMax')),
    concepte: (ids) => deblocheazaConcepteGlobal(storage, ids),
  };

  const ui = creeazaEcranPrincipal(ctx);
  const btnAvanseaza = $('#btn-avanseaza');
  let state = incarcaJoc(storage) ?? stareNoua(ctx);
  let ocupat = false;

  const randeaza = () => {
    ui.randeaza(state);
    deblocheazaConcepteGlobal(storage, state.concepte); // include conceptele din momentele-cheie
  };

  // Rulează opririle una după alta până când jocul așteaptă din nou „Avansează”.
  async function ruleaza(oprire) {
    ocupat = true;
    btnAvanseaza.disabled = true;
    try {
      while (oprire) {
        randeaza();
        if (oprire.tip === 'eveniment') {
          const cale = await arataEveniment(oprire);
          const r = alege(state, ctx, cale);
          randeaza();
          arataLectie(r.rezultat, ctx);
          oprire = r.oprire;
        } else if (oprire.tip === 'moment') {
          await arataMoment(oprire, ctx);
          oprire = continua(state, ctx);
        } else if (oprire.tip === 'rezumat') {
          await arataRezumat(oprire, state, ctx);
          oprire = continua(state, ctx);
        } else if (oprire.tip === 'final') {
          await arataFinal(oprire, rezumatFinanciar(state, ctx), state.indicePreturi);
          state = incepeDinNou();
          oprire = oprireCurenta(state, ctx);
        } else {
          oprire = null;
        }
      }
    } catch (e) {
      console.error(e);
      arataLectie({ lectie: `A apărut o eroare: ${e.message}` }, ctx);
    } finally {
      ocupat = false;
      btnAvanseaza.disabled = false;
      randeaza();
    }
  }

  function incepeDinNou() {
    stergeJoc(storage);
    ui.reseteaza();
    return stareNoua(ctx);
  }

  btnAvanseaza.addEventListener('click', () => {
    if (!ocupat && !stratDeschis()) ruleaza(avanseaza(state, ctx));
  });

  for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => {
      if (ocupat) return;
      deschidePanou(tab.dataset.tab, {
        state, ctx, conceptGlobale: storage.citeste(CHEI.concepte, []), laSchimbare: randeaza,
        laOprire: (oprire) => ruleaza(oprire), // ex. CV-ul pornit din meniul Carieră
      });
    });
  }

  $('#btn-meniu').addEventListener('click', async () => {
    if (ocupat) return;
    if (await confirma('Începi o viață nouă? Jocul de acum se pierde (conceptele descoperite rămân).', { da: 'Joc nou' })) {
      state = incepeDinNou();
      ruleaza(oprireCurenta(state, ctx));
    }
  });

  if (storage.tip !== 'localStorage') {
    arataLectie({ lectie: 'Browserul blochează salvarea: poți juca, dar progresul se pierde când închizi pagina.' }, ctx);
  }

  randeaza();
  ruleaza(oprireCurenta(state, ctx)); // reia o decizie rămasă deschisă (sau prima decizie, la joc nou)
}

function stareNoua(ctx) {
  const nume = NUME[Math.floor(Math.random() * NUME.length)];
  return jocNou(ctx, { seed: `${Date.now()}-${Math.random()}`, nume });
}

function arataErori(erori) {
  erori.forEach((e) => console.error(`[conținut] ${formateazaEroare(e)}`));
  const el = $('#erori-continut');
  el.replaceChildren(h('details', {},
    h('summary', {}, `Conținutul are ${erori.length} ${erori.length === 1 ? 'eroare' : 'erori'}: evenimentele afectate nu apar în joc.`),
    h('ul', {}, erori.map((e) => h('li', {}, formateazaEroare(e))))));
  el.hidden = false;
}

function eroareFatala(e) {
  console.error(e);
  const local = location.protocol === 'file:';
  $('#app').replaceChildren(h('div', { class: 'card', style: 'margin:16px' },
    h('h2', {}, 'Jocul nu a putut porni'),
    h('p', {}, local
      ? 'Deschide jocul printr-un server local (ex. „npx serve” sau „python -m http.server” în folderul proiectului), nu direct din fișier.'
      : e.message)));
}

porneste();

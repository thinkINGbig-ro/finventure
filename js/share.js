// Cardul de distribuit la final: imagine generată pe canvas + Web Share API,
// cu descărcarea imaginii ca variantă de rezervă.

const CULORI = { bg: '#1E1638', main: '#3B5BDB', accent: '#FF8A3D', text: '#F3EEFF', text2: '#C9BFE8' };

// date: { titluFinal, emoji, linie (fraza principală), sub (rând mic), url }
export async function genereazaCard(date) {
  try { await document.fonts?.ready; } catch { /* fără fonturi web: folosim fallback */ }
  const W = 1080;
  const H = 1350;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const font = (marime, greutate = 600) => `${greutate} ${marime}px Fredoka, Nunito, system-ui, sans-serif`;

  g.fillStyle = CULORI.bg;
  g.fillRect(0, 0, W, H);
  g.fillStyle = CULORI.main;
  g.beginPath();
  g.arc(W - 120, 160, 300, 0, Math.PI * 2);
  g.fill();

  g.textBaseline = 'top';
  g.font = font(64, 700);
  g.fillStyle = CULORI.accent;
  g.fillText('Fin', 80, 80);
  const lFin = g.measureText('Fin').width;
  g.fillStyle = CULORI.text;
  g.fillText('venture', 80 + lFin, 80);

  g.font = font(160, 400);
  g.fillText(date.emoji ?? '🏁', 80, 330);
  g.font = font(76, 700);
  g.fillStyle = CULORI.accent;
  scrieRanduri(g, date.titluFinal, 80, 540, W - 160, 88);

  g.font = font(60, 600);
  g.fillStyle = CULORI.text;
  const y = scrieRanduri(g, date.linie, 80, 720, W - 160, 76);
  if (date.sub) {
    g.font = font(42, 400);
    g.fillStyle = CULORI.text2;
    scrieRanduri(g, date.sub, 80, y + 24, W - 160, 54);
  }

  g.fillStyle = CULORI.accent;
  roundRect(g, 80, H - 230, W - 160, 120, 60);
  g.fill();
  g.font = font(48, 700);
  g.fillStyle = CULORI.bg;
  g.textAlign = 'center';
  g.fillText('Tu cum ai face?', W / 2, H - 200);
  g.textAlign = 'left';
  g.font = font(32, 400);
  g.fillStyle = CULORI.text2;
  g.fillText(date.url.replace(/^https?:\/\//, ''), 80, H - 80);
  return c;
}

function scrieRanduri(g, text, x, y, latime, inaltime) {
  const cuvinte = text.split(' ');
  let rand = '';
  for (const cuv of cuvinte) {
    const test = rand ? `${rand} ${cuv}` : cuv;
    if (g.measureText(test).width > latime && rand) {
      g.fillText(rand, x, y);
      y += inaltime;
      rand = cuv;
    } else rand = test;
  }
  if (rand) {
    g.fillText(rand, x, y);
    y += inaltime;
  }
  return y;
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// Întoarce 'distribuit' | 'descarcat' | 'anulat'.
export async function distribuie(date) {
  const canvas = await genereazaCard(date);
  const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
  const fisier = new File([blob], 'finventure.png', { type: 'image/png' });
  const text = `${date.textDistribuire} ${date.url}`;
  try {
    if (navigator.canShare?.({ files: [fisier] })) {
      await navigator.share({ files: [fisier], text, title: 'Finventure' });
      return 'distribuit';
    }
  } catch (e) {
    if (e?.name === 'AbortError') return 'anulat';
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'finventure.png';
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return 'descarcat';
}

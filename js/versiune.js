// Versiunea paginii: aceeași valoare stă în index.html (<meta name="finventure-cod">). Dacă diferă, browserul
// are în cache un index.html și un main.js din versiuni diferite, iar pornirea cere fișierele din nou.
// Schimb-o (în ambele locuri) când index.html se schimbă într-un fel de care depinde codul; un test le compară.
export const COD_PAGINA = '2026-11-25';

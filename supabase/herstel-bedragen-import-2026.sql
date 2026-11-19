-- Herstel: geïmporteerde facturen 2026 die door een fout op € 0,00 zijn gezet.
-- Bedragen komen uit de originele Word-facturen. Past alleen facturen aan die nu op 0 staan.
update documents d
set subtotal = v.excl, vat_amount = v.btw, total = v.totaal
from (values
  ('202601', 85.00, 17.85, 102.85),
  ('202602', 85.00, 17.85, 102.85),
  ('202603', 112.50, 23.63, 136.13),
  ('202604', 85.00, 17.85, 102.85),
  ('202605', 85.00, 17.85, 102.85),
  ('202606', 85.00, 17.85, 102.85),
  ('202607', 766.00, 160.86, 926.86),
  ('202608', 42.50, 8.93, 51.43),
  ('202609', 42.50, 8.93, 51.43),
  ('202610', 42.50, 8.93, 51.43),
  ('202611', 85.00, 17.85, 102.85),
  ('202612', 42.50, 8.93, 51.43)
) as v(nummer, excl, btw, totaal)
where d.doc_type = 'factuur' and d.imported and d.number = v.nummer and d.total = 0;

-- Controle: alle geïmporteerde facturen met bedragen
select number, issue_date, client_snapshot->>'name' as klant, subtotal, vat_amount, total, status
from documents where imported order by number;

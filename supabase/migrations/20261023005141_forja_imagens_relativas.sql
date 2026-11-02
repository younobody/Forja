-- Migration 20261023005141 "forja_imagens_relativas" (projeto FORJA, aupfamquyihqagzwmpkb, 23/10/2026).
-- Este arquivo nao existia no repositorio; copiado em 02/11/2026 de supabase_migrations.schema_migrations.statements.
-- So dado, sem DDL: as imagens dos exercicios passaram a ser servidas pelo proprio Worker (caminho relativo) em vez do
-- GitHub Pages. O efeito ja esta nos dados vivos; ao reconstruir o banco a partir de um backup de dados que ainda traga a
-- URL antiga, rode este UPDATE.

update public.exercicios
set imagem_url = replace(imagem_url, 'https://younobody.github.io/Forja/', '')
where imagem_url like 'https://younobody.github.io/Forja/%';

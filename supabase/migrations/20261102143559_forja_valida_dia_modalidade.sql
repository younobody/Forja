-- Migration 20261102143559 "forja_valida_dia_modalidade". Aplicada ao vivo via Supabase MCP em 02/11/2026 (projeto
-- aupfamquyihqagzwmpkb). Do inicio do bloco abaixo ate o `end $function$;` e o texto EXATO aplicado
-- (supabase_migrations.schema_migrations.statements); o bloco de ROLLBACK, no fim do arquivo, e so comentario.
-- Efeito imediato e independente do front: um registro com dia fora de A-E ou modalidade fora da lista passa a ser
-- recusado pela RPC com 'limite: dia ou modalidade invalido'. Nada de tabela/dado foi alterado.

-- FORJA · valida "dia" e "modalidade" dos registros enviados pelo aluno (defesa em profundidade contra XSS armazenado).
-- Ate a v30.29.0 do front, o painel do trainer renderizava esses dois campos sem escapar. O front foi corrigido, mas
-- config.google_signup = 'sim' deixa qualquer conta Google criar um aluno e escrever esses campos direto na RPC api_post.
-- Whitelist = o que o app envia e o legado do banco (conferido em 02/11/2026 em 1103 registros: dia em A-E ou vazio;
-- modalidade vazia ou pedal/esteira/remo/corrida/outro). Nao altera tabela nem dado.
-- ROLLBACK: recriar f_checar_limites_aluno com a definicao anterior (supabase/migrations/..._forja_valida_dia_modalidade.sql, bloco comentado)
-- e dropar f_valores_item.

create or replace function public.f_valores_item(r jsonb)
 returns boolean
 language sql
 immutable
 set search_path to 'public', 'pg_temp'
as $function$
  select upper(trim(coalesce(r->>'dia', ''))) in ('', 'A', 'B', 'C', 'D', 'E')
     and lower(trim(coalesce(r->>'modalidade', ''))) in ('', 'pedal', 'esteira', 'remo', 'corrida', 'outro')
$function$;

-- funcao interna: nao pode virar endpoint RPC (mesmo tratamento de f_limites_item)
revoke all on function public.f_valores_item(jsonb) from public, anon, authenticated;

create or replace function public.f_checar_limites_aluno(p jsonb)
 returns text
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  act text := p->>'action';
  v_aluno text := trim(coalesce(p->>'aluno_id', ''));
  v_goog boolean;
  v_lim int;
  v_corte text := to_char((now() - interval '24 hours') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_novos int := 0;
  v_ja int := 0;
  r jsonb;
begin
  if octet_length(p::text) > 65536 then return 'limite: pedido grande demais'; end if;

  if act in ('registro', 'registroBatch') then
    if act = 'registro' then
      if not f_limites_item(p) then return 'limite: texto grande demais'; end if;
      if not f_valores_item(p) then return 'limite: dia ou modalidade invalido'; end if;
      v_novos := 1;
    else
      if jsonb_typeof(coalesce(p->'registros', '[]'::jsonb)) <> 'array' then return 'limite: formato invalido'; end if;
      v_novos := jsonb_array_length(coalesce(p->'registros', '[]'::jsonb));
      if v_novos > 40 then return 'limite: lote grande demais'; end if;
      for r in select * from jsonb_array_elements(coalesce(p->'registros', '[]'::jsonb)) loop
        if not f_limites_item(r) then return 'limite: texto grande demais'; end if;
        if not f_valores_item(r) then return 'limite: dia ou modalidade invalido'; end if;
      end loop;
    end if;
    select exists (select 1 from alunos where trim(id) = v_aluno and google_sub is not null) into v_goog;
    v_lim := case when v_goog then 80 else 300 end;
    select count(*) into v_ja from registro where trim(aluno_id) = v_aluno and "timestamp" >= v_corte;
    if v_ja + v_novos > v_lim then return 'limite: registros demais nas ultimas 24 h'; end if;

  elsif act = 'removerRegistrosAlunoBatch' then
    if jsonb_typeof(coalesce(p->'timestamps', '[]'::jsonb)) = 'array' and jsonb_array_length(coalesce(p->'timestamps', '[]'::jsonb)) > 100 then
      return 'limite: lote grande demais';
    end if;

  elsif act in ('salvarPeso', 'salvarPerimetros') then
    if exists (select 1 from jsonb_each_text(p) e where length(e.value) > 200) then return 'limite: texto grande demais'; end if;
    if act = 'salvarPeso' then
      select count(*) into v_ja from peso where trim(aluno_id) = v_aluno and "timestamp" >= v_corte;
    else
      select count(*) into v_ja from perimetros where trim(aluno_id) = v_aluno and "timestamp" >= v_corte;
    end if;
    if v_ja >= 30 then return 'limite: medidas demais nas ultimas 24 h'; end if;
  end if;

  return null;
end $function$;

-- ===========================================================================================================
-- ROLLBACK (tudo comentado; descomente e rode para desfazer). Devolve f_checar_limites_aluno a definicao da migration
-- 20261023034156 (a mesma de cima SEM as duas linhas f_valores_item) e remove f_valores_item. Ordem: primeiro a funcao
-- que chama, depois a chamada.
--
-- create or replace function public.f_checar_limites_aluno(p jsonb)
-- returns text
-- language plpgsql
-- stable
-- security definer
-- set search_path to 'public', 'pg_temp'
-- as $function$
-- declare
--   act text := p->>'action';
--   v_aluno text := trim(coalesce(p->>'aluno_id', ''));
--   v_goog boolean;
--   v_lim int;
--   v_corte text := to_char((now() - interval '24 hours') at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
--   v_novos int := 0;
--   v_ja int := 0;
--   r jsonb;
-- begin
--   if octet_length(p::text) > 65536 then return 'limite: pedido grande demais'; end if;
--
--   if act in ('registro', 'registroBatch') then
--     if act = 'registro' then
--       if not f_limites_item(p) then return 'limite: texto grande demais'; end if;
--       v_novos := 1;
--     else
--       if jsonb_typeof(coalesce(p->'registros', '[]'::jsonb)) <> 'array' then return 'limite: formato invalido'; end if;
--       v_novos := jsonb_array_length(coalesce(p->'registros', '[]'::jsonb));
--       if v_novos > 40 then return 'limite: lote grande demais'; end if;
--       for r in select * from jsonb_array_elements(coalesce(p->'registros', '[]'::jsonb)) loop
--         if not f_limites_item(r) then return 'limite: texto grande demais'; end if;
--       end loop;
--     end if;
--     select exists (select 1 from alunos where trim(id) = v_aluno and google_sub is not null) into v_goog;
--     v_lim := case when v_goog then 80 else 300 end;
--     select count(*) into v_ja from registro where trim(aluno_id) = v_aluno and "timestamp" >= v_corte;
--     if v_ja + v_novos > v_lim then return 'limite: registros demais nas ultimas 24 h'; end if;
--
--   elsif act = 'removerRegistrosAlunoBatch' then
--     if jsonb_typeof(coalesce(p->'timestamps', '[]'::jsonb)) = 'array' and jsonb_array_length(coalesce(p->'timestamps', '[]'::jsonb)) > 100 then
--       return 'limite: lote grande demais';
--     end if;
--
--   elsif act in ('salvarPeso', 'salvarPerimetros') then
--     if exists (select 1 from jsonb_each_text(p) e where length(e.value) > 200) then return 'limite: texto grande demais'; end if;
--     if act = 'salvarPeso' then
--       select count(*) into v_ja from peso where trim(aluno_id) = v_aluno and "timestamp" >= v_corte;
--     else
--       select count(*) into v_ja from perimetros where trim(aluno_id) = v_aluno and "timestamp" >= v_corte;
--     end if;
--     if v_ja >= 30 then return 'limite: medidas demais nas ultimas 24 h'; end if;
--   end if;
--
--   return null;
-- end $function$;
--
-- drop function public.f_valores_item(jsonb);

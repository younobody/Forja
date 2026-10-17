-- v29.8.0: o feed motivacional (streak/treinos7d/campeao do mes) passa a contar
-- SO forca. Registros de cardio (modalidade <> '') nao entram — cardio e "a
-- parte" da forca (mesma logica do frontend: ehCardio). Unica mudanca: o
-- coalesce(modalidade,'')='' na subquery de datas.
create or replace function public.f_feed_motivacional()
 returns jsonb
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
declare
  hoje date := f_today_sp()::date;
  ontem date := f_today_sp()::date - 1;
  mp_last date := date_trunc('month', f_today_sp()::date)::date - 1;
  mp_first date := date_trunc('month', date_trunc('month', f_today_sp()::date)::date - 1)::date;
  a record;
  datas date[];
  mais_recente date;
  streak int; d7 int; mes_passado int;
  cur date;
  stats jsonb := '[]'::jsonb;
  maior_mes int := 0;
  s jsonb;
  saida jsonb := '[]'::jsonb;
begin
  for a in
    select trim(id) as id, trim(coalesce(nome,'')) as nome
    from alunos where f_aluno_visivel(visivel_publico) order by seq
  loop
    select coalesce(array_agg(distinct d order by d desc), '{}') into datas
    from (
      select coalesce(nullif(f_data_treino_iso(data_treino),''), nullif(f_data_treino_iso("timestamp"),''))::date as d
      from registro where trim(aluno_id) = a.id and coalesce(modalidade,'') = ''
    ) t where d is not null;

    mais_recente := case when array_length(datas,1) > 0 then datas[1] else null end;

    streak := 0;
    if mais_recente is not null and (mais_recente = hoje or mais_recente = ontem) then
      cur := mais_recente;
      while cur = any(datas) loop
        streak := streak + 1;
        cur := cur - 1;
      end loop;
    end if;

    select count(*)::int into d7 from unnest(datas) d where d between hoje - 6 and hoje;
    select count(*)::int into mes_passado from unnest(datas) d where d between mp_first and mp_last;

    stats := stats || jsonb_build_array(jsonb_build_object(
      'nome', a.nome,
      'ultimoTreino', coalesce(to_char(mais_recente, 'YYYY-MM-DD'), ''),
      'streak', streak,
      'treinos7d', d7,
      'treinosMesPassado', mes_passado,
      'treinouOntemOuHoje', (mais_recente is not null and (mais_recente = hoje or mais_recente = ontem))
    ));

    if mes_passado > maior_mes then maior_mes := mes_passado; end if;
  end loop;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'nome', e->>'nome',
      'ultimoTreino', e->>'ultimoTreino',
      'streak', (e->>'streak')::int,
      'treinos7d', (e->>'treinos7d')::int,
      'treinosMesPassado', (e->>'treinosMesPassado')::int,
      'campeaoMes', (maior_mes > 0 and (e->>'treinosMesPassado')::int = maior_mes)
    )
    order by
      (maior_mes > 0 and (e->>'treinosMesPassado')::int = maior_mes) desc,
      (e->>'streak')::int desc,
      (e->>'treinos7d')::int desc,
      e->>'ultimoTreino' desc
  ), '[]'::jsonb) into saida
  from jsonb_array_elements(stats) e
  where (e->>'treinouOntemOuHoje')::boolean
     or (e->>'streak')::int >= 2
     or (e->>'treinos7d')::int >= 3
     or (maior_mes > 0 and (e->>'treinosMesPassado')::int = maior_mes);

  return jsonb_build_object('feed', saida);
end $function$;

-- v29.7.0: f_exercicios_json passa a expor os campos ricos (musculos,
-- equipamento, instrucoes, imagem/video, wger_id). Mudanca ADITIVA no shape:
-- nome_atual e aliases continuam identicos — frontends antigos ignoram o
-- resto. getAluno e getAdmin usam esta funcao, entao ambos herdam.
create or replace function public.f_exercicios_json()
 returns jsonb
 language sql
 stable
 set search_path to 'public', 'pg_temp'
as $function$
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'nome_atual', nome_atual, 'aliases', aliases,
      'musculos_primarios', musculos_primarios,
      'musculos_secundarios', musculos_secundarios,
      'equipamento', equipamento, 'instrucoes', instrucoes,
      'imagem_url', imagem_url, 'video_url', video_url,
      'wger_id', wger_id
    )
    order by nome_atual
  ), '[]'::jsonb)
  from exercicios
  where trim(coalesce(nome_atual,'')) <> ''
$function$;

-- v30.34.0 (17/11/2026): EDITAR um registro ja feito (aluno edita os proprios; trainer edita de qualquer aluno).
--
-- Campos editaveis (lista fechada): exercicio, carga, reps, rir, obs, data_treino, dia, completou.
-- NUNCA mudam: pk, aluno_id, timestamp, local_id, modalidade.
-- Regras:
--  * a linha e achada por pk E aluno_id (o aluno so alcanca as proprias linhas; no admin o
--    aluno_id tambem e obrigatorio, pra um pk errado nao editar a linha de outra pessoa);
--  * mesmos limites de tamanho (f_limites_item) e whitelist de dia/modalidade (f_valores_item) do INSERT;
--  * exercicio passa por f_canonizar_exercicio, como no INSERT; nao pode ficar vazio;
--  * data_treino precisa ser data valida (f_data_treino_iso); vazio = mantem;
--  * registro de cardio (modalidade preenchida) mantem dia vazio;
--  * devolve a linha atualizada, pro app trocar no cache local.

create or replace function public.f_editar_registro_core(body jsonb)
 returns jsonb
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_pk    bigint := nullif(trim(coalesce(body->>'pk','')), '')::bigint;
  v_aluno text   := trim(coalesce(body->>'aluno_id',''));
  r       registro%rowtype;
  v_ex    text;
  v_data  text;
  v_dia   text;
  v_item  jsonb;
begin
  if v_pk is null or v_aluno = '' then
    return jsonb_build_object('error', 'pk e aluno_id obrigatorios');
  end if;
  select * into r from registro where pk = v_pk and trim(aluno_id) = v_aluno for update;
  if not found then
    return jsonb_build_object('error', 'registro nao encontrado');
  end if;

  v_ex := case when body ? 'exercicio' then trim(coalesce(body->>'exercicio','')) else r.exercicio end;
  if v_ex = '' then return jsonb_build_object('error', 'exercicio nao pode ficar vazio'); end if;
  v_ex := f_canonizar_exercicio(v_ex);

  v_data := r.data_treino;
  if body ? 'data_treino' and trim(coalesce(body->>'data_treino','')) <> '' then
    v_data := f_data_treino_iso(body->>'data_treino');
    if v_data = '' then return jsonb_build_object('error', 'data invalida'); end if;
  end if;

  v_dia := case when body ? 'dia' then upper(trim(coalesce(body->>'dia',''))) else r.dia end;
  if trim(coalesce(r.modalidade,'')) <> '' then v_dia := ''; end if;

  v_item := jsonb_build_object(
    'exercicio', v_ex,
    'carga', case when body ? 'carga' then coalesce(body->>'carga','') else r.carga end,
    'reps',  case when body ? 'reps'  then coalesce(body->>'reps','')  else r.reps  end,
    'rir',   case when body ? 'rir'   then coalesce(body->>'rir','')   else r.rir   end,
    'obs',   case when body ? 'obs'   then coalesce(body->>'obs','')   else r.obs   end,
    'dia', v_dia, 'modalidade', coalesce(r.modalidade,''));
  if not f_limites_item(v_item) then return jsonb_build_object('error', 'limite: texto grande demais'); end if;
  if not f_valores_item(v_item) then return jsonb_build_object('error', 'limite: dia ou modalidade invalido'); end if;

  update registro set
    exercicio   = v_item->>'exercicio',
    carga       = v_item->>'carga',
    reps        = v_item->>'reps',
    rir         = v_item->>'rir',
    obs         = v_item->>'obs',
    dia         = v_dia,
    data_treino = v_data,
    completou   = case when body ? 'completou'
                       then (case when f_truthy(body->'completou') then 'sim' else 'nao' end)
                       else completou end
  where pk = v_pk
  returning * into r;

  return jsonb_build_object('ok', true, 'registro', to_jsonb(r));
end $function$;

revoke all on function public.f_editar_registro_core(jsonb) from public, anon, authenticated;

-- api_post: mesma funcao de antes + 'editarRegistroAluno' (bloco do aluno, com PIN) e
-- 'editarRegistro' (bloco do trainer, com chave).
create or replace function public.api_post(payload jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
declare
  action text := payload->>'action';
  v_limite text;
begin
  if action in ('registro','registroBatch','removerRegistroAluno','removerRegistrosAlunoBatch','salvarPeso','salvarPerimetros','editarRegistroAluno') then
    if not f_validar_aluno(payload->>'aluno_id', payload->>'pin') then
      perform pg_sleep(0.3);
      return jsonb_build_object('error', 'aluno/pin invalido');
    end if;
    v_limite := f_checar_limites_aluno(payload);
    if v_limite is not null then return jsonb_build_object('error', v_limite); end if;
    if action = 'registro' then return f_registro(payload); end if;
    if action = 'registroBatch' then return f_registro_batch(payload); end if;
    if action = 'removerRegistroAluno' then return f_remover_registro_aluno(payload); end if;
    if action = 'removerRegistrosAlunoBatch' then return f_remover_registros_aluno_batch(payload); end if;
    if action = 'salvarPeso' then return f_salvar_peso(payload); end if;
    if action = 'salvarPerimetros' then return f_salvar_perimetros(payload); end if;
    if action = 'editarRegistroAluno' then return f_editar_registro_core(payload); end if;
  end if;

  if not f_check_admin_key(payload->>'key') then
    perform pg_sleep(0.3);
    return jsonb_build_object('error', 'unauthorized');
  end if;

  if action = 'registroAdmin' then return f_registro_admin(payload); end if;
  if action = 'salvarPlano' then return f_salvar_plano(payload); end if;
  if action = 'salvarAluno' then return f_salvar_aluno(payload); end if;
  if action = 'importAluno' then return f_import_aluno(payload); end if;
  if action = 'removerAluno' then return f_remover_aluno(payload); end if;
  if action = 'removerRegistro' then return f_remover_registro(payload); end if;
  if action = 'removerRegistrosBatch' then return f_remover_registros_batch(payload); end if;
  if action = 'editarRegistro' then return f_editar_registro_core(payload); end if;

  return jsonb_build_object('error', 'unknown action: ' || coalesce(action, 'undefined'));
exception when others then
  return jsonb_build_object('error', SQLERRM);
end $function$;

-- Rollback: recriar api_post sem as duas acoes (ver 20261023034156_forja_limites_api_post.sql)
-- e drop function public.f_editar_registro_core(jsonb).

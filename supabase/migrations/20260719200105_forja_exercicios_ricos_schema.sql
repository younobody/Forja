-- v29.7.0: banco de exercicios rico (inspirado no wger, github.com/wger-project)
-- Colunas novas na tabela exercicios. Tudo TEXT/opcional: linha antiga (so
-- nome_atual+aliases) continua 100% valida. musculos_* usam os 9 grupos do
-- mapa muscular do frontend (peito, ombro, triceps, costas, biceps, core,
-- quadriceps, posterior, panturrilha), separados por ";".
-- imagem_url aponta pro wger.de (CC-BY-SA); video_url fica pronta pro futuro
-- (videos das maquinas da academia — decisao do usuario: midia SEMPRE por
-- link externo, nunca no Storage).
alter table exercicios
  add column if not exists musculos_primarios text not null default '',
  add column if not exists musculos_secundarios text not null default '',
  add column if not exists equipamento text not null default '',
  add column if not exists instrucoes text not null default '',
  add column if not exists imagem_url text not null default '',
  add column if not exists video_url text not null default '',
  add column if not exists wger_id int;

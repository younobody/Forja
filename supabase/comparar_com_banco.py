#!/usr/bin/env python3
"""Confere se supabase/migrations/*.sql == o SQL realmente aplicado no banco (ver supabase/migrations/README.md).

1) Rode no banco (SQL Editor, psql ou execute_sql do MCP) e salve o resultado como JSON puro (lista de objetos):

   select version, name,
          md5(lower(regexp_replace(regexp_replace(regexp_replace(array_to_string(statements, E'\\n'),
              'update public\\.alunos set google_email = [^;]*;', '', 'g'), '--[^\\n]*', '', 'g'), '\\s+', '', 'g'))) as md5_norm
   from supabase_migrations.schema_migrations order by version;

2) python3 supabase/comparar_com_banco.py resultado.json

O hash e do texto SEM comentarios e SEM espacos, em minusculas, entao diferencas so de comentario/formatacao nao contam. O UPDATE do e-mail do
trainer (migration forja_login_google) e removido dos dois lados porque o e-mail foi omitido no arquivo do repositorio.
Sai com 0 se tudo que e comparavel bate, 1 se alguma migration difere ou falta arquivo.
"""
import glob
import hashlib
import json
import os
import re
import sys

PASTA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'migrations')
# migrations do banco que de proposito NAO tem arquivo aqui (outro app que divide o projeto Supabase)
OUTRO_APP = {'create_schema_imoveis', 'create_views_imoveis'}


def norm(sql):
    sql = re.sub(r'update public\.alunos set google_email = [^;]*;', '', sql)
    sql = re.sub(r'--[^\n]*', '', sql)
    sql = re.sub(r'\s+', '', sql)
    return hashlib.md5(sql.lower().encode('utf8')).hexdigest()


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    banco = json.load(open(sys.argv[1], encoding='utf8'))
    ruim = 0
    for m in banco:
        nome = m['name']
        if nome in OUTRO_APP:
            print('ignorada (outro app)  ', m['version'], nome)
            continue
        achados = glob.glob(os.path.join(PASTA, '*_%s.sql' % nome)) + glob.glob(os.path.join(PASTA, '*_%s.SNAPSHOT.sql' % nome))
        if not achados:
            print('FALTA ARQUIVO         ', m['version'], nome)
            ruim += 1
            continue
        arq = achados[0]
        base = os.path.basename(arq)
        if '.SNAPSHOT.' in base:
            print('snapshot (nao comparavel)', m['version'], base)
            continue
        igual = norm(open(arq, encoding='utf8').read()) == m['md5_norm']
        print(('OK                    ' if igual else 'DIFERE                ') + m['version'], base)
        ruim += 0 if igual else 1
    sys.exit(1 if ruim else 0)


if __name__ == '__main__':
    main()

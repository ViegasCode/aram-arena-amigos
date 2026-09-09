# ARAM Arena — MVP

Aplicação responsiva em português para campeonato privado de ARAM entre amigos. Implementação funcional com React/TypeScript, Vinext, Worker e banco relacional Cloudflare D1. O banco de produção começa vazio; não há ranking fictício nem armazenamento de resultados em localStorage.

## Incluído

- Cadastro, edição e ativação de jogadores por Riot ID; ícone de iniciais ou emoji.
- Perfis compartilháveis, ranking, estatísticas, histórico e painel da partida atual.
- Sorteio criptograficamente aleatório de dez participantes ativos, dois times de cinco, animação, novo sorteio e confirmação.
- Registro manual de estatísticas, nota 0–10, vitória +1 e bônus configurável, inclusive para derrotados.
- Resultados e composição persistidos, regras congeladas em cada partida, estatísticas e componentes da nota preservados.
- Ajustes de pontuação com motivo e auditoria. Resultados únicos por jogador/partida e operações transacionais.
- Leitura pública na aplicação; alterações exigem identidade validada pelo Sites e e-mail autorizado no backend.

## Rodar e configurar

Requisitos: Node 22.13+ e npm. Instale com `npm ci`. Copie `.env.example` para `.env` e `.dev.vars`, usando `ADMIN_EMAILS=seedy@sites.test` exclusivamente no desenvolvimento local. O login local usa a conta de teste fornecida pelo plugin Sites; em produção, configure os e-mails reais pelo ambiente do Sites. O valor vazio não autoriza ninguém. Não exponha o Worker diretamente sem o dispatcher que autentica e limpa os cabeçalhos de identidade.

Gere migrações com `npm run db:generate`. Para preparar o banco local existente: `npx wrangler d1 execute site-creator-d1 --local --config .wrangler-local.json --file drizzle/0000_jazzy_jane_foster.sql`. Execute `npm run dev`. Migrações de produção são aplicadas pelo Sites antes da publicação. Não repita uma migração manualmente sobre banco já preparado.

`npm run build` gera o Worker e assets em `dist`. O deploy é gerenciado pelo Sites com `.openai/hosting.json`.

## Verificações

- `node tests/scoring.mjs`: limites das notas, estatísticas zeradas, equivalência entre contribuição defensiva e ofensiva, sorteio sem perda/duplicação.
- `node tests/integration.mjs`: use um banco local descartável e servidor na porta 3000. Cria dez jogadores QA e uma partida, verifica autenticação, CSRF, transições, bônus e envio duplicado. Não executar contra produção. O teste mantém os registros QA no banco local.
- `npx tsc --noEmit`: verificação de tipos.

## Pontuação inicial

Versão `aram-v1`: participação 30%, sobrevivência 20%, contribuição 35%, economia/objetivos 15%. Contribuição considera o melhor eixo entre dano, mitigação e utilidade (cura, escudos, controle), com participação secundária dos demais eixos. Métricas são relativas ao time e a sobrevivência usa duração. O algoritmo é uma heurística inicial não calibrada por campeão; não é nota oficial Riot nem garantia de neutralidade entre classes. Os pesos estão isolados em `lib/scoring.ts` para evolução. Os dados brutos e regras históricas permitem desenvolver recálculo posterior sem perder a origem.

Bônus inicial: nota >= 7, +1 ponto. O administrador altera a nota mínima e o bônus na interface. Alterações não recalculam o passado. Desempate atual: vitórias, nota média e nome. Ajustes manuais somam ao total, sem modificar as estatísticas das partidas.

## Etapa seguinte / limites deliberados

A API Riot, resolução de PUUID, detecção e associação de Match ID ainda NÃO foram implementadas. Todos os resultados deste MVP são explicitamente manuais. Nenhum código interage com o cliente do jogo. Variáveis RIOT_API_KEY, RIOT_REGION e RIOT_PLATFORM estão reservadas exclusivamente para o backend futuro. A próxima etapa exige verificar oficialmente a disponibilidade de partidas personalizadas no Match-V5 antes de prometer detecção; correspondência deve validar participantes, times, modo e janela temporal, rejeitar ambiguidades e nunca pontuar apenas porque um ID foi digitado.

O banco é D1/SQLite, não PostgreSQL. Não há migração PostgreSQL implementada. O MVP gerencia um campeonato; múltiplas temporadas, administração de permissões por interface, upload de fotos, correção de resultados finalizados e recálculo em lote ficam para evolução. A troca do algoritmo exige versionamento explícito. Consultas públicas hoje carregam o histórico inteiro: paginar antes de uso em grande escala.

A capacidade WebMCP `read_championship` está registrada quando suportada; não houve contexto de navegador compatível disponível para validar o contrato. Não foi realizada inspeção visual automatizada de navegador.

A aplicação de leitura pode ser publicada publicamente; a política externa do Sites pode inicialmente restringir o link ao proprietário. Autenticação do administrador é via ChatGPT, não Riot.

## Revisão de dependências

Após as atualizações, `npm audit --omit=dev` retornou zero vulnerabilidades conhecidas. A auditoria completa ainda reporta oito avisos em ferramentas de desenvolvimento; não trate isso como certificação de segurança. O servidor de desenvolvimento deve permanecer restrito ao ambiente local. Os pacotes foram fixados no arquivo de lock e as versões de React, Vinext, Vite e ferramentas Cloudflare foram atualizadas para correções disponíveis.

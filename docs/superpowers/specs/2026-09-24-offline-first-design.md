# Offline-first: fila de operações e autenticação

Data: 2026-09-24
Repos: `planting-geotracker-app` (principal), `planting-geotracker-api` (ajustes)

## Objetivo

O app é usado em campo com sinal fraco ou nenhum, por até alguns dias. O
usuário precisa criar, editar, excluir e ver plantas sem internet. Tudo sobe
sozinho quando o sinal volta, sem perder e sem duplicar dados. A sessão não
pode cair durante esse período.

Fora do escopo: mapa offline (tiles). O `react-native-maps` com Google não
baixa regiões; offline os marcadores aparecem sobre o fundo em cache ou em
branco. Mapa offline real seria MapLibre + tiles baixados, outro projeto.

## Estado atual (resumo)

- Cache do React Query persistido em AsyncStorage (7 dias).
- Só a criação offline funciona (`offline_plants_v2`, flag `sync`).
- Editar planta já sincronizada offline: a edição é perdida.
- Excluir planta já sincronizada offline: falha.
- Com sinal fraco, POST pode chegar ao servidor com a resposta perdida. O
  retry cria duplicata.
- Axios sem timeout: com sinal fraco o submit trava e não cai para offline.
- Após 7 dias sem sinal o cache de tipos de planta expira.

## Arquitetura: outbox de operações

Toda escrita de planta passa por uma fila local (outbox), com ou sem
internet. O submit grava na fila e dispara o sync. Existe um único caminho
de escrita; a lógica duplicada online/offline do `add-plants-screen` sai.

### Unidades

1. `src/lib/plants/outbox-core.ts` — funções puras, sem imports de React
   Native:
   - Tipos `OutboxOp` (create | update | delete).
   - `compact(ops, newOp)`: aplica a regra de compactação.
   - `applyOutbox(serverPlants, ops)`: devolve a lista para a tela.
   - `rewriteLocalId(ops, localId, serverId)`: troca id local pelo id do
     servidor nas ops restantes.
   - `migrateLegacy(legacyPlants, userId)`: converte `offline_plants_v2`.
2. `src/lib/plants/outbox.ts` — persistência em AsyncStorage (chave
   `plant_outbox_v1`) com mutex (cadeia de promises) em todo
   ler-modificar-gravar. Expõe `enqueue`, `readOutbox`, `takeNext`,
   `complete`, `fail`, `retry`, `discard`.
3. `src/context/offline-context.tsx` — motor de sync e estado reativo
   (ops, contagens, `isConnected`, `isSyncing`, `syncNow`). Substitui o
   conteúdo atual.
4. `usePlantsView()` (no mesmo contexto) — `useFindAllPlants` +
   `applyOutbox`. Substitui os três `plantsMerge` (`index.tsx`,
   `plants.tsx`, `use-map-plants`).

### Modelo da op

```ts
type OutboxOp = {
  opId: string;            // id único da op
  kind: "create" | "update" | "delete";
  plantId: string;         // create: id local ("local_<ts>_<rand>"); demais: id do servidor ou local
  payload?: PlantData;     // create/update: formulário completo
  userId: string;          // dono da op
  createdAt: string;
  attempts: number;
  status: "pending" | "inFlight" | "failed";
  lastError?: string;
};
```

### Regras de compactação (`compact`)

O formulário sempre envia o objeto completo, então update substitui o
payload inteiro.

| Nova op | Op pendente para o mesmo `plantId` | Resultado |
|---|---|---|
| create | — | adiciona |
| update | create pendente | payload do create é substituído |
| update | update pendente | payload do update é substituído |
| update | nenhuma | adiciona |
| delete | create pendente | remove o create; nenhuma op nova; apaga foto local |
| delete | update pendente | remove o update; adiciona delete |
| delete | nenhuma | adiciona |

Ops com `status: "inFlight"` nunca são alteradas pela compactação. A nova op
entra no fim da fila. Assim uma edição feita durante o envio não se perde.

### Leitura (`applyOutbox`)

Parte da lista do servidor (cache persistido) e aplica as ops em ordem:

- create: adiciona item com `offline: true`.
- update: sobrescreve campos do item, marca `offline: true`.
- delete: remove o item da lista.
- Op `failed`: item mantém `offline: true` e ganha `syncError`.

O campo `offline` já existe nas telas e mantém o nome para reduzir o diff.

### Motor de sync (`syncNow`)

Processa a fila em ordem (FIFO), uma op por vez. Só envia ops com
`userId` igual ao usuário atual e `status: "pending"`.

1. `takeNext` marca a op como `inFlight` (sob mutex).
2. Envia:
   - create: sobe a foto local (se `file://`), depois POST com
     `offlinePreviousId = plantId` local.
   - update: sobe a foto local (se houver), depois PUT.
   - delete: DELETE.
3. Resultado:
   - Sucesso: `complete` remove a op. Para create, `rewriteLocalId` troca o
     id local pelo id do servidor nas ops restantes. A foto local é apagada.
   - Delete com 404: sucesso.
   - Update com 404 (planta excluída por outro usuário): `failed`, com
     mensagem.
   - Erro de rede ou timeout: volta para `pending`, `attempts++`, e o loop
     para (sem sinal).
   - Outro 4xx ou 5xx: `failed` com `lastError`, e o loop segue para a
     próxima op.
   - 401 depois de refresh falho: a sessão é limpa e o loop para. As ops
     ficam guardadas.
4. No fim: invalida `getFindAllPlantsQueryKey()`.

Gatilhos: reconexão (NetInfo), app volta ao foreground (AppState), após
`enqueue`, botão manual. Proteção contra execução concorrente com ref.

Na inicialização, ops `inFlight` (app morto no meio do envio) voltam para
`pending`. O create é idempotente, então o reenvio é seguro.

### Falhas na UI

`plants.tsx` mostra um aviso "N plantas com erro de sincronização". Cada
item com `syncError` mostra a mensagem e duas ações: "Tentar de novo"
(`retry` volta a op para `pending`) e "Descartar" (`discard` remove a op e
apaga a foto local).

### Mudanças nas telas

- `add-plants-screen.tsx`:
  - Carrega o formulário a partir de `usePlantsView()` pelo id. Funciona
    offline para qualquer planta. Sai o `useFindPlantsById`.
  - O submit faz `enqueue` (create ou update), dispara `syncNow()` sem
    esperar e volta. Offline mostra o aviso "salvo, sincroniza depois".
  - Excluir faz `enqueue(delete)`.
  - Saem `isEditingOffline`, o listener NetInfo local e
    `saveOfflinePlant`/`syncData`. O estado de conexão vem do contexto.
- `plants.tsx`: exclusão em lote faz `enqueue(delete)` por id.
- `index.tsx`, `plants.tsx`, `plants-map`: usam `usePlantsView()`.

Trade-off aceito: com internet, um erro do servidor no submit não aparece
na hora. Ele aparece na lista como falha de sincronização.

### Migração

Na primeira carga, se `offline_plants_v2` existir, `migrateLegacy`
converte cada planta com `sync: true` em op create (mantém o id `temp_...`
como `plantId`) e apaga a chave antiga.

## Autenticação

### Como funciona hoje

- App: está logado se existe `accessToken` no SecureStore. Offline não
  desloga. Erro de rede não limpa tokens. Isso está certo e continua.
- Backend: o `authenticationMiddleware` lê o token só de **cookies**
  (`request.cookies.accessToken`). O header `Authorization: Bearer` que o
  app envia é ignorado. Hoje funciona porque o cookie jar nativo guarda o
  `Set-Cookie` do login.
- O middleware já renova a sessão sozinho: access expirado (JWT 1h, cookie
  24h) + refresh válido (30d) gera cookies novos. Cada uso online renova os
  30 dias.
- Conclusão: alguns dias offline não derrubam a sessão. Mais de 30 dias sem
  nenhuma conexão exige login de novo.

### Problemas

1. **Segurança (crítico):** `refreshTokenService` usa `app.jwt.decode` no
   `refreshToken` do body, sem verificar a assinatura. A rota exige uma
   sessão válida por cookie, mas o `userId` vem do body. Um usuário logado
   pode forjar um token com o `userId` de outro usuário e receber tokens
   dessa conta.
2. A sessão depende do cookie jar nativo. O cookie jar persiste em
   Android/iOS, mas pode ser perdido (limpeza de dados do WebView, reinstalação
   parcial). Os tokens do SecureStore, que são a fonte de verdade do app, não
   são usados pelo backend.
3. A rota `/authentication/refresh` exige o `authenticationMiddleware`
   (sessão por cookie válida). O `@fastify/jwt` lança erros do `fast-jwt`, não
   `TokenExpiredError` do `jsonwebtoken`, então um access expirado com cookie
   ainda presente vira 401 direto. O app tenta o refresh, a rota de refresh
   também dá 401 e o app desloga. Isso acontece cerca de 1h depois de um
   refresh (JWT 1h, cookie 24h).
4. O logout não limpa o cache do React Query. O próximo usuário no mesmo
   aparelho vê as plantas do anterior até o refetch.

### Mudanças

Backend:
- `refreshTokenService`: trocar `decode` por `verify`.
- Rota `/authentication/refresh`: sem `authenticationMiddleware`. A
  autenticação é o próprio refresh token do body, verificado.
- `authenticationMiddleware`: aceitar `Authorization: Bearer <token>` e usar
  cookie como fallback. Se o access do header estiver expirado, retorna 401
  e o app faz refresh pelo body (fluxo que já existe no interceptor).

App:
- `api.ts`: `timeout: 15000` no `AXIOS_INSTANCE` e no POST de refresh. O
  interceptor rejeita o próprio erro do axios (com `response.status`) em vez
  de `new Error(message)`, para o sync saber o status.
- Ops levam `userId`, lido do payload do `accessToken` no SecureStore
  (campo `userId`, só decode local). Isso não depende do cache, que o logout
  limpa. Após o login só
  sobem as ops do mesmo usuário. Um logout forçado por refresh expirado
  mantém as ops; ao logar de novo com a mesma conta, elas sobem.
- Logout com ops pendentes do usuário: modal avisa "N plantas ainda não
  sincronizadas. Elas continuam salvas neste aparelho e sobem quando você
  entrar de novo com esta conta." Confirmar faz o logout.
- Logout chama `queryClient.clear()`. O outbox fica separado e não é
  apagado.

## Cache

`gcTime` e `persistOptions.maxAge` sobem de 7 para 30 dias. Assim tipos de
planta, usuário e lista sobrevivem ao período offline.

## Backend: idempotência e 404

- `PlantsModel.create`: se `offlinePreviousId` vier, faz `upsert` por esse
  campo. Um reenvio (resposta perdida) atualiza a planta com o payload mais
  recente em vez de duplicar ou ignorar edições feitas depois.
- Update ou delete de planta inexistente (P2025) retornam 404. Hoje o erro
  genérico do Prisma retorna 409.

## Testes

- `src/lib/plants/outbox-core.check.ts`: self-check com `assert` para
  `compact` (todas as linhas da tabela), `applyOutbox`, `rewriteLocalId`,
  `migrateLegacy` e o caso de op `inFlight`. Roda com `npx tsx`.
- Backend (vitest): `PlantsModel.create` com `offlinePreviousId` usa
  `upsert`; sem ele usa `create`.
- Backend manual: refresh com token forjado retorna 401; request com
  `Authorization: Bearer` válido e sem cookie retorna 200.
- Manual em aparelho (modo avião):
  1. Criar, editar e excluir planta nova offline, depois reconectar.
  2. Editar e excluir planta já sincronizada offline, depois reconectar.
  3. Matar o app com ops pendentes, abrir offline, conferir a lista.
  4. Sinal fraco (throttle): o submit não trava e não cria duplicata.
  5. Logout com pendências: aviso aparece, relogar sobe as ops.

# 🏗️ Arquitetura, Convenções de Código e Guia de Extensão

Como o código é organizado, as convenções que todo módulo segue, e um passo a passo para criar um novo módulo do zero seguindo o mesmo padrão. É o arquivo para quem vai *escrever* o back-end, não só consumi-lo. Complementa o [MODELO_DADOS.md](./MODELO_DADOS.md) (dados), [REGRAS_NEGOCIO.md](./REGRAS_NEGOCIO.md) (regras) e [AUTENTICACAO_PERMISSOES.md](./AUTENTICACAO_PERMISSOES.md) (guards).

## 📌 Índice

- [Estrutura de pastas](#-estrutura-de-pastas)
- [Anatomia de um módulo](#-anatomia-de-um-módulo)
- [O que vive em `src/common/`](#-o-que-vive-em-srccommon)
- [Convenções de código](#-convenções-de-código)
- [Padrões de erro e exceções](#-padrões-de-erro-e-exceções)
- [Passo a passo: criando um novo módulo CRUD](#-passo-a-passo-criando-um-novo-módulo-crud)
- [O front-end como fonte de verdade do contrato](#-o-front-end-como-fonte-de-verdade-do-contrato)
- [Checklist final antes de considerar um módulo pronto](#-checklist-final-antes-de-considerar-um-módulo-pronto)

---

## 📂 Estrutura de pastas

```
src/
  app.module.ts          # registra TODOS os módulos de feature (import manual, sem auto-discovery)
  app.controller.ts       # /health e /config
  main.ts                 # bootstrap: helmet, cors, pino, ValidationPipe, filtro de exceção
  config/                 # validação de env vars + configuração do logger
  common/                 # guards, decorators, filtros e utils compartilhados entre módulos
  prisma/                 # PrismaModule + PrismaService (client injetável)
  email/                  # EmailModule + EmailService (nodemailer)
  <cada-domínio>/          # um módulo por entidade/domínio de negócio
    <dominio>.module.ts
    <dominio>.controller.ts
    <dominio>.service.ts
    dto/
      criar-<dominio>.dto.ts
      atualizar-<dominio>.dto.ts   # geralmente PartialType do DTO de criação
      ...outros DTOs de ação específica (ex.: decidir-ferias.dto.ts)
    <dominio>.pdf.ts               # só nos módulos que geram PDF (folha, contrato, espelho, tickets)
```

Não existe pasta `controllers/`, `services/` ou `routes/` genérica — cada domínio é **auto-contido** na própria pasta (padrão "feature module" do NestJS), e o roteamento vem só da anotação `@Controller('prefixo')` de cada controller.

---

## 🧩 Anatomia de um módulo

Exemplo mínimo real (`src/vagas/`):

```ts
// vagas.module.ts
@Module({
  controllers: [VagasController],
  providers: [VagasService],
  exports: [VagasService] // exportado quando outro módulo precisa injetar este service
})
export class VagasModule {}
```

- **Controller**: só lida com HTTP — recebe o DTO já validado, aplica guards, chama o service, devolve o resultado. Não contém regra de negócio.
- **Service**: toda regra de negócio, toda chamada ao Prisma, toda exceção de domínio (`ConflictException`, `BadRequestException`, etc.).
- **DTO** (`class-validator`): a única porta de entrada de dado externo — o `ValidationPipe` global rejeita (`400`) qualquer campo não declarado no DTO (`forbidNonWhitelisted: true`).
- **Módulo** (`@Module`): fiação do NestJS — registra controller/provider e exporta o service se outro módulo precisar dele (ex.: `AuditoriaModule` é importado por praticamente todo módulo de RH para registrar log).
- **Nenhum módulo importa `PrismaModule` explicitamente nos exemplos vistos** porque `PrismaModule` é `@Global()` — uma vez registrado em `app.module.ts`, `PrismaService` fica disponível para injeção em qualquer service do projeto sem import adicional.
- **Registro central**: todo módulo novo precisa ser adicionado manualmente ao array `imports` de `src/app.module.ts` — não há auto-discovery de módulos por pasta.

---

## 🧰 O que vive em `src/common/`

| Arquivo | Papel |
|---|---|
| `guards/jwt-auth.guard.ts` | Valida o JWT, popula `request.usuario` |
| `guards/admin.guard.ts` | Exige `role === 'admin'` |
| `guards/roles.guard.ts` + `decorators/roles.decorator.ts` | `@Roles('admin','rh')` — allowlist de papéis, opt-in |
| `guards/profile-complete.guard.ts` | Bloqueia contas Google sem CPF ainda cadastrado |
| `guards/auth-throttler.guard.ts` / `guards/eventos-throttler.guard.ts` | Rate limiting específico de `/auth/*` e `/analytics/eventos` |
| `decorators/current-user.decorator.ts` | `@CurrentUser()` — extrai `request.usuario` no parâmetro do controller |
| `filters/http-exception.filter.ts` | Normaliza toda resposta de erro para `{ erro: string }` |
| `validation-exception-factory.ts` | Customiza a mensagem de erro do `ValidationPipe` (só a primeira falha, recursando em `children`) |
| `cpf-valido.decorator.ts` | `@IsCpfValido()` |
| `placa-valida.decorator.ts` | `@IsPlacaValida()` |
| `senha-forte.decorator.ts` | `@IsSenhaForte()` |
| `dias-escala-validos.decorator.ts` | `@IsDiasEscalaValidos()` |
| `utils/papel.util.ts` | `ehGestaoDeRh(role)` — única fonte de verdade de "quem administra RH" |
| `utils/mascarar-cpf.util.ts` | Mascara CPF para quem não é admin |
| `utils/prisma-erro.util.ts` | Detecta erro de unicidade (P2002) e de violação de FK (P2003 + códigos do driver adapter) vindos do Prisma |

Regra de ouro: **qualquer validação ou verificação de acesso usada por mais de um módulo vive aqui** — nunca duplicada módulo a módulo.

---

## 🎨 Convenções de código

- **Lint**: ESLint com `neostandard` (variante do StandardJS para TypeScript) — sem ponto e vírgula, aspas simples, 2 espaços. Rodar `npm run lint:fix` antes de commitar.
- **Nomenclatura em português**: entidades, campos, métodos de service e mensagens de erro são todos em português (`criar`, `listar`, `buscarPorId`, `remover`, `ConflictException('Já existe...')`). Não misturar inglês/português dentro do mesmo domínio.
- **DTOs de atualização** são, na maioria dos módulos, `PartialType(CriarXDto)` de `@nestjs/mapped-types` — evita redeclarar todo campo como opcional manualmente.
- **Ordem dos decorators de validação importa**: com `experimentalDecorators`, decorators de uma propriedade rodam de baixo para cima. Um validador de formato customizado (ex.: `@IsCpfValido()`) deve vir **acima** de `@IsString()/@IsNotEmpty()` no código-fonte, para que um campo vazio falhe primeiro com "obrigatório" em vez de "formato inválido" (ver comentário em `criar-mensalista.dto.ts`).
- **Transações Prisma** (`prisma.$transaction`) são usadas sempre que uma operação precisa alterar mais de uma tabela de forma atômica (ex.: abrir ticket muda `Ticket` + `Vaga` juntos; mover item de PDI troca a `ordem` de dois registros).
- **Snapshots imutáveis**: sempre que um documento "trava" um estado (contrato, holerite, espelho de ponto), os dados são **copiados** para o novo registro no momento da geração — nunca ficam como referência viva ao dado de origem (`PerfilRH`). Isso é intencional e deve ser preservado em qualquer novo documento desse tipo.
- **Sem controllers "gordos"**: qualquer lógica além de "validar guard → chamar service → retornar" deve ir para o service, mesmo que pareça pequena (ex.: a checagem de papel para `GET /mensalidades` sem `mensalistaId` está no controller apenas porque é uma decisão sobre *qual guard aplicar*, não uma regra de negócio em si — é a exceção que confirma a regra).

---

## ⚠️ Padrões de erro e exceções

| Situação | Exceção NestJS | Status HTTP |
|---|---|---|
| Token ausente/inválido | `UnauthorizedException` | 401 |
| Sem permissão para o papel/recurso | `ForbiddenException` | 403 |
| Registro não encontrado | `NotFoundException` | 404 |
| Regra de negócio violada, mas o recurso existe e está bem formado (ex.: campo obrigatório condicional faltando) | `BadRequestException` | 400 |
| Conflito de estado (duplicidade, transição de status inválida, FK bloqueando exclusão) | `ConflictException` | 409 |
| Dependência externa não configurada (SMTP, Google) | `ServiceUnavailableException` | 503 |
| Erro de validação de DTO | gerado automaticamente pelo `ValidationPipe` | 400 |

Toda exceção lançada nos services chega ao cliente já normalizada pelo `HttpExceptionFilter` global como `{ erro: 'mensagem em português, terminando em ponto final' }`. Nunca lançar `Error` genérico numa regra de negócio — sempre uma das exceções do `@nestjs/common` acima, para que o filtro saiba mapear o status certo.

---

## 🛠️ Passo a passo: criando um novo módulo CRUD

Sequência recomendada para adicionar uma entidade nova ao sistema, seguindo exatamente o padrão já usado:

1. **Modelar no `prisma/schema.prisma`**: novo `model`, com `id String @id @default(cuid())`, `@@map("nome_tabela")`, e comentário de bloco explicando o *porquê* de qualquer campo não-óbvio (padrão já usado em todo o schema atual).
2. **Gerar a migration**: `npx prisma migrate dev --name <nome_descritivo>`.
3. **Criar a pasta do módulo** em `src/<dominio>/` com os quatro arquivos de sempre: `<dominio>.module.ts`, `<dominio>.controller.ts`, `<dominio>.service.ts`, `dto/`.
4. **DTOs primeiro**: `criar-<dominio>.dto.ts` com todos os campos e seus decorators de `class-validator`; `atualizar-<dominio>.dto.ts` como `PartialType(Criar...Dto)` a menos que a regra de negócio exija campos condicionalmente obrigatórios na edição (nesse caso, usar `@ValidateIf` como em `AtualizarMensalidadeDto.motivoCancelamento`).
5. **Service**: métodos `criar`, `listar`, `buscarPorId`, `atualizar`, `remover` (o que fizer sentido para a entidade — nem toda entidade tem os cinco). Qualquer unicidade que o banco já garante (`@unique`) deve ser capturada com `ehConflitoUnico()` (de `src/common/utils/prisma-erro.util.ts`) e relançada como `ConflictException` com mensagem amigável. Qualquer FK que deva bloquear exclusão deve ser capturada com `ehViolacaoRestricaoFk()` do mesmo util.
6. **Controller**: decidir os guards certos consultando o [AUTENTICACAO_PERMISSOES.md](./AUTENTICACAO_PERMISSOES.md) — a maioria começa com `@UseGuards(JwtAuthGuard, ProfileCompleteGuard)`; adicionar `RolesGuard` + `@Roles(...)` só se a rota precisa restringir por papel (o padrão do projeto é **não** restringir, a menos que exista uma razão de negócio documentada).
7. **Módulo**: registrar `controllers`/`providers`, e `exports` do service **se** outro módulo for precisar chamá-lo diretamente (ex.: geração de contrato chamando o service de auditoria).
8. **Registrar em `src/app.module.ts`**: adicionar o import e incluir no array `imports`.
9. **Auditoria** (só se a entidade for sensível/RH): chamar `AuditoriaService.registrar()` explicitamente em toda operação de escrita relevante — nunca via interceptor global, para manter o controle explícito de o quê e quando é auditado.
10. **Atualizar os documentos de referência**: adicionar a nova entidade ao [MODELO_DADOS.md](./MODELO_DADOS.md), as rotas ao [MAPEAMENTO_ROTAS.md](./MAPEAMENTO_ROTAS.md), as regras ao [REGRAS_NEGOCIO.md](./REGRAS_NEGOCIO.md) e, se houver restrição de papel, à matriz do [AUTENTICACAO_PERMISSOES.md](./AUTENTICACAO_PERMISSOES.md). Manter esses arquivos como a fonte de verdade evita que a documentação fique desatualizada como aconteceu com o README original (ver divergências listadas no REGRAS_NEGOCIO.md).
11. **Testes**: pelo menos um `*.spec.ts` para o service (mockando `PrismaService`), seguindo o padrão dos specs já existentes em `src/common/guards/*.spec.ts`.

---

## 🖥️ O front-end como fonte de verdade do contrato

O front-end (`views/*.html` + `assets/js/`) já existe e consome esta API — ele **não** será reescrito junto com o back-end. Isso significa que:

- O arquivo `assets/js/models/api.js` é o cliente HTTP único do front e mostra exatamente quais campos são enviados/esperados em cada chamada — é a validação final de que um endpoint recriado bate com o contrato real, mais confiável que qualquer tabela deste conjunto de documentos caso surja alguma divergência pontual.
- Ao recriar um endpoint, rodar o front-end apontando para o novo back-end e exercitar a tela correspondente é o teste de aceitação mais direto — os quatro documentos (`MAPEAMENTO_ROTAS.md`, `REGRAS_NEGOCIO.md`, `AUTENTICACAO_PERMISSOES.md`, `MODELO_DADOS.md`) foram escritos a partir do código-fonte original e devem bater, mas em caso de dúvida o código do front e o comportamento observado têm precedência sobre a prosa.
- Nomes de campo em português, formatos de data (`YYYY-MM`, `YYYY-MM-DD`) e a forma de erro `{ erro: string }` são convenções que o front já espera — mudar qualquer uma delas exige also alterar o front, o que está fora do escopo de "recriar o back-end com o mesmo contrato".

---

## ✅ Checklist final antes de considerar um módulo pronto

- [ ] Model no `schema.prisma` com `@@map`, tipos corretos (`Decimal` para dinheiro, `@db.Date` para datas sem hora) e `onDelete` explícito onde a exclusão não deve travar.
- [ ] Migration gerada e aplicada.
- [ ] DTOs cobrindo 100% dos campos aceitos, com `whitelist` em mente (nenhum campo extra "passa" sem decorator).
- [ ] Guards corretos aplicados (ver matriz de permissões).
- [ ] Toda unicidade e toda FK sensível tratada com mensagem de erro amigável, não deixada estourar como erro 500 do Prisma.
- [ ] Nenhuma regra de negócio vazou para o controller.
- [ ] Se o módulo é de RH: chamadas de auditoria nos pontos certos, e visibilidade restrita via `ehGestaoDeRh` ou dono do recurso.
- [ ] Documentação atualizada nos quatro arquivos de referência.
- [ ] Pelo menos um teste automatizado do service.
- [ ] Testado manualmente contra o front-end existente (não só via Postman/curl).

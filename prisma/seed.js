/**
 * Script de seed: importa os dados de prisma/db.json para as tabelas criadas
 * pelo Prisma no PostgreSQL.
 *
 * Uso: node prisma/seed.js
 *
 * Idempotente: usa upsert por id, então pode ser rodado mais de uma vez sem
 * duplicar registros.
 */

const path = require('node:path')
const fs = require('node:fs')
require('dotenv/config')
const bcrypt = require('bcryptjs')
const { PrismaPg } = require('@prisma/adapter-pg')
const { PrismaClient } = require('../generated/prisma')

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

function paraData (valor) {
  return valor ? new Date(valor) : null
}

async function main () {
  const dbPath = path.join(__dirname, 'db.json')
  const dados = JSON.parse(fs.readFileSync(dbPath, 'utf-8'))

  for (const v of dados.vagas || []) {
    await prisma.vaga.upsert({
      where: { id: v.id },
      update: {},
      create: {
        id: v.id,
        codigo: v.codigo,
        tipo: v.tipo,
        status: v.status,
        acessivel: Boolean(v.acessivel)
      }
    })
  }
  console.log(`Vagas importadas: ${dados.vagas?.length || 0}`)

  for (const t of dados.tarifas || []) {
    await prisma.tarifa.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id,
        categoria: t.categoria,
        valorHora: t.valorHora
      }
    })
  }
  console.log(`Tarifas importadas: ${dados.tarifas?.length || 0}`)

  for (const m of dados.mensalistas || []) {
    await prisma.mensalista.upsert({
      where: { id: m.id },
      update: {},
      create: {
        id: m.id,
        nome: m.nome,
        cpf: m.cpf,
        placa: m.placa,
        telefone: m.telefone || null,
        valorMensalidade: m.valorMensalidade || 0,
        categoriaPlano: m.categoriaPlano || 'Mensal Integral',
        ativo: m.ativo !== undefined ? Boolean(m.ativo) : true
      }
    })
  }
  console.log(`Mensalistas importados: ${dados.mensalistas?.length || 0}`)

  for (const u of dados.usuarios || []) {
    // db.json guarda a senha em texto puro (limitação conhecida do
    // json-server) — aqui já convertemos para hash antes de gravar no
    // Postgres, já que o backend novo faz login com bcrypt.compare.
    const senhaHash = u.senha ? await bcrypt.hash(u.senha, 12) : null

    await prisma.usuario.upsert({
      where: { id: u.id },
      update: { senha: senhaHash },
      create: {
        id: u.id,
        nome: u.nome,
        cpf: u.cpf || null,
        email: u.email,
        senha: senhaHash,
        telefone: u.telefone || null,
        endereco: u.endereco || null,
        dataNascimento: paraData(u.dataNascimento),
        avatar: u.avatar || null,
        role: ['admin', 'rh', 'gestor'].includes(u.role) ? u.role : 'funcionario',
        ativo: u.ativo !== undefined ? Boolean(u.ativo) : true,
        aceitouTermos: Boolean(u.aceitouTermos),
        provedor: u.provedor === 'google' ? 'google' : 'local',
        senhaTemporaria: Boolean(u.senhaTemporaria),
        senhaAlteradaEm: paraData(u.senhaAlteradaEm),
        criadoEm: paraData(u.criadoEm) || new Date()
      }
    })
  }
  console.log(`Usuários importados: ${dados.usuarios?.length || 0}`)

  for (const t of dados.tickets || []) {
    await prisma.ticket.upsert({
      where: { id: t.id },
      update: {},
      create: {
        id: t.id,
        placa: t.placa,
        status: t.status === 'aberto' ? 'aberto' : 'fechado',
        dataEntrada: paraData(t.dataEntrada || t.horaEntrada) || new Date(),
        dataSaida: paraData(t.dataSaida || t.horaSaida),
        valorTotal: t.valorTotal ?? t.valorCobrado ?? null,
        formaPagamento: t.formaPagamento || null,
        vagaId: t.vagaId,
        tarifaId: t.tarifaId || null,
        mensalistaId: t.mensalistaId || null
      }
    })
  }
  console.log(`Tickets importados: ${dados.tickets?.length || 0}`)

  await seedDemoRh()
}

/**
 * Dados de demonstração do módulo de RH — fora do db.json (que não tem
 * seção de RH) porque foram pedidos diretamente: um funcionário "Operador
 * de Sistema" completo (perfil de RH com escala/salário/dados bancários
 * simulados) e um usuário de RH, prontos pra testar o fluxo fim a fim
 * (ponto, férias, assinatura, folha de pagamento) sem precisar cadastrar
 * nada manualmente primeiro.
 */
async function seedDemoRh () {
  const senhaDemo = await bcrypt.hash('Demo@123', 12)

  const funcionarioDemo = await prisma.usuario.upsert({
    where: { email: 'operador.sistema@parkgestao.com.br' },
    update: {},
    create: {
      nome: 'Operador de Sistema Demo',
      cpf: '123.456.789-00',
      email: 'operador.sistema@parkgestao.com.br',
      senha: senhaDemo,
      telefone: '(11) 90000-0001',
      role: 'funcionario',
      ativo: true,
      aceitouTermos: true,
      provedor: 'local',
      senhaTemporaria: false,
      senhaAlteradaEm: new Date()
    }
  })

  const rhDemo = await prisma.usuario.upsert({
    where: { email: 'rh@parkgestao.com.br' },
    update: {},
    create: {
      nome: 'RH Demo',
      cpf: '987.654.321-00',
      email: 'rh@parkgestao.com.br',
      senha: senhaDemo,
      telefone: '(11) 90000-0002',
      role: 'rh',
      ativo: true,
      aceitouTermos: true,
      provedor: 'local',
      senhaTemporaria: false,
      senhaAlteradaEm: new Date()
    }
  })

  const gestorDemo = await prisma.usuario.upsert({
    where: { email: 'gestor@parkgestao.com.br' },
    update: {},
    create: {
      nome: 'Gestor Demo',
      cpf: '111.222.333-00',
      email: 'gestor@parkgestao.com.br',
      senha: senhaDemo,
      telefone: '(11) 90000-0003',
      role: 'gestor',
      ativo: true,
      aceitouTermos: true,
      provedor: 'local',
      senhaTemporaria: false,
      senhaAlteradaEm: new Date()
    }
  })

  // Admissão aleatória (só pra simular, sem sentido de negócio real) — entre
  // 6 meses e 2 anos atrás, pedido explicitamente como "aleatória".
  const diasAtras = 180 + Math.floor(Math.random() * (730 - 180))
  const dataAdmissao = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000)

  // Trilha de carreira (catálogo global, visível a qualquer funcionário) —
  // 4 degraus fictícios pro cargo de Operador de Sistema, pra demonstrar a
  // seção "Trilha de Carreira" da aba Dados do RH.
  const etapasCarreiraSeed = [
    { ordem: 1, titulo: 'Operador de Sistema Júnior', faixaSalarial: 'R$ 2.000 - R$ 2.500', descricao: 'Executa as rotinas básicas de operação do estacionamento sob supervisão direta.' },
    { ordem: 2, titulo: 'Operador de Sistema Pleno', faixaSalarial: 'R$ 2.500 - R$ 3.200', descricao: 'Já domina todas as rotinas de operação e ajuda a treinar novos operadores.' },
    { ordem: 3, titulo: 'Operador de Sistema Sênior', faixaSalarial: 'R$ 3.200 - R$ 4.000', descricao: 'Referência técnica da equipe, atua também em situações excepcionais e conciliações de caixa.' },
    { ordem: 4, titulo: 'Supervisor de Operações', faixaSalarial: 'R$ 4.000 - R$ 5.500', descricao: 'Coordena a escala da equipe de operadores e responde por metas de atendimento e faturamento.' }
  ]

  const etapasCriadas = []
  for (const etapa of etapasCarreiraSeed) {
    etapasCriadas.push(await prisma.etapaCarreira.upsert({
      where: { ordem: etapa.ordem },
      update: {},
      create: etapa
    }))
  }

  const dadosPerfilFuncionarioDemo = {
    cargo: 'Operador de Sistema',
    salarioBase: 2500,
    tipoContrato: 'clt',
    vagaOrigem: 'Operador de Sistema — Turno Diurno (processo seletivo de 2024)',
    gestorId: gestorDemo.id,
    // Segunda a quinta (1=segunda … 4=quinta), 6h/dia — exatamente como
    // pedido, sem data de demissão (funcionário ativo).
    diasEscala: [1, 2, 3, 4],
    horasPorDia: 6,
    horaInicioEscala: '08:00',
    bancoNome: 'Banco Fictício ParkGestão',
    agencia: '0001',
    contaBancaria: '12345-6',
    direitos: [
      'Vale-Refeição (VR) de no mínimo R$ 45,00 por dia trabalhado.',
      'Vale-Alimentação (VA) de no mínimo R$ 1.000,00 fixo por mês.',
      'Plano de saúde subsidiado em 100% pela empresa, sem desconto em folha.',
      'Plano odontológico sem desconto em folha.',
      'TotalPass sem desconto em folha.',
      'Vale-transporte ou vale-combustível, conforme necessidade de deslocamento.',
      'Bônus por desempenho, com metas saudáveis.',
      'Folga remunerada no dia do aniversário.',
      'Recesso remunerado de uma semana no final do ano, com escala revezada.',
      'Apoio à saúde mental com terapia e psicólogos, em parceria com a empresa.',
      '60 dias de férias por ano, com pelo menos 90 dias de antecedência para solicitar.',
      'Hora extra paga com 100% de adicional em dias fora da escala autorizados pelo RH.'
    ].join('\n'),
    deveres: [
      'Cumprir os dias e horários de escala definidos pelo RH.',
      'Registrar entrada e saída no ponto eletrônico todos os dias trabalhados.',
      'Solicitar autorização prévia do RH antes de trabalhar fora da escala.',
      'Zelar pelos equipamentos e sistemas do estacionamento.',
      'Seguir os protocolos de atendimento e segurança da ParkGestão.'
    ].join('\n'),
    tarefas: [
      'Emitir e conferir tickets de entrada e saída de veículos.',
      'Operar a cancela e orientar clientes nas vagas disponíveis.',
      'Conferir o fechamento de caixa ao final do turno.',
      'Reportar ocorrências e manutenções necessárias ao supervisor.'
    ].join('\n'),
    etapaCarreiraAtualId: etapasCriadas[1].id
  }

  await prisma.perfilRH.upsert({
    where: { usuarioId: funcionarioDemo.id },
    update: dadosPerfilFuncionarioDemo,
    create: { usuarioId: funcionarioDemo.id, dataAdmissao, ...dadosPerfilFuncionarioDemo }
  })

  // PDI (Plano de Desenvolvimento Individual) do funcionário demo — 2 etapas
  // já concluídas e 2 ainda pendentes, pra demonstrar o anel/barra de
  // progresso e a timeline da aba Dados do RH.
  const itensPdiSeed = [
    { ordem: 1, titulo: 'Treinamento de integração', descricao: 'Concluir o treinamento inicial de rotinas de operação e segurança.', status: 'concluido', diasAtrasConclusao: 150 },
    { ordem: 2, titulo: 'Certificação em atendimento ao cliente', descricao: 'Concluir o curso interno de atendimento e resolução de conflitos.', status: 'concluido', diasAtrasConclusao: 60 },
    { ordem: 3, titulo: 'Treinamento de conciliação de caixa', descricao: 'Aprender e executar sozinho o fechamento de caixa do turno.', status: 'pendente' },
    { ordem: 4, titulo: 'Mentoria de novos operadores', descricao: 'Acompanhar a integração de pelo menos um novo operador contratado.', status: 'pendente' }
  ]

  for (const item of itensPdiSeed) {
    await prisma.itemPdi.upsert({
      where: { usuarioId_ordem: { usuarioId: funcionarioDemo.id, ordem: item.ordem } },
      update: {},
      create: {
        usuarioId: funcionarioDemo.id,
        ordem: item.ordem,
        titulo: item.titulo,
        descricao: item.descricao,
        status: item.status,
        concluidoEm: item.status === 'concluido' ? new Date(Date.now() - item.diasAtrasConclusao * 24 * 60 * 60 * 1000) : null,
        criadoPorId: rhDemo.id
      }
    })
  }

  console.log(`Etapas de carreira importadas: ${etapasCriadas.length}`)
  console.log(`Itens de PDI importados: ${itensPdiSeed.length}`)
  console.log('Funcionário de demonstração de RH: operador.sistema@parkgestao.com.br (senha: Demo@123)')
  console.log('Usuário de RH de demonstração: rh@parkgestao.com.br (senha: Demo@123)')
  console.log('Usuário de gestor de demonstração: gestor@parkgestao.com.br (senha: Demo@123)')
}

main()
  .catch(erro => {
    console.error('Erro ao popular o banco:', erro)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

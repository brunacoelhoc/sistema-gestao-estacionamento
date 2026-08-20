/**
 * Script de seed: importa os dados que hoje vivem em db.json (json-server)
 * para as tabelas criadas pelo Prisma no PostgreSQL.
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
  const dbPath = path.join(__dirname, '..', 'db.json')
  const dados = JSON.parse(fs.readFileSync(dbPath, 'utf-8'))

  for (const v of dados.vagas || []) {
    await prisma.vaga.upsert({
      where: { id: v.id },
      update: {},
      create: {
        id: v.id,
        codigo: v.codigo,
        tipo: v.tipo,
        status: v.status
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
        role: u.role === 'admin' ? 'admin' : 'funcionario',
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
}

main()
  .catch(erro => {
    console.error('Erro ao popular o banco:', erro)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

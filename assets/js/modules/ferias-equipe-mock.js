// Dados simulados do calendário de férias da equipe (não vêm do backend).
// Datas são geradas em relação ao ano vigente, então continuam fazendo
// sentido não importa em que ano/dia a página seja aberta.
;(function () {
  const DEPARTAMENTOS = {
    operacoes: { label: 'Operações', cor: '#0d6efd' },
    financeiro: { label: 'Financeiro', cor: '#198754' },
    gestao: { label: 'Gestão', cor: '#6f42c1' },
    admin: { label: 'Admin', cor: '#fd7e14' },
    rh: { label: 'RH', cor: '#d63384' }
  }

  // mes: 1-12 · dia: dia de início · duracaoDias: tamanho do período (dias corridos)
  const EQUIPE = [
    { nome: 'Camila Rodrigues', departamento: 'rh', periodos: [{ mes: 1, dia: 12, duracaoDias: 30 }] },
    { nome: 'Bruno Almeida', departamento: 'operacoes', periodos: [{ mes: 2, dia: 2, duracaoDias: 30 }] },
    { nome: 'Eduardo Nascimento', departamento: 'admin', periodos: [{ mes: 2, dia: 20, duracaoDias: 15 }, { mes: 9, dia: 15, duracaoDias: 15 }] },
    { nome: 'Fernanda Costa', departamento: 'financeiro', periodos: [{ mes: 3, dia: 15, duracaoDias: 30 }, { mes: 10, dia: 1, duracaoDias: 30 }] },
    { nome: 'Rafael Souza', departamento: 'gestao', periodos: [{ mes: 4, dia: 20, duracaoDias: 60 }] },
    { nome: 'Beatriz Santos', departamento: 'admin', periodos: [{ mes: 5, dia: 4, duracaoDias: 20 }] },
    { nome: 'Juliana Martins', departamento: 'rh', periodos: [{ mes: 6, dia: 1, duracaoDias: 30 }, { mes: 12, dia: 1, duracaoDias: 30 }] },
    { nome: 'Thiago Pereira', departamento: 'gestao', periodos: [{ mes: 7, dia: 6, duracaoDias: 30 }] },
    { nome: 'Patrícia Lima', departamento: 'operacoes', periodos: [{ mes: 8, dia: 10, duracaoDias: 30 }] },
    { nome: 'Diego Fernandes', departamento: 'operacoes', periodos: [{ mes: 9, dia: 1, duracaoDias: 30 }] },
    { nome: 'Larissa Oliveira', departamento: 'financeiro', periodos: [{ mes: 10, dia: 12, duracaoDias: 20 }] },
    { nome: 'Marcos Vinícius', departamento: 'gestao', periodos: [{ mes: 11, dia: 9, duracaoDias: 30 }] }
  ]

  window.FeriasEquipeMock = { DEPARTAMENTOS, EQUIPE }
})()

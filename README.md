# 🚗 ParkGestão — Sistema de Gestão de Estacionamento

> Sistema web responsivo para controle de tickets, gestão de mensalistas, vagas, tarifas e métricas de estacionamento, construído focado em **Acessibilidade (WCAG 2.1 AAA)** e **Conformidade com a LGPD**.

---

## 📌 Índice
- [🚗 ParkGestão — Sistema de Gestão de Estacionamento](#-parkgestão--sistema-de-gestão-de-estacionamento)
  - [📌 Índice](#-índice)
  - [📖 Sobre o Projeto](#-sobre-o-projeto)
    - [🎯 Principais Objetivos:](#-principais-objetivos)
  - [🛠️ Arquitetura e Tecnologias](#️-arquitetura-e-tecnologias)
  - [📂 Estrutura do Projeto](#-estrutura-do-projeto)
    - [💡 Por que este formato é um padrão corporativo excelente?](#-por-que-este-formato-é-um-padrão-corporativo-excelente)

---

## 📖 Sobre o Projeto

O **ParkGestão** é uma solução completa para operacionalização e controle financeiro/operacional de estacionamentos. Ele resolve o fluxo de emissão e pagamento de tickets avulsos, bem como a gestão contínua de clientes mensalistas.

### 🎯 Principais Objetivos:
* **Eficiência Operacional:** Controle rápido de entrada, saída e valores de permanência.
* **Inclusão e Acessibilidade:** Interface adaptada para pessoas com deficiência visual, dislexia ou daltonismo.
* **Segurança e Privacidade:** Tratamento de dados pessoais (como CPF e Placa) em conformidade com a Lei Geral de Proteção de Dados (LGPD).

---

## 🛠️ Arquitetura e Tecnologias

O projeto adota uma arquitetura **Front-end Jamstack/Vanilla**, focada em alta performance, sem dependência de *frameworks* pesados no lado do cliente.

* **HTML5 Semântico:** Estruturação acessível com uso adequado de tags ARIA e WCAG.
* **CSS3 & Bootstrap 5.3:** Layout responsivo, utilitários flexbox e componentes visuais.
* **JavaScript (ES6+):** Programação modular e assíncrona (`async/await`, Fetch API).
* **FontAwesome 6:** Iconografia vetorial e acessível.
* **SweetAlert2:** Feedback visual amigável para modais de confirmação e alertas.
* **VLibras Widget:** Tradução automática do conteúdo para Língua Brasileira de Sinais (LIBRAS).

---

## 📂 Estrutura do Projeto

Para manter a organização corporativa e facilitar a manutenção, o projeto é dividido em pastas bem definidas:

```text
ParkGestao/
├── assets/
│   ├── css/
│   │   └── style.css            # Estilos globais e customizações de acessibilidade
│   ├── img/
│   │   └── favicon.svg          # Ícone da aplicação
│   └── js/
│       ├── modules/             # Módulos reutilizáveis em toda a aplicação
│       │   ├── accessibility.js # Motor do painel de acessibilidade
│       │   ├── api.js           # Comunicação centralizada com a API REST
│       │   └── lgpd.js          # Funções de mascaramento e privacidade de dados
│       └── pages/               # Scripts específicos de cada página HTML
│           ├── mensalistas.js   # Regras de negócio e CRUD de Mensalistas
│           ├── tickets.js       # Controle e emissão de tickets
│           └── vagas.js         # Gestão de ocupação e tarifas
├── pages/
│   ├── mensalistas.html         # Tela de gestão de clientes mensalistas
│   ├── metricas.html            # Relatórios e gráficos operacionais
│   ├── sobre.html               # Informações do sistema e privacidade
│   ├── tickets.html             # Painel de operações de tickets
│   └── vagas-tarifas.html       # Configuração de vagas e preços
├── index.html                   # Dashboard principal
└── README.md                    # Documentação do projeto

🚀 Pré-requisitos e Como Rodar
Por ser um projeto de front-end nativo, não é necessário instalar o Node.js ou gerenciadores de pacote para rodar localmente.

👨‍💻 Passo a Passo para Desenvolvimento:
Clonar o Repositório:

Bash
git clone [https://github.com/seu-usuario/parkgestao.git](https://github.com/seu-usuario/parkgestao.git)
Acessar a pasta do projeto:

Bash
cd parkgestao
Executar a aplicação:

Opção 1 (Recomendada): Abra a pasta no VS Code, instale a extensão Live Server e clique em "Go Live".

Opção 2: Abra diretamente o arquivo index.html em qualquer navegador web moderno (Chrome, Edge, Firefox, Safari).

⚙️ Funcionalidades e Validações
👤 Módulo de Mensalistas
Cadastro e Edição: Inclusão de Nome, CPF, Telefone e Placa.

Validações de Entrada:

Nome Completo: Campo obrigatório, impede salvamento em branco.

CPF: Máscara dinâmica (000.000.000-00) + Algoritmo matemático dos dígitos verificadores (DV).

Placa: Padrão antigo (ABC-1234) e Mercosul (ABC1D23).

Duplicidade: Bloqueio de cadastro de CPFs ou Placas já registrados na base de dados.

Sem Exclusão Física: Em conformidade com auditorias operacionais, mensalistas não são deletados, apenas Inativados ou Reativados.

♿ Acessibilidade & LGPD
♿ Recursos WCAG 2.1 AAA
Aumentar/Diminuir Fonte: Ajuste dinâmico da escala de texto sem quebrar o layout.

Modo Alto Contraste: Troca de esquema de cores para facilitar a leitura por pessoas com baixa visão.

Fonte para Dislexia: Alteração da tipografia para fontes otimizadas para leitura facilitada.

Modo Reduzir Animações: Pausa efeitos visuais para usuários com sensibilidade a movimento (vestibular disorders).

Filtros de Daltonismo: Ajustes em SVG/CSS para Protanopia, Deuteranopia e Tritanopia.

Suporte a VLibras: Tradutor automático integrado.

🛡️ Conformidade LGPD
Minimização de Dados: Coleta estritamente dos dados necessários para a operação.

Mascaramento de CPF: Exibição mascarada (***.***.**0-00) nas listagens e tabelas públicas para evitar exposição visual.

📐 Padrões de Código e Commits
Este projeto adota a convenção de Conventional Commits para manter o histórico de alterações limpo e legível.

Padrão de Mensagens do Git:
feat: Uma nova funcionalidade (ex: feat(mensalistas): adiciona validacao no campo nome).

fix: Correção de um bug (ex: fix(tickets): corrige calculo do valor de permanencia).

style: Mudanças de formatação ou CSS sem alterar lógica (ex: style(bar): ajusta espacamento do select).

docs: Alterações na documentação (ex: docs: atualiza guia de instalacao no README).

refactor: Refatoração de código que não altera comportamento final.

👩‍💻 Autora e Contato
Desenvolvido por Bruna Coelho.

Projeto: Sistema Estacionamento ParkGestão

Licença: MIT — Livre para estudos e aprimoramentos.


---

### 💡 Por que este formato é um padrão corporativo excelente?

1. **Badges e Índice Visual:** Permite navegar direto ao ponto sem precisar rolar a página toda.
2. **Explicativo para Iniciantes:** Ensina como clonar, como rodar via *Live Server*, o motivo da arquitetura sem *frameworks* pesados e o significado de cada pasta.
3. **Padrão Profissional para Recrutadores:** Inclui seções sobre **LGPD**, **Acessibilidade WC
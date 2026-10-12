# Claudio Meireles | Portfolio

Portfólio em HTML, CSS e JavaScript, com uma interface de terminal inspirada na experiência visual de [hancore.dev](https://hancore.dev/). O código, as ilustrações e a identidade desta versão foram implementados para Claudio Meireles.

A entrada revela o código por digitação progressiva, com rolagem automática e duas mãos de 21 pontos articulados. Os dedos alcançam as posições das teclas, enquanto as palmas acompanham o movimento; letras maiúsculas também acionam Shift com a outra mão. Um olho formado por glifos acompanha o ponteiro e pisca. Clicar em entrar inicia uma aproximação pela pupila, com um túnel de partículas, antes de abrir o portfólio. Depois de entrar, a navegação combina uma roda circular de projetos com inércia, conteúdo no terminal, uma árvore de ramificações e uma malha animada no painel de apresentação. No celular, a roda vira uma faixa horizontal e as seções usam a rolagem normal da página.

## Executar

Não há etapa de build nem dependências de produção. Abra `index.html` ou sirva o diretório:

```bash
git clone https://github.com/ClaudioAMF1/Portfolio.git
cd Portfolio
python -m http.server 8000
```

Acesse `http://localhost:8000`. O mesmo diretório pode ser publicado em hospedagens estáticas, incluindo GitHub Pages.

## Navegação

Todas as seções são acessíveis pelos cartões. O terminal é uma opção adicional, com comandos locais de navegação; ele não executa comandos do sistema.

| Comando                                    | Resultado                      |
| ------------------------------------------ | ------------------------------ |
| `help`                                     | Lista os comandos              |
| `whoami`                                   | Apresentação e perfil          |
| `ls` ou `projetos`                         | Links para os quatro projetos  |
| `open crypto`                              | Pipeline de criptomoedas       |
| `open soccer`                              | Análise tática de futebol      |
| `open air`                                 | Pipeline de qualidade do ar    |
| `open carreta`                             | Carreta Digital                |
| `stack`                                    | Tecnologias                    |
| `experiencia`                              | Experiência, formação e cursos |
| `contato`                                  | Contatos e formulário          |
| `cv`, `github`, `email`                    | Exibe o link correspondente    |
| `tema noite`, `tema fosforo`, `tema papel` | Seleciona a paleta             |
| `pwd`                                      | Exibe a seção atual            |
| `clear`                                    | Limpa as respostas do terminal |
| `exit`                                     | Volta à entrada                |

Os nomes dos arquivos, como `open crypto-pipeline`, também funcionam. O terminal mantém um histórico da sessão e completa comandos únicos com Tab.

| Atalho                              | Ação                    |
| ----------------------------------- | ----------------------- |
| Enter na tela de entrada            | Abre o portfólio        |
| ↑ / ↓ com foco na roda ou na página | Seleciona uma seção     |
| Home / End na roda                  | Primeira / última seção |
| `/`                                 | Foca o terminal         |
| `T`, fora de campos e controles     | Abre os temas           |
| Esc no portfólio                    | Volta à entrada         |
| Esc no terminal                     | Remove o foco do campo  |

Setas dentro do conteúdo mantêm a rolagem normal. A roda também aceita scroll e arraste com mouse. A captura do ponteiro começa somente após um deslocamento de arraste, mantendo os cliques nos cartões funcionais. Esc durante a animação de entrada cancela a transição. Os links antigos `#hero` e `#projects` continuam apontando para as seções correspondentes.

## Temas e acessibilidade

- **Noite:** carvão, marfim e sálvia.
- **Fósforo:** terminal verde.
- **Papel:** fundo claro e tinta escura.

Tema e preferência de animação são salvos no navegador quando o armazenamento está disponível. `prefers-reduced-motion` desliga as animações por padrão. Os controles de movimento na entrada e na barra de status permitem pausá-las ou ativá-las explicitamente. A animação JavaScript para quando a aba está oculta.

O conteúdo usa HTML semântico, nomes acessíveis, indicadores de foco e anúncios de mudança de seção. Sem JavaScript, os textos, projetos, contatos e currículo continuam disponíveis em uma página contínua.

## Contato

O formulário valida os campos e prepara um link `mailto:` com assunto e mensagem. O visitante abre seu aplicativo de email para revisar e enviar. Não há backend de envio; os dados do formulário não são enviados a serviços externos pelo site e ficam nos campos até o visitante decidir o que fazer.

## Estrutura e edição

- `index.html`: textos, links, seções e ilustrações SVG dos projetos.
- `css/style.css`: layout, temas, foco, responsividade e impressão.
- `js/main.js`: navegação, comandos, preferências e animações.
- `js/visuals.js`: olho, mãos, árvore, malha e rastro do cursor em canvas.
- `assets/profile.jpg`: foto do perfil.
- `assets/Claudio_Meireles_CV.pdf`: currículo.
- `assets/favicon.svg`: ícone do site.

Para adicionar uma seção, inclua um cartão em `.project-wheel` e o artigo correspondente em `.terminal-scroll`, mantendo a mesma ordem nos dois. O `data-panel` do cartão deve corresponder ao `id` do artigo; `data-path` define o caminho mostrado no terminal.

As imagens dos projetos são ilustrações da arquitetura e do funcionamento, identificadas nas legendas. Não representam capturas de execução nem resultados de avaliação.

## Validação desta versão

Foram verificados a sintaxe JavaScript, a estrutura HTML, os links e assets locais e 62 cenários de integração em DOM simulado. Além da navegação, comandos e formulário, os testes cobrem avanço da digitação, rolagem do código, acompanhamento do ponteiro pelo olho, piscadas, inércia e arraste da roda, pausa e ativação explícita de movimento. A regressão dos cliques é verificada com sequências de ponteiro e captura; a entrada cobre início, progresso, conclusão, cancelamento e movimento reduzido. A simulação não substitui a inspeção visual e a interação com mouse em um navegador.

## Licença

[MIT](LICENSE).

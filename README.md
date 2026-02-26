# Claudio Meireles | Portfolio

Portfolio profissional desenvolvido com HTML, CSS e JavaScript puro, sem dependências de frameworks.

## Preview

Site pessoal com design dark premium, animações fluidas e layout totalmente responsivo.

## Tecnologias Utilizadas

- **HTML5** - Estrutura semântica e acessível
- **CSS3** - Design system com variáveis CSS, glassmorphism, gradientes e animações
- **JavaScript (ES6+)** - Interatividade sem dependências externas
- **Google Fonts** - Space Grotesk, Inter, JetBrains Mono
- **Font Awesome 6** - Ícones

## Funcionalidades

- **Cursor personalizado** com efeito de follow suave
- **Partículas animadas** no hero com canvas (conexões dinâmicas entre pontos)
- **Efeito typewriter** alternando entre roles (Software Developer, Backend Engineer, etc.)
- **Animações on-scroll** com IntersectionObserver
- **Contadores animados** nas estatísticas do hero
- **Barras de progresso** nas skills com animação sequencial
- **Efeito tilt 3D** nos cards de projetos e na foto de perfil
- **Parallax** sutil no hero ao rolar a página
- **Menu mobile** com transições suaves
- **Navegação flutuante** com destaque da seção ativa

## Estrutura do Projeto

```
Portfolio/
├── index.html          # Página principal
├── css/
│   └── style.css       # Design system completo
├── js/
│   └── main.js         # Animações e interatividade
├── assets/             # Imagens (foto de perfil, etc.)
├── LICENSE             # MIT License
└── README.md
```

## Seções

| Seção | Descrição |
|-------|-----------|
| **Hero** | Apresentação com partículas, typewriter e estatísticas |
| **Sobre** | Bio, detalhes pessoais e foto de perfil |
| **Projetos** | Cards com projetos destacados e tecnologias |
| **Skills** | Barras de progresso organizadas por categoria |
| **Experiência** | Timeline profissional e certificações |
| **Contato** | Links para email, LinkedIn, GitHub e WhatsApp |

## Como Usar

1. Clone o repositório:
   ```bash
   git clone https://github.com/ClaudioAMF1/Portfolio.git
   ```

2. Abra o `index.html` no navegador ou use um servidor local:
   ```bash
   # Com Python
   python -m http.server 8000

   # Com Node.js
   npx serve .
   ```

3. Para adicionar sua foto de perfil, coloque a imagem em `assets/profile.jpg`.

## Personalização

- **Cores**: Edite as variáveis CSS em `:root` no arquivo `css/style.css`
- **Conteúdo**: Atualize textos e links diretamente no `index.html`
- **Roles do typewriter**: Modifique o array `roles` em `js/main.js`

## Licença

Este projeto está licenciado sob a [MIT License](LICENSE).

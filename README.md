# PDV Pastel & Lanche

PDV web para pastelaria/lanchonete em HTML/CSS/JS puro, preparado para publicar no GitHub Pages.

## Arquivos
- `index.html` — estrutura
- `style.css` — layout responsivo + estilos de impressão
- `app.js` — lógica (cadastros, carrinho, caixa, pedidos, relatórios, senha master)
- `README.md` — este guia

## Como publicar no GitHub Pages
1. Faça backup dos arquivos atuais do repositório.
2. Substitua os quatro arquivos por estes.
3. Commit/push.
4. **Settings → Pages** → branch principal + `/ (root)`.
5. Abra o endereço publicado.

## Senha master
- Senha padrão: **`1234`**
- Altere em **Aparência → Senha master** no primeiro uso.
- Necessária para: **cancelar pedido** e **cancelar item** de um pedido.

## Fluxo de operação
1. **Abrir caixa** (topo) informando o fundo de troco. *Não é possível vender com o caixa fechado.*
2. Registrar pedidos; escolher **forma de pagamento**; clicar **Concluir e imprimir**.
3. O sistema gera uma **senha aleatória de 100 a 999** (não sequencial) impressa em destaque nas 3 vias (cozinha, cliente, cupom completo).
4. **Pedidos** (topo, com badge laranja mostrando pendentes): marcar como **Recebidos** ao entregar/cobrar; cancelar com senha master se necessário.
5. **Fechar caixa** ao encerrar o turno.

### Janela de Pedidos
A janela de Pedidos mostra **apenas os pedidos do caixa aberto**. Se você fechar o caixa e abrir um novo, essa janela começa vazia (apenas novas vendas). Todos os pedidos antigos ficam disponíveis nos Relatórios.

### Fechamento de caixa
**O caixa só fecha quando não houver pedidos pendentes.** Ao abrir o fechamento com pendências, aparece um aviso destacado com a lista de senhas pendentes e um botão **"Ver pedidos pendentes"** que leva direto para a aba Pendentes.

O relatório de fechamento de caixa (impresso e no modal) inclui:
- Valores por forma de pagamento
- Total recebido, contado e diferença
- Produtos vendidos
- **Descontos aplicados** (senha e valor)
- **Cancelamentos** (senha e valor)

## Relatórios (topo → Relatórios)
Todos com **período personalizado** (data inicial e final), acumulativos:

| Aba | Conteúdo |
|---|---|
| **Faturamento** | Total recebido, pedidos, ticket médio, itens, descontos, a receber e cancelados + quebra por forma de pagamento |
| **Produtos vendidos** | Lista agregada por produto (quantidade e faturamento) com % |
| **Vendas por dia** | Pedidos, itens e faturamento em cada dia do período |
| **Financeiro** | Sessões de caixa fechadas (esperado × contado × diferença) + total de cancelados |

Cada relatório tem **📥 CSV** e **🖨 Imprimir** (formato cupom 80 mm).

## Itens do pedido em andamento
- Cada linha tem **nome em 14.5 px**, preço unitário, botões **− / +** maiores e o total da linha em destaque.
- A área do carrinho cresce até **42 vh** para o atendente visualizar mais itens sem rolar.
- Ao passar o mouse, a linha é destacada.
- O contador **"X item(ns)"** fica no topo do painel do pedido.

## Impressão
- **Fonte dos cupons: 16 px** no corpo, 24 px no título, 20 px no total, 14 px nos textos auxiliares.
- **Senha em destaque: 42 px** (não foi alterada, mantendo o destaque).
- O navegador exige confirmação na caixa de impressão (segurança). Para impressão realmente automática, use um PC em modo quiosque com QZ Tray ou similar.

## Migração dos dados existentes
O `localStorage` é migrado automaticamente na primeira execução. Vendas antigas recebem senha aleatória e status "Recebido" para compatibilidade.

## Limitações
- Não é emissor fiscal (não é NFC-e/SAT).
- Dados ficam apenas no navegador/dispositivo — sem nuvem, sem multiusuário, sem sincronização.
- Exporte o CSV com frequência.

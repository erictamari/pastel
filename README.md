# PDV Pastel & Lanche

PDV web para pastelaria/lanchonete em HTML/CSS/JS puro, publicado no GitHub Pages.

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
- **Altere em Aparência → Senha master** no primeiro uso.
- Necessária para: cancelar pedido, cancelar item de um pedido.

## Fluxo de operação
1. **Abrir caixa** (topo) informando o fundo de troco. *Não é possível vender com o caixa fechado.*
2. Registrar pedidos pelo catálogo; escolher forma de pagamento e clicar **Concluir e imprimir**.
3. O sistema gera uma **senha aleatória de 100 a 999** (não sequencial) impressa em destaque nas 3 vias (cozinha, cliente, cupom completo).
4. **Pedidos** (topo): marcar como **Recebidos** ao entregar/cobrar; cancelar com senha master se necessário.
5. **Fechar caixa** ao encerrar o turno — imprime relatório com valores, formas de pagamento, produtos vendidos, diferença de gaveta.

## Relatórios (topo → Relatórios)
Todos com **período personalizado** (data inicial e final):

| Aba | Conteúdo |
|---|---|
| **Faturamento** | Total recebido, pedidos, ticket médio, itens, descontos, a receber e cancelados + quebra por forma de pagamento |
| **Produtos vendidos** | Lista agregada por produto (quantidade e faturamento) com % |
| **Vendas por dia** | Pedidos, itens e faturamento em cada dia do período |
| **Financeiro** | Sessões de caixa fechadas (esperado × contado × diferença) + total de cancelados |

Cada relatório tem **📥 CSV** e **🖨 Imprimir** (formato cupom 80 mm).

## Impressão
- Fonte dos cupons: **14 px** (senha em destaque ~42 px).
- O navegador exige confirmação na caixa de impressão (segurança). Para impressão realmente automática, use um PC em modo quiosque com QZ Tray ou similar.

## Migração dos dados existentes
O `localStorage` é migrado automaticamente na primeira execução da nova versão. As vendas antigas recebem uma senha aleatória e o status "Recebido".

## Limitações
- Não é emissor fiscal (não é NFC-e/SAT).
- Dados ficam apenas no navegador/dispositivo — sem nuvem, sem multiusuário, sem sincronização.
- Exporte o CSV com frequência.

# PDV Pastel & Lanche

PDV web para pastelaria/lanchonete, feito em HTML, CSS e JavaScript puro, preparado para publicar no GitHub Pages.

## Arquivos
- `index.html` — estrutura da aplicação
- `style.css` — layout responsivo e estilos de impressão
- `app.js` — cadastro, carrinho, descontos, vendas, armazenamento local e impressão
- `README.md` — instruções

## Como publicar no GitHub Pages
1. Faça backup dos arquivos atuais do repositório.
2. Substitua os arquivos pelos quatro arquivos desta pasta (ou copie o conteúdo de cada um para o arquivo correspondente).
3. Faça commit/push para o GitHub.
4. No repositório, acesse **Settings → Pages** e selecione a branch principal e a pasta `/ (root)`.
5. Abra o endereço GitHub Pages do projeto.

## Uso inicial
- Há produtos de exemplo para demonstrar o funcionamento. Edite ou exclua esses produtos e grupos em **Cadastros**.
- Os dados são salvos no `localStorage` do navegador/dispositivo. Não existe sincronização entre computadores ou tablets e limpar os dados do navegador pode apagar os cadastros e vendas. Exporte as vendas em CSV regularmente.
- Configure nome, cores e fonte em **Aparência**.
- Ao concluir uma venda, o sistema registra o pedido e chama a impressão das três vias (cozinha, cliente e cupom completo). É possível reimprimir cada via individualmente no modal ou pelo histórico.

## Importante sobre impressão automática
Por segurança, navegadores comuns exigem confirmação na caixa de impressão. GitHub Pages, por si só, não pode imprimir silenciosamente nem escolher uma impressora automaticamente. Para operação realmente sem confirmação, use um computador dedicado em modo quiosque com uma solução local de impressão compatível (por exemplo, QZ Tray configurado localmente) e valide a integração com sua impressora térmica. A impressão do navegador também depende do tamanho de papel configurado no driver.

## Limitações desta versão
- Não é um emissor fiscal: o cupom impresso é um comprovante não fiscal, não NFC-e/SAT.
- Os dados ficam no dispositivo e navegador em uso; não há login, banco de dados na nuvem, sincronização multiusuário ou integração de pagamentos.
- Antes de usar em operação real, teste impressão, preços, descontos e backup em seu equipamento.

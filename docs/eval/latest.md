# Avaliação com Claude real — 2026-11-24T00:57

Motor: agente (D-075) · Bot: claude-haiku-5-5 · Adriano simulado: claude-haiku-5-5 · Avaliador: claude-sonnet-5-5

Conferências objetivas: **95/96**

| Critério | Média (1–5) |
|---|---|
| entendimento | 3.78 |
| naturalidade | 3.43 |
| acessibilidade | 3.65 |
| uma_pergunta_por_vez | 3.91 |
| sem_invencao | 3.30 |
| eficiencia | 3.61 |
| conclusao | 4.52 |

## Problemas por classe

- baixa:tom: 19
- media:jargao: 16
- media:inventou: 14
- media:perdeu_informacao: 9
- media:fluxo_confuso: 8
- baixa:fluxo_confuso: 8
- alta:nao_entendeu: 6
- baixa:pergunta_repetida: 6
- baixa:texto_longo: 6
- media:pergunta_desnecessaria: 5
- media:pergunta_repetida: 4
- baixa:jargao: 4
- baixa:perdeu_informacao: 4
- baixa:pergunta_desnecessaria: 3
- baixa:inventou: 3
- baixa:pergunta_dupla: 3
- media:pergunta_dupla: 2
- media:nao_entendeu: 2
- baixa:promessa: 2
- baixa:nao_entendeu: 2
- media:eficiencia: 1
- alta:dado_incorreto_no_banco: 1
- media:promessa_ou_incoerencia: 1
- alta:perdeu_informacao: 1
- baixa:duas_perguntas: 1
- baixa:pressao: 1
- media:loop: 1
- alta:ignorou_comando: 1
- baixa:uma_pergunta_por_vez: 1
- media:promessa_confusa: 1
- baixa:repeticao: 1
- alta:jargao: 1
- alta:inconsistencia: 1
- alta:inventou: 1
- alta:fluxo_confuso: 1
- baixa:inconsistencia: 1
- alta:pergunta_repetida: 1
- baixa:suposicao: 1
- alta:erro_de_dado: 1
- media:decidiu_dinheiro: 1

## real-adriano-roberto-jo — Conversa real do Adriano: mesinha + 2 móveis do Seu Roberto e da Dona Jo

Notas: entendimento 3 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 4 · sem_invencao 3 · eficiencia 2 · conclusao 3 · 105s

- ✅ 3 peças (mesinha + 2 aparadores)
- ✅ 2 aparadores reconhecidos
- ✅ técnica verniz em todos
- ✅ cliente Seu Roberto/Dona Jo
- ❌ aparadores só no tampo — [{"part":"inteiro"},{"part":"tampo"}]
- ✅ medida/porte de todas as peças
- ✅ orçamento calculado para todos os serviços

> O objetivo de apresentar o valor e obter a concordância foi atingido, mas a conversa teve falhas: o bot travou no turno 8 e fez o Adriano repetir tudo, fez perguntas sobre o que ele já tinha dito (por dentro/por fora, prazo) e o banco ficou com um aparador como 'inteiro', o que pode inflar o valor. A mensagem do valor usa linguagem de alerta ('prejuízo') e não detalha a conta.

- [media] (pergunta_desnecessaria) turno 3: O bot pergunta quais são os outros dois móveis, mas o Adriano só disse que eram 'só o tampo'. Aceitável, porém o bot não captou o contexto de que o assunto era orçamento e ainda pede foto logo no início.
- [media] (pergunta_desnecessaria) turno 6: Ele já tinha dito que era só o tampo, e o bot pergunta se é por fora ou por dentro. É uma pergunta que ele já respondeu; um tampo não tem 'dentro'. Também repete o convite de foto.
- [alta] (nao_entendeu) turno 8: Respondeu 'me perdi aqui, pode falar de novo?' a uma resposta simples e clara ('só por fora, o tampo, pode fechar a conta'). Obrigou o Adriano a repetir tudo, perdendo tempo.
- [media] (eficiencia) turno 9: O Adriano precisou reenviar toda a descrição (peças, medidas, pincel, prazo, material) por causa do erro do bot, o que é frustrante para quem fala por áudio.
- [media] (jargao) turno 11: Fala em 'Total sugerido' e avisa que abaixo de R$ 323,00 fica 'no prejuízo', sem explicar. Tom de cobrança/alerta e conta sem detalhar, e o aparador aparece como 'par' sem o valor de cada. Não mostra o material de R$ 70 nem o prazo.
- [alta] (dado_incorreto_no_banco) turno 11: O banco registra os aparadores com part 'inteiro' em um deles e 'tampo' no outro, contrariando a fala dele (só o tampo nos dois). O preço pode estar inflado, e o bot afirmou 'só o tampo' na mensagem 6 sem refletir isso nos dados.
- [media] (pergunta_repetida) turno 13: Pergunta quando consegue começar e quando fica pronto, sendo que ele já disse 3 a 5 dias e que ia buscar terça (informação já dada nos turnos 1, 4 e 9).
- [media] (promessa_ou_incoerencia) turno 17: O PDF foi enviado no turno 16 antes da confirmação do prazo no turno 17, com mensagens fora de ordem. Diz 'fechei' o valor como se o cliente tivesse aceitado, quando apenas o Adriano concordou com o valor sugerido.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, beleza? Terça eu vou pegar um trabalho do seu Roberto e da Dona Jo. Uma mesinha de centro pra lixar e passar verniz, e mais outros dois móveis que é só o tampo. Queria saber quanto cobrar nisso aí.
2. BOT: 🎧 Ouvi: "E aí, beleza? Terça eu vou pegar um trabalho do seu Roberto e da Dona Jo. Uma mesinha de centro pra lixar e passar verniz, e mais outros dois móveis que é só o tampo. Queria saber quanto cobrar nisso aí."
3. BOT: Opa, anotei a mesinha de centro com verniz pro Seu Roberto e Dona Jo ✅ Quais são os outros dois móveis que são só o tampo? 🪵

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Então são duas aparadoras, só o tampo de cada uma. Lixar e envernizar. Os tampos tão melhores, mas tem que lixar bem. Cada um tem 1,20 por 40. A mesinha é redonda, 80 de diâmetro e 45 de altura, e o tampo tá meio machucado, tem que acertar uns detalhes nele. Vou de pincel, o verniz eu já tenho. Acho que leva uns 3 a 5 dias, e o material deve dar uns 70 reais. Ah, eu que busco e entrego.
5. BOT: 🎧 Ouvi: "Então são duas aparadoras, só o tampo de cada uma. Lixar e envernizar. Os tampos tão melhores, mas tem que lixar bem. Cada um tem 1,20 por 40. A mesinha é redonda, 80 de diâmetro e 45 de altura, e o tampo tá meio machucado, tem que acertar uns detalhes nele. Vou de pincel, o verniz eu já tenho. Acho que leva uns 3 a 5 dias, e o material deve dar uns 70 reais. Ah, eu que busco e entrego."
6. BOT: Anotei tudo ✅ Os dois aparadores são 1,20 x 0,40, só o tampo, lixar e verniz.

Pra fechar a conta dos aparadores: é só por fora, ou tem que pintar/envernizar por dentro também?

📸 Se tiver foto da peça, manda que ajuda!
7. ADRIANO: Só por fora, o tampo. Por dentro não precisa, é só o tampo mesmo. Pode fechar a conta aí.
8. BOT: Opa, me perdi aqui. 😅 Pode me falar de novo?
9. ADRIANO (áudio): Beleza, então é só o tampo dos dois aparadores, por fora, lixar e envernizar. A mesinha redonda de 80 de diâmetro e 45 de altura é lixar inteira e passar verniz, com o tampo meio machucado que precisa acertar uns detalhes. Vou de pincel, verniz eu já tenho, leva uns 3 a 5 dias e o material deve dar uns 70 reais. Eu busco e entrego. Pode fechar a conta com isso aí.
10. BOT: 🎧 Ouvi: "Beleza, então é só o tampo dos dois aparadores, por fora, lixar e envernizar. A mesinha redonda de 80 de diâmetro e 45 de altura é lixar inteira e passar verniz, com o tampo meio machucado que precisa acertar uns detalhes. Vou de pincel, verniz eu já tenho, leva uns 3 a 5 dias e o material deve dar uns 70 reais. Eu busco e entrego. Pode fechar a conta com isso aí."
11. BOT: Fiz a conta dos dois ✅

- Os 2 aparadores: R$ 175,00 (o par)
- Mesa de centro redonda: R$ 223,00

Total sugerido: **R$ 398,00**. Abaixo de R$ 323,00 você fica no prejuízo.

Você concorda com esse valor, ou quer dar um desconto? 🤝
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
12. ADRIANO: [tocou: 👍 Concordo]
13. BOT: Show, valor fechado ✅ Antes de eu mandar o PDF, me diz: quando você consegue começar e quando fica pronto pro cliente? 📅
14. ADRIANO (áudio): Ah, boa! Começo terça mesmo, aí depois de buscar eu lixo e vou envernizando. Acho que fica pronto em uns 3 a 5 dias, depende do verniz secar entre as demãos. Pode colocar assim pra eles.
15. BOT: 🎧 Ouvi: "Ah, boa! Começo terça mesmo, aí depois de buscar eu lixo e vou envernizando. Acho que fica pronto em uns 3 a 5 dias, depende do verniz secar entre as demãos. Pode colocar assim pra eles."
16. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
17. BOT: Anotado: começa terça, depois de buscar, e fica pronto em uns 3 a 5 dias ✅

Fechei a mesa e os dois aparadores em R$ 398,00 e te mandei o PDF aqui no Telegram pra repassar ao cliente. 📄 Quando o Seu Roberto e a Dona Jo responderem, me avisa que eu anoto.
18. ADRIANO: Valeu, tá bom! Só isso mesmo. Obrigado.
19. BOT: Valeu, Adriano! 👋 Bom trabalho aí.
```

</details>

## admin-mesinha-criados — Administrador: mesinha + 2 criados-mudos, medidas todas de uma vez

Notas: entendimento 3 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 4 · sem_invencao 3 · eficiencia 3 · conclusao 3 · 137s

- ✅ 3 peças
- ✅ 2 criados-mudos
- ✅ cliente Dona Carla
- ✅ medidas das 3 peças
- ✅ sem frete (cliente traz e busca)
- ✅ PDF gerado após o desconto

> O objetivo foi atingido: o valor com 10% de desconto saiu (R$ 893,70) e o PDF foi gerado. Mas houve falhas: o material de R$ 70 ficou de fora no primeiro cálculo, o bot repetiu perguntas sobre dados já dados, usou o termo 'mínimo' sem explicar e deu uma resposta vaga quando ele perguntou sobre a base do desconto. Também juntou duas perguntas em uma no turno 21.

- [baixa] (pergunta_repetida) turno 3: Mistura confirmação com pergunta e pedido de foto na mesma mensagem, duas solicitações juntas.
- [media] (perdeu_informacao) turno 9: Já havia sido dito que a mesinha precisava lixar, acertar detalhes e envernizar inteira (tampo danificado), mas o bot pergunta de novo se é só o tampo ou peça inteira, o que ele indicou parcialmente.
- [alta] (perdeu_informacao) turno 12: Calcula o valor sem o material de R$ 70 que ele já tinha dito, e só avisa depois; o desconto de 10% foi tratado como pedido de 'se der' e já aplicado, apesar do tom hesitante. Também usa termos como 'mínimo', que soam como jargão e deixam dúvida sobre quem decide o valor.
- [media] (jargao) turno 12: Fala em 'acima do mínimo de R$ 735,11' sem explicar, e mostra valores quebrados e longos, difícil para o Adriano acompanhar por áudio.
- [media] (inventou) turno 15: O material de R$ 70 aumentou a mesa de 748 para 818, mas o desconto de 10% sobre 993 dá 893,70, ou seja, o desconto incide também sobre o material; não explicou isso de forma clara.
- [alta] (nao_entendeu) turno 18: Diante da dúvida do Adriano sobre onde o desconto incide, responde de forma vaga, não calcula a outra opção e devolve a decisão pedindo que ele diga o valor final, o que é o contrário de ajudar.
- [media] (fluxo_confuso) turno 21: Pergunta quando começa e quando fica pronto, duas perguntas em uma, e pergunta de novo a entrega que ele já tinha dito (deixa e busca).
- [media] (inventou) turno 25: Diz 'Fechei' e 'mandei o PDF' como se a proposta estivesse concluída; confirmação plausível porque o PDF foi enviado, mas a mensagem final está cortada e o prazo de 5 dias contradiz a fala inicial de 3 a 5 dias sem esclarecer.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): e aí, tudo bem? preciso de um orçamento. é uma mesinha de centro com o tampo um pouco danificado, precisa lixar, acertar uns detalhes e invernizar. e mais dois criados-mudos, só o tampo deles, também lixar e invernizar. vai demorar uns 3 a 5 dias e o material dá uns 70 reais. já trnho o pincel e a faca pra raspar.
2. BOT: 🎧 Ouvi: "e aí, tudo bem? preciso de um orçamento. é uma mesinha de centro com o tampo um pouco danificado, precisa lixar, acertar uns detalhes e invernizar. e mais dois criados-mudos, só o tampo deles, também lixar e invernizar. vai demorar uns 3 a 5 dias e o material dá uns 70 reais. já trnho o pincel e a faca pra raspar."
3. BOT: Anotei: mesinha de centro e 2 criados-mudos, só o tampo, com lixar e envernizar, e os 70 reais de material. 🪵

De quem são as peças?

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): A dona Carla, cliente. A mesinha é ela, e os dois criados-mudos também. Ela deixa em casa e busca depois de pronto. A mesinha é redonda, dois metros de largura. Os criados-mudos têm 80 cm de largura e 40 de altura, os dois iguais. Só o tampo deles mesmo.
5. BOT: 🎧 Ouvi: "A dona Carla, cliente. A mesinha é ela, e os dois criados-mudos também. Ela deixa em casa e busca depois de pronto. A mesinha é redonda, dois metros de largura. Os criados-mudos têm 80 cm de largura e 40 de altura, os dois iguais. Só o tampo deles mesmo."
6. BOT: Anotei: Dona Carla, a mesinha redonda de 2 m e os 2 criados-mudos de 80 x 40 cm, só o tampo. Ela deixa e busca.

Os criados-mudos precisam de algum conserto, ou é só lixar e envernizar?
7. ADRIANO (áudio): Só lixar e envernizar mesmo, mas tem uns detalhe que eu acerto ali, tipo uma quina meio lascada. Nada de conserto grande.
8. BOT: 🎧 Ouvi: "Só lixar e envernizar mesmo, mas tem uns detalhe que eu acerto ali, tipo uma quina meio lascada. Nada de conserto grande."
9. BOT: Anotei a quina lascada nos criados-mudos, sem conserto grande. 🪵

A mesinha da Dona Carla é só o tampo ou a peça inteira?
10. ADRIANO (áudio): A mesinha é a peça inteira, a dona Carla quer tudo: tampo e pé. Só os criados-mudos é que é só o tampo. E pode anotar o preço de 10% de desconto também, se der.
11. BOT: 🎧 Ouvi: "A mesinha é a peça inteira, a dona Carla quer tudo: tampo e pé. Só os criados-mudos é que é só o tampo. E pode anotar o preço de 10% de desconto também, se der."
12. BOT: Mesa inteira e criados só tampo, anotado ✅

Sem desconto: R$ 923,00 (mesa R$ 748,00 + os 2 criados-mudos R$ 175,00). Com 10% de desconto: **R$ 830,70**, acima do mínimo de R$ 735,11.

Os R$ 70 de material que você falou pra mesa não entraram na conta, então confere antes de fechar. Fecho com R$ 830,70?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
13. ADRIANO (áudio): Opa, o valor de 830,70 tá certo mas os 70 reais de material não entraram. Pode ver isso aí? A mesa tem que sair com o material incluso, eu acho. Se for pra fechar, o desconto de 10% já tá no valor, então só corrige o material e me fala o total.
14. BOT: 🎧 Ouvi: "Opa, o valor de 830,70 tá certo mas os 70 reais de material não entraram. Pode ver isso aí? A mesa tem que sair com o material incluso, eu acho. Se for pra fechar, o desconto de 10% já tá no valor, então só corrige o material e me fala o total."
15. BOT: Material entrou: a mesa ficou em R$ 818,00. Com os 2 criados-mudos (R$ 175,00), o total é R$ 993,00.

Com 10% de desconto, fica **R$ 893,70**, acima do mínimo de R$ 805,11. Fecho com esse valor?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
16. ADRIANO (áudio): Opa, o desconto de 10% já tá no valor, então era isso. Só que você tá falando que o total com material ficou 893,70 e eu quero ver o valor antes de fechar. Você mantém os 10% sobre o total ou dá pra fazer 10% sobre o orçamento sem o material? Me fala o total que fica bom pra você.
17. BOT: 🎧 Ouvi: "Opa, o desconto de 10% já tá no valor, então era isso. Só que você tá falando que o total com material ficou 893,70 e eu quero ver o valor antes de fechar. Você mantém os 10% sobre o total ou dá pra fazer 10% sobre o orçamento sem o material? Me fala o total que fica bom pra você."
18. BOT: Dá pra fazer das duas formas. Com 10% em tudo, incluindo o material, fica **R$ 893,70**, acima do mínimo.

Se o 10% for só na conta sem material, eu preciso que você me confirme o valor final que quer cobrar. Qual você prefere?
19. ADRIANO (áudio): Fica assim: o 10% já tá no valor, então pode fechar com os 893,70 mesmo. Não precisa mexer no desconto. Pode fechar aí pra mim.
20. BOT: 🎧 Ouvi: "Fica assim: o 10% já tá no valor, então pode fechar com os 893,70 mesmo. Não precisa mexer no desconto. Pode fechar aí pra mim."
21. BOT: Fechando com R$ 893,70 ✅ Antes de mandar o PDF, quando você consegue começar e quando fica pronto pra Dona Carla?
22. ADRIANO (áudio): Ah, a Dona Carla deixa em casa e busca depois de pronto. Eu consigo começar essa semana, uns 5 dias pra ficar tudo pronto, mais ou menos. Se der certo assim pra você, pode mandar o PDF.
23. BOT: 🎧 Ouvi: "Ah, a Dona Carla deixa em casa e busca depois de pronto. Eu consigo começar essa semana, uns 5 dias pra ficar tudo pronto, mais ou menos. Se der certo assim pra você, pode mandar o PDF."
24. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
25. BOT: Anotado: começa essa semana, uns 5 dias pra ficar pronto. Fechei em R$ 893,70 e te mandei o PDF aqui no Telegram 📄

Assim que a Dona Carla responder, me avisa que eu registro.
```

</details>

## admin-comoda-carla — Cômoda da Dona Carla (pátina), gavetão, correção e logística do cliente

Notas: entendimento 4 · naturalidade 4 · acessibilidade 4 · uma_pergunta_por_vez 4 · sem_invencao 4 · eficiencia 5 · conclusao 5 · 56s

- ✅ 1 serviço
- ✅ cômoda
- ✅ pátina
- ✅ 5 gavetas (4 + gavetão)
- ✅ gavetão nas observações
- ✅ estilete nas observações
- ✅ pincel
- ✅ sem frete
- ✅ medidas 1 m × 0,8 m

> Conversa chegou ao valor e ele concordou com poucas trocas, e os dados no banco batem (medidas, 5 gavetas, pincel, estilete, sem frete). Falhas pequenas: chute inicial na medida, mensagens com várias informações, pergunta dupla sobre datas e o 'orçamento fechado' sem a cliente ter aceitado.

- [baixa] (pergunta_desnecessaria) turno 3: Interpretou '80 por 1 metro' como altura 80 e largura 1 m e pediu confirmação; é um chute que gerou uma troca extra. Perguntar qual é a altura sem sugerir seria mais neutro.
- [baixa] (duas_perguntas) turno 3: Fez a confirmação das medidas e pediu foto na mesma mensagem, embora o pedido da foto seja sugestão leve.
- [media] (jargao) turno 12: Usa 'você fica no prejuízo' com valor de piso e botões; é um pouco seco e fala em 'Pelas contas' sem explicar. Também traz várias informações juntas (valor, dias, horas, mínimo, 3 opções).
- [baixa] (fluxo_confuso) turno 14: Perguntou duas coisas ao mesmo tempo (quando começa e quando fica pronta) e a data de pronto não é algo que ele possa saber; ele já havia dito 3 dias de trabalho.
- [media] (inventou) turno 18: Disse 'Orçamento fechado' e 'Quando ela responder, me avisa'; o orçamento ainda não foi aceito pela cliente, então 'fechado' é impreciso. Também o PDF foi enviado antes de confirmar os dados de início. Ignorou que ele disse que combinaria data de trazer e buscar com a cliente e que não sabia o dia certo.
- [baixa] (pressao) turno 18: 'Me avisa' quando ela responder pode soar como cobrança leve, mas é aceitável.
- [baixa] (tom) turno 9: Ofereceu 'pincel, rolo ou pistola' para pátina, mas ele não havia falado de ferramentas; ok. Ignorou o pronome 'Ele' (cliente) corretamente.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): Ô, chegou uma cômoda aqui da dona Carla pra eu fazer a pátina. Ela tem uns 80 por 1 metro, mais ou menos. Tem 4 gavetas e 1 gavetão. Tá boazinha, só precisa por fora, sem conserto nenhum. Dá pra você me ajudar a fazer o orçamento?
2. BOT: 🎧 Ouvi: "Ô, chegou uma cômoda aqui da dona Carla pra eu fazer a pátina. Ela tem uns 80 por 1 metro, mais ou menos. Tem 4 gavetas e 1 gavetão. Tá boazinha, só precisa por fora, sem conserto nenhum. Dá pra você me ajudar a fazer o orçamento?"
3. BOT: Anotei a cômoda da Dona Carla pra pátina, por fora, sem conserto ✅ Você falou 80 por 1 metro: a altura é 80 cm e a largura 1 metro, certo?

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Não, ao contrário: é 1 metro de altura por 80 cm de largura. Pode anotar assim.
5. BOT: 🎧 Ouvi: "Não, ao contrário: é 1 metro de altura por 80 cm de largura. Pode anotar assim."
6. BOT: Anotei: 1 metro de altura por 80 cm de largura ✅ Ainda não consegui gravar as gavetas. São 5 no total (4 + o gavetão), certo? 🪵
7. ADRIANO (áudio): Isso, são 5 no total: 4 gavetas e o gavetão. Ah, e ela também pediu pra gente pensar no preço da pátina só por fora mesmo. Ele vai trazer e buscar quando tiver pronta, eu combino com ela.
8. BOT: 🎧 Ouvi: "Isso, são 5 no total: 4 gavetas e o gavetão. Ah, e ela também pediu pra gente pensar no preço da pátina só por fora mesmo. Ele vai trazer e buscar quando tiver pronta, eu combino com ela."
9. BOT: Anotado: 5 gavetas, só por fora, e a Dona Carla traz e busca a peça 👍 Falta saber como você pinta: pincel, rolo ou pistola? 🛠️
10. ADRIANO (áudio): Pincel, e também uso estilete pra raspar. Vou aplicar com pincel e estilete pra raspar, é o jeito que eu faço essas pátinas.
11. BOT: 🎧 Ouvi: "Pincel, e também uso estilete pra raspar. Vou aplicar com pincel e estilete pra raspar, é o jeito que eu faço essas pátinas."
12. BOT: Pincel e estilete anotados ✅ Pelas contas, a cômoda da Dona Carla fica em **R$ 539,00**, em uns 3 dias de trabalho (umas 9 horas).

Abaixo de R$ 436,14 você fica no prejuízo. Concorda, quer dar um desconto ou acrescentar algo? 💰
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
13. ADRIANO: [tocou: 👍 Concordo]
14. BOT: Beleza, o orçamento tá certinho. Só falta você me dizer quando consegue começar a cômoda e quando ela fica pronta pra Dona Carla 👍
15. ADRIANO (áudio): Ah, então começo daqui uns dias, tipo semana que vem. Ela fica pronta em uns 3 dias de trabalho, mas eu não sei o dia certo ainda, depois eu vejo. Ela combina com a Dona Carla quando pode trazer e buscar, tá?
16. BOT: 🎧 Ouvi: "Ah, então começo daqui uns dias, tipo semana que vem. Ela fica pronta em uns 3 dias de trabalho, mas eu não sei o dia certo ainda, depois eu vejo. Ela combina com a Dona Carla quando pode trazer e buscar, tá?"
17. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
18. BOT: Orçamento fechado em R$ 539,00 ✅ Te mandei o PDF aqui no Telegram pra você repassar à Dona Carla.

Anotei que você começa semana que vem, e fica pronto em uns 3 dias de trabalho. Quando ela responder, me avisa 👍
```

</details>

## abreu-isa-casal — Mesa de cabeceira do Seu Abreu e da Dona Isa (casal), cor e tempo estimado

Notas: entendimento 4 · naturalidade 3 · acessibilidade 4 · uma_pergunta_por_vez 4 · sem_invencao 4 · eficiencia 3 · conclusao 5 · 54s

- ✅ 1 serviço (casal = 1 cliente)
- ✅ cor azul marinho anotada
- ✅ tempo estimado anotado
- ✅ segundo dono não se perdeu
- ✅ porte médio usado

> Chegou ao valor e Adriano concordou, com detalhes da peça, cor e tempo guardados. Falhas: repetiu pergunta de transporte que ele já tinha respondido, fez pergunta dupla de prazo, e as confirmações ficaram um pouco mecânicas e repetitivas. Sem invenção grave.

- [media] (pergunta_desnecessaria) turno 9: Perguntou se a peça vem até ele ou se vai buscar, mas no turno 7 Adriano já tinha dito que não precisa buscar nem entregar e que ele leva de volta. Perguntou o que já foi dito.
- [media] (perdeu_informacao) turno 12: A confirmação do orçamento resume só 'criado-mudo, sem transporte, azul marinho' e não repete o prazo de 3 a 5 dias; o valor aparece com 'uns 3 dias' sem explicar de onde vem, o que destoa da estimativa dele.
- [media] (pergunta_dupla) turno 14: Fez duas perguntas na mesma mensagem (quando começa e quando fica pronto) e ainda avançou para prazo, assunto fora do objetivo do caso (valor e concordar).
- [baixa] (jargao) turno 12: 'Você fica no prejuízo' e 'Sugestão' são aceitáveis, mas o aviso de piso é seco e não explica de onde vem o valor; poderia ser mais simples.
- [baixa] (tom) turno 18: Disse 'Fechado' e 'Te mandei o PDF' logo após a fala dele, mas o PDF só apareceu no turno 17; ok, porém o 'Fechado' soa como se o cliente tivesse aceitado, e a data 'sexta da semana que vem' foi só repetida, sem checar a dúvida segunda ou terça.
- [baixa] (tom) turno 4: Foto prometida por ele 'depois' não foi retomada com naturalidade; o bot não deixou claro que ficaria aguardando, mas também não prometeu nada indevido.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): e ai, blz? quero ver se da pra fazer um orcamento novo. e a mesa de cabeceira do seu Abreu e da dona Isa, vou lixar e pintar de azul marinho. ta boa, so por fora, sem conserto nenhum
2. BOT: 🎧 Ouvi: "e ai, blz? quero ver se da pra fazer um orcamento novo. e a mesa de cabeceira do seu Abreu e da dona Isa, vou lixar e pintar de azul marinho. ta boa, so por fora, sem conserto nenhum"
3. BOT: Anotei: criado-mudo do Seu Abreu e Dona Isa, pintura azul marinho por fora, sem conserto ✅

Qual o tamanho dele, em cm ou pequeno/médio/grande? 📏

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Ah, é médio mais ou menos, não tenho a medida exata não. Ela é tamanho normal de mesa de cabeceira. Foto eu mando depois que eu tirar.
5. BOT: 🎧 Ouvi: "Ah, é médio mais ou menos, não tenho a medida exata não. Ela é tamanho normal de mesa de cabeceira. Foto eu mando depois que eu tirar."
6. BOT: Anotei: tamanho médio, estado bom, só por fora ✅

Pra pintar, você usa pincel, rolo ou pistola?
7. ADRIANO (áudio): Pincel. Pincel mesmo, sem rolo nem pistola. Acho que leva de 3 a 5 dias pra terminar, contando lixar, pintar e secar direitinho. Não precisa buscar nem entregar, eu levo ela de volta na hora que tiver pronta.
8. BOT: 🎧 Ouvi: "Pincel. Pincel mesmo, sem rolo nem pistola. Acho que leva de 3 a 5 dias pra terminar, contando lixar, pintar e secar direitinho. Não precisa buscar nem entregar, eu levo ela de volta na hora que tiver pronta."
9. BOT: Anotei: pincel, e 3 a 5 dias contando lixar, pintar e secar ✅

Só pra confirmar o transporte: a peça vem até você, ou você vai buscar lá na casa deles?
10. ADRIANO (áudio): Não precisa buscar nem entregar não, ela já tá aqui comigo, eu levo de volta quando tiver pronta. Anota aí que é sem transporte. Ah, e a cor é azul marinho mesmo, e eu mando foto da mesa quando tirar.
11. BOT: 🎧 Ouvi: "Não precisa buscar nem entregar não, ela já tá aqui comigo, eu levo de volta quando tiver pronta. Anota aí que é sem transporte. Ah, e a cor é azul marinho mesmo, e eu mando foto da mesa quando tirar."
12. BOT: Anotei: criado-mudo, sem transporte, azul marinho ✅

O orçamento ficou assim:
💰 Sugestão: R$ 484,00 (uns 3 dias de trabalho)
⚠️ Abaixo de R$ 390,00 você fica no prejuízo.

Você concorda, quer dar desconto ou acrescentar algo? 🤝
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
13. ADRIANO: [tocou: 👍 Concordo]
14. BOT: Show, então falta só o prazo ⏳

Quando você consegue começar o criado-mudo, e quando fica pronto pro cliente?
15. ADRIANO (áudio): Começo essa semana, na segunda ou terça, depende de quando a tinta do outro serviço secar. Fica pronta em 3 a 5 dias contando lixar, pintar e secar, então por volta de sexta da semana que vem. Se atrasar eu aviso.
16. BOT: 🎧 Ouvi: "Começo essa semana, na segunda ou terça, depende de quando a tinta do outro serviço secar. Fica pronta em 3 a 5 dias contando lixar, pintar e secar, então por volta de sexta da semana que vem. Se atrasar eu aviso."
17. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
18. BOT: Fechado ✅ Anotei: começa segunda ou terça, fica pronto por volta de sexta da semana que vem.

Te mandei o PDF aqui no Telegram de R$ 484,00 pra repassar ao cliente. Quando ele responder, me avisa. 📄
```

</details>

## licele-cama — Cama queen da Dona Licele (medida do colchão é só referência)

Notas: entendimento 3 · naturalidade 3 · acessibilidade 4 · uma_pergunta_por_vez 4 · sem_invencao 3 · eficiencia 3 · conclusao 4 · 88s

- ✅ 1 serviço
- ✅ cama
- ✅ Dona Licele
- ✅ verniz

> Chegou ao orçamento (R$ 654,00), ele concordou e o PDF foi gerado, então o objetivo foi atingido. Mas houve pergunta já respondida (dono da cama), 'riscos leves' inventado, mistura de frete com dono no turno 9, e três respostas finais quase idênticas num loop de despedida. Tom amigável e curto, mas pouco eficiente no fim.

- [media] (nao_entendeu) turno 9: Anotou 'você não precisa de frete' como se fosse resposta sobre o dono, misturando assuntos. Também não reconheceu que a Dona Licele já tinha sido dita como cliente no turno 1.
- [media] (inventou) turno 6: Escreveu 'riscos leves', mas o Adriano disse só 'uns riscos'. O 'leves' foi inventado.
- [baixa] (pergunta_repetida) turno 6: Perguntou quem é o dono da cama, mas ele já tinha dito no turno 1 que era da cliente dona Licele.
- [media] (fluxo_confuso) turno 17: Disse 'valor fechado' e 'antes de fechar o orçamento', depois já enviou o PDF sem esperar a resposta completa. Ele disse que não sabia a data, mas o PDF saiu e o bot disse 'Fechado!'.
- [baixa] (tom) turno 21: 'Fechado!' e 'Anotei: começa essa semana' dão a impressão de compromisso firme, quando ele disse 'se der' e que a data é incerta. A ressalva foi mantida, mas o tom é de confirmação.
- [baixa] (jargao) turno 15: 'Você fica no prejuízo' está claro, mas apresenta o piso sem explicar de onde veio o valor. Também não detalha a conta.
- [media] (loop) turno 27: Depois do PDF e do combinado, o bot continuou respondendo a cada despedida com a mesma frase (turnos 27, 30, 33) em vez de encerrar. Repetição quase idêntica e desnecessária.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): Oi, tudo bem? Queria registrar um serviço aqui, é pra cliente da dona Licele. Ela me trouxe um móvel pra eu dar um jeito, tem uns riscos e ela quer que fique bonito de novo. Como é que eu começo?
2. BOT: 🎧 Ouvi: "Oi, tudo bem? Queria registrar um serviço aqui, é pra cliente da dona Licele. Ela me trouxe um móvel pra eu dar um jeito, tem uns riscos e ela quer que fique bonito de novo. Como é que eu começo?"
3. BOT: Opa, bora lá! 🪵 Primeiro me diz: que móvel é esse?

Se tiver foto, manda que ajuda 📸
4. ADRIANO (áudio): Ah, é uma cama queen. Vou lixar e envernizar a cama inteira, cabeceira e peseira. Tem uns riscos, mas não sei a medida da estrutura, só que é queen. Vai ser pincel, e não precisa de frete.
5. BOT: 🎧 Ouvi: "Ah, é uma cama queen. Vou lixar e envernizar a cama inteira, cabeceira e peseira. Tem uns riscos, mas não sei a medida da estrutura, só que é queen. Vai ser pincel, e não precisa de frete."
6. BOT: Anotei: cama queen, lixar e envernizar a cama inteira, riscos leves, pincel, sem frete ✅

Quem é o dono da cama? Pode ser o nome dele ou dela, tipo "Dona Licele" ou "Seu Zé".

📸 Se tiver foto da peça, manda que ajuda!
7. ADRIANO (áudio): A dona Licele é a cliente. A cama é dela, da casa dela. Ela trouxe pra mim dar um jeito.
8. BOT: 🎧 Ouvi: "A dona Licele é a cliente. A cama é dela, da casa dela. Ela trouxe pra mim dar um jeito."
9. BOT: Anotei: a cama é da Dona Licele, e você não precisa de frete ✅

Cama queen é bem grande, então acho que é porte grande. Confere pra mim? 📏
10. ADRIANO (áudio): Isso mesmo, dona Licele é a cliente e a cama é dela. Sobre o porte, não sei a medida exata da estrutura, só que é queen. Acho que é grande mesmo, mas não tenho como confirmar sem medir. Se for pra chutar, eu colocaria como grande. Depois eu vejo a medida certinha quando eu tiver ela na minha mão.
11. BOT: 🎧 Ouvi: "Isso mesmo, dona Licele é a cliente e a cama é dela. Sobre o porte, não sei a medida exata da estrutura, só que é queen. Acho que é grande mesmo, mas não tenho como confirmar sem medir. Se for pra chutar, eu colocaria como grande. Depois eu vejo a medida certinha quando eu tiver ela na minha mão."
12. BOT: Anotei: porte grande, pelo seu chute, e vou deixar a medida pra confirmar depois ✅

A cama precisa de algum conserto, ou só lixar e envernizar mesmo? 🛠️
13. ADRIANO (áudio): Só lixar e envernizar mesmo, sem conserto. Tem os riscos, mas nada quebrado nem solto.
14. BOT: 🎧 Ouvi: "Só lixar e envernizar mesmo, sem conserto. Tem os riscos, mas nada quebrado nem solto."
15. BOT: Fiz a conta da cama da Dona Licele 🪵

💰 Sugestão: R$ 654,00
⚠️ Abaixo de R$ 539,26 você fica no prejuízo.
📅 Dá uns 3 dias de trabalho.

Você concorda, quer dar um desconto ou acrescentar algo?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
16. ADRIANO: [tocou: 👍 Concordo]
17. BOT: Show, valor fechado ✅

Antes de fechar o orçamento, me diz: quando você consegue começar a cama e em quanto tempo ela fica pronta pra Dona Licele? 📅
18. ADRIANO (áudio): Ah, começo essa semana mesmo, se der. Acho que uns 3 dias de trabalho tá certo, mas só consigo fechar a data depois de ver a cama na mão, porque tem que lixar com calma e tirar os riscos. Por enquanto não sei o dia exato, deixa aí que eu te falo.
19. BOT: 🎧 Ouvi: "Ah, começo essa semana mesmo, se der. Acho que uns 3 dias de trabalho tá certo, mas só consigo fechar a data depois de ver a cama na mão, porque tem que lixar com calma e tirar os riscos. Por enquanto não sei o dia exato, deixa aí que eu te falo."
20. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
21. BOT: Fechado! ✅ Anotei: começa essa semana, se der, uns 3 dias de trabalho, e a data exata você confirma depois de ver a cama.

Te mandei o PDF aqui de R$ 654,00 pra você repassar à Dona Licele 📄 Quando ela responder, me avisa.
22. ADRIANO (áudio): Beleza, valeu! Então tá fechado, vou repassar o PDF pra Dona Licele. Quando ela responder eu te aviso. Só uma coisa: a data exata eu confirmo depois que eu pegar a cama na mão.
23. BOT: 🎧 Ouvi: "Beleza, valeu! Então tá fechado, vou repassar o PDF pra Dona Licele. Quando ela responder eu te aviso. Só uma coisa: a data exata eu confirmo depois que eu pegar a cama na mão."
24. BOT: Beleza, anotado ✅ Quando a Dona Licele responder, me avisa aqui. E quando pegar a cama, passa a medida certinha pra eu ajustar o porte.
25. ADRIANO (áudio): Valeu! Pode deixar, quando a Dona Licele responder eu te aviso aqui. E quando eu pegar a cama e medir, eu passo a medida certinha pra você ajustar o porte.
26. BOT: 🎧 Ouvi: "Valeu! Pode deixar, quando a Dona Licele responder eu te aviso aqui. E quando eu pegar a cama e medir, eu passo a medida certinha pra você ajustar o porte."
27. BOT: Valeu! Fica combinado 👍 Quando ela responder ou você medir a cama, é só mandar aqui.
28. ADRIANO (áudio): Beleza, Adriano! Então tá combinado. Quando a Dona Licele responder ou você pegar a cama e medir, me manda aqui. Valeu!
29. BOT: 🎧 Ouvi: "Beleza, Adriano! Então tá combinado. Quando a Dona Licele responder ou você pegar a cama e medir, me manda aqui. Valeu!"
30. BOT: Valeu! Combinado 👍 Quando a Dona Licele responder ou você medir a cama, é só mandar aqui.
31. ADRIANO (áudio): Valeu! Então fica assim: quando a Dona Licele responder, eu te aviso aqui. E assim que eu pegar a cama na mão e medir, passo a medida certinha. Obrigado!
32. BOT: 🎧 Ouvi: "Valeu! Então fica assim: quando a Dona Licele responder, eu te aviso aqui. E assim que eu pegar a cama na mão e medir, passo a medida certinha. Obrigado!"
33. BOT: Valeu, Adriano! Combinado 👍 Quando ela responder ou você medir a cama, é só mandar aqui.
34. ADRIANO (áudio): Beleza, Adriano! Então fica assim mesmo. Quando a Dona Licele responder ou você medir a cama, é só me mandar aqui. Valeu!
35. BOT: 🎧 Ouvi: "Beleza, Adriano! Então fica assim mesmo. Quando a Dona Licele responder ou você medir a cama, é só me mandar aqui. Valeu!"
36. BOT: Valeu, Adriano! Combinado 👍 Quando a Dona Licele responder ou você medir a cama, é só chamar aqui.
37. ADRIANO (áudio): Beleza, valeu! Então fica assim mesmo. Quando a Dona Licele responder ou eu pegar a cama e medir, eu te chamo aqui. Obrigado!
38. BOT: 🎧 Ouvi: "Beleza, valeu! Então fica assim mesmo. Quando a Dona Licele responder ou eu pegar a cama e medir, eu te chamo aqui. Obrigado!"
39. BOT: Valeu, Adriano! Combinado 👍 Quando precisar, é só chamar aqui.
40. ADRIANO (áudio): Valeu! Então combinado. Quando a Dona Licele responder ou eu pegar a cama e medir, eu te chamo aqui. Obrigado!
41. BOT: 🎧 Ouvi: "Valeu! Então combinado. Quando a Dona Licele responder ou eu pegar a cama e medir, eu te chamo aqui. Obrigado!"
42. BOT: Valeu, Adriano! Combinado 👍 Quando precisar, é só chamar aqui.
43. ADRIANO (áudio): Beleza, então fica combinado assim mesmo. Quando a Dona Licele responder ou eu medir a cama, eu te chamo aqui. Valeu!
44. BOT: 🎧 Ouvi: "Beleza, então fica combinado assim mesmo. Quando a Dona Licele responder ou eu medir a cama, eu te chamo aqui. Valeu!"
45. BOT: Valeu, Adriano! Combinado 👍 Quando a Dona Licele responder ou você medir a cama, é só chamar aqui.
46. ADRIANO (áudio): Beleza, então é isso. Quando a Dona Licele responder ou eu medir a cama, eu te chamo aqui. Valeu!
47. BOT: 🎧 Ouvi: "Beleza, então é isso. Quando a Dona Licele responder ou eu medir a cama, eu te chamo aqui. Valeu!"
48. BOT: Valeu, Adriano! Combinado 👍 Quando a Dona Licele responder ou você medir a cama, é só chamar aqui.
49. ADRIANO (áudio): Beleza, então é isso. Ainda não tenho a medida, a Dona Licele não respondeu. Quando eu medir a cama ou ela responder, eu te chamo aqui. Valeu!
50. BOT: 🎧 Ouvi: "Beleza, então é isso. Ainda não tenho a medida, a Dona Licele não respondeu. Quando eu medir a cama ou ela responder, eu te chamo aqui. Valeu!"
51. BOT: Valeu, Adriano! Combinado 👍 Quando ela responder ou você medir a cama, é só chamar aqui.
52. ADRIANO (áudio): Beleza, então é isso. Ainda não tenho a medida e a Dona Licele não respondeu. Quando eu medir ou ela responder, eu te chamo aqui. Valeu!
53. BOT: 🎧 Ouvi: "Beleza, então é isso. Ainda não tenho a medida e a Dona Licele não respondeu. Quando eu medir ou ela responder, eu te chamo aqui. Valeu!"
54. BOT: Valeu, Adriano! Quando tiver a medida ou a resposta dela, é só chamar aqui 👋
```

</details>

## preco-material-solvente — Preço de material na hora do orçamento: 'duas latas por 150' e 'não uso solvente'

Notas: entendimento 5 · naturalidade 4 · acessibilidade 3 · uma_pergunta_por_vez 4 · sem_invencao 4 · eficiencia 5 · conclusao 5 · 53s

- ✅ verniz = R$ 75 por lata (150 ÷ 2)
- ✅ embalagem 900 ml
- ✅ solvente continua sem preço (não usa)
- ✅ solvente fora deste orçamento
- ✅ orçamento calculado

> O assistente entendeu tudo, inclusive os preços do verniz (2 latas por 150) e que ele não usa solvente, e chegou ao orçamento e ao PDF em poucas trocas. As conferências no banco estão corretas. Os pontos fracos são a mensagem do orçamento, um pouco técnica e com R$ 87 de material sem explicação, e a pergunta de prazo dupla.

- [media] (jargao) turno 6: Mensagem do orçamento usa 'Sugestão', 'prejuízo' e 'Material novo' sem explicar de onde vem o R$ 87. O valor não bate com os R$ 150 que ele disse ter gasto, e isso pode confundir. Também mistura vários blocos de informação.
- [baixa] (fluxo_confuso) turno 6: A mensagem oferece três opções (concordo, desconto, acrescentar) numa só pergunta. Os botões ajudam, mas é um pouco burocrático.
- [baixa] (tom) turno 8: 'Fechado quase!' é estranho. Além disso, a pergunta de prazo junta duas coisas: quando começa e em quanto tempo fica pronta.
- [baixa] (inventou) turno 12: Diz 'Prazo anotado' sem repetir o prazo dito (fim da semana que vem). Não deixa claro o que foi registrado.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, tudo bem? Peguei uma mesa da dona Ana pra envernizar. Ela tá boa, só precisa de verniz por fora, sem conserto nenhum. O tampo tem 1 metro por 60 cm e a altura é 75. Vou fazer com pincel, sem frete. Dá pra você montar o orçamento aí?
2. BOT: 🎧 Ouvi: "E aí, tudo bem? Peguei uma mesa da dona Ana pra envernizar. Ela tá boa, só precisa de verniz por fora, sem conserto nenhum. O tampo tem 1 metro por 60 cm e a altura é 75. Vou fazer com pincel, sem frete. Dá pra você montar o orçamento aí?"
3. BOT: Anotei: mesa da Dona Ana, só verniz por fora, sem conserto, a pincel, sem frete ✅. Você pegou a mesa lá e vai devolver também, ou ela vem buscar?

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Ela mesma traz aqui na oficina e depois eu levo de volta pra ela, combinado assim. Não tenho foto agora, depois eu mando se precisar. Ah, e o verniz eu comprei duas latas de 900 ml, deu 150 reais no total. Solvente eu não uso nesse serviço, só o verniz mesmo.
5. BOT: 🎧 Ouvi: "Ela mesma traz aqui na oficina e depois eu levo de volta pra ela, combinado assim. Não tenho foto agora, depois eu mando se precisar. Ah, e o verniz eu comprei duas latas de 900 ml, deu 150 reais no total. Solvente eu não uso nesse serviço, só o verniz mesmo."
6. BOT: Mesa da Dona Ana pronta 🪵

💰 Sugestão: R$ 236,00, uns 2 dias de trabalho.
⚠️ Abaixo de R$ 190,00 você fica no prejuízo.
🛒 Material novo: uns R$ 87,00.

Você concorda, quer dar desconto ou acrescentar algo?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
7. ADRIANO: [tocou: 👍 Concordo]
8. BOT: Fechado quase! 📄 Só falta o prazo: quando você consegue começar a mesa e em quanto tempo ela fica pronta pra Dona Ana?
9. ADRIANO (áudio): Começo essa semana, vou dar uma olhada na mesa e fazer o verniz, acho que fica pronta em uns 2 dias de trabalho, mais ou less no final da semana que vem. Pode colocar esse prazo aí.
10. BOT: 🎧 Ouvi: "Começo essa semana, vou dar uma olhada na mesa e fazer o verniz, acho que fica pronta em uns 2 dias de trabalho, mais ou less no final da semana que vem. Pode colocar esse prazo aí."
11. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
12. BOT: Prazo anotado ✅ Fechei a mesa da Dona Ana em R$ 236,00 e te mandei o PDF aqui no Telegram pra você repassar pra ela. Quando ela responder, me avisa que eu anoto 📄
```

</details>

## pagamento-gasto — Pagamento e gasto no dia a dia

Notas: entendimento 5 · naturalidade 4 · acessibilidade 5 · uma_pergunta_por_vez 5 · sem_invencao 4 · eficiencia 4 · conclusao 5 · 25s

- ✅ pagamento de R$ 200
- ✅ gasto de R$ 90

> Conversa curta e eficiente: pagamento de R$ 200 e gasto de R$ 90 registrados corretamente, uma pergunta por vez e linguagem simples. Pequenos deslizes: 'anotei' antes da confirmação, 'estoque' dito como se fosse registrado, e oferta de fechar o orçamento que não era pedida.

- [baixa] (tom) turno 3: Diz 'anotei' antes de o Adriano confirmar, quando na verdade só registra depois do botão; mistura passado com pedido de confirmação.
- [baixa] (inventou) turno 12: Diz que o verniz ficou 'no estoque', mas o Adriano só disse que era verniz para estoque e deixou solto; o sistema não registrou estoque de fato.
- [baixa] (tom) turno 14: Chama o Adriano de 'Adriano' ao se despedir de uma mensagem em que ele mesmo se confundiu de nome; a resposta é correta, mas o bot não notou a troca de papéis no turno 13.
- [baixa] (fluxo_confuso) turno 5: Oferece fechar o orçamento logo após o pagamento, o que não era pedido; Adriano recusou sem problema.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): Oi, tudo certo? Então, a dona Maria pagou duzentos reais da cristaleira hoje, foi a entrada. Anota aí pra mim, por favor.
2. BOT: 🎧 Ouvi: "Oi, tudo certo? Então, a dona Maria pagou duzentos reais da cristaleira hoje, foi a entrada. Anota aí pra mim, por favor."
3. BOT: Opa, anotei a entrada de R$ 200 da cristaleira da Dona Maria. Confirma no botão aí pra eu registrar 👍
   [botões: ✅ Pode anotar | ✏️ Não]
4. ADRIANO: [tocou: ✅ Pode anotar]
5. BOT: Pronto, anotei os R$ 200 de entrada da cristaleira da Dona Maria ✅ O orçamento dela ainda não fechou. Quer que a gente feche o valor agora?
6. ADRIANO (áudio): Não, deixa pra depois. Ainda tem uma coisa: hoje também comprei verniz numa loja, gastei noventa reais. Anota esse gasto aí.
7. BOT: 🎧 Ouvi: "Não, deixa pra depois. Ainda tem uma coisa: hoje também comprei verniz numa loja, gastei noventa reais. Anota esse gasto aí."
8. BOT: Beleza, vou anotar o gasto de R$ 90 com verniz. Confirma no botão aí pra eu registrar ✅
   [botões: ✅ Pode anotar | ✏️ Não]
9. ADRIANO: [tocou: ✅ Pode anotar]
10. BOT: Gasto de R$ 90 com verniz anotado ✅ Quer que eu já ligue esse verniz à cristaleira da Dona Maria, ou deixo solto?
11. ADRIANO: Deixa solto, não tem a ver com a cristaleira. É verniz pra estoque, mais pra frente eu vejo. Obrigado, era isso.
12. BOT: Beleza, deixei o verniz solto, no estoque 👍 Obrigado a você, Adriano. Qualquer coisa, é só chamar!
13. ADRIANO: Valeu, Adriano! Era isso mesmo, o pagamento de 200 e o verniz de 90 ficaram anotados. Um abraço!
14. BOT: Valeu! 👋 Um abraço pra você também, Adriano.
```

</details>

## andamento-nao-andamento — Andamento: 'comecei' muda; 'quando ficar pronta ela busca' não muda

Notas: entendimento 4 · naturalidade 3 · acessibilidade 4 · uma_pergunta_por_vez 3 · sem_invencao 3 · eficiencia 3 · conclusao 5 · 26s

- ✅ serviço em execução (não concluído)

> O objetivo foi atingido: o serviço ficou em execução e não foi marcado como pronto. Mas houve perguntas desnecessárias sobre prazo de retirada, confirmação de botão repetida e frases repetidas sobre técnica ou prazo, o que alongou a conversa.

- [media] (pergunta_desnecessaria) turno 3: Perguntou quando ficará pronta para buscar, sendo que o comentário sobre a Dona Maria buscar não é andamento. Isso induz a falar de prazo e mistura assuntos. Também são duas chamadas na mesma mensagem (confirmar botão e pergunta de prazo).
- [baixa] (fluxo_confuso) turno 3: 'Confirma o botão de iniciado aí' é instrução estranha e mecânica, e os botões 'Confirmar/Não' não combinam com a pergunta feita.
- [media] (pergunta_repetida) turno 5: Repete o pedido de confirmar o botão de iniciado, mesmo ele já ter dito que só queria registrar que começou. Insiste na mesma confirmação.
- [baixa] (perdeu_informacao) turno 3: Não registrou claramente que a Dona Maria vai buscar quando ficar pronta, detalhe dito de passagem.
- [baixa] (jargao) turno 7: 'Em execução' soa técnico para o Adriano.
- [media] (fluxo_confuso) turno 8: A mensagem do Adriano parece ter sido gerada com voz de assistente (resumo e pergunta 'mais alguma coisa'), o que inverte papéis e confunde; o bot apenas seguiu sem estranhar.
- [baixa] (texto_longo) turno 9: Repete a frase 'quando definir a técnica ou o prazo' pela terceira vez, redundante.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, começou hoje a cristaleira da dona Maria. Tirei a tinta velha e comecei a lixar, ainda tá na lixa, a técnica eu ainda não defini. Ela falou que quando ficar pronta ela vem buscar. Anota aí que começou hoje.
2. BOT: 🎧 Ouvi: "E aí, começou hoje a cristaleira da dona Maria. Tirei a tinta velha e comecei a lixar, ainda tá na lixa, a técnica eu ainda não defini. Ela falou que quando ficar pronta ela vem buscar. Anota aí que começou hoje."
3. BOT: Anotei que a cristaleira da Dona Maria começou hoje, lixando a tinta velha. Confirma o botão de "iniciado" aí. 🪵

Quando você acha que fica pronta pra ela buscar?
   [botões: ✅ Confirmar | ✏️ Não]
4. ADRIANO: Não, ainda não sei quando fica pronta. Ainda nem defini a técnica, então depois eu vejo isso. Por enquanto só registra que começou hoje mesmo.
5. BOT: Beleza, fica registrado que começou hoje. Confirma o botão de "iniciado" aí. 🪵

Quando definir a técnica ou o prazo, é só me falar.
   [botões: ✅ Confirmar | ✏️ Não]
6. ADRIANO: [tocou: ✅ Confirmar]
7. BOT: Show, a cristaleira da Dona Maria tá em execução agora ✅ Quando definir a técnica ou o prazo, me fala que eu anoto.
8. ADRIANO: Valeu! Então tá registrado: começou hoje, lixando a tinta velha. Quando definir a técnica ou o prazo, eu falo com você. Mais alguma coisa sobre essa cristaleira ou outro serviço?
9. BOT: Isso, tá registrado 👍 Quando definir a técnica ou o prazo, me fala. Tem mais alguma coisa pra anotar agora?
10. ADRIANO: Não, por enquanto é isso. Só queria registrar que começou hoje mesmo. Valeu!
11. BOT: Valeu! Tá tudo registrado: a cristaleira da Dona Maria começou hoje 👍 Quando definir a técnica ou o prazo, é só chamar.
```

</details>

## fora-do-roteiro — Fora do roteiro: oi, teste de áudio, conversa social e recomeçar

Notas: entendimento 3 · naturalidade 3 · acessibilidade 4 · uma_pergunta_por_vez 3 · sem_invencao 3 · eficiencia 2 · conclusao 4 · 78s

- ✅ o serviço da cadeira foi cancelado ao recomeçar

> O bot cumpriu o objetivo final: cancelou a cadeira com confirmação em botão e recomeçou com a mesinha da dona Vera, e o banco confirma o cancelamento. Porém, ficou preso no roteiro do orçamento da cadeira, adiou o pedido de recomeçar por vários turnos, ignorou a parte social e repetiu perguntas sobre algo já dito (tampo arranhado). Ficou menos natural e eficiente do que um bom atendente humano.

- [media] (fluxo_confuso) turno 10: Adriano perguntou como recomeçar e o bot explicou 'cancelar a peça' em vez de dizer 'recomeçar' como comando; só no turno 13 confirmou a palavra. Além disso emendou uma pergunta nova sobre a cadeira na mesma mensagem.
- [alta] (ignorou_comando) turno 13: Adriano pediu repetidamente para testar o recomeçar (turnos 14, 17, 20), mas o bot continuou fazendo perguntas do orçamento da cadeira (pincel, tamanho, por fora) em vez de atender o pedido de teste. Só preparou o cancelamento no turno 22.
- [media] (pergunta_repetida) turno 19: A pergunta 'só por fora ou parte de dentro' é pouco natural para uma cadeira e forçou mais trocas. O bot também não reconheceu que Adriano já tinha dito que era a cadeira inteira para pintura.
- [media] (perdeu_informacao) turno 7: Não respondeu às perguntas sociais ('você tá bem?') e à pergunta sobre voltar do zero; apenas anotou a cadeira. Ignorou parte da fala.
- [baixa] (uma_pergunta_por_vez) turno 10: Respondeu sobre recomeço e já emendou pergunta de orçamento, misturando assuntos.
- [baixa] (texto_longo) turno 13: Mensagens com 'Ouvi:' repetindo a transcrição inteira são redundantes e poluem a conversa.
- [baixa] (perdeu_informacao) turno 29: Anotou o decapê e verniz, mas o tampo arranhado só aparece depois; e o bot perguntou se é só o tampo mesmo Adriano tendo dito 'tampo arranhado', o que é aceitável mas pouco atento. Depois, no turno 32, perguntou de novo o estado do tampo que ele já havia dito arranhado.

<details><summary>Conversa</summary>

```
1. ADRIANO: oi
2. BOT: Opa, tudo bem, Adriano? 😄 Me conta qual peça você tá orçando hoje que a gente começa.
3. ADRIANO: Oi, tudo certo sim! Testando aqui o bot. Ô, tá me ouvindo bem? Queria ver se o áudio funciona também.
4. BOT: Tô ouvindo sim, Adriano! 👍 Pode mandar o áudio quando quiser, e se quiser orçar alguma peça é só falar.
5. ADRIANO (áudio): Beleza, então funcionou o áudio! Mas deixa eu perguntar uma coisa, você tá bem aí? Tô testando também se o bot responde direito. Bora orçar uma cadeira do seu João, ela é para pintar. Só que antes queria ver outra coisa, quando eu for começar eu consigo voltar do zero se eu errar?
6. BOT: 🎧 Ouvi: "Beleza, então funcionou o áudio! Mas deixa eu perguntar uma coisa, você tá bem aí? Tô testando também se o bot responde direito. Bora orçar uma cadeira do seu João, ela é para pintar. Só que antes queria ver outra coisa, quando eu for começar eu consigo voltar do zero se eu errar?"
7. BOT: Anotei: cadeira do Seu João, pra pintura ✅ Se tiver foto, manda que ajuda 📸
8. ADRIANO (áudio): Tô bem sim, valeu por perguntar! Então, sobre a cadeira do seu João: ela tem o assento e o encosto, é de madeira e vai ser só pintura, sem mexer na estrutura. Foto eu não tenho agora, depois eu mando. E sim, dá pra recomeçar do zero se eu errar, né? Como faço isso?
9. BOT: 🎧 Ouvi: "Tô bem sim, valeu por perguntar! Então, sobre a cadeira do seu João: ela tem o assento e o encosto, é de madeira e vai ser só pintura, sem mexer na estrutura. Foto eu não tenho agora, depois eu mando. E sim, dá pra recomeçar do zero se eu errar, né? Como faço isso?"
10. BOT: Dá sim! Se errar, é só me pedir pra cancelar a peça e eu preparo o cancelamento. Você confirma num botão, e aí começa de novo do zero. 👍

Agora me diz: a cadeira tá boa, só com riscos, ou tem alguma parte quebrada?
11. ADRIANO (áudio): Ah, tá boa, só com umas marcas de uso, nada quebrado. O assento tá firme e o encosto também, só precisa pintar mesmo. Ah, e o recomeçar é esse mesmo? Então quando eu quiser começar de novo, é só falar 'recomeçar' que você cancela e eu faço do zero, né?
12. BOT: 🎧 Ouvi: "Ah, tá boa, só com umas marcas de uso, nada quebrado. O assento tá firme e o encosto também, só precisa pintar mesmo. Ah, e o recomeçar é esse mesmo? Então quando eu quiser começar de novo, é só falar 'recomeçar' que você cancela e eu faço do zero, né?"
13. BOT: Anotei: cadeira do Seu João, estado bom, só marcas de uso e pintura ✅

Isso mesmo: é só falar "recomeçar" que eu cancelo a peça e você começa do zero. Você confirma num botão.

Essa pintura vai ser no pincel, rolo ou pistola? 🎨
14. ADRIANO (áudio): Ah, então é isso mesmo! Quando eu quiser recomeçar, falo 'recomeçar' e você cancela e eu começo do zero. Pintura é no pincel, sem rolo nem pistola. Ah, e é só tinta mesmo, sem verniz por cima ainda, tá? Quando der, testo o recomeçar pra ver se funciona.
15. BOT: 🎧 Ouvi: "Ah, então é isso mesmo! Quando eu quiser recomeçar, falo 'recomeçar' e você cancela e eu começo do zero. Pintura é no pincel, sem rolo nem pistola. Ah, e é só tinta mesmo, sem verniz por cima ainda, tá? Quando der, testo o recomeçar pra ver se funciona."
16. BOT: Anotei: pintura no pincel, só tinta, sem verniz por cima ✅

Pra fechar o tamanho, a cadeira é pequena, média ou grande? 📏
17. ADRIANO (áudio): Pequena, tamanho normal de cadeira de sala, nada grande. Agora eu testo o recomeçar pra ver se funciona mesmo.
18. BOT: 🎧 Ouvi: "Pequena, tamanho normal de cadeira de sala, nada grande. Agora eu testo o recomeçar pra ver se funciona mesmo."
19. BOT: Anotei: cadeira pequena, pintura no pincel, só tinta ✅

Pra fechar o orçamento, a pintura é só por fora ou tem parte de dentro também?
20. ADRIANO (áudio): Só por fora, a cadeira inteira. Agora testa o recomeçar aí, falou.
21. BOT: 🎧 Ouvi: "Só por fora, a cadeira inteira. Agora testa o recomeçar aí, falou."
22. BOT: Anotei: só por fora, cadeira inteira ✅

Vou preparar o cancelamento da cadeira do Seu João. Confirma no botão que ela sai e você recomeça do zero. 👇
   [botões: ✅ Sim, cancelar | ✏️ Não]
23. ADRIANO: [tocou: ✅ Sim, cancelar]
24. BOT: Cancelada 👍 A cadeira do Seu João saiu e ficou guardada no histórico.

Pode começar do zero: me conta de novo a peça que você quer orçar.
25. ADRIANO: Beleza, então a cadeira do Seu João tá cancelada e a gente começa do zero. Pode me contar a peça que você quer orçar agora.
26. BOT: Beleza, a cadeira do Seu João ficou cancelada e a gente começa do zero. 👍

Qual peça você quer orçar agora? 🪑
27. ADRIANO (áudio): Ah, agora sim, então já posso começar do zero. A peça é uma mesinha de centro de madeira que a dona Vera trouxe. Ela tem o tampo arranhado e precisa de decapê e verniz novo, mas ainda não medi direito.
28. BOT: 🎧 Ouvi: "Ah, agora sim, então já posso começar do zero. A peça é uma mesinha de centro de madeira que a dona Vera trouxe. Ela tem o tampo arranhado e precisa de decapê e verniz novo, mas ainda não medi direito."
29. BOT: Anotei: mesinha de centro da Dona Vera, com decapê e verniz novo ✅

É só o tampo que vai ser trabalhado, ou a mesa inteira? 🪵

📸 Se tiver foto da peça, manda que ajuda!
30. ADRIANO (áudio): Ah, é o tampo mesmo, o resto da mesinha eu nem toco. Mas ainda não medi, depois vejo as medidas.
31. BOT: 🎧 Ouvi: "Ah, é o tampo mesmo, o resto da mesinha eu nem toco. Mas ainda não medi, depois vejo as medidas."
32. BOT: Anotei: só o tampo, decapê e verniz novo, medidas depois ✅

Pra gente seguir, o tampo tá bom, só com riscos, ou tem alguma parte danificada?
```

</details>

## correcoes — Correções do jeito dele no meio do orçamento

Notas: entendimento 4 · naturalidade 4 · acessibilidade 4 · uma_pergunta_por_vez 4 · sem_invencao 4 · eficiencia 3 · conclusao 4 · 50s

- ✅ 1 serviço
- ✅ cliente corrigida para Dona Bia
- ✅ método corrigido para rolo
- ✅ cor branca anotada

> O bot entendeu as correções (cliente Dona Bia, rolo) e chegou ao orçamento e ao PDF com os dados certos. Perdeu eficiência com uma pergunta desnecessária sobre busca e entrega, um fechamento exagerado ('Fechado!') e várias mensagens redundantes no final. O orçamento está um pouco técnico, mas o geral é natural e sem invenção de fatos.

- [baixa] (pergunta_dupla) turno 3: Pergunta gavetas e tamanho na mesma mensagem, além de sugerir foto; são duas perguntas juntas.
- [media] (pergunta_desnecessaria) turno 6: Pergunta se busca e entrega a peça, o que não muda o orçamento e foi gasto um turno; depois o Adriano ainda precisou esclarecer que não cobra deslocamento.
- [media] (jargao) turno 9: Usa 'Sugestão', 'prejuízo' e 'Material novo' sem explicar; o valor de R$ 308 e as horas vêm do sistema, mas o texto é denso para quem prefere conversa simples. Não considerou o 'sem frete' dito pelo usuário na resposta.
- [media] (promessa_confusa) turno 15: Diz 'Fechado!' e 'Te mandei o PDF' antes do cliente aceitar, e pede 'me avisa quando aceitar', o que pode parecer confirmação de fechamento. Também o bot gerou o PDF sem Adriano confirmar o prazo vago ('se der').
- [baixa] (repeticao) turno 18: Os turnos 18 a 23 repetem a mesma combinação (avisar quando a Dona Bia aceitar) várias vezes; conversa prolongada sem necessidade.
- [baixa] (promessa) turno 23: 'Quando ela aceitar eu anoto' é aceitável, mas o bot repete o ciclo de despedida sem encerrar, esticando a conversa.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): Fala, beleza? Peguei uma cômoda pra pintar aqui, da dona Ana. É pintura branca. Queria fazer o orçamento
2. BOT: 🎧 Ouvi: "Fala, beleza? Peguei uma cômoda pra pintar aqui, da dona Ana. É pintura branca. Queria fazer o orçamento"
3. BOT: Anotei: cômoda da Dona Ana, pintura branca ✅ Quantas gavetas ela tem, e qual o tamanho aproximado (altura, largura e fundura em cm)? 🪵

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Cara, ela tá boa, sem conserto nenhum. Ah, e na verdade a cliente é a dona Bia, não a Ana. A cômoda tem 90 de altura, 1 metro de largura e 45 de fundura. Só vou pintar por fora. Sem frete. Ah, e primeiro falei que era pincel, mas é rolo mesmo.
5. BOT: 🎧 Ouvi: "Cara, ela tá boa, sem conserto nenhum. Ah, e na verdade a cliente é a dona Bia, não a Ana. A cômoda tem 90 de altura, 1 metro de largura e 45 de fundura. Só vou pintar por fora. Sem frete. Ah, e primeiro falei que era pincel, mas é rolo mesmo."
6. BOT: Anotei: cômoda da Dona Bia, 90 x 100 x 45 cm, bom estado, só por fora, pintura branca no rolo, sem frete ✅ Corrigido. Você busca e entrega a peça, ou ela vem até você?
7. ADRIANO (áudio): Busco e entrego. Ela não vem aqui, eu pego a cômoda lá e levo de volta. Mas sem frete no orçamento, então é só o meu tempo mesmo, não cobra deslocamento.
8. BOT: 🎧 Ouvi: "Busco e entrego. Ela não vem aqui, eu pego a cômoda lá e levo de volta. Mas sem frete no orçamento, então é só o meu tempo mesmo, não cobra deslocamento."
9. BOT: Cômoda da Dona Bia, pintura branca no rolo:
💰 Sugestão: R$ 308,00
⚠️ Abaixo de R$ 248,01 você fica no prejuízo.
🛒 Material novo: uns R$ 205,00
⏱️ Umas 5 horas, cerca de 2 dias de trabalho.

Você concorda, quer dar um desconto ou acrescentar algo?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
10. ADRIANO: [tocou: 👍 Concordo]
11. BOT: Fechado, falta só o prazo 📅 Quando você consegue começar a cômoda da Dona Bia, e em quanto tempo ela fica pronta pra cliente?
12. ADRIANO (áudio): Começo na segunda, se der. Umas duas semanas pra ficar pronta, mais ou menos. Tá bom assim.
13. BOT: 🎧 Ouvi: "Começo na segunda, se der. Umas duas semanas pra ficar pronta, mais ou menos. Tá bom assim."
14. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
15. BOT: Fechado! ✅ Te mandei o PDF aqui, de R$ 308,00 pra cômoda da Dona Bia. Anotei: começa na segunda, se der, e fica pronta em umas duas semanas. Quando ela aceitar, me avisa 😄
16. ADRIANO (áudio): Beleza, valeu! Só um detalhe: a cômoda tá na casa da Dona Bia, né? Pode deixar que é isso mesmo, então tá tudo certo. Pode mandar o PDF pra ela.
17. BOT: 🎧 Ouvi: "Beleza, valeu! Só um detalhe: a cômoda tá na casa da Dona Bia, né? Pode deixar que é isso mesmo, então tá tudo certo. Pode mandar o PDF pra ela."
18. BOT: Isso, a cômoda tá na casa da Dona Bia e você busca lá 👍 O PDF já tá aqui no Telegram, é só repassar pra ela. Quando ela aceitar, me avisa ✅
19. ADRIANO (áudio): Beleza, valeu! Isso mesmo, a cômoda tá na casa dela e eu busco. Vou repassar o PDF pra Dona Bia. Quando ela aceitar eu te aviso.
20. BOT: 🎧 Ouvi: "Beleza, valeu! Isso mesmo, a cômoda tá na casa dela e eu busco. Vou repassar o PDF pra Dona Bia. Quando ela aceitar eu te aviso."
21. BOT: Show, Adriano! 👍 Combinado: quando a Dona Bia aceitar, você me avisa. Boa pintura na cômoda! 🎨
22. ADRIANO: Valeu, Adriano! Quando a Dona Bia aceitar, me avisa que eu anoto. Até mais!
23. BOT: Valeu! Combinado, quando ela aceitar eu anoto 👋
```

</details>

## edileuza-prazo — Mesa da Dona Edileuza: 'pegar o serviço' não é buscar a peça, método em aberto, prazo do Adriano

Notas: entendimento 3 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 4 · sem_invencao 2 · eficiencia 3 · conclusao 4 · 73s

- ✅ mesa de centro anotada
- ✅ não afirmou que ele vai buscar a peça
- ✅ não anotou que ele busca
- ✅ prazo dele anotado (2 meses)
- ✅ pediu foto
- ✅ sem falar de sistema/marcação
- ✅ PDF gerado

> A conversa chegou ao PDF com valor fechado e prazo anotado, mas houve falhas importantes. O bot tratou o pincel como decisão sem sugerir, atrapalhou a correção sobre quem busca a mesa, ignorou os preços dos materiais e apresentou um orçamento com jargão e números sem explicação (3 dias contra a semana dita por Adriano). A conversa é razoavelmente curta, mas a qualidade do entendimento e da comunicação ficou abaixo do ideal.

- [media] (inventou) turno 9: Adriano disse que aceitaria pincel se sugerissem, mas o bot afirmou 'Então vai de pincel' sem sugerir antes. Tratou como decisão dele o que era dúvida em aberto.
- [alta] (nao_entendeu) turno 12: Adriano corrigiu que os clientes trazem e buscam a mesa e que ele só vai lá ver. O bot respondeu 'a mesa fica com você só pra ver amanhã, e os dois vêm buscar depois', o que é confuso. Parece que a mesa vai até ele só para ver e depois volta, e não deixa claro que os clientes trazem.
- [baixa] (jargao) turno 3: Ao resumir a fala, o bot pediu o estado da peça logo depois de Adriano dizer 'sem conserto'. A pergunta é parcialmente redundante e usa a lista rígida 'boa, com reparos ou danificada'.
- [media] (perdeu_informacao) turno 6: O bot anotou 'reparos (massa e lixa)' como se fosse conserto, apesar de Adriano ter dito 'sem conserto'. Também reformulou o que ele disse e a conta mostra o risco de ter gerado custo de reparo.
- [media] (perdeu_informacao) turno 14: Adriano informou os preços dos materiais e pediu que mandasse o preço para conferir. O bot não reconheceu os preços nem respondeu à pergunta sobre massa; foi direto ao orçamento.
- [alta] (jargao) turno 15: O orçamento usou 'prejuízo', 'mínimo' e 'material novo', sem mostrar a conta. Os números R$ 453, R$ 359 e 3 dias não foram pedidos nem explicados, e os 3 dias de trabalho conflitam com a semana que Adriano disse depois. Parece valor decidido pelo sistema.
- [media] (fluxo_confuso) turno 22: O bot perguntou o prazo apenas no fim, depois de fechar o preço, e o PDF saiu junto com a pergunta de prazo, sem esperar confirmação final.
- [baixa] (tom) turno 25: A mensagem final ficou um pouco longa e repetiu informações. Também não retomou a visita de amanhã nem a falta de foto.
- [baixa] (texto_longo) turno 2: O bot repete a transcrição inteira do áudio em cada turno ('Ouvi:'), o que enche a conversa e atrasa a resposta.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): Amanhã eu tenho um serviço pra pegar lá na casa da dona Edileuza e do seu Crayson. É uma mesa de centro, tamanho médio, só pra passar massa e lixar e pintar por fora. Peça inteira, sem conserto. Por enquanto só a mesa de centro, depois eu falo dos outros.
2. BOT: 🎧 Ouvi: "Amanhã eu tenho um serviço pra pegar lá na casa da dona Edileuza e do seu Crayson. É uma mesa de centro, tamanho médio, só pra passar massa e lixar e pintar por fora. Peça inteira, sem conserto. Por enquanto só a mesa de centro, depois eu falo dos outros."
3. BOT: Anotei: mesa de centro média, pintura por fora, peça inteira, sem conserto ✅

Como ela tá de estado? Boa, com reparos ou danificada?

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Ela tá boa, sem defeito. Só precisa mesmo passar massa e lixar pra pintar. Não tenho foto agora, depois eu vejo.
5. BOT: 🎧 Ouvi: "Ela tá boa, sem defeito. Só precisa mesmo passar massa e lixar pra pintar. Não tenho foto agora, depois eu vejo."
6. BOT: Anotei: reparos (massa e lixa) e pintura por fora ✅

Vai pintar com pincel, rolo ou pistola?
7. ADRIANO (áudio): Ainda não sei, pode ser pincel ou rolo. Se você sugerir pincel eu vou de pincel.
8. BOT: 🎧 Ouvi: "Ainda não sei, pode ser pincel ou rolo. Se você sugerir pincel eu vou de pincel."
9. BOT: Então vai de pincel, anotei ✅

Você busca a mesa e entrega depois, ou o cliente traz e busca?
10. ADRIANO (áudio): Eu não disse que ia buscar a mesa. Os clientes trazem e buscam, eu só vou lá amanhã pra ver a peça.
11. BOT: 🎧 Ouvi: "Eu não disse que ia buscar a mesa. Os clientes trazem e buscam, eu só vou lá amanhã pra ver a peça."
12. BOT: Certo, a mesa fica com você só pra ver amanhã, e os dois vêm buscar depois ✅

Pincel anotado também. Já tem massa, lixa e tinta em casa?
13. ADRIANO (áudio): Não tenho massa, lixa e tinta aqui no estoque agora, mas pode mandar o preço e eu confiro. Se precisar comprar, a lixa é 10 reais o pacote com 10 folhas, o fundo preparador 100 reais a lata de 5 litros, a tinta 50 reais a lata de 2 litros e o thinner 15 reais a lata de 500 ml.
14. BOT: 🎧 Ouvi: "Não tenho massa, lixa e tinta aqui no estoque agora, mas pode mandar o preço e eu confiro. Se precisar comprar, a lixa é 10 reais o pacote com 10 folhas, o fundo preparador 100 reais a lata de 5 litros, a tinta 50 reais a lata de 2 litros e o thinner 15 reais a lata de 500 ml."
15. BOT: Orçamento da mesa da Dona Edileuza e Seu Crayson: sugestão de **R$ 453,00**. Abaixo de R$ 359,00 você fica no prejuízo. Dá uns 3 dias de trabalho, e o material novo fica em R$ 175,00.

Você concorda, quer dar um desconto ou acrescentar algo? 🤝
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
16. ADRIANO: [tocou: ➖ Dar desconto]
17. BOT: Beleza! Quanto você quer dar de desconto, em reais ou em porcentagem? 💰
18. ADRIANO (áudio): Pede 59 reais de desconto. Vai ficar bom pra eles, e a mesa é de tamanho médio mesmo.
19. BOT: 🎧 Ouvi: "Pede 59 reais de desconto. Vai ficar bom pra eles, e a mesa é de tamanho médio mesmo."
20. BOT: Com R$ 59,00 de desconto, a mesa fica em **R$ 394,00**. Ainda fica acima do mínimo.

Fecho assim? 👍
21. ADRIANO: [tocou: 👍 Concordo]
22. BOT: Fechou em **R$ 394,00** então ✅

Antes de eu gerar o PDF, quando você consegue começar a mesa?
23. ADRIANO: Começo daqui a 2 meses, e aí fica pronto em uma semana.
24. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
25. BOT: Prazo anotado: começa em 2 meses, fica pronto em uma semana ✅

Fechei a mesa da Dona Edileuza e Seu Crayson em **R$ 394,00** e te mandei o PDF aqui no Telegram. Quando o cliente responder, me avisa 📄
```

</details>

## decisao-valor — Decisão do valor: desconto abaixo do mínimo e depois acréscimo de frete

Notas: entendimento 4 · naturalidade 4 · acessibilidade 4 · uma_pergunta_por_vez 4 · sem_invencao 4 · eficiencia 4 · conclusao 5 · 52s

- ✅ PDF gerado
- ✅ orçamento fechado

> Conversa chegou ao objetivo: orçamento fechado em R$ 500 com frete incluso e PDF gerado. O bot percebeu a duplicidade do frete e corrigiu com clareza, sem inventar. Pontos fracos: o frete entrou incluso sem ele pedir à parte, pergunta dupla de prazo e um pouco de jargão no aviso de prejuízo.

- [baixa] (pergunta_desnecessaria) turno 3: Pergunta 'por fora ou por dentro' logo após o Adriano dizer 'só o verniz'; aceitável, mas o pedido de foto junto vira segundo pedido na mesma mensagem.
- [media] (jargao) turno 9: Usa 'prejuízo' e mostra o mínimo R$ 421,18 com centavos sem explicar. Além disso o frete de R$ 60 entra 'já incluso' no valor sugerido, sem o Adriano ter pedido para somar e ele queria cobrar à parte, o que gerou confusão depois.
- [baixa] (tom) turno 12: Não reconhece a correção 'Opa, Seu Luiz... quer dizer' nem o tom; aceitou o pedido de metade do valor e avisou do prejuízo, mas a mensagem é um pouco seca.
- [baixa] (fluxo_confuso) turno 18: Pergunta dupla: quando começa e quando fica pronto, duas perguntas em uma mensagem.
- [baixa] (promessa) turno 22: Fala 'Te mandei o PDF' e pede para avisar quando o cliente responder; o PDF foi gerado e enviado ao Adriano, não ao Seu Luiz, mas está razoavelmente claro.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): e aí, tudo bem? preciso de um orçamento pra um aparador do seu Luiz, é pra envernizar. tá bom de madeira, 1,20 de largura, 40 de fundura e 80 de altura. é inteiro, sem conserto nenhum. só o verniz mesmo, pincel.
2. BOT: 🎧 Ouvi: "e aí, tudo bem? preciso de um orçamento pra um aparador do seu Luiz, é pra envernizar. tá bom de madeira, 1,20 de largura, 40 de fundura e 80 de altura. é inteiro, sem conserto nenhum. só o verniz mesmo, pincel."
3. BOT: Anotei o aparador do Seu Luiz: verniz, pincel, 120 x 40 x 80 cm, inteiro e sem conserto ✅

Só por fora, ou por dentro também?

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Por dentro também, ele tá com as gavetas e o miolo bem, só o lado de fora que tá meio sem brilho. Sem foto agora, depois eu mando.
5. BOT: 🎧 Ouvi: "Por dentro também, ele tá com as gavetas e o miolo bem, só o lado de fora que tá meio sem brilho. Sem foto agora, depois eu mando."
6. BOT: Anotei: aparador do Seu Luiz, verniz por dentro e por fora, gavetas e miolo bons ✅

Quem leva e traz a peça: você busca e entrega, ou o Seu Luiz leva e pega na oficina?
7. ADRIANO (áudio): Eu busco e entrego, lá na casa dele. Só que o frete eu vou cobrar a parte, uns 60 reais de ida e volta. Pode colocar aí.
8. BOT: 🎧 Ouvi: "Eu busco e entrego, lá na casa dele. Só que o frete eu vou cobrar a parte, uns 60 reais de ida e volta. Pode colocar aí."
9. BOT: Fechou o cálculo do aparador do Seu Luiz 🪵

💰 Sugestão: R$ 500,00, já com o frete de R$ 60,00.
⚠️ Abaixo de R$ 421,18 você fica no prejuízo.
📅 Dá uns 3 dias de trabalho.

Você concorda com esse valor, ou quer dar um desconto?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
10. ADRIANO (áudio): Opa, Seu Luiz... quer dizer, o valor tá alto pro meu gosto. Dá pra fazer metade? Tipo uns 250 reais, aí eu fecho.
11. BOT: 🎧 Ouvi: "Opa, Seu Luiz... quer dizer, o valor tá alto pro meu gosto. Dá pra fazer metade? Tipo uns 250 reais, aí eu fecho."
12. BOT: Por R$ 250,00 fica abaixo do mínimo, e você teria prejuízo nessa peça ⚠️

Quer fechar mesmo assim nesses R$ 250, ou prefere um valor mais perto do mínimo?
13. ADRIANO (áudio): Ah não, 250 é muito pouco pra 3 dias de serviço com frete. Acrescenta os 60 do frete que eu já tinha falado. Aí fica 560 então? Pode fechar nisso.
14. BOT: 🎧 Ouvi: "Ah não, 250 é muito pouco pra 3 dias de serviço com frete. Acrescenta os 60 do frete que eu já tinha falado. Aí fica 560 então? Pode fechar nisso."
15. BOT: Opa, um ponto antes de fechar: os R$ 500 que eu passei já tinham os R$ 60 do frete dentro. Se somar mais 60, dá R$ 560, e o frete entra duas vezes.

Você quer fechar em R$ 500 (com o frete já incluso) ou em R$ 560 mesmo assim?
16. ADRIANO (áudio): Ah, entendi, então o frete já tava dentro dos 500. Pode fechar em 500 mesmo, com o frete incluso. Não precisa somar de novo.
17. BOT: 🎧 Ouvi: "Ah, entendi, então o frete já tava dentro dos 500. Pode fechar em 500 mesmo, com o frete incluso. Não precisa somar de novo."
18. BOT: Fechado em R$ 500,00, com o frete incluso ✅ Falta só o prazo pra eu gerar o PDF.

Quando você consegue começar o aparador do Seu Luiz, e quando fica pronto pra ele?
19. ADRIANO (áudio): Começo essa semana, na quinta-feira. Fica pronto uns 3 dias depois, se não aparecer nada no meio. Pode colocar assim.
20. BOT: 🎧 Ouvi: "Começo essa semana, na quinta-feira. Fica pronto uns 3 dias depois, se não aparecer nada no meio. Pode colocar assim."
21. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
22. BOT: Fechado e anotado: começo na quinta, fica pronto uns 3 dias depois ✅

Te mandei o PDF aqui no Telegram de R$ 500,00 pro Seu Luiz. Quando ele responder, me avisa que eu registro.
23. ADRIANO (áudio): Beleza, Seu Luiz vai receber o PDF de R$ 500,00. Quando ele responder eu te aviso. Valeu!
24. BOT: 🎧 Ouvi: "Beleza, Seu Luiz vai receber o PDF de R$ 500,00. Quando ele responder eu te aviso. Valeu!"
25. BOT: Valeu, Adriano! Quando ele responder, me avisa 👋
```

</details>

## consulta — Consultas: quais serviços eu tenho e quanto falta receber

Notas: entendimento 3 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 3 · sem_invencao 3 · eficiencia 2 · conclusao 3 · 66s


> O bot listou os serviços e acertou que a Dona Maria não tem nada fechado, mas passou a conversa tentando fechar um orçamento que ele não pediu. Na pergunta final sobre o total, deu uma resposta contraditória (não deve nada, mas sugere R$ 1.161,00) com jargão e uma estimativa baseada em dados vagos. Aceitou bem os 'não sei' no final, mas a consulta de quanto falta receber não ficou clara.

- [media] (fluxo_confuso) turno 3: Ele só pediu a lista e quanto a Dona Maria deve; o bot já puxou para montar o orçamento da cristaleira, sem ser pedido. Também ficou vago ao dizer 'ainda não tem valor', sem dizer claramente que deve R$ 0 ou que nada foi cobrado.
- [baixa] (pergunta_repetida) turno 12: Depois de ele dizer que não tem as medidas, o bot segue puxando perguntas de orçamento (por fora ou por dentro, pincel, busca e entrega) quando ele já sinalizou que passaria depois. Perguntas em sequência o empurram para um fluxo que ele não pediu.
- [alta] (inconsistencia) turno 21: Pergunta sobre o total e o bot responde que 'ela não deve nada' e ao mesmo tempo apresenta uma sugestão de R$ 1.161,00 sem ele ter fornecido medidas ou horas. Mistura conceitos confusos e contraditórios.
- [media] (jargao) turno 21: Usa 'prejuízo abaixo de R$ 945,00' e 'a sugestão dá', que são termos técnicos pouco naturais para o artesão. Botões de Concordo/Desconto/Acrescentar aparecem junto com uma pergunta de horas, o que é confuso.
- [media] (inventou) turno 21: Calculou valor e '5 dias de trabalho' a partir de tamanho 'médio, mais ou menos' e sem horas do conserto, tratando uma estimativa vaga como base firme.
- [baixa] (perdeu_informacao) turno 18: Não registrou o que ele disse sobre rolo não entrar em canto de móvel; o fato de a Dona Maria trazer a peça e a dúvida sobre devolução ficaram sem registro claro no resumo. Também tratou 'acho que pincel' como certeza.
- [baixa] (tom) turno 12: Respostas mecânicas e repetitivas ('Anotado ✅'), com pouca conversa de parceiro de oficina.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): Oi, tudo bem? Me fala aí quais serviços eu tenho anotados agora. E da Dona Maria, quanto ela ainda deve? Ela não pagou nada ainda.
2. BOT: 🎧 Ouvi: "Oi, tudo bem? Me fala aí quais serviços eu tenho anotados agora. E da Dona Maria, quanto ela ainda deve? Ela não pagou nada ainda."
3. BOT: Você tem estes serviços em orçamento:
- A cristaleira da Dona Maria (pátina)
- A mesa do Seu João (verniz)

Da Dona Maria, ainda não tem valor, porque o orçamento não foi fechado. Ela não pagou nada, então está tudo em aberto. 📋

Quer começar pelo orçamento da cristaleira? Me conta o estado dela.
4. ADRIANO (áudio): Beleza, então a cristaleira da Dona Maria tá com pátina e a mesa do Seu João é verniz, né? Só pra confirmar, a Dona Maria ainda não tem valor fechado, então por enquanto não tem o que cobrar. Pode deixar, depois eu passo o estado da cristaleira pra gente fechar o orçamento. Obrigado.
5. BOT: 🎧 Ouvi: "Beleza, então a cristaleira da Dona Maria tá com pátina e a mesa do Seu João é verniz, né? Só pra confirmar, a Dona Maria ainda não tem valor fechado, então por enquanto não tem o que cobrar. Pode deixar, depois eu passo o estado da cristaleira pra gente fechar o orçamento. Obrigado."
6. BOT: Isso mesmo: cristaleira da Dona Maria com pátina e mesa do Seu João com verniz ✅

Sem orçamento fechado, não tem o que cobrar da Dona Maria ainda. Quando quiser, me passa o estado da cristaleira que a gente fecha. 🪵
7. ADRIANO (áudio): Beleza, valeu. Então é isso mesmo. Depois eu passo o estado da cristaleira, que ela tá com umas partes soltas e o pé meio mole, aí a gente fecha o orçamento.
8. BOT: 🎧 Ouvi: "Beleza, valeu. Então é isso mesmo. Depois eu passo o estado da cristaleira, que ela tá com umas partes soltas e o pé meio mole, aí a gente fecha o orçamento."
9. BOT: Anotei: a cristaleira tem partes soltas e pé meio mole, então entra como reparo 🛠️

Pra fechar, me diz as medidas da cristaleira (altura, largura e fundura) ou se é pequena, média ou grande.
10. ADRIANO (áudio): Isso, as medidas eu não sei de cabeça agora, não tenho aqui na mão. Ela é uma cristaleira de tamanho médio, mais ou menos, e tem umas duas portas de vidro. Dá pra fechar com isso por enquanto?
11. BOT: 🎧 Ouvi: "Isso, as medidas eu não sei de cabeça agora, não tenho aqui na mão. Ela é uma cristaleira de tamanho médio, mais ou menos, e tem umas duas portas de vidro. Dá pra fechar com isso por enquanto?"
12. BOT: Dá pra seguir com o tamanho médio ✅ Ainda falta saber uma coisa: a pintura é só por fora ou por dentro também?
13. ADRIANO (áudio): Por fora e por dentro também, tudo pintado com pátina. As portas de vidro eu tiro pra lixar as bordas, mas isso é detalhe, pode deixar anotado. Quando eu tiver as medidas certinhas eu te falo.
14. BOT: 🎧 Ouvi: "Por fora e por dentro também, tudo pintado com pátina. As portas de vidro eu tiro pra lixar as bordas, mas isso é detalhe, pode deixar anotado. Quando eu tiver as medidas certinhas eu te falo."
15. BOT: Anotado: pátina por dentro e por fora, 2 portas de vidro, e o conserto das partes soltas e do pé ✅

Pra pátina, você usa pincel, rolo ou pistola?
16. ADRIANO (áudio): Pincel, acho que pincel mesmo. Pra pátina em canto de móvel rolo não entra direito. Anota aí também que as portas de vidro eu tiro pra lixar as bordas, isso tá anotado. Quando eu tiver as medidas certinhas eu te passo. Por enquanto é isso, valeu.
17. BOT: 🎧 Ouvi: "Pincel, acho que pincel mesmo. Pra pátina em canto de móvel rolo não entra direito. Anota aí também que as portas de vidro eu tiro pra lixar as bordas, isso tá anotado. Quando eu tiver as medidas certinhas eu te passo. Por enquanto é isso, valeu."
18. BOT: Anotado: pincel, pátina por dentro e por fora, e as portas de vidro saem pra lixar as bordas ✅

Falta só saber quem leva e traz a cristaleira: você busca e entrega, ou ela vem até você?
19. ADRIANO (áudio): Ela vem até mim, eu não busco. Mas é a Dona Maria que traz, não sei se ela vai levar de volta ou se eu entrego lá. Por enquanto deixa assim, depois eu vejo isso. Qual o total até agora? Quero saber quanto ela ainda deve, ela não pagou nada ainda.
20. BOT: 🎧 Ouvi: "Ela vem até mim, eu não busco. Mas é a Dona Maria que traz, não sei se ela vai levar de volta ou se eu entrego lá. Por enquanto deixa assim, depois eu vejo isso. Qual o total até agora? Quero saber quanto ela ainda deve, ela não pagou nada ainda."
21. BOT: Ainda não tem valor fechado, então ela não deve nada por enquanto. Pelo tamanho médio, a sugestão dá R$ 1.161,00 (uns 5 dias de trabalho), com prejuízo abaixo de R$ 945,00.

Antes de fechar, quantas horas você acha que leva o conserto das partes soltas e do pé? 🛠️
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
22. ADRIANO (áudio): Ah, então ela ainda não tem valor fechado. Não sei quantas horas leva o conserto ainda, preciso olhar a peça direito primeiro. Pode deixar isso em aberto por enquanto, depois eu vejo. Valeu.
23. BOT: 🎧 Ouvi: "Ah, então ela ainda não tem valor fechado. Não sei quantas horas leva o conserto ainda, preciso olhar a peça direito primeiro. Pode deixar isso em aberto por enquanto, depois eu vejo. Valeu."
24. BOT: Beleza, fica em aberto. Quando olhar a peça com calma, me passa as horas do conserto e as medidas. 🪵
```

</details>

## div-guarda-roupa-decape — Decapê num guarda-roupa grande, por dentro e por fora, com frete

Notas: entendimento 4 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 4 · sem_invencao 3 · eficiencia 4 · conclusao 5 · 76s

- ✅ peça anotada com o nome que ele usou
- ✅ chegou num valor
- ✅ PDF gerado
- ✅ sem travar nem falar de sistema

> Chegou ao valor e gerou o PDF com poucas trocas, e entendeu bem a fala dele. Mas as mensagens têm números demais, algum jargão ('prejuízo', 'sugestão'), e o resumo do turno 6 deixou de fora a hora de conserto da dobradiça. O valor mudou bastante entre as versões sem explicar direito. O fechamento promete registrar a resposta da cliente e confirma o prazo sem ele ter aparecido na proposta.

- [media] (perdeu_informacao) turno 6: O resumo omitiu a hora de conserto da dobradiça e o prazo. A hora de conserto não foi confirmada nem aparece depois explicitamente na conta.
- [baixa] (pergunta_repetida) turno 3: Pediu as medidas em cm e depois pediu foto, duas coisas na mesma mensagem. Ele disse em metros e a mensagem mistura unidades.
- [media] (inventou) turno 9: Disse que 'o decapê resolve' o pedaço estragado da lateral como se fosse fato, e não só palpite dele. Também sugeriu pincel como padrão, o que induz a resposta.
- [media] (jargao) turno 12: Usa 'sugestão', 'prejuízo' e 'ajustar o valor'; mostra valor antes de os materiais estarem completos. Fez a pergunta sobre tinta e thinner de forma confusa, e mudou o valor quase R$ 200 de uma vez sem explicar bem.
- [media] (fluxo_confuso) turno 18: O valor subiu de R$ 1.230 para R$ 1.410 com 3 litros (R$ 180) mas a explicação não bate de forma clara e diz 'com o frete incluso' só agora, sem ele ter perguntado. Ele havia dito que o removedor era uns 60 reais.
- [media] (inventou) turno 21: Disse 'quando ela responder, me avisa que eu registro' e que anotou o prazo, mas o prazo não foi confirmado no PDF nem aparece nas contas. Promete registro sem garantia.
- [baixa] (texto_longo) turno 12: Mensagem com muitos números (valor, mínimo, horas, dias) e markdown com asteriscos duplos.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): Fala, tudo bem? Então, é o seguinte: a dona Rita, cliente minha, quer fazer um decapê num guarda-roupa antigo dela. Ela quer deixar bonito, com a madeira aparecendo, sabe? Tô começando a ver o orçamento agora, mas queria te mostrar as medidas e o que ela quer. Posso falar?
2. BOT: 🎧 Ouvi: "Fala, tudo bem? Então, é o seguinte: a dona Rita, cliente minha, quer fazer um decapê num guarda-roupa antigo dela. Ela quer deixar bonito, com a madeira aparecendo, sabe? Tô começando a ver o orçamento agora, mas queria te mostrar as medidas e o que ela quer. Posso falar?"
3. BOT: Opa, pode falar sim! Anotei o guarda-roupa da Dona Rita para decapê ✅ Manda as medidas (altura, largura e fundura, em cm) quando puder. Se tiver foto, manda que ajuda 📸
4. ADRIANO (áudio): Beleza! Então é assim: o guarda-roupa tem 1,80 de altura, 1,20 de largura e 55 de fundura. Tem duas portas e três gavetas. Ela quer decapê por dentro e por fora, deixando a madeira aparecendo. Tem uma dobradiça solta que precisa consertar, uns 1 hora de serviço, acho. Eu que busco e entrego lá, o frete dá uns 80 reais. Ah, e começa daqui a um mês, e leva umas 2 semanas. Foto eu não tenho agora, depois eu vejo se consigo mandar.
5. BOT: 🎧 Ouvi: "Beleza! Então é assim: o guarda-roupa tem 1,80 de altura, 1,20 de largura e 55 de fundura. Tem duas portas e três gavetas. Ela quer decapê por dentro e por fora, deixando a madeira aparecendo. Tem uma dobradiça solta que precisa consertar, uns 1 hora de serviço, acho. Eu que busco e entrego lá, o frete dá uns 80 reais. Ah, e começa daqui a um mês, e leva umas 2 semanas. Foto eu não tenho agora, depois eu vejo se consigo mandar."
6. BOT: Anotei tudo: guarda-roupa de 1,80 x 1,20 x 0,55 m, 2 portas e 3 gavetas, decapê por dentro e por fora, dobradiça pra consertar e frete de R$ 80. ✅

Como está a madeira hoje: boa, com riscos, ou bem estragada?
7. ADRIANO (áudio): Ah, a madeira tá boa no geral, mas tem uns riscos e marca de uso nas portas. Nada muito grave, não tem cupim nem nada. Tem um pedaço da lateral que é um pouco mais estragado, mas acho que o decapê resolve. Ela quer deixar bem natural mesmo.
8. BOT: 🎧 Ouvi: "Ah, a madeira tá boa no geral, mas tem uns riscos e marca de uso nas portas. Nada muito grave, não tem cupim nem nada. Tem um pedaço da lateral que é um pouco mais estragado, mas acho que o decapê resolve. Ela quer deixar bem natural mesmo."
9. BOT: Anotei: madeira boa, com riscos e um pedaço da lateral mais estragado, e o decapê resolve ✅

Pra fechar a conta, você vai de pincel, rolo ou pistola? Se não souber, o pincel costuma ser o mais usado nesse tipo de trabalho.
10. ADRIANO (áudio): Ah, vou de pincel mesmo, tá tranquilo. Pra decapê geralmente uso pincel e uma lixada depois. E o removedor eu acho que uns 60 reais o litro, mas isso vc que calcula aí.
11. BOT: 🎧 Ouvi: "Ah, vou de pincel mesmo, tá tranquilo. Pra decapê geralmente uso pincel e uma lixada depois. E o removedor eu acho que uns 60 reais o litro, mas isso vc que calcula aí."
12. BOT: Pronto, a sugestão pro guarda-roupa da Dona Rita fica em **R$ 1.298,00** ✅ Abaixo de uns R$ 1.055 você fica no prejuízo. São umas 21 horas, cerca de 5 dias de trabalho.

A conta colocou tinta e thinner, mas pro decapê você não usa isso, certo? Me confirma pra eu ajustar o valor.
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
13. ADRIANO (áudio): Isso, não uso tinta nem thinner no decapê, é só removedor, pincel e lixa. Pode tirar essa parte aí. Aí fica o valor que você calculou?
14. BOT: 🎧 Ouvi: "Isso, não uso tinta nem thinner no decapê, é só removedor, pincel e lixa. Pode tirar essa parte aí. Aí fica o valor que você calculou?"
15. BOT: Pronto, tirei a tinta e o thinner. Sem eles, o valor fica em **R$ 1.230,00**, e abaixo de uns R$ 987 você fica no prejuízo.

O removedor não está na minha lista de materiais, então ainda não entrou na conta. Quantos litros você gasta nessa peça?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
16. ADRIANO (áudio): Ah, pra esse guarda-roupa acho que uns 3 litros de removedor. Ele tem muita superfície, por dentro e por fora, então gasta bastante. Pode colocar 3 litros aí.
17. BOT: 🎧 Ouvi: "Ah, pra esse guarda-roupa acho que uns 3 litros de removedor. Ele tem muita superfície, por dentro e por fora, então gasta bastante. Pode colocar 3 litros aí."
18. BOT: Anotei os 3 litros de removedor (R$ 180) e recalculei. Com o frete incluso, a sugestão pro guarda-roupa da Dona Rita fica em **R$ 1.410,00**. Abaixo de uns R$ 1.166 você fica no prejuízo.

Você concorda com esse valor, quer dar desconto ou acrescentar algo? 💰
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
19. ADRIANO: [tocou: 👍 Concordo]
20. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
21. BOT: Fechado! ✅ Orçamento da Dona Rita em **R$ 1.410,00** e o PDF já foi pra você aqui no Telegram pra repassar a ela.

Anotei também o prazo: começa daqui a um mês e leva umas 2 semanas. Quando ela responder, me avisa que eu registro. 👍
22. ADRIANO: Valeu! Tá bom, era isso mesmo. Vou repassar o PDF pra Dona Rita. Obrigado.
23. BOT: Valeu, Adriano! Boa sorte com a Dona Rita 👋
```

</details>

## div-estatua-folha-ouro — Folha de ouro numa estátua de santo (peça que não é móvel)

Notas: entendimento 4 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 3 · sem_invencao 4 · eficiencia 4 · conclusao 5 · 53s

- ✅ peça anotada com o nome que ele usou
- ✅ chegou num valor
- ✅ PDF gerado
- ✅ sem travar nem falar de sistema

> Chegou ao valor e ao PDF com poucas trocas e sem travar, mas há perguntas desnecessárias (foto, estado da peça já dito), valor sem explicar os materiais (ouro e cola) e linguagem de sistema no preço. O fechamento do prazo ficou um pouco redundante.

- [media] (pergunta_repetida) turno 3: Faz duas pedidos na mesma mensagem (horas e foto), e a foto é pedida sem necessidade, quebrando a regra de uma coisa por vez.
- [media] (jargao) turno 9: Apresenta o valor com 'Abaixo de R$ 241,00 você fica no prejuízo' e a pergunta tripla (tá bom, desconto ou acrescentar), tom de sistema e não de colega. Também não mostra como o valor foi calculado (hora, materiais), e o ouro e a cola mordente não entram na conta.
- [baixa] (fluxo_confuso) turno 6: Pergunta sobre o estado do resto da estátua depois de ele já ter dito que só o dedinho está lascado; pergunta algo que ele já tinha dito.
- [baixa] (tom) turno 3: Eco do áudio inteiro ('Ouvi') repetido a cada turno deixa a conversa longa e repetitiva.
- [media] (inventou) turno 15: Registra 'entrega lá pelo fim da segunda semana' e que 'começa essa semana' como datas anotadas e na sequência pergunta se registra o início, redundante; ele já tinha dito para registrar.
- [baixa] (fluxo_confuso) turno 18: Ele pediu para registrar que começa essa semana e o bot devolve a bola dizendo para avisar depois, sem deixar claro o que foi de fato registrado.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, tudo bem? Olha, chegou aqui um serviço do seu Jorge: uma estátua de madeira de Santo Antônio, uns 60 cm de altura. Ele quer folha de ouro só no manto, uma parte da imagem. Tem um dedinho lascado que tenho que arrumar com massa antes. Eu aplico com pincel. Ele busca daqui a 3 semanas. Bora fazer o orçamento?
2. BOT: 🎧 Ouvi: "E aí, tudo bem? Olha, chegou aqui um serviço do seu Jorge: uma estátua de madeira de Santo Antônio, uns 60 cm de altura. Ele quer folha de ouro só no manto, uma parte da imagem. Tem um dedinho lascado que tenho que arrumar com massa antes. Eu aplico com pincel. Ele busca daqui a 3 semanas. Bora fazer o orçamento?"
3. BOT: Anotei: estátua de Santo Antônio de 60 cm, folha de ouro só no manto, dedinho lascado pra arrumar com massa, pincel, e o Seu Jorge busca. 🪵

Como é uma peça fora do comum, quantas horas você acha que leva o trabalho todo?

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Acho que umas 6 horas, contando a massa no dedinho, o manto com a folha de ouro e a limpeza no final. Não tenho foto agora, mas depois eu mando se precisar.
5. BOT: 🎧 Ouvi: "Acho que umas 6 horas, contando a massa no dedinho, o manto com a folha de ouro e a limpeza no final. Não tenho foto agora, mas depois eu mando se precisar."
6. BOT: Anotei: 6 horas, contando a massa no dedinho, a folha de ouro no manto e a limpeza. ✅

Como tá o resto da estátua: está boa, precisa de reparos ou está bem danificada?
7. ADRIANO (áudio): Tá boa no geral, só esse dedinho lascado mesmo. O resto da madeira tá firme, sem trinca nem nada. Pode seguir com o orçamento.
8. BOT: 🎧 Ouvi: "Tá boa no geral, só esse dedinho lascado mesmo. O resto da madeira tá firme, sem trinca nem nada. Pode seguir com o orçamento."
9. BOT: Fechou: a estátua do Seu Jorge ficou em **R$ 312,00**, pelas 6 horas de trabalho. ⏱️

Abaixo de R$ 241,00 você fica no prejuízo. Tá bom pra você, ou quer dar um desconto ou acrescentar algo? 💰
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
10. ADRIANO: [tocou: 👍 Concordo]
11. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
12. BOT: Fechou! Te mandei o PDF aqui no Telegram pra você repassar ao Seu Jorge. 📄

Agora, quando você consegue começar essa estátua, e quando ela fica pronta pra ele?
13. ADRIANO (áudio): Ah, boa! Ele busca em 3 semanas, então eu consigo começar essa semana mesmo, sem pressa. Lá pelo fim da segunda semana ela tá pronta pra ele buscar, tá bom assim.
14. BOT: 🎧 Ouvi: "Ah, boa! Ele busca em 3 semanas, então eu consigo começar essa semana mesmo, sem pressa. Lá pelo fim da segunda semana ela tá pronta pra ele buscar, tá bom assim."
15. BOT: Anotado ✅ Você começa essa semana e entrega pro Seu Jorge lá pelo fim da segunda semana, antes da busca dele.

Quer que eu registre que o trabalho começou quando você der o pontapé?
16. ADRIANO (áudio): Isso mesmo, pode registrar que começo essa semana. Quando eu der o pontapé eu aviso. Obrigado!
17. BOT: 🎧 Ouvi: "Isso mesmo, pode registrar que começo essa semana. Quando eu der o pontapé eu aviso. Obrigado!"
18. BOT: Beleza, anotei ✅ Quando você der o pontapé, me avisa que eu registro como iniciado.
```

</details>

## div-faqueiro-veludo — Encapar faqueiro com veludo (trabalho que não é pintura)

Notas: entendimento 5 · naturalidade 4 · acessibilidade 4 · uma_pergunta_por_vez 4 · sem_invencao 4 · eficiencia 5 · conclusao 5 · 35s

- ✅ peça anotada com o nome que ele usou
- ✅ chegou num valor
- ✅ PDF gerado
- ✅ sem travar nem falar de sistema

> Conversa eficiente: entendeu tudo de primeira, chegou ao valor e gerou o PDF em poucas trocas, sem inventar nada. Pontos fracos: pergunta de conserto que ele já tinha respondido, aviso de prejuízo com tom técnico, pergunta dupla sobre início e entrega. Fechou bem, aceitando o 'não sei' sem insistir.

- [baixa] (pergunta_desnecessaria) turno 3: Perguntou se o faqueiro precisava de conserto, mas ele já tinha dito que por fora estava bom e não precisava mexer. Também acrescentou o pedido de foto na mesma mensagem.
- [media] (jargao) turno 5: Disse que abaixo de R$ 216,00 ele fica no prejuízo e apresentou o valor de forma mais técnica e fria do que um colega de oficina faria. Ainda juntou três opções (concordar, desconto, acrescentar) numa só pergunta.
- [baixa] (pergunta_dupla) turno 8: Perguntou duas coisas de uma vez: quando consegue começar e pra quando fica pronto, mesmo já sabendo que a entrega é semana que vem.
- [baixa] (tom) turno 10: Disse 'é só guardar' e 'me fala que eu anoto' com tom um pouco seco. Ainda assim não prometeu nada que não fez e respeitou o 'não sei'.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, beleza? Olha, a dona Lúcia me trouxe um faqueiro pra encapar por dentro com veludo vinho. É uma caixa de talheres de 40 por 30 cm e 8 de altura. Por fora tá bom, não precisa mexer. Eu acho que leva umas 4 horas. O veludo é meio metro, uns 35 reais, e a cola de contato uns 20. Ela traz e busca, e quer pra semana que vem. Dá pra você me ajudar a montar o orçamento?
2. BOT: 🎧 Ouvi: "E aí, beleza? Olha, a dona Lúcia me trouxe um faqueiro pra encapar por dentro com veludo vinho. É uma caixa de talheres de 40 por 30 cm e 8 de altura. Por fora tá bom, não precisa mexer. Eu acho que leva umas 4 horas. O veludo é meio metro, uns 35 reais, e a cola de contato uns 20. Ela traz e busca, e quer pra semana que vem. Dá pra você me ajudar a montar o orçamento?"
3. BOT: Anotei tudo: faqueiro da Dona Lúcia, encapar por dentro com veludo vinho, 4 h, veludo R$ 35 e cola R$ 20. Ela traz e busca, pra semana que vem ✅

Falta uma coisa: o faqueiro precisa de conserto ou só o forro?

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO: Só o forro mesmo, por fora tá bom, não precisa mexer. Pode fazer o orçamento assim.
5. BOT: Fechou, o faqueiro da Dona Lúcia ficou em R$ 263,00 (forro por dentro com veludo vinho, umas 4 horas, 1 dia de trabalho).

Abaixo de R$ 216,00 você fica no prejuízo. Concorda com esse valor, quer dar desconto ou acrescentar algo?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
6. ADRIANO: [tocou: 👍 Concordo]
7. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
8. BOT: Fechado em R$ 263,00 ✅ Te mandei o PDF aqui no Telegram pra você repassar à Dona Lúcia.

Quando você consegue começar o faqueiro, e pra quando fica pronto pra ela?
9. ADRIANO: Beleza, valeu! Olha, o início eu não sei ainda, depende de como ficar minha agenda essa semana. A entrega é pra semana que vem, então vou ver isso com a Dona Lúcia quando ela trouxer a caixa. Por enquanto só segura aí o PDF pra mim.
10. BOT: Anotado ✅ Início ainda sem data, entrega pra semana que vem. O PDF do faqueiro da Dona Lúcia já está aqui no Telegram, é só guardar.

Quando você souber como ficou a agenda, me fala que eu anoto.
```

</details>

## div-cadeiras-palhinha — 6 cadeiras: verniz + palhinha terceirizada

Notas: entendimento 3 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 4 · sem_invencao 2 · eficiencia 4 · conclusao 4 · 58s

- ✅ peça anotada com o nome que ele usou
- ✅ chegou num valor
- ✅ PDF gerado
- ✅ sem travar nem falar de sistema
- ✅ palhinha/terceirizado anotado

> Chegou a um valor e gerou o PDF, mas a explicação da conta da palhinha foi fraca e com número inconsistente (2.279 vs 2.179). Tratou o aceite condicional como fechamento e mandou o PDF cedo. Tom amigável e poucas trocas, mas há falhas de precisão e de resposta direta.

- [alta] (inventou) turno 9: Diz que o desconto de R$ 100 sai só do trabalho e do material e que a palhinha fica como está, e cita 'R$ 2.279' como total. Isso não foi calculado pelo sistema e mistura o valor antigo com o novo, o que confunde. Ele pediu a conta da palhinha separada (540 + 100 de frete + resto) e o bot não mostrou o valor do resto.
- [media] (nao_entendeu) turno 9: Não respondeu a pergunta direta 'o resto do trabalho fica com quanto?'. Faltou a divisão: 540 da palhinha, 100 de frete e o restante de trabalho e material.
- [alta] (fluxo_confuso) turno 13: Fechou e mandou o PDF sem confirmação clara. Ele disse 'pensa se não dá pra tirar um pouco mais' e só aceitaria 'se fechar nesses 2.179', o que foi tratado como aceite. O PDF saiu antes de ele confirmar de fato.
- [media] (jargao) turno 3: Fala em 'Sugestão', 'prejuízo' e 'material novo', e despeja vários números de uma vez. A mensagem fica pesada para quem lê por áudio e prefere conversa simples. Não mostra a palhinha incluída, que era o que ele pediu.
- [baixa] (inconsistencia) turno 6: Mínimo muda de R$ 1.923,00 para R$ 1.922,10 sem explicação, o que passa insegurança.
- [media] (inventou) turno 16: 'Anotei o prazo de entrega' e a leitura de que ele começa antes pela agenda: o prazo foi anotado, mas o bot não deixou claro o que exatamente guardou. A resposta ao 'fechou, né?' foi ok, mas a confirmação do PDF dependeu dele.
- [baixa] (tom) turno 13: Pergunta sobre o prazo logo após o fechamento, sendo que ele já tinha dito 'daqui a 2 meses'. Ele teve que esclarecer algo que o bot poderia ter entendido.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, beleza? Olha, a dona Neide me trouxe 6 cadeiras iguais pra envernizar. Só por fora, inteiras. E a palhinha do assento, eu não faço, mando pro Seu Zé, que cobra 90 reais por cadeira. Elas estão boas, só gastas. Pincel eu já tenho. Eu busco e entrego, frete 100 reais. Prazo é daqui a 2 meses. Cadeira normal, tamanho médio. Quero ver quanto fica com a palhinha incluída.
2. BOT: 🎧 Ouvi: "E aí, beleza? Olha, a dona Neide me trouxe 6 cadeiras iguais pra envernizar. Só por fora, inteiras. E a palhinha do assento, eu não faço, mando pro Seu Zé, que cobra 90 reais por cadeira. Elas estão boas, só gastas. Pincel eu já tenho. Eu busco e entrego, frete 100 reais. Prazo é daqui a 2 meses. Cadeira normal, tamanho médio. Quero ver quanto fica com a palhinha incluída."
3. BOT: Anotei tudo: 6 cadeiras da Dona Neide, verniz por fora, pincel, palhinha com o Seu Zé e frete de R$ 100 ✅

Sugestão: **R$ 2.279,00** pelas 6 cadeiras.
⚠️ Abaixo de R$ 1.923,00 você fica no prejuízo.
🛒 Material novo: uns R$ 601,00.
⏱️ Umas 30 horas, dá uns 7 dias de trabalho.

Você concorda, quer dar um desconto ou acrescentar algo?

📸 Se tiver foto da peça, manda que ajuda!
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
4. ADRIANO (áudio): Ah, não, o valor tá alto demais pra mim. Acho que a palhinha já tá sendo cobrada certinho, mas quero ver se dá pra baixar um pouco. Pensa aí mais uns 100 reais de desconto no total e me fala como ficou.
5. BOT: 🎧 Ouvi: "Ah, não, o valor tá alto demais pra mim. Acho que a palhinha já tá sendo cobrada certinho, mas quero ver se dá pra baixar um pouco. Pensa aí mais uns 100 reais de desconto no total e me fala como ficou."
6. BOT: Com R$ 100 de desconto, o total fica em **R$ 2.179,00** pelas 6 cadeiras. Ainda fica acima do mínimo de R$ 1.922,10, então não tem prejuízo. Fecha assim?
7. ADRIANO (áudio): Hmm, tá bom, mas eu queria ver a conta da palhinha separada. Se o Seu Zé cobra 90 por cadeira, são 540 só com ele, né? Então o resto do trabalho fica com quanto? Só pra eu entender onde entra o desconto.
8. BOT: 🎧 Ouvi: "Hmm, tá bom, mas eu queria ver a conta da palhinha separada. Se o Seu Zé cobra 90 por cadeira, são 540 só com ele, né? Então o resto do trabalho fica com quanto? Só pra eu entender onde entra o desconto."
9. BOT: Dá pra ver assim: a palhinha (R$ 90 por cadeira com o Seu Zé) e o frete de R$ 100 já estão dentro dos R$ 2.279. O desconto de R$ 100 sai só do seu trabalho e do material, e a palhinha fica como está. Fecha com esse desconto? 🤝
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
10. ADRIANO (áudio): Ah, entendi. Então a palhinha entra com 540 e o frete 100, e o resto é teu trabalho mais material. Pra mim tá ok, mas pensa se não dá pra tirar um pouco mais do teu lado, não da palhinha. Se fechar nesses 2.179, eu aceito.
11. BOT: 🎧 Ouvi: "Ah, entendi. Então a palhinha entra com 540 e o frete 100, e o resto é teu trabalho mais material. Pra mim tá ok, mas pensa se não dá pra tirar um pouco mais do teu lado, não da palhinha. Se fechar nesses 2.179, eu aceito."
12. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
13. BOT: Fechado: R$ 2.179,00 pelas 6 cadeiras da Dona Neide ✅ Te mandei o PDF aqui no Telegram pra você repassar.

Você falou em "daqui a 2 meses": é quando você começa, ou quando ficam prontas pra ela?
14. ADRIANO (áudio): Ah, então o que eu quis dizer é que o prazo de 2 meses é pra ficar pronto, entregue pra ela. Começo antes disso, depende da agenda, mas o prazo fechado é 2 meses pra entrega. E esse valor de 2.179 fechou, né? Só me confirma se o PDF chegou aí.
15. BOT: 🎧 Ouvi: "Ah, então o que eu quis dizer é que o prazo de 2 meses é pra ficar pronto, entregue pra ela. Começo antes disso, depende da agenda, mas o prazo fechado é 2 meses pra entrega. E esse valor de 2.179 fechou, né? Só me confirma se o PDF chegou aí."
16. BOT: Fechou o orçamento das seis cadeiras da Dona Neide ✅ O PDF saiu aqui no Telegram. Se não aparecer aí, me fala que eu mando de novo.

Anotei o prazo de entrega que você passou. Você começa antes, conforme a agenda. 🪑
17. ADRIANO (áudio): Chegou sim, Dona Neide e o PDF tão aqui, vou repassar pra ela. Obrigado, valeu!
18. BOT: 🎧 Ouvi: "Chegou sim, Dona Neide e o PDF tão aqui, vou repassar pra ela. Obrigado, valeu!"
19. BOT: Valeu! Boa sorte com as cadeiras da Dona Neide 🪑
```

</details>

## div-porta-macica — Porta de entrada maciça, dos dois lados, tirar verniz velho

Notas: entendimento 4 · naturalidade 4 · acessibilidade 4 · uma_pergunta_por_vez 5 · sem_invencao 3 · eficiencia 5 · conclusao 5 · 45s

- ✅ peça anotada com o nome que ele usou
- ✅ chegou num valor
- ✅ PDF gerado
- ✅ sem travar nem falar de sistema

> Conversa eficiente: em poucas trocas chegou ao valor e ao PDF, com uma pergunta por vez e linguagem simples. Pontos fracos: antecipou no turno 3 a busca da peça, sem Adriano ter dito, ignorou o detalhe dos cantinhos lascados, deixou de registrar que o cliente busca e leva de volta, e o aviso de prejuízo soa técnico. O fechamento 'Fechado!' é um pouco enganoso.

- [baixa] (inventou) turno 3: Disse que 'ele trouxe a peça e busca depois'. Adriano só disse que o Seu Paulo trouxe a porta; a busca e a volta só foram ditas no turno 4. Antecipou um fato.
- [baixa] (perdeu_informacao) turno 6: Não registrou que o Seu Paulo busca e leva de volta. O frete de 120 foi anotado, mas sem esse contexto.
- [media] (perdeu_informacao) turno 8: Os cantinhos com lascado leve, ditos no turno 7, não foram confirmados nem anotados. O bot foi direto para a conta, e o detalhe pode ter se perdido.
- [media] (jargao) turno 9: Frase 'Abaixo de uns R$ 1.500 você fica no prejuízo' é um piso de preço dito sem explicação. O texto 'Sugestão' e o aviso de prejuízo soam como o sistema decidindo valor. Faltou mostrar de onde veio a conta, e o formato com símbolos e negrito é um pouco técnico.
- [baixa] (texto_longo) turno 2: O eco do áudio repete a fala inteira, o que polui o chat sem necessidade.
- [baixa] (tom) turno 12: 'Fechado!' sugere negócio fechado com o cliente, mas só o orçamento foi aprovado por ele. Pode confundir.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, beleza? Olha, o seu Paulo me trouxe uma porta de entrada de madeira maciça, 2,10 de altura por 90 de largura. Ele quer tirar o verniz velho, que tá descascando, e envernizar de novo, dos dois lados. A madeira tá boa, só precisa de cuidado. Vou fazer o decapê e depois invernizar. Tenho que passar um valor pra ele, você me ajuda a montar o orçamento?
2. BOT: 🎧 Ouvi: "E aí, beleza? Olha, o seu Paulo me trouxe uma porta de entrada de madeira maciça, 2,10 de altura por 90 de largura. Ele quer tirar o verniz velho, que tá descascando, e envernizar de novo, dos dois lados. A madeira tá boa, só precisa de cuidado. Vou fazer o decapê e depois invernizar. Tenho que passar um valor pra ele, você me ajuda a montar o orçamento?"
3. BOT: Anotei: porta de entrada do Seu Paulo, 2,10 x 0,90 m, decapê e verniz por dentro e por fora. Ele trouxe a peça e busca depois.

Vai ser com pincel, rolo ou pistola? 🛠️

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Pincel. O verniz tá descascando, então vai ser decapê primeiro e depois duas demãos de verniz de cada lado. Ele busca e leva de volta, e o frete é 120. Prazo de uns 30 dias, daqui a 1 mês.
5. BOT: 🎧 Ouvi: "Pincel. O verniz tá descascando, então vai ser decapê primeiro e depois duas demãos de verniz de cada lado. Ele busca e leva de volta, e o frete é 120. Prazo de uns 30 dias, daqui a 1 mês."
6. BOT: Anotei: pincel, decapê e 2 demãos de verniz de cada lado, frete de R$ 120 e prazo de uns 30 dias.

A porta precisa de conserto, ou é só o decapê e o verniz? 🪵
7. ADRIANO (áudio): Ah, é só decapê e verniz mesmo. A madeira tá boa, não tem conserto. Só tem uns cantinhos com lascado de leve, mas nada que precise de madeira nova. Pode anotar aí.
8. BOT: 🎧 Ouvi: "Ah, é só decapê e verniz mesmo. A madeira tá boa, não tem conserto. Só tem uns cantinhos com lascado de leve, mas nada que precise de madeira nova. Pode anotar aí."
9. BOT: Fiz a conta da porta do Seu Paulo 🧮

💰 Sugestão: **R$ 1.816,00**
⚠️ Abaixo de uns R$ 1.500 você fica no prejuízo.
⏱️ Dá uns 6 dias de trabalho, dentro do prazo de 1 mês.

Você concorda, quer dar um desconto ou acrescentar algo?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
10. ADRIANO: [tocou: 👍 Concordo]
11. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
12. BOT: Fechado! ✅ Orçamento da porta do Seu Paulo em R$ 1.816,00.

Te mandei o PDF aqui no Telegram pra repassar pra ele. Quando ele responder, me avisa 📄
```

</details>

## div-oratorio-cupim — Oratório com cupim: restauração + pátina + detalhes em folha de ouro

Notas: entendimento 3 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 4 · sem_invencao 3 · eficiencia 3 · conclusao 5 · 71s

- ✅ peça anotada com o nome que ele usou
- ✅ chegou num valor
- ✅ PDF gerado
- ✅ sem travar nem falar de sistema

> Chegou no valor de R$ 850 e gerou o PDF, o objetivo foi atingido. Mas o caminho foi confuso: o preço subiu para R$ 997 depois do pedido de desconto, o bot repetiu pergunta de horas que ele já tinha respondido, e usou números quebrados e linguagem de prejuízo. Fechou respeitando a dúvida dele sobre a pátina, sem prometer o que não fez.

- [alta] (pergunta_repetida) turno 9: Perguntou o total de horas no geral, mesmo ele já ter dado cupim 3h, ouro 2h, pátina e nicho no turno 7. Pergunta redundante e vaga, com botões que não combinam.
- [alta] (nao_entendeu) turno 12: O valor subiu de R$ 790 para R$ 997 depois que ele pediu para baixar. Usou '5 horas, fora a pátina' sem esclarecer a pátina. Não explicou por que subiu, e deixou ele mais confuso.
- [media] (inventou) turno 3: Sugeriu R$ 790 e 5 dias de trabalho sem explicar de onde vieram. Ele havia dito só 3 horas de conserto, e o prazo de 1 mês não foi usado.
- [media] (jargao) turno 15: Fala de 'mínimo de R$ 794,56' e 'prejuízo', número quebrado que difere do R$ 795 do turno 12, parece incoerente e técnico demais.
- [media] (perdeu_informacao) turno 13: Ele disse que a pátina leva mais tempo e não sabe quanto. O bot não perguntou nem registrou essa dúvida antes de fechar, só tratou depois no fim.
- [baixa] (tom) turno 19: Fechou bem e avisou que ele pode ajustar a pátina depois. Mas 'Te mandei o PDF' e 'quando ela responder, me avisa' é correto; sem prometer. Faltou citar prazo e que ela traz e busca.
- [baixa] (nao_entendeu) turno 6: Perguntou horas da folha de ouro, mas ele já tinha dito que é 'mais rápido que isso', e a pergunta é razoável. Porém o valor não foi refeito até o turno 12.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, beleza? Olha, a dona Cida trouxe um oratório antigo pra mim, bem antigo mesmo, uns 50 de altura, 30 de largura e 20 de fundura. Só que tem cupim, então primeiro tem que tratar e restaurar. Acho que isso dá umas 3 horas de conserto. Depois é pátina por fora, e uns detalhes em folha de ouro nos frisos. Por dentro também, o nicho. Pincel mesmo. Ela traz e busca. Prazo é 1 mês. Quero ver quanto fica isso pra ela.
2. BOT: 🎧 Ouvi: "E aí, beleza? Olha, a dona Cida trouxe um oratório antigo pra mim, bem antigo mesmo, uns 50 de altura, 30 de largura e 20 de fundura. Só que tem cupim, então primeiro tem que tratar e restaurar. Acho que isso dá umas 3 horas de conserto. Depois é pátina por fora, e uns detalhes em folha de ouro nos frisos. Por dentro também, o nicho. Pincel mesmo. Ela traz e busca. Prazo é 1 mês. Quero ver quanto fica isso pra ela."
3. BOT: Anotei o oratório da Dona Cida, com cupim, pátina, folha de ouro e o nicho por dentro 🪵

💰 Minha sugestão: **R$ 790,00**
⚠️ Abaixo de R$ 635,00 você fica no prejuízo.
⏱️ Dá uns 5 dias de trabalho.

Você concorda, quer dar um desconto ou acrescentar algo?

📸 Se tiver foto da peça, manda que ajuda!
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
4. ADRIANO (áudio): Ah, achei alto esse valor. O cupim eu acho que dá umas 3 horas só, e a folha de ouro nos frisos é mais rápido que isso. Dá pra baixar um pouco? Não sei quanto, deixa eu pensar. Ela é cliente antiga, então quero ser justo com ela.
5. BOT: 🎧 Ouvi: "Ah, achei alto esse valor. O cupim eu acho que dá umas 3 horas só, e a folha de ouro nos frisos é mais rápido que isso. Dá pra baixar um pouco? Não sei quanto, deixa eu pensar. Ela é cliente antiga, então quero ser justo com ela."
6. BOT: Entendi, vamos ser justos com a Dona Cida 🤝

Quanto tempo você acha que leva só a folha de ouro nos frisos? Se me passar as horas, eu refaço a conta certinha.
7. ADRIANO (áudio): Acho que a folha de ouro nos frisos leva umas 2 horas, mais ou menos. Ainda não tenho certeza, depois eu confiro. Refaz a conta com isso aí, por favor. O resto fica como estava: cupim 3 horas, pátina e o nicho por dentro.
8. BOT: 🎧 Ouvi: "Acho que a folha de ouro nos frisos leva umas 2 horas, mais ou menos. Ainda não tenho certeza, depois eu confiro. Refaz a conta com isso aí, por favor. O resto fica como estava: cupim 3 horas, pátina e o nicho por dentro."
9. BOT: Pra acertar o valor do oratório da Dona Cida, quantas horas no total você acha que leva o trabalho todo? 🪵
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
10. ADRIANO (áudio): Cupim 3 horas, folha de ouro 2 horas, pátina e o nicho por dentro. Dá umas 5 horas, mais ou menos, fora a pátina. Pode refazer a conta com isso.
11. BOT: 🎧 Ouvi: "Cupim 3 horas, folha de ouro 2 horas, pátina e o nicho por dentro. Dá umas 5 horas, mais ou menos, fora a pátina. Pode refazer a conta com isso."
12. BOT: Pelas horas que você passou, a sugestão ficou em **R$ 997,00**.

⚠️ Abaixo de R$ 795,00 você fica no prejuízo.
⏱️ Dá uns 5 dias de trabalho.

Quer manter esse valor ou prefere ajustar algo?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
13. ADRIANO (áudio): Ah, peraí. Eu falei 5 horas, mas esqueci de contar a pátina, que leva mais um tempo. Então o total fica uns 5 dias mesmo, mas o valor de 997 eu acho que tá alto pra Dona Cida. Ela é cliente antiga. Dá pra fazer uns 850 mais ou menos? Não tenho certeza, quero ver você conta isso direito pra mim.
14. BOT: 🎧 Ouvi: "Ah, peraí. Eu falei 5 horas, mas esqueci de contar a pátina, que leva mais um tempo. Então o total fica uns 5 dias mesmo, mas o valor de 997 eu acho que tá alto pra Dona Cida. Ela é cliente antiga. Dá pra fazer uns 850 mais ou menos? Não tenho certeza, quero ver você conta isso direito pra mim."
15. BOT: Fazendo a conta: de R$ 997,00 para R$ 850,00 dá um desconto de R$ 147,00. Esse valor fica acima do mínimo de R$ 794,56, então não tem prejuízo 👍

Fecha o oratório da Dona Cida em R$ 850,00?
16. ADRIANO (áudio): Fecha sim, mas antes uma coisa: eu não tenho certeza se o total de horas tá certo, porque a pátina eu não sei quanto leva. Então deixa o valor de 850 como está e eu confiro depois com você. Pode fechar em 850 pra Dona Cida.
17. BOT: 🎧 Ouvi: "Fecha sim, mas antes uma coisa: eu não tenho certeza se o total de horas tá certo, porque a pátina eu não sei quanto leva. Então deixa o valor de 850 como está e eu confiro depois com você. Pode fechar em 850 pra Dona Cida."
18. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
19. BOT: Fechado: o oratório da Dona Cida em R$ 850,00 ✅ Te mandei o PDF aqui no Telegram.

Quando você conferir as horas da pátina, me fala que a gente ajusta. Quando a Dona Cida responder, me avisa.
```

</details>

## div-bandeja-flores — Pintura artística à mão numa bandeja (técnica fora da lista)

Notas: entendimento 5 · naturalidade 4 · acessibilidade 4 · uma_pergunta_por_vez 4 · sem_invencao 4 · eficiencia 5 · conclusao 5 · 51s

- ✅ peça anotada com o nome que ele usou
- ✅ chegou num valor
- ✅ PDF gerado
- ✅ sem travar nem falar de sistema

> Conversa chegou ao valor e ao PDF com poucas trocas, sem perder detalhes e sem inventar nada relevante. Pontos fracos: jargão de preço mínimo/prejuízo no orçamento, perguntas duplas em alguns turnos e leve insistência em pedir a data de início no final.

- [baixa] (pergunta_dupla) turno 3: Faz a pergunta do estado da peça e ainda pede foto na mesma mensagem, são dois pedidos juntos.
- [media] (jargao) turno 9: Usa 'sugestão' e 'abaixo de R$ 231,00 você fica no prejuízo', linguagem de margem/piso. Também não explica como chegou ao valor (mão de obra, verniz).
- [baixa] (fluxo_confuso) turno 12: Pergunta 'quando começa e pra quando fica pronto' são duas perguntas numa só, ainda que ele já tivesse dito o prazo de 10 dias.
- [baixa] (tom) turno 15: Registra 'começa essa semana' como fato e reforça pedido de data depois de ele já ter dito que avisa, leve insistência. Mensagem um pouco longa para o contexto.
- [baixa] (suposicao) turno 6: Sugere 'pincel' por conta própria, embora o artesão já tivesse dito 'pintadas à mão'. Foi confirmado, sem dano.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, tudo bem? Fala, a dona Bete me pediu uma bandeja de madeira, 45 por 30 cm. Ela quer o fundo branco e umas flores pintadas à mão, pintura artística mesmo. Acho que dá umas 5 horas por causa dos detalhes. A tinta acrílica eu já tenho, só falta um verniz spray de uns 30 reais. Ela traz e busca, e precisa ficar pronta em 10 dias. Dá pra fazer um orçamento com isso?
2. BOT: 🎧 Ouvi: "E aí, tudo bem? Fala, a dona Bete me pediu uma bandeja de madeira, 45 por 30 cm. Ela quer o fundo branco e umas flores pintadas à mão, pintura artística mesmo. Acho que dá umas 5 horas por causa dos detalhes. A tinta acrílica eu já tenho, só falta um verniz spray de uns 30 reais. Ela traz e busca, e precisa ficar pronta em 10 dias. Dá pra fazer um orçamento com isso?"
3. BOT: Anotei a bandeja da Dona Bete: 45 por 30 cm, fundo branco e flores pintadas à mão (5 h), com o verniz spray de R$ 30. Ela traz e busca, e fica pronta em 10 dias. 🎨

Como está a bandeja hoje? Está boa, com reparos ou danificada?

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Ah, ela tá boa, só precisa de limpeza leve e um lixadinha nas bordas. Não tem defeito nem reparo. Foto eu mando depois, agora tô no celular de lado, então deixa assim.
5. BOT: 🎧 Ouvi: "Ah, ela tá boa, só precisa de limpeza leve e um lixadinha nas bordas. Não tem defeito nem reparo. Foto eu mando depois, agora tô no celular de lado, então deixa assim."
6. BOT: Anotei: limpeza leve, lixar as bordas, sem conserto. Pra pintar as flores, acho que é pincel. Pode ser assim? 🖌️
7. ADRIANO (áudio): Isso mesmo, pincel. Pode ser assim. Ah, e a tinta é a acrílica que eu já tenho, então não entra na conta. O verniz spray é os 30 reais que falei. Tá certo?
8. BOT: 🎧 Ouvi: "Isso mesmo, pincel. Pode ser assim. Ah, e a tinta é a acrílica que eu já tenho, então não entra na conta. O verniz spray é os 30 reais que falei. Tá certo?"
9. BOT: Fiz a conta da bandeja da Dona Bete: 💰 sugestão de R$ 290,00. Abaixo de R$ 231,00 você fica no prejuízo. São umas 5 horas, cerca de 1 dia de trabalho.

Você concorda, quer dar um desconto ou acrescentar algo?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
10. ADRIANO: [tocou: 👍 Concordo]
11. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
12. BOT: Fechou ✅ Te mandei o PDF aqui, de R$ 290,00 pra bandeja da Dona Bete.

Quando você consegue começar, e pra quando fica pronto pra ela?
13. ADRIANO (áudio): Beleza, valeu! Começo essa semana, então fica pronto dentro dos 10 dias que ela pediu. Deixa eu ver a agenda e te falo certinho depois.
14. BOT: 🎧 Ouvi: "Beleza, valeu! Começo essa semana, então fica pronto dentro dos 10 dias que ela pediu. Deixa eu ver a agenda e te falo certinho depois."
15. BOT: Anotado: começa essa semana e fica pronto em até 10 dias, como a Dona Bete pediu. 📅

Quando a agenda estiver certinha, me fala a data de início, se quiser. O orçamento já está fechado, com o PDF aqui.
16. ADRIANO (áudio): Beleza, então tá combinado. Quando eu souber a data certinha, te falo. Valeu!
17. BOT: 🎧 Ouvi: "Beleza, então tá combinado. Quando eu souber a data certinha, te falo. Valeu!"
18. BOT: Valeu, Adriano! Quando souber a data, é só me falar. Bom trabalho na bandeja 👋
```

</details>

## div-comoda-puxadores — Cômoda: pintura lisa + troca de puxadores comprados

Notas: entendimento 3 · naturalidade 4 · acessibilidade 4 · uma_pergunta_por_vez 4 · sem_invencao 3 · eficiencia 3 · conclusao 5 · 67s

- ✅ peça anotada com o nome que ele usou
- ✅ chegou num valor
- ✅ PDF gerado
- ✅ sem travar nem falar de sistema
- ✅ puxadores anotados

> Objetivo atingido: valor de R$ 520 com puxadores separados e PDF enviado em poucas trocas. Porém o bot confundiu preço unitário e total dos puxadores, não separou o valor logo no início e perguntou 'Ela fecha assim?', o que fez Adriano repetir o que já tinha dito. No fim, tratou o prazo de 3 semanas como compromisso. O tom ficou razoável, mas com um toque técnico no preço mínimo.

- [alta] (erro_de_dado) turno 3: Anotou '8 puxadores a R$ 120', misturando preço unitário com total. Ele disse R$ 15 cada, 120 no total, e a anotação sugere cada puxador a 120.
- [alta] (nao_entendeu) turno 6: A sugestão de R$ 400 saiu com a troca dos puxadores 'anotada' como se estivesse incluída. Ele já tinha dito que queria cobrar os puxadores à parte, e o bot não separou o valor desde o início.
- [alta] (nao_entendeu) turno 9: Disse 'Feito' e somou 400 + 120 = 520, mas ele tinha dito que os 400 eram só a pintura. Depois perguntou 'Ela fecha assim?', pergunta que não faz sentido (quem decide é ele), e com botões de desconto que não cabiam. Forçou Adriano a repetir a explicação no turno 10.
- [media] (jargao) turno 6: 'Abaixo de R$ 345,54 você fica no prejuízo' e 'Sugestão' soam técnicos; o valor com centavos quebrados também. Falta o tom de colega de oficina.
- [media] (inventou) turno 16: Disse que a cômoda 'fica pronta em 3 semanas' como se fosse prazo confirmado, mas o prazo é do cliente e ele só vai começar depois da confirmação. Soa como compromisso.
- [baixa] (pergunta_repetida) turno 13: Perguntou 'Quando você começa o trabalho?' na mesma mensagem em que pede para avisar quando a cliente responder, o que resulta em duas solicitações. Ele respondeu de forma vaga e foi aceito sem problema.
- [baixa] (texto_longo) turno 3: O eco do áudio inteiro repetido em toda mensagem ('Ouvi') pesa a conversa, principalmente com falas longas.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, beleza? Então, é uma cômoda da dona Vera, de 4 gavetas, 90 de largura, 80 de altura e 45 de fundura. Ela quer pintar de branco liso, só por fora, a peça tá boa. Vou pintar no rolo. E ela quer trocar os puxadores também, os 8. Eu compro os puxadores novos a 15 reais cada, dá 120 no total, e quero cobrar isso junto. Ela traz e busca. Prazo é daqui a 3 semanas. Dá pra fazer o orçamento com isso aí?
2. BOT: 🎧 Ouvi: "E aí, beleza? Então, é uma cômoda da dona Vera, de 4 gavetas, 90 de largura, 80 de altura e 45 de fundura. Ela quer pintar de branco liso, só por fora, a peça tá boa. Vou pintar no rolo. E ela quer trocar os puxadores também, os 8. Eu compro os puxadores novos a 15 reais cada, dá 120 no total, e quero cobrar isso junto. Ela traz e busca. Prazo é daqui a 3 semanas. Dá pra fazer o orçamento com isso aí?"
3. BOT: Anotei: cômoda da Dona Vera, 4 gavetas, 90 x 80 x 45, pintura branca lisa só por fora no rolo, 8 puxadores a R$ 120 e prazo de 3 semanas 🎨

A peça precisa de algum conserto?

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Não, a peça tá boa, só precisa pintar mesmo. Só tiro o velho e lixo de leve pra pintura pegar. Sem conserto.
5. BOT: 🎧 Ouvi: "Não, a peça tá boa, só precisa pintar mesmo. Só tiro o velho e lixo de leve pra pintura pegar. Sem conserto."
6. BOT: Tudo anotado: cômoda da Dona Vera, sem conserto, pintura branca no rolo e troca dos 8 puxadores.

Sugestão: R$ 400,00. Abaixo de R$ 345,54 você fica no prejuízo. Dá uns 2 dias de trabalho.

Você concorda com esse valor ou quer dar um desconto?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
7. ADRIANO (áudio): Ó, o valor de 400 tá bom pra mim, mas quero que os puxadores fiquem cobrados à parte, de 120 reais, e não dentro dos 400. Eu compro eles e ela só paga o que é meu. Pode ajustar isso aí?
8. BOT: 🎧 Ouvi: "Ó, o valor de 400 tá bom pra mim, mas quero que os puxadores fiquem cobrados à parte, de 120 reais, e não dentro dos 400. Eu compro eles e ela só paga o que é meu. Pode ajustar isso aí?"
9. BOT: Feito: os 8 puxadores ficam separados, a R$ 120. Pelo total, fica R$ 400 + R$ 120 = **R$ 520,00** 💰

Ela fecha assim?
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
10. ADRIANO (áudio): Não, não. O valor de 400 é só a pintura e o serviço. Os puxadores ficam separados, 120 reais, como eu falei. Então pode fechar assim, 400 mais 120, total 520. Pode mandar o PDF pra eu passar pra ela.
11. BOT: 🎧 Ouvi: "Não, não. O valor de 400 é só a pintura e o serviço. Os puxadores ficam separados, 120 reais, como eu falei. Então pode fechar assim, 400 mais 120, total 520. Pode mandar o PDF pra eu passar pra ela."
12. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
13. BOT: Fechado: R$ 400 da pintura + R$ 120 dos puxadores, total R$ 520 📄

Te mandei o PDF aqui pra você passar pra Dona Vera. Quando ela responder, me avisa. Quando você começa o trabalho?
14. ADRIANO (áudio): Beleza, recebi o PDF. Vou passar pra Dona Vera. Começo daqui a uns dias, depois que ela confirmar. Obrigado.
15. BOT: 🎧 Ouvi: "Beleza, recebi o PDF. Vou passar pra Dona Vera. Começo daqui a uns dias, depois que ela confirmar. Obrigado."
16. BOT: Anotado: a cômoda da Dona Vera começa depois que ela confirmar e fica pronta em 3 semanas ✅

Assim que ela responder, me conta que eu anoto o resultado.
```

</details>

## div-banco-jardim — Banco de jardim (fica no tempo) com verniz marítimo

Notas: entendimento 4 · naturalidade 3 · acessibilidade 4 · uma_pergunta_por_vez 4 · sem_invencao 3 · eficiencia 4 · conclusao 5 · 49s

- ✅ peça anotada com o nome que ele usou
- ✅ chegou num valor
- ✅ PDF gerado
- ✅ sem travar nem falar de sistema

> Chegou ao valor de R$ 412 e gerou o PDF com poucas trocas, e a confirmação do frete incluso foi correta. Pontos fracos: o aviso de prejuízo abaixo de R$ 350, a pergunta dupla sobre início e prazo que ele já tinha dado, 'está no prazo' dito sem base e despedidas repetitivas no final.

- [media] (decidiu_dinheiro) turno 6: Informa que abaixo de R$ 350 ele fica no prejuízo, um piso que ele não pediu. Soa como jargão de margem e pressiona o valor.
- [media] (pergunta_dupla) turno 9: Pergunta duas coisas juntas: quando consegue começar e quando fica pronto. Já sabia o prazo de 2 semanas, então a segunda parte repete o que ele disse.
- [baixa] (tom) turno 3: Repete todo o resumo dos fatos de volta, mais longo que o necessário, depois de o áudio já ter sido transcrito.
- [media] (inventou) turno 12: Diz 'está no prazo' e anota 'começa essa semana' como data, sem data concreta de início. A confirmação é vaga e comenta o prazo sem base.
- [baixa] (tom) turno 18: Despedidas repetitivas e quase idênticas (turnos 18, 21, 24). Ele continuou agradecendo e o bot respondeu igual, sem encerrar de forma natural.
- [baixa] (nao_entendeu) turno 22: O bot não notou que o 'Valeu, Adriano!' do usuário ficou estranho (talvez transcrição) e seguiu sem problema, mas não houve nenhuma checagem.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, tudo bem? Olha, o seu Antônio me pediu pra envernizar um banco de madeira de jardim. Ele fica exposto no sol e na chuva, então queria verniz marítimo mesmo. Tá meio cinza do tempo, precisa lixar bem, mas não tem conserto não. O banco tem 1,50 de comprimento, 45 de fundura e 85 de altura com o encosto. Ele busca e entrega, o frete eu passo 70. Ele quer pronto daqui a 2 semanas. Dá pra você me ajudar a fechar um orçamento?
2. BOT: 🎧 Ouvi: "E aí, tudo bem? Olha, o seu Antônio me pediu pra envernizar um banco de madeira de jardim. Ele fica exposto no sol e na chuva, então queria verniz marítimo mesmo. Tá meio cinza do tempo, precisa lixar bem, mas não tem conserto não. O banco tem 1,50 de comprimento, 45 de fundura e 85 de altura com o encosto. Ele busca e entrega, o frete eu passo 70. Ele quer pronto daqui a 2 semanas. Dá pra você me ajudar a fechar um orçamento?"
3. BOT: Anotei o banco do Seu Antônio: verniz marítimo, lixar bem, sem conserto, você busca e entrega com frete de R$ 70 e fica pronto em 2 semanas 🪵

Você vai aplicar com pincel, rolo ou pistola?

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Pincel. Pode ser pincel mesmo, que é do jeito que eu faço. Não tenho foto agora, depois se precisar eu mando. Tá bom assim.
5. BOT: 🎧 Ouvi: "Pincel. Pode ser pincel mesmo, que é do jeito que eu faço. Não tenho foto agora, depois se precisar eu mando. Tá bom assim."
6. BOT: Fiz a conta do banco do Seu Antônio: sugestão de **R$ 412,00**, incluindo o frete de R$ 70. Abaixo de R$ 350 você fica no prejuízo. São uns 2 dias de trabalho, pronto em 2 semanas.

Você concorda com esse valor ou quer dar um desconto? 🤝
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
7. ADRIANO: [tocou: 👍 Concordo]
8. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
9. BOT: Fechou o banco do Seu Antônio por R$ 412,00 ✅ Te mandei o PDF aqui.

Quando você consegue começar, e quando fica pronto pro cliente?
10. ADRIANO (áudio): Beleza, valeu! Começo essa semana. Fica pronto em 2 semanas, então entrego pro seu Antônio no dia que a gente combinou. Qualquer coisa eu te falo.
11. BOT: 🎧 Ouvi: "Beleza, valeu! Começo essa semana. Fica pronto em 2 semanas, então entrego pro seu Antônio no dia que a gente combinou. Qualquer coisa eu te falo."
12. BOT: Anotado: começa essa semana e fica pronto em 2 semanas ✅ Boa, o banco do Seu Antônio está no prazo.
13. ADRIANO (áudio): Beleza! Só uma coisa: esse valor de 412 já tá fechado com o frete de 70 incluso, né? E a data que eu te falei, de entregar pro seu Antônio em 2 semanas, pode deixar anotada. Obrigado!
14. BOT: 🎧 Ouvi: "Beleza! Só uma coisa: esse valor de 412 já tá fechado com o frete de 70 incluso, né? E a data que eu te falei, de entregar pro seu Antônio em 2 semanas, pode deixar anotada. Obrigado!"
15. BOT: Isso, o R$ 412,00 já tem os R$ 70 de frete dentro ✅ E a entrega em 2 semanas já está anotada no banco do Seu Antônio. Valeu, Adriano! 🪵
16. ADRIANO (áudio): Isso mesmo, valeu! Era isso que eu queria confirmar. Então tá fechado. Obrigado, qualquer coisa eu falo.
17. BOT: 🎧 Ouvi: "Isso mesmo, valeu! Era isso que eu queria confirmar. Então tá fechado. Obrigado, qualquer coisa eu falo."
18. BOT: Valeu, Adriano! Qualquer coisa é só chamar 🪵👋
19. ADRIANO (áudio): Valeu! Tá tudo fechado então: banco do Seu Antônio, R$ 412,00 com o frete de 70 dentro, pronto em 2 semanas. Qualquer coisa eu chamo.
20. BOT: 🎧 Ouvi: "Valeu! Tá tudo fechado então: banco do Seu Antônio, R$ 412,00 com o frete de 70 dentro, pronto em 2 semanas. Qualquer coisa eu chamo."
21. BOT: Show, Adriano! Qualquer coisa é só chamar 🪵👋
22. ADRIANO (áudio): Valeu, Adriano! Tá tudo certo mesmo. Qualquer coisa eu chamo. Obrigado!
23. BOT: 🎧 Ouvi: "Valeu, Adriano! Tá tudo certo mesmo. Qualquer coisa eu chamo. Obrigado!"
24. BOT: Valeu, Adriano! Boa sorte com o banco do Seu Antônio 🪵👋
```

</details>

## div-bau-e-espelho — Duas peças diferentes: baú (pátina) e moldura de espelho redonda (folha de ouro)

Notas: entendimento 4 · naturalidade 4 · acessibilidade 4 · uma_pergunta_por_vez 4 · sem_invencao 3 · eficiencia 4 · conclusao 5 · 68s

- ✅ peça anotada com o nome que ele usou
- ✅ chegou num valor
- ✅ PDF gerado
- ✅ sem travar nem falar de sistema
- ✅ moldura anotada

> Conversa chegou ao objetivo: duas peças anotadas, valor de R$ 2.200 fechado a pedido do Adriano, PDF enviado, prazo e sinal registrados. Pontos fracos: o piso aparece com números diferentes (2.070 e 2.069,07), há termos como 'sugerido' e 'prejuízo' sem explicação, e o bot não confirmou o detalhe da folha de ouro (frente, dentro da borda, fundo cru) antes das contas. A resposta ao pedido de 2 mil foi um pouco seca, mas a conversa fluiu em poucas trocas.

- [baixa] (tom) turno 3: Pergunta sobre conserto e pedido de foto na mesma mensagem; o pedido de foto vira uma segunda solicitação.
- [media] (jargao) turno 9: Fala em 'valor sugerido' e 'fica no prejuízo' com valor de piso sem explicar de onde vem. O piso aparece como R$ 2.070,00 e depois como R$ 2.069,07, o que confunde.
- [media] (perdeu_informacao) turno 9: Adriano disse que a folha de ouro vai na frente e dentro da borda e que o fundo é madeira crua. O bot não confirmou o que anotou antes de fazer as contas e passou direto aos valores.
- [media] (fluxo_confuso) turno 12: Ao ouvir '2 mil' o bot recusa e pergunta se fecha mesmo assim ou sobe, sem sugerir um número. Adriano já tinha pedido para baixar, e a resposta foi ríspida ('abaixo do que você precisa'). O bot também não mostrou quanto seria o mínimo.
- [baixa] (pergunta_repetida) turno 15: Número do mínimo (2.069,07) difere do que foi dito antes (2.070,00), inconsistência de valores.
- [media] (inventou) turno 18: Diz que o PDF foi enviado e fechou o valor depois de um 'Concordo' escrito, mas o 'Concordo' respondia à pergunta sobre fechar em 2.200. Aceitável, porém o PDF mostra versão v1 sem explicar como os R$ 2.200 foram divididos entre as peças.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, tudo bem? Então, uma cliente nova, dona Fátima. Ela tem um baú pra fazer pátina azul envelhecida, 80 x 45 x 50 de altura, por dentro e por fora. Tá em bom estado, é só pincel. E tem uma moldura de espelho redonda, 80 cm de diâmetro, com folha de ouro na moldura toda, também em bom estado, pincel. Ela traz e busca as duas. Ela quer as duas daqui a 1 mês. Dá pra você me ajudar a montar o orçamento?
2. BOT: 🎧 Ouvi: "E aí, tudo bem? Então, uma cliente nova, dona Fátima. Ela tem um baú pra fazer pátina azul envelhecida, 80 x 45 x 50 de altura, por dentro e por fora. Tá em bom estado, é só pincel. E tem uma moldura de espelho redonda, 80 cm de diâmetro, com folha de ouro na moldura toda, também em bom estado, pincel. Ela traz e busca as duas. Ela quer as duas daqui a 1 mês. Dá pra você me ajudar a montar o orçamento?"
3. BOT: Anotei as duas peças da Dona Fátima ✅ O baú com pátina azul por dentro e por fora, e a moldura redonda de 80 cm com folha de ouro. As duas com pincel, ela traz e busca.

Alguma delas precisa de conserto?

📸 Se tiver foto da peça, manda que ajuda!
4. ADRIANO (áudio): Não, nenhuma precisa de conserto. Tá tudo bom, só pátina e pincel mesmo. Foto eu não tenho agora, depois eu mando se precisar.
5. BOT: 🎧 Ouvi: "Não, nenhuma precisa de conserto. Tá tudo bom, só pátina e pincel mesmo. Foto eu não tenho agora, depois eu mando se precisar."
6. BOT: Anotei: nenhuma das duas precisa de conserto, só pátina e pincel. ✅

Uma coisa: na moldura, a folha de ouro é só por fora ou também por dentro?
7. ADRIANO (áudio): Na moldura é a folha de ouro na frente toda, por dentro da borda também. Só que a parte de trás não tem nada, é madeira crua mesmo. Pode anotar assim.
8. BOT: 🎧 Ouvi: "Na moldura é a folha de ouro na frente toda, por dentro da borda também. Só que a parte de trás não tem nada, é madeira crua mesmo. Pode anotar assim."
9. BOT: Pronto, fiz as contas das duas peças da Dona Fátima:

• O baú: R$ 490,00 (3 dias de trabalho)
• A moldura: R$ 2.013,00 (6 dias de trabalho)

💰 Total sugerido: R$ 2.503,00. Abaixo de R$ 2.070,00 você fica no prejuízo.

Você concorda com esse valor, quer dar desconto ou acrescentar algo? 🤝
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
10. ADRIANO (áudio): Ah, o valor tá alto pra minha conta. Acho que a moldura com folha de ouro tá cara demais, eu cobro mais barato em outras. Quer baixar um pouco, tipo uns 2 mil no total mesmo, e eu fecho com ela.
11. BOT: 🎧 Ouvi: "Ah, o valor tá alto pra minha conta. Acho que a moldura com folha de ouro tá cara demais, eu cobro mais barato em outras. Quer baixar um pouco, tipo uns 2 mil no total mesmo, e eu fecho com ela."
12. BOT: Esse valor de 2 mil fica abaixo do que você precisa pra não ter prejuízo. 😬

Quer fechar em 2 mil mesmo assim, ou prefere um valor um pouco acima?
13. ADRIANO (áudio): Ah, entendi. Então não fecha em 2 mil, né. Me deixa pensar nisso. Sobe um pouco aí, tipo uns 2.200? Acho que dá pra ela pagar isso, a moldura é trabalhosa mesmo, mas se não der eu vejo com ela.
14. BOT: 🎧 Ouvi: "Ah, entendi. Então não fecha em 2 mil, né. Me deixa pensar nisso. Sobe um pouco aí, tipo uns 2.200? Acho que dá pra ela pagar isso, a moldura é trabalhosa mesmo, mas se não der eu vejo com ela."
15. BOT: Com R$ 2.200,00 você fica acima do mínimo, que é R$ 2.069,07. ✅

Dá pra fechar assim: o total das duas peças fica em R$ 2.200,00. Quer que eu feche nesse valor?
16. ADRIANO: Concordo
17. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
18. BOT: Fechado em R$ 2.200,00 pras duas peças da Dona Fátima ✅ Te mandei o PDF aqui no Telegram pra você repassar a ela.

Quando você consegue começar e quando fica pronto pra ela?
19. ADRIANO (áudio): Ah, valeu. As duas ficam prontas daqui a 1 mês. Pode colocar esse prazo aí pra ela. Começo quando ela deixar as peças aqui.
20. BOT: 🎧 Ouvi: "Ah, valeu. As duas ficam prontas daqui a 1 mês. Pode colocar esse prazo aí pra ela. Começo quando ela deixar as peças aqui."
21. BOT: Anotado ✅ As duas ficam prontas em 1 mês, e você começa quando a Dona Fátima deixar as peças aí na oficina.

Quer que eu registre algum sinal ou pagamento da Dona Fátima agora?
22. ADRIANO: Não, por enquanto não tem sinal nem pagamento. Pode deixar sem registrar. Obrigado, valeu.
23. BOT: Beleza, deixei sem registrar nada. Valeu, Adriano! 👋
```

</details>

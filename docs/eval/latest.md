# Avaliação com Claude real — 2026-11-23T18:55

Bot: claude-haiku-5-5 · Adriano simulado: claude-haiku-5-5 · Avaliador: claude-sonnet-5-5

Conferências objetivas: **39/46**

| Critério | Média (1–5) |
|---|---|
| entendimento | 1.83 |
| naturalidade | 2.17 |
| acessibilidade | 2.92 |
| uma_pergunta_por_vez | 3.00 |
| sem_invencao | 2.00 |
| eficiencia | 1.50 |
| conclusao | 2.67 |

## Problemas por classe

- alta:inventou: 19
- media:pergunta_repetida: 14
- alta:pergunta_repetida: 13
- alta:nao_entendeu: 8
- media:perdeu_informacao: 7
- alta:travou: 6
- baixa:jargao: 6
- media:jargao: 5
- media:fluxo_confuso: 5
- alta:perdeu_informacao: 5
- media:nao_entendeu: 5
- baixa:fluxo_confuso: 4
- baixa:tom: 4
- media:texto_longo: 3
- media:pergunta_desnecessaria: 2
- media:suposicao_errada: 1
- baixa:insistencia: 1
- alta:jargao: 1
- baixa:travou: 1
- media:tom: 1
- baixa:confirmacao_redundante: 1
- baixa:perda_de_clareza: 1
- baixa:decisao_dinheiro: 1
- alta:nao_respondeu: 1

## real-adriano-roberto-jo — Conversa real do Adriano: mesinha + 2 móveis do Seu Roberto e da Dona Jo

Notas: entendimento 3 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 4 · sem_invencao 3 · eficiencia 2 · conclusao 4 · 103s

- ✅ 3 serviços (mesinha + 2 aparadores)
- ✅ 2 aparadores reconhecidos
- ✅ técnica verniz em todos
- ✅ cliente Seu Roberto/Dona Jo
- ✅ aparadores só no tampo
- ✅ medida/porte de todas as peças
- ✅ orçamento calculado para as 3 peças

> Chegou ao fechamento e o cliente aceitou, mas a conversa foi ineficiente: o bot repetiu perguntas sobre dados já ditos (aparadores, tamanho, busca e entrega) e irritou o Adriano. O orçamento final mostra material de R$ 360 contra os 70 que ele disse, e a mensagem de contas é longa e pouco acessível. Os 3 PDFs contradizem o orçamento único.

- [media] (suposicao_errada) turno 4: Perguntou se a mesinha era do Seu Roberto e os outros da Dona Jo, sendo que ele falou 'do seu Roberto e da Dona Jo' como casal; chutou em vez de tratar como um cliente só.
- [media] (pergunta_repetida) turno 8: Perguntou quais eram os outros dois móveis, que ele já tinha dito no turno 5 (duas aparadoras, só o tampo).
- [alta] (pergunta_repetida) turno 16: Perguntou o tamanho do tampo do 1º aparador depois de ele já ter dado 1,20 por 40 duas vezes; ele precisou reclamar 'já falei'.
- [media] (pergunta_repetida) turno 22: Perguntou sobre buscar e entregar, que ele já tinha dito no turno 5; também ignorou o tempo de 3 a 5 dias e o material de 70 reais ditos várias vezes.
- [baixa] (insistencia) turno 25: Perguntou o custo do transporte, sem que ele tivesse falado de valor; depois de 'não sei' seguiu corretamente.
- [alta] (inventou) turno 28: Disse que precisa comprar R$ 360 de material, contradizendo os 70 reais que ele informou e já ter o verniz; valor não explicado nem reconhecido.
- [media] (jargao) turno 28: Mensagem de orçamento longa e cheia de números e avisos (prejuízo, horas, frete), pesada para quem prefere conversa simples; sem explicar de onde vem o 378 da mesinha.
- [baixa] (fluxo_confuso) turno 33: Gerou 3 PDFs separados (um por peça) para um cliente só com orçamento único, após ter dito que seria um orçamento só.
- [baixa] (tom) turno 33: Perdeu a nota da terça e o 'reparo da mesinha 3 horas / depende do que aparecer' não aparece no resumo final.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, beleza? Terça eu vou buscar um trabalho do seu Roberto e da Dona Jo. Uma mesinha de centro pra lixar inteira e passar verniz, e mais outros dois móveis que é só o tampo. Queria saber quanto cobrar nisso aí.
   {entendido: (igual) · rota: global/new_job}
2. BOT: 🎧 Ouvi: "E aí, beleza? Terça eu vou buscar um trabalho do…"
3. BOT: Entendi: são 3 móveis para lixar e envernizar, sendo uma mesinha de centro e mais dois móveis para o Seu Roberto e a Dona Jo. Você quer saber quanto cobrar. 📅 Anotei o dia que você falou: terça (01/12/2026), só como lembrete. Se for outro dia, me avisa.
4. BOT: Só falta organizar de quem é cada peça. A mesinha de centro é do Seu Roberto, e os outros dois móveis são da Dona Jo?
   [botões: Isso | Não]
5. ADRIANO (áudio): Não, os dois são do casal, é um cliente só. Os outros dois são duas aparadoras, só o tampo de cada uma pra lixar e envernizar. Mede 1,20 por 40 cada. A mesinha é redonda, 80 de diâmetro e 45 de altura. Já tenho o verniz, vou de pincel. Acho que leva uns 3 a 5 dias e o material deve dar uns 70 reais. Eu mesmo busco e entrego. Me fala aí quanto ficaria.
   {entendido: Não: a mesinha de centro é do Seu Roberto, e os outros dois móveis são do casal, que é um cliente só (Seu Roberto e Dona Jo). Os outros dois são duas aparadoras, só o tampo de cada uma para lixar e envernizar, medindo 1,20 por 40 cada. A mesinha é redonda, 80 de diâmetro e 45 de altura, para lixar inteira e envernizar. Já tenho o verniz; vou usar pincel. Acho que leva de 3 a 5 dias. O material deve dar uns 70 reais. Eu mesmo busco e entrego. Quero saber quanto ficaria. · rota: pending_answer/item_owner_answer}
6. BOT: 🎧 Ouvi: "Não, os dois são do casal, é um cliente só.…"
7. BOT: Combinado! Seu Roberto e Dona Jo ficam como um cliente só, com um orçamento só. 😄
8. BOT: Quais são os outros dois móveis? Por exemplo: "uma cômoda e um aparador".
9. ADRIANO (áudio): Duas aparadoras, só o tampo de cada uma, pra lixar e envernizar. Cada tampo mede 1,20 por 40. A mesinha é redonda, 80 de diâmetro e 45 de altura. Tudo de pincel, que o verniz eu já tenho.
   {entendido: duas aparadoras; só o tampo de cada uma para lixar e envernizar; cada tampo mede 1,20 por 40; a mesinha de centro é redonda, 80 de diâmetro e 45 de altura; tudo com pincel; o verniz eu já tenho. · rota: pending_answer/item_identity_answer}
10. BOT: 🎧 Ouvi: "Duas aparadoras, só o tampo de cada uma, pra lixar…"
11. BOT: Beleza, anotado! 😄 Agora me conta: como estão a mesinha de centro, o 1º aparador e o 2º aparador? Alguma peça precisa de reparo?
12. ADRIANO (áudio): Então a mesinha tá meio danificada no tampo, precisa acertar uns detalhes antes de lixar e passar o verniz. Os dois aparadores tão melhores, só precisam de lixar e envernizar mesmo. Mas o tampo da mesinha é redondo, então tem que ter cuidado com o acabamento ali.
   {entendido: Mesinha de centro: tampo meio danificado, precisa acertar uns detalhes antes de lixar e envernizar. Tampo redondo, então tem que ter cuidado com o acabamento ali. 1º aparador e 2º aparador: estão melhores, só precisam de lixar e envernizar. · rota: pending_answer/item_condition_answer}
13. BOT: 🎧 Ouvi: "Então a mesinha tá meio danificada no tampo, precisa acertar…"
14. BOT: Entendi! 😄 A mesinha de centro: lixar e envernizar inteira, com reparos no tampo. O 1º aparador: lixar e envernizar só o tampo, sem reparos grandes. O 2º aparador: lixar e envernizar só o tampo, sem reparos grandes.

Está certo assim?
   [botões: Certo | Corrigir]
15. ADRIANO: [tocou: Certo]
16. BOT: Beleza, vamos em frente! 🪵 Qual é o tamanho do tampo do 1º aparador? Pode me dizer largura e profundidade, tipo "1,20 por 50", ou só se ele é pequeno, médio ou grande.
17. ADRIANO (áudio): Já falei, os dois aparadores têm o tampo 1,20 por 40, cada um. Os dois iguais.
   {entendido: 1º e 2º aparador: tampo de 1,20 por 40 cada um (os dois iguais). · rota: pending_answer/item_dimensions_answer}
18. BOT: 🎧 Ouvi: "Já falei, os dois aparadores têm o tampo 1,20 por…"
19. BOT: Anotado! 🪵 Quanto tempo você acha que leva o reparo da mesinha de centro? Por exemplo: "2 horas". Se não souber, tudo bem.
20. ADRIANO (áudio): Ah, o reparo da mesinha eu não sei dizer ao certo ainda, depende do que aparecer quando eu abrir o tampo. Mas chuto umas 3 horas pra acertar tudo. Depois vejo melhor. O resto já falei: cada aparador é 1,20 por 40, e a mesinha é redonda, 80 de diâmetro e 45 de altura.
   {entendido: Tempo do reparo da mesinha de centro: chuto umas 3 horas para acertar tudo, mas depende do que aparecer quando eu abrir o tampo; depois vejo melhor. Reafirmando: cada aparador tem tampo de 1,20 por 40; a mesinha é redonda, diâmetro 80 e altura 45. · rota: pending_answer/repair_hours_answer}
21. BOT: 🎧 Ouvi: "Ah, o reparo da mesinha eu não sei dizer ao…"
22. BOT: Beleza, anotado! 🚚 Você vai buscar os móveis na terça (01/12/2026)? E a entrega, também fica por sua conta? Por exemplo: "buscar e entregar" ou "não precisa".
23. ADRIANO (áudio): Isso, eu busco na terça e entrego também, eu mesmo levo. Acho que leva uns 3 a 5 dias pra terminar tudo, e o material deve dar uns 70 reais. Pode seguir com o orçamento aí.
   {entendido: buscar na terça (01/12/2026) e entregar também, eu mesmo levo; prazo de 3 a 5 dias para terminar tudo; material deve dar uns R$ 70; pode seguir com o orçamento · rota: pending_answer/logistics_answer}
24. BOT: 🎧 Ouvi: "Isso, eu busco na terça e entrego também, eu mesmo…"
25. BOT: Quanto você costuma gastar com esse transporte (ida e volta)? Por exemplo: "60 reais". Se não souber, tudo bem.
26. ADRIANO (áudio): Ah, não sei de cabeça o valor do transporte, depende da gasolina e do caminho. Pode deixar sem esse valor por enquanto, depois eu vejo. Mas pode seguir com o orçamento aí, tá?
   {entendido: Não sei o valor do transporte agora, depende da gasolina e do caminho. Deixar sem esse valor por enquanto; depois ele vê. Pode seguir com o orçamento. · rota: pending_answer/transport_cost_answer}
27. BOT: 🎧 Ouvi: "Ah, não sei de cabeça o valor do transporte, depende…"
28. BOT: 🧮 Prontinho, fiz as contas dos 3 móveis!

• Mesinha de centro: R$ 378,00
• 1º aparador: R$ 130,00
• 2º aparador: R$ 130,00

💰 Total sugerido: R$ 638,00

⚠️ Menos que R$ 509,00 no total você começa a ter prejuízo.
🛒 Vai precisar comprar uns R$ 360,00 de material.
⏱️ Dá umas 11 horas de trabalho.
🚚 O frete não está na conta. Se for cobrar, é só acrescentar.

E aí, você concorda com esse valor? 🤝
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
29. ADRIANO: [tocou: 👍 Concordo]
30. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
31. BOT: [PDF enviado: Proposta-AP-2026-0002-v1.pdf]
32. BOT: [PDF enviado: Proposta-AP-2026-0003-v1.pdf]
33. BOT: Fechado! ✅

💰 Valor final: R$ 638,00

📄 Os 3 PDFs (um por peça) já estão prontos. Pode encaminhar pro Seu Roberto e Dona Jo.
34. BOT: Quando o cliente responder, me chama aqui: 👇
   [botões: 👍 Cliente aceitou | 👎 Cliente recusou]
35. ADRIANO: [tocou: 👍 Cliente aceitou]
36. BOT: Boa! 🎉 Anotei que o cliente aceitou os 3 orçamentos, R$ 638,00 no total.
```

</details>

## admin-mesinha-criados — Administrador: mesinha + 2 criados-mudos, medidas todas de uma vez

Notas: entendimento 2 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 3 · sem_invencao 2 · eficiencia 2 · conclusao 3 · 90s

- ❌ 3 serviços — 2
- ❌ 2 criados-mudos — [{"type":"mesa","descriptors":["de centro"]},{"type":"mesa_cabeceira","descriptors":[],"quantity":2}]
- ✅ cliente Dona Carla
- ✅ medidas das 3 peças
- ✅ sem frete (cliente traz e busca)
- ✅ PDF gerado após o desconto

> O bot chegou ao valor e aplicou os 10% de desconto, mas com muito atrito. Repetiu perguntas sobre dados que o usuário já tinha dado, inventou 'reparo' no resumo e mostrou uma mensagem de orçamento longa e técnica. Gerou 2 PDFs em vez de 3 peças e falhou nas conferências de serviços. As 22 horas calculadas contradizem as 6 horas informadas.

- [media] (perdeu_informacao) turno 3: Resumo diz 'lixar e envernizar' para os 3 móveis e chama de '2 criados' sem 'mudos'. Também ignora que o tampo da mesinha está 'meio judiado' e o prazo de 3 a 5 dias.
- [media] (pergunta_desnecessaria) turno 4: Pergunta se é só o tampo ou a mesinha inteira, mas ele já tinha dito que a mesinha é inteira e os criados só o tampo. Isso mostra que o bot não entendeu a primeira fala.
- [media] (pergunta_repetida) turno 10: Pergunta o estado de peças que ele já tinha descrito (lixar e acertar detalhes). Depois pergunta de quem são os móveis, o que é aceitável, mas o fluxo repete informação já dada.
- [alta] (inventou) turno 13: Resumo de confirmação inventa 'reparo no tampo' e 'reparos' nos criados, contra o que ele disse (só lixar e acertar detalhes). Obrigou o usuário a corrigir.
- [media] (pergunta_repetida) turno 18: Pede as medidas da mesinha, que ele já tinha dado no primeiro áudio (redonda, 2 metros). O exemplo de resposta também é técnico demais.
- [media] (pergunta_repetida) turno 21: Pergunta o tempo dos detalhes depois que ele já tinha dito o prazo de 3 a 5 dias. Mesmo assim é razoável pedir horas de trabalho. Ele já tinha dado as medidas dos criados no turno 19, e o bot ignorou isso.
- [media] (fluxo_confuso) turno 24: Diz 'Já já te pergunto de qual peça é', mas nunca pergunta. Ignora o desconto de 10% e o detalhamento de horas por peça que ele já tinha dado no turno 22.
- [alta] (jargao) turno 25: Mensagem de orçamento é longa, com prejuízo, material a comprar, divergência de R$ 70 e R$ 239, 'medida aproximada'. Contradiz o que ele disse (já tem o material) e confunde. O total de 22 horas também destoa das 6 horas que ele informou.
- [media] (pergunta_repetida) turno 28: Pergunta o valor do desconto, que ele já tinha dito no turno 22 (10%, cliente antiga). Ele teve que repetir.
- [alta] (perdeu_informacao) turno 30: Gera 2 PDFs (um por peça) quando eram 3 peças em 2 serviços (mesinha + 2 criados). O banco confirma que o resultado falhou: apenas 2 serviços, sem os 3 móveis. Os criados aparecem sem 'só o tampo'.
- [baixa] (tom) turno 34: Registra que o cliente aceitou e fala em '2 orçamentos'. Isso reforça a estrutura errada dos serviços.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): Oi, tudo bem? Preciso de um orçamento. Trnho uma mesinha de centro redonda, com 2 metros de largura, o tampo meio judiado. Ela é pra lixar, acertar uns detalhes e envernizar. Também são dois criados-mudos, 80 cm de largura e 40 de altura, os dois iguais, só o tampo de cada um, pra lixar e envernizar. Já tenho o material, uns 70 reais. Eu falei pra cliente que demora uns 3 a 5 dias. Dá pra fazer a conta pra mim?
   {entendido: (igual) · rota: global/new_job}
2. BOT: 🎧 Ouvi: "Oi, tudo bem? Preciso de um orçamento. Trnho uma mesinha…"
3. BOT: Entendi! São 3 móveis para lixar e envernizar: uma mesinha de centro e 2 criados. Você quer saber quanto cobrar.
4. BOT: Perfeito 😄 Na mesinha de centro, você vai trabalhar só no tampo ou na mesinha inteira?
5. ADRIANO (áudio): Na mesinha é ela inteira, pés e tampo. Os criados-mudos é só o tampo de cada um. Pode fazer a conta com isso. A cliente deixa tudo em casa e busca depois de pronto.
   {entendido: Na mesinha de centro, trabalhar na mesinha inteira, pés e tampo. Nos 2 criados-mudos, só o tampo de cada um. Pode fazer a conta com isso. A cliente deixa tudo em casa e busca depois de pronto. · rota: pending_answer/service_scope_answer}
6. BOT: 🎧 Ouvi: "Na mesinha é ela inteira, pés e tampo. Os criados-mudos…"
7. BOT: Anotado: mesinha inteira, com pés e tampo, e só o tampo dos 2 criados. Assim eu consigo fechar a conta. 🛠️

E os criados, como estão hoje? Algum precisa de reparo além do lixamento?
8. ADRIANO (áudio): Os dois criados tão bons, só precisam de lixa e acertar uns detalhezinhos. Nada de reparo grande. E a mesinha também só precisa lixar e acertar uns detalhes. Já trnho o material, então é só fazer a conta mesmo.
   {entendido: Os 2 criados-mudos estão bons; só precisam de lixa e acertar uns detalhes, sem reparo grande. A mesinha de centro também só precisa de lixa e acertar uns detalhes. O material já está comprado (cerca de 70 reais), então é só fazer a conta. · rota: active_goal/quote_request_continue}
9. BOT: 🎧 Ouvi: "Os dois criados tão bons, só precisam de lixa e…"
10. BOT: Beleza, anotado: os dois criados estão bons, só precisam de lixa e uns detalhes, sem reparo grande. 📏 A mesinha também só precisa de lixa e acertos, e o material você já tem.

Esses móveis são de quem? Pode me passar só o nome do cliente, tipo "da dona Maria". 🙂
11. ADRIANO (áudio): Dona Carla. Os móveis são da dona Carla. Ela deixa tudo em casa e busca depois de pronto.
   {entendido: Os móveis são da dona Carla. Ela deixa tudo em casa e busca depois de pronto. · rota: pending_answer/client_identity_answer}
12. BOT: 🎧 Ouvi: "Dona Carla. Os móveis são da dona Carla. Ela deixa…"
13. BOT: Entendi 😄 Então fica assim:

• Mesinha de centro: lixar e envernizar inteira, com reparo no tampo.
• 2 criados: lixar e envernizar só o tampo, com reparos.

Está certo?
   [botões: Certo | Corrigir]
14. ADRIANO (áudio): Não, não é bem isso. A mesinha só precisa lixar e acertar uns detalhes, não tem reparo no tampo. E os criados também, só lixa e acerto, nada de reparo grande. Pode fazer a conta assim.
   {entendido: corrigir: a mesinha de centro (inteira, com pés e tampo) só precisa de lixa e acertos de detalhes, sem reparo no tampo; os 2 criados-mudos (só o tampo de cada um) também só precisam de lixa e acertos de detalhes, sem reparo grande. Pode fazer a conta assim. · rota: active_goal/quote_request_continue}
15. BOT: 🎧 Ouvi: "Não, não é bem isso. A mesinha só precisa lixar…"
16. BOT: Ah, entendi, errei na leitura 😄 Então fica assim: a mesinha de centro é só lixar e acertar uns detalhes, sem reparo no tampo, e os 2 criados também só lixa e acerto, sem reparo grande. Está certo agora?
   [botões: Certo | Corrigir]
17. ADRIANO: [tocou: Certo]
18. BOT: Beleza, então agora as medidas, que fazem diferença no preço. 📏 Quais são as medidas da mesinha de centro? Por exemplo: "45 de altura, 1 metro de largura e 60 de fundura". Se não tiver certeza, pode dizer só pequena, média ou grande.
19. ADRIANO (áudio): A mesinha é redonda, tem 2 metros de largura. Os dois criados têm 80 cm de largura e 40 de altura, iguais. Pincel e uma faca pra raspar, já trnho tudo. Pode fazer a conta.
   {entendido: A mesinha de centro é redonda, com 2 metros de largura. Os 2 criados têm 80 cm de largura e 40 cm de altura, iguais entre si. Método: pincel; também vou usar faca pra raspar. Já tem todo o material. Pode fazer a conta. · rota: pending_answer/item_dimensions_answer}
20. BOT: 🎧 Ouvi: "A mesinha é redonda, tem 2 metros de largura. Os…"
21. BOT: Quanto tempo você acha que leva pra acertar os detalhes de todas as peças, somando tudo? 🛠️ Por exemplo: "3 horas". Se não souber, tudo bem.
22. ADRIANO (áudio): Uns 6 horas no total, contando lixa e os acertos das três peças. A mesinha é uma parte maior, uns 3 horas, e cada criado umas 1h30. Se quiser fechar a conta com 10% de desconto, pode fazer, dona Carla é cliente antiga.
   {entendido: Total de 6 horas somando as três peças (lixar e acertar os detalhes). Mesinha de centro: 3 horas. Cada criado: 1h30. Desconto de 10% para a dona Carla (cliente antiga), para o sistema aplicar na conta. · rota: pending_answer/repair_hours_answer}
23. BOT: 🎧 Ouvi: "Uns 6 horas no total, contando lixa e os acertos…"
24. BOT: Anotei o que você falou do estado 👍 Já já te pergunto de qual peça é.
25. BOT: 🧮 Prontinho, fiz as contas dos 2 móveis!

• Mesinha de centro: R$ 1.043,00
• Os 2 criados: R$ 331,00

💰 Total sugerido: R$ 1.374,00

⚠️ Menos que R$ 1.116,00 no total você começa a ter prejuízo.
🛒 Vai precisar comprar uns R$ 377,00 de material.
⏱️ Dá umas 22 horas de trabalho.
📏 Fiz com a medida aproximada, então pode variar um pouco.
🧾 Você comentou uns R$ 70,00 de material; pela minha conta o material usado dá uns R$ 239,00.

E aí, você concorda com esse valor? 🤝
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
26. ADRIANO: [tocou: ➖ Dar desconto]
27. BOT: Beleza! Quanto de desconto você quer dar? 🙂

Pode falar em reais, tipo "50 reais", ou em porcentagem, tipo "10%".
28. ADRIANO: 10%, a dona Carla é cliente antiga, pode fazer assim.
   {entendido: desconto de 10%; a cliente é antiga · rota: active_goal/quote_decision_continue}
29. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
30. BOT: [PDF enviado: Proposta-AP-2026-0002-v1.pdf]
31. BOT: Fechado! ✅

Valor final: R$ 1.236,60 (R$ 1.374,00 com R$ 137,40 de desconto)

📄 Os 2 PDFs (um por peça) já estão prontos pra você encaminhar pra Carla.
32. BOT: Quando a cliente responder, me avisa aqui: 👇
   [botões: 👍 Cliente aceitou | 👎 Cliente recusou]
33. ADRIANO: [tocou: 👍 Cliente aceitou]
34. BOT: Boa! 🎉 Anotei que a Carla aceitou os 2 orçamentos, R$ 1.236,60 no total.

Quando você quiser, pode me mandar o próximo serviço ou registrar algum gasto ou pagamento. 🛠️
```

</details>

## admin-comoda-carla — Cômoda da Dona Carla (pátina), gavetão, correção e logística do cliente

Notas: entendimento 1 · naturalidade 2 · acessibilidade 3 · uma_pergunta_por_vez 3 · sem_invencao 1 · eficiencia 1 · conclusao 1 · 115s

- ✅ 1 serviço
- ✅ cômoda
- ✅ pátina
- ✅ 5 gavetas (4 + gavetão)
- ✅ gavetão nas observações
- ✅ estilete nas observações
- ✅ pincel
- ✅ sem frete
- ❌ medidas 1 m × 0,8 m — {"height":"1","width":"1"}

> Falha total. O bot inverteu as medidas no começo (80 cm largura e 1 m altura virou 0,8 m de altura) e nunca conseguiu corrigir. Quatro correções claras do Adriano geraram resultados errados, falsas confirmações e um resumo repetido, depois silêncio. Nunca calculou o orçamento, e o faixa de preço inicial estava baseada em medidas erradas.

- [alta] (inventou) turno 3: Inverteu as medidas logo de início: Adriano disse 80 por 1 metro (largura 80, altura 1 m) e o bot anotou altura 0,8 m, largura 1 m. Também pôs 'raspagem com estilete' como tipo de móvel e 'sem frete' sem ele ter dito assim.
- [media] (jargao) turno 4: Deu faixa de preço (R$ 393 a 520) calculada com medidas erradas, e chamou de 'última coisinha' uma pergunta que já tinha sido respondida no áudio inicial (só por fora).
- [media] (perdeu_informacao) turno 7: Anotou só 'só por fora'. Ignorou a confirmação das medidas (largura por altura) e a repetição de que a cliente traz e busca.
- [alta] (inventou) turno 11: Disse que ajustou para altura 1 m e largura 1 m, mudando a largura de 80 cm para 1 m. Valor errado inventado, ao contrário do que o usuário pediu.
- [alta] (nao_entendeu) turno 15: Voltou para altura 0,8 m e largura 1 m, repetindo o erro original e alegando 'corrigido'. Falsa confirmação de correção.
- [alta] (nao_entendeu) turno 19: Voltou a 1 m por 1 m e disse 'troquei', mas a largura 0,8 m nunca foi gravada. Loop de erro.
- [alta] (travou) turno 23: Ignorou o pedido, sem avisar da correção, e repetiu o mesmo resumo errado (1 m por 1 m). Texto longo repetido pela quarta vez.
- [alta] (travou) turno 26: Quarta correção pedida e nenhuma resposta; o orçamento nunca é calculado nem ele consegue concordar com o valor. Ele repete a mesma correção cinco vezes e o bot não muda.
- [media] (texto_longo) turno 12: Repete o resumão inteiro a cada correção em vez de resposta curta. Pergunta 'tá tudo certo?' mesmo depois de ele já ter dito 'pode calcular depois de corrigir'.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): Ô, chegou uma cômoda aqui da dona Carla pra patinar. Ela tem uns 80 por 1 metro, mais ou menos. Ela tem 4 gavetas e um gavetão. Tá boazinha, só precisa de pátina por fora, não tem conserto nenhum. Vou fazer com pincel e vou usar o estilete pra raspar. Ela que traz e busca quando tiver pronta.
   {entendido: (igual) · rota: global/new_job}
2. BOT: 🎧 Ouvi: "Ô, chegou uma cômoda aqui da dona Carla pra patinar.…"
3. BOT: Anotei um serviço novo:
• móvel: cômoda (raspagem com estilete)
• trabalho: pátina
• cliente: Dona Carla
• aplicação: pincel
• estado: bom
• sem consertos
• sem frete
• medidas: altura 0,8 m, largura 1 m
• inclui 1 gavetão
• também vai usar: estilete pra raspar

Agora vou te fazer umas perguntinhas, uma de cada vez, pra montar o orçamento. Pode responder por áudio ou escrevendo.
4. BOT: 💰 Só pra você ter uma ideia: pelo que já sei, deve ficar entre R$ 393,00 e R$ 520,00. Com o resto das respostas eu fecho o valor.

Última coisinha: a cômoda vai ser trabalhada só por fora, ou a parte de dentro (prateleiras, gavetas) também?
5. ADRIANO (áudio): Só por fora mesmo. As gavetas por dentro não precisa mexer, tá limpinha. Ah, e as medidas que eu falei, 80 por 1 metro, era a largura por a altura, tá certo assim. Ela busca quando tiver pronta, ela mesma traz e busca.
   {entendido: (igual) · rota: pending_answer/service_scope_answer}
6. BOT: 🎧 Ouvi: "Só por fora mesmo. As gavetas por dentro não precisa…"
7. BOT: Anotado: só por fora.
8. BOT: Pronto, Adriano! Já tenho o que preciso sobre a cômoda da Dona Carla. Dá uma conferida:

• móvel: cômoda (raspagem com estilete)
• trabalho: pátina
• cliente: Dona Carla
• aplicação: pincel
• estado: bom
• sem consertos
• sem frete
• medidas: altura 0,8 m, largura 1 m
• observações: inclui 1 gavetão; também vai usar: estilete pra raspar
• só por fora

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
9. ADRIANO (áudio): Opa, ta quase! So uma correcao: a altura e 1 metro e a largura 80 cm, que e o contrario do que ta ai. Fora isso ta certo. Pode calcular depois que corrigir.
   {entendido: corrigir: a altura é 1 metro e a largura é 80 cm (o contrário do que está anotado: altura 0,8 m, largura 1 m). Fora isso, está certo. Pode calcular depois de corrigir. · rota: active_goal/confirm_calc_continue}
10. BOT: 🎧 Ouvi: "Opa, ta quase! So uma correcao: a altura e 1…"
11. BOT: Anotado, Adriano! Ajustei as medidas pra altura 1 m e largura 1 m (antes estava altura 0,8 m, largura 1 m). Guardei a correção. 🪵
12. BOT: Pronto, Adriano! Já tenho o que preciso sobre a cômoda da Dona Carla. Dá uma conferida:

• móvel: cômoda (raspagem com estilete)
• trabalho: pátina
• cliente: Dona Carla
• aplicação: pincel
• estado: bom
• sem consertos
• sem frete
• medidas: altura 1 m, largura 1 m
• observações: inclui 1 gavetão; também vai usar: estilete pra raspar
• só por fora

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
13. ADRIANO (áudio): Ô, ficou errado a largura. A largura é 80 cm, a altura é 1 metro. Agora tá certo. Pode calcular.
   {entendido: (igual) · rota: active_goal/confirm_calc_continue}
14. BOT: 🎧 Ouvi: "Ô, ficou errado a largura. A largura é 80 cm,…"
15. BOT: Corrigido, Adriano! Ficou assim: medidas: altura 0,8 m, largura 1 m (antes: medidas: altura 1 m, largura 1 m). Guardei o histórico. 🪵
16. BOT: Pronto, Adriano! Já tenho o que preciso sobre a cômoda da Dona Carla. Dá uma conferida:

• móvel: cômoda (raspagem com estilete)
• trabalho: pátina
• cliente: Dona Carla
• aplicação: pincel
• estado: bom
• sem consertos
• sem frete
• medidas: altura 0,8 m, largura 1 m
• observações: inclui 1 gavetão; também vai usar: estilete pra raspar
• só por fora

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
17. ADRIANO (áudio): Não, ficou trocado de novo! A altura é 1 metro e a largura é 80 cm. Não é 0,8 de altura, é 0,8 de largura. Corrige aí, por favor, e depois pode calcular.
   {entendido: corrigir: medidas: altura 1 m, largura 0,8 m (80 cm). Depois pode calcular. · rota: active_goal/confirm_calc_continue}
18. BOT: 🎧 Ouvi: "Não, ficou trocado de novo! A altura é 1 metro…"
19. BOT: Beleza, troquei aqui: medidas: altura 1 m, largura 1 m (antes: medidas: altura 0,8 m, largura 1 m). Guardei o histórico. 🪵
20. BOT: Pronto, Adriano! Já tenho o que preciso sobre a cômoda da Dona Carla. Dá uma conferida:

• móvel: cômoda (raspagem com estilete)
• trabalho: pátina
• cliente: Dona Carla
• aplicação: pincel
• estado: bom
• sem consertos
• sem frete
• medidas: altura 1 m, largura 1 m
• observações: inclui 1 gavetão; também vai usar: estilete pra raspar
• só por fora

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
21. ADRIANO (áudio): Não, de novo não! Altura é 1 metro e largura é 80 cm. Tá errado de novo aí. Por favor, arruma pra altura 1 m e largura 0,8 m, aí pode calcular.
   {entendido: corrigir: medidas: altura 1 m, largura 0,8 m (80 cm). Depois pode calcular. · rota: active_goal/confirm_calc_continue}
22. BOT: 🎧 Ouvi: "Não, de novo não! Altura é 1 metro e largura…"
23. BOT: Pronto, Adriano! Já tenho o que preciso sobre a cômoda da Dona Carla. Dá uma conferida:

• móvel: cômoda (raspagem com estilete)
• trabalho: pátina
• cliente: Dona Carla
• aplicação: pincel
• estado: bom
• sem consertos
• sem frete
• medidas: altura 1 m, largura 1 m
• observações: inclui 1 gavetão; também vai usar: estilete pra raspar
• só por fora

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
24. ADRIANO (áudio): Ô, de novo errado! A altura é 1 metro e a largura é 80 cm. Não é 1 por 1, é 1 de altura e 0,8 de largura. Arruma isso aí, por favor, e depois pode calcular.
   {entendido: corrigir: medidas: altura 1 m, largura 0,8 m (80 cm). Depois pode calcular. · rota: active_goal/confirm_calc_continue}
25. BOT: 🎧 Ouvi: "Ô, de novo errado! A altura é 1 metro e…"
26. BOT: Pronto, Adriano! Já tenho o que preciso sobre a cômoda da Dona Carla. Dá uma conferida:

• móvel: cômoda (raspagem com estilete)
• trabalho: pátina
• cliente: Dona Carla
• aplicação: pincel
• estado: bom
• sem consertos
• sem frete
• medidas: altura 1 m, largura 1 m
• observações: inclui 1 gavetão; também vai usar: estilete pra raspar
• só por fora

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
27. ADRIANO (áudio): Ô, de novo errado! A largura é 80 cm, não 1 metro. Altura 1 metro, largura 0,8. Arruma aí, por favor, e depois pode calcular.
   {entendido: corrigir: medidas: altura 1 m, largura 0,8 m (80 cm). Depois pode calcular. · rota: active_goal/confirm_calc_continue}
28. BOT: 🎧 Ouvi: "Ô, de novo errado! A largura é 80 cm, não…"
29. BOT: Pronto, Adriano! Já tenho o que preciso sobre a cômoda da Dona Carla. Dá uma conferida:

• móvel: cômoda (raspagem com estilete)
• trabalho: pátina
• cliente: Dona Carla
• aplicação: pincel
• estado: bom
• sem consertos
• sem frete
• medidas: altura 1 m, largura 1 m
• observações: inclui 1 gavetão; também vai usar: estilete pra raspar
• só por fora

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
30. ADRIANO (áudio): Ô, de novo errado! A largura é 80 cm, não 1 metro. Altura 1 metro, largura 0,8. Por favor, arruma isso aí e depois eu pode calcular. Tá dando confusão no bot hoje, viu.
   {entendido: corrigir: medidas: altura 1 m, largura 0,8 m (a largura é 80 cm, não 1 m). Depois pode calcular. Comentário dele: tá dando confusão no bot hoje. · rota: active_goal/confirm_calc_continue}
31. BOT: 🎧 Ouvi: "Ô, de novo errado! A largura é 80 cm, não…"
32. BOT: Pronto, Adriano! Já tenho o que preciso sobre a cômoda da Dona Carla. Dá uma conferida:

• móvel: cômoda (raspagem com estilete)
• trabalho: pátina
• cliente: Dona Carla
• aplicação: pincel
• estado: bom
• sem consertos
• sem frete
• medidas: altura 1 m, largura 1 m
• observações: inclui 1 gavetão; também vai usar: estilete pra raspar
• só por fora

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
33. ADRIANO (áudio): Ô, de novo errado! A largura é 0,8 m, não 1 metro. Altura 1 metro, largura 0,8 metro. Arruma isso aí, por favor. Ele não tá trocando, só não tá pegando a largura. Depois pode calcular.
   {entendido: (igual) · rota: active_goal/confirm_calc_continue}
34. BOT: 🎧 Ouvi: "Ô, de novo errado! A largura é 0,8 m, não…"
35. BOT: Corrigido: medidas: altura 0,8 m, largura 1 m (antes: medidas: altura 1 m, largura 1 m). Guardei o histórico.
36. BOT: Pronto, Adriano! Já tenho o que preciso sobre a cômoda da Dona Carla. Dá uma conferida:

• móvel: cômoda (raspagem com estilete)
• trabalho: pátina
• cliente: Dona Carla
• aplicação: pincel
• estado: bom
• sem consertos
• sem frete
• medidas: altura 0,8 m, largura 1 m
• observações: inclui 1 gavetão; também vai usar: estilete pra raspar
• só por fora

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
37. ADRIANO (áudio): Ô, de novo errado! Não é altura 0,8, é altura 1 metro e largura 0,8. Eu falei duas vezes, a altura é 1 metro e a largura é 80 centímetros. Arruma isso aí, por favor, e depois pode calcular.
   {entendido: corrigir: medidas: altura 1 m, largura 0,8 m (80 cm). Depois pode calcular. · rota: active_goal/confirm_calc_continue}
38. BOT: 🎧 Ouvi: "Ô, de novo errado! Não é altura 0,8, é altura…"
39. BOT: Feito, Adriano! ✅ Corrigi as medidas: altura 1 m, largura 1 m (antes estava altura 0,8 m, largura 1 m).

O histórico já ficou guardado. 📏
40. BOT: Pronto, Adriano! Já tenho o que preciso sobre a cômoda da Dona Carla. Dá uma conferida:

• móvel: cômoda (raspagem com estilete)
• trabalho: pátina
• cliente: Dona Carla
• aplicação: pincel
• estado: bom
• sem consertos
• sem frete
• medidas: altura 1 m, largura 1 m
• observações: inclui 1 gavetão; também vai usar: estilete pra raspar
• só por fora

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
41. ADRIANO (áudio): Ainda tá errado, viu. A largura é 80 centímetros, não 1 metro. Altura 1 metro, largura 0,8. Arruma isso aí, por favor, que depois eu pode calcular.
   {entendido: corrigir: medidas: altura 1 m, largura 0,8 m (80 cm) · rota: active_goal/confirm_calc_continue}
42. BOT: 🎧 Ouvi: "Ainda tá errado, viu. A largura é 80 centímetros, não…"
43. BOT: Pronto, Adriano! Já tenho o que preciso sobre a cômoda da Dona Carla. Dá uma conferida:

• móvel: cômoda (raspagem com estilete)
• trabalho: pátina
• cliente: Dona Carla
• aplicação: pincel
• estado: bom
• sem consertos
• sem frete
• medidas: altura 1 m, largura 1 m
• observações: inclui 1 gavetão; também vai usar: estilete pra raspar
• só por fora

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
44. ADRIANO (áudio): Ô, de novo! A largura tá 1 metro e tem que ser 80 centímetros, 0,8. Altura é 1 metro. Arruma isso aí, por favor. O bot tá pegando errado a largura, eu já falei três vezes. Depois pode calcular.
   {entendido: corrigir: medidas: altura 1 m, largura 0,8 m (80 cm). Antes estava largura 1 m. · rota: active_goal/confirm_calc_continue}
45. BOT: 🎧 Ouvi: "Ô, de novo! A largura tá 1 metro e tem…"
46. BOT: Pronto, Adriano! Já tenho o que preciso sobre a cômoda da Dona Carla. Dá uma conferida:

• móvel: cômoda (raspagem com estilete)
• trabalho: pátina
• cliente: Dona Carla
• aplicação: pincel
• estado: bom
• sem consertos
• sem frete
• medidas: altura 1 m, largura 1 m
• observações: inclui 1 gavetão; também vai usar: estilete pra raspar
• só por fora

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
47. ADRIANO (áudio): Ô, de novo errado! A largura é 80 centímetros, 0,8 metro. Altura é 1 metro. Arruma isso aí, por favor. Ele não tá trocando a largura, o bot tá pegando 1 metro no lugar de 0,8. Depois pode calcular.
   {entendido: corrigir: a largura é 0,8 m (80 centímetros) e a altura é 1 m. O bot pegou 1 m de largura no lugar de 0,8 m. Depois pode calcular. · rota: active_goal/confirm_calc_continue}
48. BOT: 🎧 Ouvi: "Ô, de novo errado! A largura é 80 centímetros, 0,8…"
49. BOT: Beleza, corrigido! ✅ Medidas: altura 1,6 m, largura 1 m (antes estava altura 1 m, largura 1 m). Guardei o histórico. 📏
50. BOT: Pronto, Adriano! Já tenho o que preciso sobre a cômoda da Dona Carla. Dá uma conferida:

• móvel: cômoda (raspagem com estilete)
• trabalho: pátina
• cliente: Dona Carla
• aplicação: pincel
• estado: bom
• sem consertos
• sem frete
• medidas: altura 1,6 m, largura 1 m
• observações: inclui 1 gavetão; também vai usar: estilete pra raspar
• só por fora

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
51. ADRIANO (áudio): Ô, de novo errado! Não é altura 1,6, é altura 1 metro. Largura é 80 centímetros, 0,8. Arruma isso aí, por favor, e depois pode calcular.
   {entendido: (igual) · rota: active_goal/confirm_calc_continue}
52. BOT: 🎧 Ouvi: "Ô, de novo errado! Não é altura 1,6, é altura…"
53. BOT: Entendi, Adriano, foi mal de novo! 😅 Agora ficou assim: altura 1 m, largura 1 m (antes estava altura 1,6 m, largura 1 m). Guardei o histórico. 📏
54. BOT: Pronto, Adriano! Já tenho o que preciso sobre a cômoda da Dona Carla. Dá uma conferida:

• móvel: cômoda (raspagem com estilete)
• trabalho: pátina
• cliente: Dona Carla
• aplicação: pincel
• estado: bom
• sem consertos
• sem frete
• medidas: altura 1 m, largura 1 m
• observações: inclui 1 gavetão; também vai usar: estilete pra raspar
• só por fora

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
55. ADRIANO (áudio): Ô, de novo errado! A largura é 80 centímetros, 0,8 metro. Altura é 1 metro, isso tá certo. Você não tá trocando a largura, o bot tá pegando 1 metro no lugar de 0,8. Arruma isso aí, por favor, e depois pode calcular.
   {entendido: corrigir: medidas: altura 1 m, largura 0,8 m (80 centímetros). Depois pode calcular. · rota: active_goal/confirm_calc_continue}
56. BOT: 🎧 Ouvi: "Ô, de novo errado! A largura é 80 centímetros, 0,8…"
57. BOT: Pronto, Adriano! Já tenho o que preciso sobre a cômoda da Dona Carla. Dá uma conferida:

• móvel: cômoda (raspagem com estilete)
• trabalho: pátina
• cliente: Dona Carla
• aplicação: pincel
• estado: bom
• sem consertos
• sem frete
• medidas: altura 1 m, largura 1 m
• observações: inclui 1 gavetão; também vai usar: estilete pra raspar
• só por fora

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
58. ADRIANO (áudio): Ô, de novo errado! A largura é 80 centímetros, 0,8 metro. Altura é 1 metro. Já falei três vezes, o bot não tá pegando a largura. Arruma isso aí, por favor, e depois pode calcular.
   {entendido: (igual) · rota: active_goal/confirm_calc_continue}
59. BOT: 🎧 Ouvi: "Ô, de novo errado! A largura é 80 centímetros, 0,8…"
60. BOT: Corrigido: medidas: altura 0,8 m, largura 1 m (antes: medidas: altura 1 m, largura 1 m). Guardei o histórico.
61. BOT: Pronto, Adriano! Já tenho o que preciso sobre a cômoda da Dona Carla. Dá uma conferida:

• móvel: cômoda (raspagem com estilete)
• trabalho: pátina
• cliente: Dona Carla
• aplicação: pincel
• estado: bom
• sem consertos
• sem frete
• medidas: altura 0,8 m, largura 1 m
• observações: inclui 1 gavetão; também vai usar: estilete pra raspar
• só por fora

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
62. ADRIANO (áudio): Ô, de novo errado! Agora trocou a altura. A altura é 1 metro, a largura é 80 centímetros, 0,8. Arruma isso aí, por favor. Depois pode calcular.
   {entendido: corrigir: medidas: altura 1 m, largura 0,8 m (antes estava altura 0,8 m, largura 1 m). Depois pode calcular. · rota: active_goal/confirm_calc_continue}
63. BOT: 🎧 Ouvi: "Ô, de novo errado! Agora trocou a altura. A altura…"
64. BOT: Corrigido, Adriano! 📏 Agora ficou: medidas: altura 1 m, largura 1 m (antes estava altura 0,8 m, largura 1 m). Guardei o histórico.
65. BOT: Pronto, Adriano! Já tenho o que preciso sobre a cômoda da Dona Carla. Dá uma conferida:

• móvel: cômoda (raspagem com estilete)
• trabalho: pátina
• cliente: Dona Carla
• aplicação: pincel
• estado: bom
• sem consertos
• sem frete
• medidas: altura 1 m, largura 1 m
• observações: inclui 1 gavetão; também vai usar: estilete pra raspar
• só por fora

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
```

</details>

## abreu-isa-casal — Mesa de cabeceira do Seu Abreu e da Dona Isa (casal), cor e tempo estimado

Notas: entendimento 1 · naturalidade 1 · acessibilidade 3 · uma_pergunta_por_vez 3 · sem_invencao 1 · eficiencia 1 · conclusao 1 · 103s

- ✅ 1 serviço (casal = 1 cliente)
- ✅ cor azul marinho anotada
- ✅ tempo estimado anotado
- ✅ segundo dono não se perdeu
- ✅ porte médio usado

> O bot entrou em loop perguntando a mesma coisa sobre busca e entrega mais de sete vezes, apesar de Adriano responder e pedir para fechar. Inventou conflitos de cliente duas vezes e acabou trocando Seu Abreu por 'Cliente'. Nunca apresentou o valor final nem pediu a concordância, então o objetivo não foi cumprido.

- [alta] (inventou) turno 7: Inventou conflito de cliente ('Próprio Adriano') que ele não disse, e pediu confirmação desnecessária.
- [media] (pergunta_repetida) turno 10: Perguntou como a peça chega e volta, sendo que ele já disse no turno 5 que não precisa buscar nem entregar e que ele leva.
- [alta] (pergunta_repetida) turno 13: Confirmou a informação de busca e entrega e logo perguntou de novo a mesma coisa.
- [alta] (pergunta_repetida) turno 16: Repetiu a pergunta sobre busca e entrega com outra frase (turnos 16, 19, 22, 25, 28, 31, 34), mesmo ele reclamando várias vezes.
- [alta] (travou) turno 16: Ignorou os pedidos repetidos de fechar o orçamento e ficou preso num loop sem avançar.
- [media] (nao_entendeu) turno 34: Tratou a pergunta social 'vc tá bem?' como dúvida sobre o transporte, sem responder ao cumprimento, e repetiu a mesma pergunta.
- [alta] (inventou) turno 37: Inventou de novo uma troca de cliente ('Cliente') a partir de nada.
- [alta] (perdeu_informacao) turno 39: Trocou o cliente Seu Abreu por 'Cliente' após um botão induzido, perdendo um dado correto.
- [alta] (travou) turno 40: Terminou com 'Pronto' sem mostrar o valor final nem pedir concordância, objetivo não atingido.
- [baixa] (jargao) turno 4: Tom correto, mas ele já tinha dito tudo e o bot ficou repetindo 'Só falta' em vez de fechar.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, tudo bem? Queria saber se dá pra fazer um orçamento novo. É a mesa de cabeceira do seu Abreu e da dona Isa, eles querem lixar e pintar de azul marinho. Tá boa, só por fora, sem conserto nenhum.
   {entendido: (igual) · rota: global/new_job}
2. BOT: 🎧 Ouvi: "E aí, tudo bem? Queria saber se dá pra fazer…"
3. BOT: Anotei um serviço novo:
• móvel: criado-mudo (novo, azul)
• trabalho: pintura
• cliente: Seu Abreu
• só por fora
• estado: bom
• sem consertos
• cor: azul marinho
• também citado: Dona Isa

Vou te perguntando o resto aos pouquinhos, tá? Pode responder do jeito que for mais fácil, áudio ou texto.
4. BOT: Quase lá! Agora falta o tamanho, que mexe bastante no preço. Se tiver as medidas, manda assim: "1,80 de altura, 1 metro de largura e 40 de fundura". Se não tiver, só pequeno, médio ou grande já serve. 📏
5. ADRIANO (áudio): Médio, não sei a medida exata. Tá boa, só lixar e pintar mesmo, sem conserto. Pincel. Acho que leva uns 3 a 5 dias, e ela não precisa buscar nem entregar, eu que levo pra eles depois.
   {entendido: tamanho: médio (não sabe a medida exata); pintura só por fora, lixar e pintar, sem conserto; ferramenta: pincel; prazo estimado: 3 a 5 dias; sem busca nem entrega pelo cliente, o próprio Adriano leva depois · rota: pending_answer/item_dimensions_answer}
6. BOT: 🎧 Ouvi: "Médio, não sei a medida exata. Tá boa, só lixar…"
7. BOT: Ops, entendi errado aqui 😅 Antes eu anotei cliente: Seu Abreu, mas agora apareceu cliente: Próprio Adriano. Qual está certo?
   [botões: Vale o novo | Fica como estava]
8. ADRIANO: [tocou: Fica como estava]
9. BOT: Beleza, mantive o cliente como Seu Abreu. 👍
10. BOT: 💰 Pra você ter uma ideia: pelo que já sei, deve ficar entre R$ 270,00 e R$ 484,00 (sem contar frete). Com o resto das respostas eu fecho o valor.

E pra fechar: como o criado-mudo chega até você e volta pro cliente? Você busca e entrega, ou o cliente leva e traz? 🚚
11. ADRIANO (áudio): Ela não precisa buscar nem entregar, eu que busco e levo pra eles depois. Acho que fica entre 3 e 5 dias, a cor é azul marinho. Ah, e aquele negócio do cliente ali, pode deixar o Seu Abreu mesmo.
   {entendido: (igual) · rota: active_goal/collecting_continue}
12. BOT: 🎧 Ouvi: "Ela não precisa buscar nem entregar, eu que busco e…"
13. BOT: Beleza, anotei o prazo: 3 a 5 dias, ela não precisa buscar nem entregar, e você busca e leva pra eles depois. A cor é azul marinho e o cliente continua sendo o Seu Abreu. 🙌

Só falta saber: como o criado-mudo chega até você e volta pro cliente? Você busca e entrega, ou o cliente leva e traz? 🚚
14. ADRIANO (áudio): Já falei, não precisa buscar nem entregar. Eu busco e levo pra eles depois. Pode fechar aí que tá bom.
   {entendido: (igual) · rota: active_goal/collecting_continue}
15. BOT: 🎧 Ouvi: "Já falei, não precisa buscar nem entregar. Eu busco e…"
16. BOT: Entendi, você busca e leva pra eles depois, então não precisa perguntar isso de novo. 😄

Só confirmando a última coisa: na volta, você entrega ou o cliente vem pegar? 🚚
17. ADRIANO (áudio): Já entendi, Adriano. Eu busco e levo pra eles depois, pode fechar. Sem pressa, pode fechar aí mesmo.
   {entendido: (igual) · rota: active_goal/collecting_continue}
18. BOT: 🎧 Ouvi: "Já entendi, Adriano. Eu busco e levo pra eles depois,…"
19. BOT: Certo, você busca e leva pra eles depois. Mas ainda falta uma coisa: na volta, você entrega ou o cliente vem pegar? 🚚
20. ADRIANO (áudio): Já entendi, pode fechar sim. Eu busco e levo pra eles depois. Valor a gente vê aí, você que manda nas contas.
   {entendido: (igual) · rota: active_goal/collecting_continue}
21. BOT: 🎧 Ouvi: "Já entendi, pode fechar sim. Eu busco e levo pra…"
22. BOT: Entendi, você busca e leva. Só falta uma coisa: na volta, você entrega ou o cliente vem pegar? 🚚
23. ADRIANO (áudio): Já entendi, pode deixar assim. Eu busco e levo pra eles. Pode seguir aí com o valor que o sistema calcular.
   {entendido: (igual) · rota: active_goal/collecting_continue}
24. BOT: 🎧 Ouvi: "Já entendi, pode deixar assim. Eu busco e levo pra…"
25. BOT: Beleza, você busca e leva, então o cliente não precisa vir até aqui. 🚚

Só falta uma coisa: na volta, você entrega ou o cliente vem pegar?
26. ADRIANO (áudio): Já falei duas vezes: eu busco e levo pra eles. Não precisa perguntar de novo. Pode seguir com o valor.
   {entendido: Eu busco e levo o móvel pro cliente depois; não precisa perguntar de novo. Pode seguir com o valor. · rota: active_goal/collecting_continue}
27. BOT: 🎧 Ouvi: "Já falei duas vezes: eu busco e levo pra eles.…"
28. BOT: Entendi, você busca e leva, pode deixar. 😄

Só pra eu fechar certinho: depois que você levar, o cliente fica com a peça ou vem pegar aqui?
29. ADRIANO (áudio): Já falei duas vezes, pode ignorar isso. Eu busco e levo pra eles, o cliente fica com a mesa. Pode seguir com o valor que o sistema calcular. Ah, a mesa tá boa, só vou lixar e pintar de azul marinho, tamanho médio, sem conserto nenhum, só por fora. Pincel. Acho que leva uns 3 a 5 dias.
   {entendido: (igual) · rota: active_goal/collecting_continue}
30. BOT: 🎧 Ouvi: "Já falei duas vezes, pode ignorar isso. Eu busco e…"
31. BOT: Certo, você vai buscar. E na volta, você entrega ou o cliente vem pegar?
32. ADRIANO (áudio): Já falei duas vezes, mano, você tá perguntando de novo. Eu busco e levo, o cliente fica com a mesa. Pode seguir com o valor, por favor. E aí, vc tá bem?
   {entendido: Eu busco e levo a peça depois; o cliente não precisa vir buscar nem entregar. Pode seguir com o valor. Também pergunta: tudo bem com você? · rota: active_goal/collecting_continue}
33. BOT: 🎧 Ouvi: "Já falei duas vezes, mano, você tá perguntando de novo.…"
34. BOT: Faz sentido perguntar 🙂 Se você precisar buscar ou entregar, o transporte é um custo que entra no orçamento. Se o cliente traz e busca, não entra.

Como o criado-mudo chega até você e volta pro cliente? Você busca e entrega, ou o cliente leva e traz?
35. ADRIANO (áudio): Já falei umas três vezes: eu busco e levo pra eles, o cliente fica com a mesa. Não precisa mais perguntar isso. Pode seguir com o valor, por favor. E aí, vc tá bem? Ah, a cor vai ser azul marinho, a mesa tá boa, só lixar e pintar, tamanho médio, sem conserto. Pincel. Acho que leva de 3 a 5 dias.
   {entendido: Ele busca e leva o móvel (criado-mudo) de volta ao cliente; o cliente não vem buscar nem entregar. Não perguntar mais sobre transporte; seguir com o valor. Mensagem social: "E aí, vc tá bem?". Dados: a cor é azul marinho; a peça está boa, só lixar e pintar, tamanho médio, sem conserto; aplicação com pincel; prazo estimado de 3 a 5 dias. · rota: active_goal/collecting_continue}
36. BOT: 🎧 Ouvi: "Já falei umas três vezes: eu busco e levo pra…"
37. BOT: Entendi, Adriano. 🙂 Antes eu tinha anotado o cliente como Seu Abreu, mas agora apareceu Cliente. Qual dos dois está certo?
   [botões: Vale o novo | Fica como estava]
38. ADRIANO: [tocou: Vale o novo]
39. BOT: Atualizado: cliente: Cliente. O valor anterior ficou guardado no histórico. 📝
40. BOT: Pronto, Adriano! Já tenho o que preciso sobre o criado-mudo de Cliente. Dá uma conferida:

• móvel: criado-mudo (novo, azul)
• trabalho: pintura
• cliente: Cliente
• só por fora
• estado: bom
• sem consertos
• observações: cor: azul marinho; também citado: Dona Isa; tempo que ele estima: 3 a 5 dias
• tamanho: medio
• aplicação: pincel
• prazo: Ela não precisa buscar nem entregar, eu que busco e levo pra eles depois. Acho que fica entre 3 e 5 dias, a cor é azul marinho. Ah, e aquele negócio do cliente ali, pode deixar o Seu Abreu mesmo
• buscar

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
41. ADRIANO: [tocou: Quero corrigir]
42. BOT: Beleza, o que você quer corrigir? Pode falar do jeito que preferir, por exemplo: "a altura é 1,90" ou "vai ser decapê". 🛠️
43. ADRIANO (áudio): Corrige o seguinte: o cliente é Seu Abreu e Dona Isa, não só Cliente. E no prazo tira essa parte da entrega, eu busco e levo, o cliente fica com a mesa. O resto tá certo: criado-mudo, pintura, só por fora, estado bom, sem conserto, azul marinho, tamanho médio, pincel, uns 3 a 5 dias.
   {entendido: corrigir: o cliente é Seu Abreu e Dona Isa (não só Cliente). Corrigir o prazo: remover a parte sobre entrega; ele busca e leva o criado-mudo, o cliente fica com a mesa. O resto está certo: criado-mudo (novo, azul), pintura, só por fora, estado bom, sem consertos, cor azul marinho, tamanho médio, aplicação pincel, prazo de 3 a 5 dias. · rota: active_goal/collecting_continue}
44. BOT: 🎧 Ouvi: "Corrige o seguinte: o cliente é Seu Abreu e Dona…"
45. BOT: Corrigido: cliente é Seu Abreu (antes estava Cliente). Guardei o histórico. ✅
46. BOT: Corrigido: móvel criado-mudo (novo, azul), do jeito que estava. Guardei o histórico. 🪵
47. BOT: Pronto, Adriano! Já tenho o que preciso sobre o criado-mudo do Seu Abreu. Dá uma conferida:

• móvel: criado-mudo (novo, azul)
• trabalho: pintura
• cliente: Seu Abreu
• só por fora
• estado: bom
• sem consertos
• observações: cor: azul, azul marinho; também citado: Dona Isa, Seu Abreu; tempo que ele estima: 3 a 5 dias
• tamanho: medio
• aplicação: pincel
• prazo: Ela não precisa buscar nem entregar, eu que busco e levo pra eles depois. Acho que fica entre 3 e 5 dias, a cor é azul marinho. Ah, e aquele negócio do cliente ali, pode deixar o Seu Abreu mesmo
• buscar

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
48. ADRIANO: [tocou: Pode calcular]
49. BOT: 🧮 Prontinho, fiz as contas do criado-mudo do Seu Abreu!

💰 Minha sugestão é cobrar R$ 484,00.

⚠️ Menos que R$ 390,00 você começa a ter prejuízo.
🛒 Vai precisar comprar uns R$ 211,00 de material.
⏱️ Dá umas 8 horas de trabalho.
🚚 O frete não está na conta. Se for cobrar, é só acrescentar.
📏 Fiz com a medida aproximada, então pode variar um pouco.

E aí, você concorda com esse valor? 🤝
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
50. ADRIANO: [tocou: 👍 Concordo]
51. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
52. BOT: Fechado! ✅ Valor final: R$ 484,00 📄 Te mandei o PDF do orçamento pra você encaminhar pro Seu Abreu.
53. BOT: Quando o cliente responder, me avisa aqui: 👇
   [botões: 👍 Cliente aceitou | 👎 Cliente recusou]
54. ADRIANO: [tocou: 👍 Cliente aceitou]
55. BOT: Boa! ✅ Anotei que o orçamento do criado-mudo do Seu Abreu foi aceito por R$ 484,00.

Entrada recomendada: R$ 211,00. 💰
```

</details>

## licele-cama — Cama queen da Dona Licele (medida do colchão é só referência)

Notas: entendimento 2 · naturalidade 2 · acessibilidade 3 · uma_pergunta_por_vez 3 · sem_invencao 2 · eficiencia 2 · conclusao 4 · 82s

- ✅ 1 serviço
- ✅ cama
- ✅ Dona Licele
- ✅ verniz

> O Adriano chegou ao valor e concordou (R$ 792), mas o bot repetiu perguntas já respondidas (tamanho três vezes, frete duas), inventou 'laterais' e 'estado: bom', não entendeu a correção e tratou a medida 'acho que' como firme. O ritmo foi lento e irritou o usuário. Deve ser mais atento ao que já foi dito.

- [media] (perdeu_informacao) turno 6: Resumo inicial diz 'estado: bom' sem que ele tenha dito; não registra queen, cabeceira e peseira, riscos.
- [alta] (inventou) turno 10: Incluiu 'laterais' que o Adriano nunca falou e ainda perguntou sobre elas no turno 7.
- [media] (pergunta_repetida) turno 10: Perguntou o tamanho da cama (queen) que ele já tinha dito duas vezes (turnos 4 e 8).
- [alta] (nao_entendeu) turno 13: Não entendeu a correção sobre lateral e queen; respondeu com exemplo irrelevante ('altura é 1,90').
- [media] (nao_entendeu) turno 16: Respondeu 'tamanho grande' e 'Corrigido: móvel cama', confuso e sem mostrar que removeu laterais.
- [alta] (pergunta_repetida) turno 21: Repetiu a pergunta do tamanho da cama pela terceira vez, mesmo já respondida.
- [media] (texto_longo) turno 24: Mensagem longa com medidas de colchão e explicação; pergunta de medida com várias instruções.
- [alta] (inventou) turno 27: Registrou 1,7 × 2,1 m como medida firme, mas ele disse 'acho' e preferiu usar o colchão; não deixou a referência anotada.
- [media] (pergunta_repetida) turno 30: Perguntou transporte/frete após ele já ter dito que não precisa de frete (turnos 4 e 28), e ignorou o 'pode fechar o valor'.
- [media] (pergunta_repetida) turno 33: Insistiu perguntando como a cama chegou, repetindo a mesma questão de frete.
- [baixa] (jargao) turno 37: Resumo em lista seca, com 'fundura', 'estado: bom' inventado e entradas duplicadas; pouco natural.
- [baixa] (jargao) turno 39: Valor R$ 792 fica acima da faixa estimada de R$ 376–654 sem explicação, e 'prejuízo' em tom seco.
- [baixa] (travou) turno 41: PDF não gerado; apenas avisou o administrador, objetivo parcial.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, tudo bem? Queria registrar um serviço aqui, é um móvel da dona Licele. Vou te falar por partes, tá?
   {entendido: E aí, tudo bem? Quero registrar um serviço, é um móvel da dona Licele. Vou falar por partes. · rota: global/new_job}
2. BOT: 🎧 Ouvi: "E aí, tudo bem? Queria registrar um serviço aqui, é…"
3. BOT: Claro, bora nessa! 🪵 Qual é o móvel da Dona Licele?
4. ADRIANO (áudio): Ah, é uma cama queen. Vou lixar e envernizar ela inteira, cabeceira e peseira. Tem uns riscos, então precisa lixar bem antes. Eu uso pincel. Não precisa de frete, eu mesmo levo.
   {entendido: (igual) · rota: pending_answer/answer}
5. BOT: 🎧 Ouvi: "Ah, é uma cama queen. Vou lixar e envernizar ela…"
6. BOT: Beleza, serviço novo anotado:
• móvel: cama
• trabalho: verniz
• cliente: Dona Licele
• estado: bom

Vou te perguntando o resto aos pouquinhos, tá? Pode responder do jeito que for mais fácil, áudio ou texto.
7. BOT: Anotado: cama queen, lixar e envernizar inteira, com cabeceira e peseira. 🪵 Você vai trabalhar a cama toda (cabeceira, peseira e laterais) ou só a cabeceira?
8. ADRIANO (áudio): Toda a cama, cabeceira e peseira. Os riscos são só na parte de cima mesmo, mas quero lixar bem a peça inteira pra ficar uniforme.
   {entendido: Toda a cama (cabeceira, peseira e laterais). Os riscos são só na parte de cima, mas quer lixar a peça inteira para ficar uniforme. · rota: pending_answer/service_scope_answer}
9. BOT: 🎧 Ouvi: "Toda a cama, cabeceira e peseira. Os riscos são só…"
10. BOT: Beleza, então é a cama inteira, com cabeceira, peseira e laterais. Lixar tudo pra ficar uniforme faz sentido. 🪵

Essa cama é qual destas: cama de solteiro, cama de casal padrão, cama queen ou cama king?
11. ADRIANO (áudio): Ah, é queen sim, eu já falei. E não tem lateral não, é só cabeceira e peseira. Lixa tudo pra ficar uniforme, mas é isso.
   {entendido: (igual) · rota: active_goal/collecting_continue}
12. BOT: 🎧 Ouvi: "Ah, é queen sim, eu já falei. E não tem…"
13. BOT: Não entendi bem o que mudar. Pode me dizer de outro jeito, tipo: "a altura é 1,90" ou "a cliente é a dona Ana".
14. ADRIANO (áudio): Ah, entendi, errei eu. É cama queen, sem lateral, só cabeceira e peseira. Lixar tudo pra ficar uniforme, e envernizar. Pode seguir.
   {entendido: corrigir: a cama é queen, sem laterais, só cabeceira e peseira. Lixar a peça inteira pra ficar uniforme e envernizar. Pode seguir. · rota: active_goal/collecting_continue}
15. BOT: 🎧 Ouvi: "Ah, entendi, errei eu. É cama queen, sem lateral, só…"
16. BOT: Anotado: tamanho grande, então.
17. BOT: Corrigido: móvel cama (do jeito que já estava). Guardei o histórico. 🪵
18. BOT: 💰 Só pra você ter uma ideia: pelo que já sei, deve ficar entre R$ 376,00 e R$ 654,00 (sem contar frete). Com o resto das respostas eu fecho o valor.

Falta pouquinho. Tem algum conserto pra fazer antes? Uma perna bamba, uma lasca, uma tábua solta. Se não tiver, só "não".
19. ADRIANO (áudio): Não, não tem conserto nenhum. Só os riscos mesmo, que é pra lixar bem antes. A cama tá firme.
   {entendido: não tem conserto; só os riscos, que devem ser lixados bem antes. A cama está firme. · rota: pending_answer/job_field_answer}
20. BOT: 🎧 Ouvi: "Não, não tem conserto nenhum. Só os riscos mesmo, que…"
21. BOT: Show! Anotei: sem consertos. 👌
Anotei também: móvel: cama (riscos para lixar, cama firme, sem conserto).

Essa cama é qual destes: cama de solteiro, cama de casal padrão, cama queen ou cama king?
22. ADRIANO (áudio): Já falei que é queen, Dona Licele... quer dizer, é cama queen sim. Sem lateral, só cabeceira e peseira. Pode anotar e seguir.
   {entendido: cama queen; sem lateral, só cabeceira e peseira · rota: active_goal/collecting_continue}
23. BOT: 🎧 Ouvi: "Já falei que é queen, Dona Licele... quer dizer, é…"
24. BOT: Anotado: cama queen, sem lateral, só cabeceira e peseira. 🛏️

Queen normalmente é o colchão de 158 × 198 cm, mas a estrutura da cama costuma ser um pouco maior.

Você consegue me passar a largura e o comprimento da estrutura, por fora? 📏

Pode ser aproximado, em centímetros ou metros.

Se não tiver como medir agora, tudo bem: uso a medida do colchão como referência e deixo isso anotado.
25. ADRIANO (áudio): Não sei de cabeça não, tô na oficina e não medi. Acho que uns 170 de largura e uns 210 de comprimento, mas pode usar o colchão mesmo, tudo bem.
   {entendido: Não sei de cabeça, não medi (estou na oficina). Acho que a estrutura tem uns 170 cm de largura e uns 210 cm de comprimento, mas pode usar a medida do colchão mesmo, tudo bem. · rota: pending_answer/item_dimensions_answer}
26. BOT: 🎧 Ouvi: "Não sei de cabeça não, tô na oficina e não…"
27. BOT: Anotado: 1,7 × 2,1 m. 📏

Quase lá! Você vai aplicar o verniz com pincel, rolo ou pistola?
28. ADRIANO (áudio): Pincel. Não precisa de frete, a Dona Licele vem buscar na oficina. Pode fechar o valor aí.
   {entendido: pincel; sem frete, a cliente Dona Licele vem buscar na oficina; pode fechar o valor · rota: pending_answer/application_method_answer}
29. BOT: 🎧 Ouvi: "Pincel. Não precisa de frete, a Dona Licele vem buscar…"
30. BOT: Anotado: pincel. ✅

Última coisinha: o transporte. Você vai precisar buscar a cama, ou o cliente traz? E depois, você entrega ou ela vem pegar?
31. ADRIANO (áudio): Ela vem buscar na oficina, não precisa de frete nenhum. Pode fechar o valor aí.
   {entendido: (igual) · rota: active_goal/collecting_continue}
32. BOT: 🎧 Ouvi: "Ela vem buscar na oficina, não precisa de frete nenhum.…"
33. BOT: Entendi: a Dona Licele vem buscar na oficina quando ficar pronto. 🚚 E pra chegar até você: ela traz a cama ou você precisa buscar?
34. ADRIANO (áudio): Já falei, ela vem buscar na oficina, não precisa de frete. Pode fechar o valor. A cama já tá aqui comigo, ela trouxe e deixou.
   {entendido: Ela já trouxe a cama e deixou na oficina; não precisa de frete para chegar até mim. A Dona Licele vem buscar na oficina quando ficar pronto. Pode fechar o valor. · rota: pending_answer/logistics_answer}
35. BOT: 🎧 Ouvi: "Já falei, ela vem buscar na oficina, não precisa de…"
36. BOT: Certo, sem frete. 👍
37. BOT: Pronto, Adriano! Já tenho o que preciso sobre a cama da Dona Licele. Dá uma conferida:

• móvel: cama (riscos para lixar, cama firme, sem conserto)
• trabalho: verniz
• cliente: Dona Licele
• estado: bom
• trabalho na peça inteira
• tamanho: grande
• sem consertos
• medidas: largura 1,7 m, fundura 2,1 m
• aplicação: pincel
• sem frete

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
38. ADRIANO: [tocou: Pode calcular]
39. BOT: 🧮 Prontinho, fiz as contas da cama da Dona Licele!

💰 Minha sugestão é cobrar R$ 792,00.

⚠️ Menos que R$ 654,00 você começa a ter prejuízo.
🛒 Vai precisar comprar uns R$ 250,00 de material.
⏱️ Dá umas 12 horas de trabalho.

E aí, você concorda com esse valor? 🤝
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
40. ADRIANO: [tocou: 👍 Concordo]
41. BOT: Fechado! ✅ Valor final: R$ 792,00.

Só não consegui gerar o PDF agora. 😕 Já avisei o administrador, e o valor ficou guardado.
```

</details>

## preco-material-solvente — Preço de material na hora do orçamento: 'duas latas por 150' e 'não uso solvente'

Notas: entendimento 1 · naturalidade 1 · acessibilidade 2 · uma_pergunta_por_vez 2 · sem_invencao 1 · eficiencia 1 · conclusao 1 · 134s

- ❌ verniz = R$ 75 por lata (150 ÷ 2) — {"p":null,"s":"0.9"}
- ✅ embalagem 900 ml
- ✅ solvente continua sem preço (não usa)
- ❌ solvente fora deste orçamento — "{}"
- ❌ orçamento calculado

> A conversa travou em laço: o bot repetiu a pergunta do tipo da mesa cinco vezes e ainda gravou dados errados (estado 'danificado', altura 1 m). Não registrou o preço do verniz (150 reais por duas latas) como preço, nem a informação de que não usa solvente. O orçamento não foi calculado e o Adriano acabou irritado.

- [alta] (inventou) turno 8: Ele pediu 'está bom' e o bot registrou 'danificado', trocando o estado da peça.
- [alta] (inventou) turno 11: Mudou a altura de 0,75 m para 1 m sem ele ter dito isso. Os 60 cm do tampo também nunca foram registrados.
- [alta] (perdeu_informacao) turno 12: O ajuste do móvel apagou os detalhes anteriores (cozinha, retangular, sem frete) e ignorou 'tampo e pés, tudo por fora'.
- [media] (nao_entendeu) turno 6: Ele já tinha dito 'mesa de cozinha, retangular' e o bot respondeu 'não entendi' sobre o estado, o que não faz sentido. A pergunta sobre o estado também só veio depois da pergunta sobre o tipo.
- [alta] (pergunta_repetida) turno 16: Perguntou de novo o tipo da mesa, que ele já tinha dito no turno 5. Repetiu essa mesma pergunta nos turnos 20, 24 e 28 mesmo com ele respondendo todas as vezes.
- [alta] (nao_entendeu) turno 19: Entendeu errado o preço do verniz: disse 'você não precisa comprar agora' e falou em 'custo de reposição', quando ele só informou que já comprou duas latas por 150 reais.
- [media] (jargao) turno 19: Usou 'custo de reposição' e 'valor do verniz usado', jargão que confunde o Adriano.
- [alta] (travou) turno 32: Ficou em laço, sem avançar para as contas do orçamento depois de ele dar tudo diversas vezes. Ele perdeu a paciência no turno 29.
- [media] (tom) turno 14: Ele insiste em corrigir o estado e o bot ignora a correção. Também não reconhece a frustração dele nem pede desculpa.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): E aí, tudo certo? Peguei uma mesa da dona Ana pra envernizar. Ela tá boa, só precisa passar verniz por fora, sem conserto nenhum. O tampo é 1 metro por 60 cm, e ela tem 75 de altura. Vou usar pincel e não tem frete. Dá pra você me ajudar a fazer o orçamento?
   {entendido: (igual) · rota: global/new_job}
2. BOT: 🎧 Ouvi: "E aí, tudo certo? Peguei uma mesa da dona Ana…"
3. BOT: Beleza, serviço novo anotado:
• móvel: mesa (sem conserto, verniz por fora, sem frete)
• trabalho: verniz
• cliente: Dona Ana
• aplicação: pincel
• sem consertos
• medidas: altura 0,75 m

Agora vou te fazer umas perguntinhas, uma de cada vez, pra montar o orçamento. Pode responder por áudio ou escrevendo.
4. BOT: Boa, Adriano! Anotei a mesa da dona Ana pra envernizar, por fora, sem conserto e sem frete. 🎨

Essa mesa é qual destes tipos: mesa retangular, mesa de centro, mesa redonda ou mesa de cozinha? 🪵
5. ADRIANO: É uma mesa de cozinha, retangular, com tampo de 1 metro por 60 cm. Tem 75 de altura, como já falei.
   {entendido: mesa de cozinha, retangular; tampo de 1 m por 60 cm; altura 75 cm (0,75 m) · rota: active_goal/collecting_continue}
6. BOT: Anotei também: móvel: mesa (sem conserto, verniz por fora, sem frete, cozinha, retangular).

Opa, essa eu não entendi bem. O estado da peça muda o tempo de preparo: uma peça bem judiada leva bem mais horas.

Por exemplo: "está bom", "precisa de reparos" ou "está bem estragado".
7. ADRIANO: Ah, tá boa mesmo, sem nada quebrado, só o verniz gasto por fora. Pode colocar como 'está bom'.
   {entendido: estado: está bom; sem nada quebrado, só o verniz gasto por fora · rota: active_goal/collecting_continue}
8. BOT: Certo, estado: danificado. 👍

Você vai trabalhar só no tampo ou na mesa de cozinha inteira?
9. ADRIANO (áudio): Não, é a mesa inteira, tampo e pés, tudo por fora. O tampo é 1 metro por 60, a altura 75. Só o verniz por fora mesmo, sem mexer em mais nada. Ah, e o estado tá bom, não danificado, só o verniz gasto.
   {entendido: corrigir: o estado é "está bom", não danificado; só o verniz está gasto por fora. Resposta: é a mesa inteira, tampo e pés, tudo por fora, só verniz, sem mexer em mais nada. Tampo 1 metro por 60, altura 75. · rota: active_goal/collecting_continue}
10. BOT: 🎧 Ouvi: "Não, é a mesa inteira, tampo e pés, tudo por…"
11. BOT: Ajustei: medidas: altura 1 m (antes: medidas: altura 0,75 m). Histórico guardado. 📏
12. BOT: Ajustei: móvel: mesa (antes: móvel: mesa (sem conserto, verniz por fora, sem frete, cozinha, retangular)). Histórico guardado. 🪵
13. BOT: Falta só mais uma coisa: o transporte. O cliente traz a mesa aí, ou você vai precisar buscar? E depois, você entrega ou o cliente vem pegar? 🚚
14. ADRIANO (áudio): Não, não precisa buscar nem entregar, a dona Ana traz a mesa aqui e ela vem pegar depois de pronta. Sem frete mesmo. Ah, e tem mais uma coisa: o estado é bom, não danificado, só o verniz gasto. Já falei isso, mas quero deixar certo.
   {entendido: Transporte: a cliente (dona Ana) traz a mesa até a oficina e vem buscar depois de pronta; sem frete. Estado: bom, não danificado, só o verniz gasto por fora. · rota: pending_answer/logistics_answer}
15. BOT: 🎧 Ouvi: "Não, não precisa buscar nem entregar, a dona Ana traz…"
16. BOT: Certo, sem frete. 👍

Essa mesa é qual destas: mesa retangular, mesa de centro, mesa redonda ou mesa de cozinha?
17. ADRIANO (áudio): Isso, mesa de cozinha retangular, já falei. Tampo 1 metro por 60, altura 75. Sem frete, a dona Ana traz e pega aqui. O estado é bom, só o verniz gasto por fora, sem conserto. Verniz eu já comprei, duas latas de 900 ml, deu 150 reais no total. Solvente eu não uso nesse. Pincel, tá certo.
   {entendido: mesa de cozinha retangular; tampo 1 metro por 60; corrigir: altura 75 (não 1 m); sem frete, a dona Ana traz a mesa e pega aqui depois de pronta; corrigir: estado bom, não danificado, só o verniz gasto por fora, sem conserto; verniz já comprado: 2 latas de 900 ml, gasto total de 150 reais; não usa solvente nesse; aplicação com pincel, confirmado. · rota: active_goal/collecting_continue}
18. BOT: 🎧 Ouvi: "Isso, mesa de cozinha retangular, já falei. Tampo 1 metro…"
19. BOT: Ótimo, você não precisa comprar agora. Vou incluir o valor do verniz usado no orçamento, porque ele tem custo de reposição.
20. BOT: Essa mesa é qual destes: mesa retangular, mesa de centro, mesa redonda ou mesa de cozinha?
21. ADRIANO (áudio): Isso, já falei: mesa de cozinha retangular. Tampo 1 metro por 60, altura 75. Estado bom, só o verniz gasto por fora, sem conserto. Verniz já comprei, duas latas de 900 ml, deu 150 reais. Solvente não uso nessa. Pincel. Sem frete, a dona Ana traz e pega aqui depois de pronta. Pode seguir com o orçamento.
   {entendido: mesa de cozinha retangular; tampo 1 m por 60 cm, altura 75 cm; estado bom, só o verniz gasto por fora, sem conserto; verniz já comprado, duas latas de 900 ml, total R$ 150,00; sem solvente; aplicação com pincel; sem frete, a dona Ana traz a mesa e pega aqui depois de pronta; pode seguir com o orçamento · rota: active_goal/collecting_continue}
22. BOT: 🎧 Ouvi: "Isso, já falei: mesa de cozinha retangular. Tampo 1 metro…"
23. BOT: Boa! Então você não precisa comprar mais verniz agora. 🎨 Vou incluir no orçamento o valor das duas latas, porque ele tem custo de reposição.
24. BOT: Essa mesa é qual destes: mesa retangular, mesa de centro, mesa redonda ou mesa de cozinha?
25. ADRIANO (áudio): Já falei, mesa de cozinha retangular. Tampo 1 metro por 60, altura 75. Estado bom, só o verniz gasto por fora, sem conserto. Verniz eu já comprei, duas latas de 900 ml, deu 150 reais. Solvente não uso nessa. Pincel. Sem frete, a dona Ana traz e pega aqui depois de pronta. Pode seguir com o orçamento.
   {entendido: mesa de cozinha retangular; tampo 1 metro por 60, altura 75; estado bom, só o verniz gasto por fora, sem conserto; verniz já comprado, duas latas de 900 ml, total 150 reais; sem solvente; aplicação com pincel; sem frete, a dona Ana traz e pega aqui depois de pronta; pode seguir com o orçamento · rota: active_goal/collecting_continue}
26. BOT: 🎧 Ouvi: "Já falei, mesa de cozinha retangular. Tampo 1 metro por…"
27. BOT: Boa, então você não precisa comprar verniz agora. 🎨 Vou incluir no orçamento o valor das duas latas, porque ele tem custo de reposição.
28. BOT: Essa mesa é qual destes: mesa retangular, mesa de centro, mesa redonda ou mesa de cozinha?
29. ADRIANO (áudio): Rapaz, eu já falei isso umas três vezes! É mesa de cozinha retangular. Tampo 1 metro por 60, altura 75. Estado bom, só o verniz gasto por fora, sem conserto. Verniz eu já comprei, duas latas de 900 ml, deu 150 reais no total. Solvente não uso nessa, só pincel. Sem frete, a dona Ana traz e pega aqui depois de pronta. Pode seguir com o orçamento, por favor.
   {entendido: mesa de cozinha retangular; tampo 1 metro por 60, altura 75; estado bom, só o verniz gasto por fora, sem conserto; verniz já comprado, duas latas de 900 ml, total 150 reais; sem solvente, só pincel; sem frete, a dona Ana traz e pega aqui depois de pronta; pode seguir com o orçamento. · rota: active_goal/collecting_continue}
30. BOT: 🎧 Ouvi: "Rapaz, eu já falei isso umas três vezes! É mesa…"
31. BOT: Ótimo, você não precisa comprar agora. Vou incluir o valor do verniz usado no orçamento, porque ele tem custo de reposição.
32. BOT: Anotado: mesa de cozinha retangular. Pode seguir?
33. ADRIANO (áudio): Pô, desculpa, é isso mesmo: mesa de cozinha retangular, tampo 1 metro por 60, altura 75. Estado bom, só o verniz gasto por fora, sem conserto. Verniz já comprei, duas latas de 900 ml, deu 150 reais no total. Solvente não uso nessa, só pincel. Sem frete, a dona Ana traz e pega aqui depois de pronta. Pode seguir com o orçamento.
   {entendido: Sim, confirmo: mesa de cozinha retangular, tampo 1 metro por 60, altura 75. Estado bom, só o verniz gasto por fora, sem conserto. Verniz já comprado: duas latas de 900 ml, total 150 reais. Sem solvente, só pincel. Sem frete, a dona Ana traz e pega aqui depois de pronta. Pode seguir com o orçamento. · rota: active_goal/collecting_continue}
34. BOT: 🎧 Ouvi: "Pô, desculpa, é isso mesmo: mesa de cozinha retangular, tampo…"
35. BOT: Ótimo, então você não precisa comprar verniz agora. 🎨 Vou incluir no orçamento o valor das duas latas, porque ele tem custo de reposição.
36. BOT: Essa mesa é qual destes: mesa retangular, mesa de centro, mesa redonda ou mesa de cozinha?
37. ADRIANO: mesa de cozinha
   {entendido: (igual) · rota: active_goal/collecting_continue}
38. BOT: Anotado: mesa de cozinha. 🪵

Você vai trabalhar só no tampo ou na mesa de cozinha inteira?
39. ADRIANO: Na mesa inteira, por fora. Tampo e pés, só o verniz. Sem conserto nem nada.
   {entendido: Mesa inteira, por fora: tampo e pés, só o verniz. Sem conserto. · rota: active_goal/collecting_continue}
40. BOT: Anotado: a peça inteira.
41. BOT: Pronto, Adriano! Já tenho o que preciso sobre a mesa da Dona Ana. Dá uma conferida:

• móvel: mesa
• trabalho: verniz
• cliente: Dona Ana
• aplicação: pincel
• sem consertos
• medidas: altura 1 m
• estado: danificado
• sem frete
• já tem o material
• trabalho na peça inteira

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
42. ADRIANO (áudio): Opa, quase! Tá errado: a altura é 75 cm, não 1 m. O tampo é 1 metro por 60 cm. E a mesa tá em bom estado, só o verniz gasto por fora. Fora isso tá certo, pode calcular.
   {entendido: corrigir: a altura da mesa é 75 cm (não 1 m); o tampo tem 1 metro por 60 cm; o estado da mesa é bom, só o verniz gasto por fora (não danificado); o resto está certo; pode calcular. · rota: active_goal/confirm_calc_continue}
43. BOT: 🎧 Ouvi: "Opa, quase! Tá errado: a altura é 75 cm, não…"
44. BOT: Corrigido: móvel: mesa (antes: móvel: mesa). Guardei o histórico.
45. BOT: Pronto, Adriano! Já tenho o que preciso sobre a mesa da Dona Ana. Dá uma conferida:

• móvel: mesa
• trabalho: verniz
• cliente: Dona Ana
• aplicação: pincel
• sem consertos
• medidas: altura 1 m
• estado: danificado
• sem frete
• já tem o material
• trabalho na peça inteira

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
46. ADRIANO (áudio): Não, não, tá errado ainda! A altura é 75 cm, não 1 metro. O tampo é 1 metro por 60 cm. E a mesa tá em bom estado, só o verniz gasto por fora, sem conserto. Fora isso tá certo. Pode corrigir aí e me mostra de novo.
   {entendido: corrigir: a altura da mesa é 75 cm (não 1 m). O tampo tem 1 metro por 60 cm. A mesa está em bom estado, só o verniz gasto por fora, sem conserto. O resto está certo. Mostrar o resumo corrigido de novo. · rota: active_goal/confirm_calc_continue}
47. BOT: 🎧 Ouvi: "Não, não, tá errado ainda! A altura é 75 cm,…"
48. BOT: Corrigido: móvel: mesa (novo) (antes: móvel: mesa). Guardei o histórico.
49. BOT: Corrigido: estado: bom (antes: estado: danificado). Guardei o histórico.
50. BOT: Pronto, Adriano! Já tenho o que preciso sobre a mesa da Dona Ana. Dá uma conferida:

• móvel: mesa (novo)
• trabalho: verniz
• cliente: Dona Ana
• aplicação: pincel
• sem consertos
• medidas: altura 1 m
• estado: bom
• sem frete
• já tem o material
• trabalho na peça inteira

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
51. ADRIANO (áudio): Ainda tá errado a altura, mano! Tá 1 metro, tem que ser 75 cm. O tampo é 1 metro por 60 cm, e a mesa de cozinha tá boa, só o verniz gasto por fora. Corrige a altura pra 75 cm e me mostra de novo. Pincel, sem frete, sem conserto, já tenho o verniz, duas latas de 900 ml que comprei por 150 reais.
   {entendido: corrigir: a altura é 75 cm (não 1 m). O tampo é 1 metro por 60 cm. A mesa de cozinha está em bom estado, só o verniz gasto por fora, sem conserto. Trabalho: verniz, aplicação com pincel, sem frete, trabalho na peça inteira. Já tem o verniz: duas latas de 900 ml, compradas por R$ 150. Mostrar os dados corrigidos de novo. · rota: active_goal/confirm_calc_continue}
52. BOT: 🎧 Ouvi: "Ainda tá errado a altura, mano! Tá 1 metro, tem…"
53. BOT: Pronto, Adriano! Já tenho o que preciso sobre a mesa da Dona Ana. Dá uma conferida:

• móvel: mesa (novo)
• trabalho: verniz
• cliente: Dona Ana
• aplicação: pincel
• sem consertos
• medidas: altura 1 m
• estado: bom
• sem frete
• já tem o material
• trabalho na peça inteira

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
54. ADRIANO (áudio): Ainda não corrigiu a altura, cara! Tá com 1 metro, tem que ser 75 cm. O tampo é 1 metro por 60 cm, a mesa de cozinha tá boa, só o verniz gasto por fora. Muda a altura pra 75 cm, aí você me mostra de novo. Pincel, sem frete, sem conserto, já tenho o verniz: duas latas de 900 ml que comprei por 150 reais no total.
   {entendido: corrigir: a altura da mesa é 75 cm (não 1 m). O tampo é 1 m por 60 cm. A mesa de cozinha está em bom estado, só o verniz gasto por fora, sem conserto. Aplicação: pincel. Sem frete. Já tem o verniz: duas latas de 900 ml, compradas por 150 reais no total. · rota: active_goal/confirm_calc_continue}
55. BOT: 🎧 Ouvi: "Ainda não corrigiu a altura, cara! Tá com 1 metro,…"
56. BOT: Corrigido: móvel: mesa (antes: móvel: mesa (novo)). Guardei o histórico.
57. BOT: Pronto, Adriano! Já tenho o que preciso sobre a mesa da Dona Ana. Dá uma conferida:

• móvel: mesa
• trabalho: verniz
• cliente: Dona Ana
• aplicação: pincel
• sem consertos
• medidas: altura 1 m
• estado: bom
• sem frete
• já tem o material
• trabalho na peça inteira

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
58. ADRIANO (áudio): Ainda tá 1 metro, cara! A altura é 75 cm. O tampo é 1 metro por 60 cm, a mesa tá boa, só o verniz gasto por fora, sem conserto. Pincel, sem frete, já tenho o verniz, duas latas de 900 ml por 150 reais no total. Muda a altura pra 75 cm e me mostra de novo.
   {entendido: corrigir: a altura é 75 cm (não 1 m). O tampo é 1 metro por 60 cm. A mesa está boa, só o verniz gasto por fora, sem conserto. Aplicação: pincel. Sem frete. Já tem o verniz: duas latas de 900 ml, por 150 reais no total. Mostrar o resumo de novo com a altura 75 cm. · rota: active_goal/confirm_calc_continue}
59. BOT: 🎧 Ouvi: "Ainda tá 1 metro, cara! A altura é 75 cm.…"
60. BOT: Corrigido: móvel: mesa (novo) (antes: móvel: mesa). Guardei o histórico. 👍
61. BOT: Pronto, Adriano! Já tenho o que preciso sobre a mesa da Dona Ana. Dá uma conferida:

• móvel: mesa (novo)
• trabalho: verniz
• cliente: Dona Ana
• aplicação: pincel
• sem consertos
• medidas: altura 1 m
• estado: bom
• sem frete
• já tem o material
• trabalho na peça inteira

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
62. ADRIANO (áudio): Cara, o sistema continua mostrando altura 1 m! Não é 1 metro, é 75 cm. O tampo é 1 metro por 60 cm, a mesa tá boa, só o verniz gasto por fora, sem conserto. Pincel, sem frete, já tenho o verniz, duas latas de 900 ml por 150 reais no total. Por favor, muda a altura pra 75 cm e me mostra de novo.
   {entendido: corrigir: a altura da mesa é 75 cm (não 1 m). O tampo tem 1 metro por 60 cm. A mesa está boa, só o verniz está gasto por fora, sem conserto. Aplicação com pincel, sem frete. Já tem o verniz: duas latas de 900 ml, compradas por 150 reais no total. Mostrar o orçamento de novo com a altura em 75 cm. · rota: active_goal/confirm_calc_continue}
63. BOT: 🎧 Ouvi: "Cara, o sistema continua mostrando altura 1 m! Não é…"
64. BOT: Pronto, Adriano! Já tenho o que preciso sobre a mesa da Dona Ana. Dá uma conferida:

• móvel: mesa (novo)
• trabalho: verniz
• cliente: Dona Ana
• aplicação: pincel
• sem consertos
• medidas: altura 1 m
• estado: bom
• sem frete
• já tem o material
• trabalho na peça inteira

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
```

</details>

## pagamento-gasto — Pagamento e gasto no dia a dia

Notas: entendimento 4 · naturalidade 3 · acessibilidade 3 · uma_pergunta_por_vez 4 · sem_invencao 4 · eficiencia 3 · conclusao 5 · 31s

- ✅ pagamento de R$ 200
- ✅ gasto de R$ 90

> Os dois registros ficaram corretos no banco e o objetivo foi atingido. A conversa teve perguntas demais para um gasto simples (embalagens, serviço, confirmações duplas) e textos com jargão contábil, o que quebra a naturalidade de um parceiro de oficina.

- [media] (pergunta_desnecessaria) turno 8: Perguntou quantidade e tamanho das embalagens antes de registrar o gasto; ele só queria anotar os 90 reais. Soa como interrogatório e atrasa. Também a justificativa "para eu aprender" é vaga.
- [media] (pergunta_repetida) turno 11: Perguntou para qual serviço era o gasto só depois de várias perguntas; podia ter perguntado logo, e ele tinha acabado de falar da cristaleira, o que já sugeria o contexto.
- [baixa] (confirmacao_redundante) turno 13: Pediu confirmação dupla (pagamento e gasto) com botão "Não, corrigir o valor" mesmo quando o erro seria de outro campo; texto "responda sim ou não" repetitivo.
- [media] (jargao) turno 15: Mensagem longa com "preço de reposição" e explicação de contabilidade ("dinheiro que saiu", "sem contar duas vezes"), técnica demais para ele.
- [baixa] (jargao) turno 5: "Ainda não temos o valor fechado desse serviço" é informação não pedida e meio burocrática.
- [baixa] (tom) turno 17: Fechamento seco; não retomou que a nota ficou para depois nem resumiu o que foi registrado.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): Oi, e aí! Então, a dona Maria da cristaleira pagou a entrada hoje, duzentos reais. Quero registrar isso aí pra não esquecer.
   {entendido: Registrar pagamento de entrada da dona Maria, referente à cristaleira: 200 reais, pago hoje. · rota: global/register_payment}
2. BOT: 🎧 Ouvi: "Oi, e aí! Então, a dona Maria da cristaleira pagou…"
3. BOT: Beleza, Adriano! Vou anotar: recebi R$ 200,00 da Dona Maria, referente à cristaleira da Dona Maria (S-0001). 💰

Tá certo? Pode responder "sim" ou "não".
   [botões: Sim, pode anotar | Não, corrigir o valor]
4. ADRIANO: [tocou: Sim, pode anotar]
5. BOT: Anotado! 💰 Recebido até agora: R$ 200,00. Ainda não temos o valor fechado desse serviço.
6. ADRIANO (áudio): Isso, e também gastei 90 reais em verniz numa loja hoje, quero anotar esse gasto também.
   {entendido: Registrar gasto de R$ 90,00 em verniz numa loja hoje. · rota: global/register_expense}
7. BOT: 🎧 Ouvi: "Isso, e também gastei 90 reais em verniz numa loja…"
8. BOT: Só para eu aprender direitinho, Adriano: foram quantas embalagens de verniz e qual era o tamanho de cada uma?

Por exemplo: “1 lata de 900 ml” ou “2 galões de 3,6 litros”.
9. ADRIANO (áudio): Ah, foi uma lata só de 900 ml, de verniz fosco. Não lembro a marca direito, foi a loja ali do centro, se precisar eu vejo a nota depois.
   {entendido: 1 lata de 900 ml de verniz fosco; marca não lembrada, loja do centro; nota pode ser vista depois. · rota: pending_answer/answer}
10. BOT: 🎧 Ouvi: "Ah, foi uma lata só de 900 ml, de verniz…"
11. BOT: Esse gasto de R$ 90,00 é para qual serviço?
   [botões: A cristaleira da Dona Maria | Estoque geral (sem serviço)]
12. ADRIANO: [tocou: Estoque geral (sem serviço)]
13. BOT: Anotado, Adriano: compra de verniz, R$ 90,00, para o estoque geral. 🎨

Tá certo? Pode responder "sim" ou "não".
   [botões: Sim, pode anotar | Não, corrigir o valor]
14. ADRIANO: [tocou: Sim, pode anotar]
15. BOT: Anotado: compra de verniz, R$ 90,00. 🎨

Também atualizei o preço de reposição desse material com o que você confirmou. Obrigado por me ensinar! 🙂

Isso conta como dinheiro que saiu. O valor do material usado em cada serviço entra no orçamento separado, sem contar duas vezes.
16. ADRIANO: Valeu, Adriano! Então tá: 200 da Dona Maria registrado e os 90 do verniz também. Não precisa se preocupar com a nota, pode deixar isso pra depois. Era isso que você queria anotar hoje.
17. BOT: Por nada, Adriano! Quando precisar, é só chamar. 😊
```

</details>

## andamento-nao-andamento — Andamento: 'comecei' muda; 'quando ficar pronta ela busca' não muda

Notas: entendimento 1 · naturalidade 2 · acessibilidade 3 · uma_pergunta_por_vez 3 · sem_invencao 1 · eficiencia 1 · conclusao 1 · 105s

- ✅ serviço em execução (não concluído)

> O bot errou o andamento: propôs 'concluído' quando ele pediu só 'começou/lixando'. Depois inverteu fatos que ele disse claramente (por fora, só pincel, estado) e repetiu perguntas já respondidas. O resumo e o orçamento saíram com dados errados e o objetivo não foi atingido.

- [alta] (nao_entendeu) turno 8: Adriano pediu para anotar só que começou, que está lixando e que a Dona Maria busca, sem marcar concluído. O bot propôs marcar como concluído, o oposto do pedido.
- [alta] (inventou) turno 24: Ele disse 'só por fora' e o bot anotou 'por dentro e por fora', invertendo o fato. Isso afeta o orçamento e entrou no resumo final.
- [alta] (inventou) turno 28: Mudou o estado de 'danificado' para 'reparos' sem ele pedir, tratando como correção. Ele falava de conserto de estrutura, não do estado.
- [media] (pergunta_repetida) turno 25: Repetiu a pergunta sobre conserto e por fora/dentro, que ele já tinha respondido, e ignorou o 'só por fora'.
- [alta] (inventou) turno 33: Ele disse 'só pincel' e o bot anotou 'pincel e rolo', contrariando o que foi dito.
- [media] (fluxo_confuso) turno 12: Após o cancelamento, a resposta foi um cartão de serviço com 'Ainda falta saber' e o botão 'Continuar este'. Não respondeu à dúvida dele e reabriu o questionário sobre algo já em execução.
- [media] (perdeu_informacao) turno 12: Não guardou que a Dona Maria vem buscar quando ficar pronta como observação. Também registrou o trabalho como 'pátina', sem ele ter dito isso.
- [media] (perdeu_informacao) turno 29: Ele pediu para anotar as portinhas que rangem. O bot disse 'sem consertos' e deixou para depois, mas esse detalhe não aparece no resumo final.
- [baixa] (jargao) turno 21: Deu faixa de preço antes de fechar as respostas, com dados errados, o que confunde. A mensagem final também ficou truncada, com 'F'.
- [alta] (inventou) turno 37: O resumo final traz dados errados (por dentro e por fora, estado reparos, pincel) e o orçamento de R$ 1.752 sai desses dados. O andamento 'lixando' não foi registrado.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): Oi, tudo bem? Então, comecei hoje a cristaleira da dona Maria. Tirei a tinta velha e comecei a lixar, ainda tá no meio. Quando ficar pronta ela vem buscar. Anota aí pra mim.
   {entendido: (igual) · rota: global/job_progress}
2. BOT: 🎧 Ouvi: "Oi, tudo bem? Então, comecei hoje a cristaleira da dona…"
3. BOT: Anotado: a cristaleira da Dona Maria está em execução. 🛠️

Vou marcar assim, certo?
   [botões: Confirmar | Cancelar]
4. ADRIANO: [tocou: Confirmar]
5. BOT: Pronto, a cristaleira da Dona Maria agora está em execução. 🛠️
6. ADRIANO (áudio): Isso, pode deixar. Só queria ver uma coisa: a cristaleira ainda não tá pronta, né? Então anota só que começou e que tá lixando, e que a dona Maria vem buscar quando ficar pronta, sem marcar nada como concluído.
   {entendido: (igual) · rota: global/job_progress}
7. BOT: 🎧 Ouvi: "Isso, pode deixar. Só queria ver uma coisa: a cristaleira…"
8. BOT: Vou marcar a cristaleira da Dona Maria como concluído. Confirma?
   [botões: Confirmar | Cancelar]
9. ADRIANO: [tocou: Cancelar]
10. BOT: Beleza, cancelei. Nada foi anotado. 👍

Quando quiser, é só me contar outra coisa.
11. ADRIANO: Isso mesmo, a cristaleira ainda não tá pronta. Ela continua em execução, lixando, e a dona Maria vem buscar quando ficar pronta. Não marquei nada como concluído, só o andamento que você falou. Pode deixar assim?
   {entendido: (igual) · rota: global/query_status}
12. BOT: A cristaleira da Dona Maria — pátina (S-0001)
Situação: Em execução
Já anotado: móvel: cristaleira; cliente: Dona Maria; trabalho: pátina
Ainda falta saber: como o móvel está; o tamanho do móvel; se é só por fora ou por dentro também; se precisa de conserto
   [botões: Continuar este]
13. ADRIANO: [tocou: Continuar este]
14. BOT: Beleza, vamos seguir! Da cristaleira da Dona Maria eu já tenho: móvel: cristaleira; cliente: Dona Maria; trabalho: pátina. 🎨
15. BOT: E como ela está hoje? Tá em bom estado ou precisa de reparos ou tá bem estragada?
16. ADRIANO (áudio): Ela tá bem estragada na parte de cima, a tinta tava descascando em um monte de lugar. A estrutura tá firme, nada solto. Só tem umas duas portinhas que rangem, mas isso eu vejo depois.
   {entendido: (igual) · rota: pending_answer/item_condition_answer}
17. BOT: 🎧 Ouvi: "Ela tá bem estragada na parte de cima, a tinta…"
18. BOT: Anotado: estado danificado, com a tinta descascando em vários pontos da parte de cima. 📝

E de tamanho, como ela é? Pode dar uma medida aproximada ou só "pequeno, médio ou grande", o que for mais fácil pra você.
19. ADRIANO (áudio): Ah, tem um detalhe que esqueci de falar: ela é grande, tem uns 2 metros de altura e uns 1,20 de largura. E se eu lembrar de mais alguma coisa, te falo depois. Por enquanto é isso.
   {entendido: tamanho: grande; cerca de 2 metros de altura e 1,20 metro de largura; ele pode lembrar de mais detalhes depois · rota: pending_answer/item_dimensions_answer}
20. BOT: 🎧 Ouvi: "Ah, tem um detalhe que esqueci de falar: ela é…"
21. BOT: Certo, medidas: altura 2 m, largura 1,2 m. 👍

💰 Pra você já ir tendo uma ideia: pelo que eu já tenho, deve ficar entre R$ 711,00 e R$ 1.034,00 (sem contar frete). Com o resto das respostas eu fecho o valor.

A cristaleira vai ser trabalhada só por fora, ou a parte de dentro (prateleiras, gavetas) também?
22. ADRIANO (áudio): Só por fora mesmo, a parte de dentro tá em ordem. As portinhas que rangem eu vejo depois, pode anotar isso também.
   {entendido: só por fora; a parte de dentro está em ordem. Anotar também: duas portinhas que rangem (ver depois). · rota: pending_answer/service_scope_answer}
23. BOT: 🎧 Ouvi: "Só por fora mesmo, a parte de dentro tá em…"
24. BOT: Beleza, então é por dentro e por fora. 🎨
25. BOT: Quase lá! Você falou que ela está precisando de cuidado. O que vai precisar consertar antes do acabamento? Tipo colar, trocar tábua, passar massa. 🛠️
26. ADRIANO (áudio): Não, só por fora mesmo, a parte de dentro tá em ordem. As portinhas que rangem eu vejo depois, pode anotar. Conserto de estrutura não precisa, a estrutura tá firme, nada solto. Só tem as portinhas que rangem.
   {entendido: corrigir: o trabalho é só por fora, a parte de dentro está em ordem. Não precisa de conserto de estrutura: a estrutura está firme, nada solto. Só tem as portinhas que rangem, para ver depois (anotar). · rota: pending_answer/job_field_answer}
27. BOT: 🎧 Ouvi: "Não, só por fora mesmo, a parte de dentro tá…"
28. BOT: Corrigido: estado: reparos (antes era danificado). Histórico guardado. 👍
29. BOT: Anotado: sem consertos. As portinhas que rangem ficam para depois, como você pediu. 🛠️
30. BOT: Falta pouquinho! E pra aplicar, vai de pincel, rolo ou pistola? Se for mais de um, pode falar. 🎨
31. ADRIANO (áudio): Pincel mesmo, só pincel. Tem umas partes com detalhe, então rolo não ia pegar direito. Já comecei a lixar hoje, ainda tá no começo. Quando ficar pronta a Dona Maria vem buscar.
   {entendido: pincel; só pincel, porque tem partes com detalhe e o rolo não pegaria direito. Já comecei a lixar hoje, ainda está no começo. Quando ficar pronta, a Dona Maria vem buscar. · rota: active_goal/collecting_continue}
32. BOT: 🎧 Ouvi: "Pincel mesmo, só pincel. Tem umas partes com detalhe, então…"
33. BOT: Entendi! Vou considerar pincel e rolo. Pra conta uso o pincel, que é o mais demorado, pra você não sair no prejuízo.

Última coisinha 📦: o transporte: o cliente traz a cristaleira aí, ou você vai precisar buscar? E depois, você entrega ou o cliente vem pegar?
34. ADRIANO (áudio): Ah, e tem outra coisa: hoje eu comecei a lixar a cristaleira, ainda tá no começo. Quando ficar pronta a Dona Maria vem buscar. Quanto ao transporte, ela traz aí no meu espaço, não precisa buscar. E na entrega, ela vem pegar mesmo.
   {entendido: Transporte: a Dona Maria traz a cristaleira até a oficina, não precisa buscar. Entrega: a Dona Maria vem pegar. Também: hoje comecei a lixar a cristaleira, ainda está no começo. · rota: active_goal/collecting_continue}
35. BOT: 🎧 Ouvi: "Ah, e tem outra coisa: hoje eu comecei a lixar…"
36. BOT: Beleza, anotei: a Dona Maria traz a cristaleira aqui e também vem buscar quando ficar pronta, então sem frete. 🚚
37. BOT: Pronto, Adriano! Já tenho o que preciso sobre a cristaleira da Dona Maria. Dá uma conferida:

• móvel: cristaleira
• cliente: Dona Maria
• trabalho: pátina
• estado: reparos
• medidas: altura 2 m, largura 1,2 m
• por dentro e por fora
• sem consertos
• aplicação: pincel
• sem frete

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
38. ADRIANO: [tocou: Pode calcular]
39. BOT: 🧮 Prontinho, fiz as contas da cristaleira da Dona Maria!

💰 Minha sugestão é cobrar R$ 1.752,00.

⚠️ Menos que R$ 1.430,00 você começa a ter prejuízo.
🛒 Vai precisar comprar uns R$ 445,00 de material.
⏱️ Dá umas 27 horas de trabalho.
📏 Fiz com a medida aproximada, então pode variar um pouco.

E aí, você concorda com esse valor? 🤝
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
40. ADRIANO: [tocou: 👍 Concordo]
41. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
42. BOT: Fechado! ✅

💰 Valor final: R$ 1.752,00

📄 Te mandei o PDF do orçamento pra você encaminhar pra Dona Maria.
43. BOT: Quando a Dona Maria responder, me avisa aqui: 👇
   [botões: 👍 Cliente aceitou | 👎 Cliente recusou]
44. ADRIANO: Opa, valeu! Só uma coisa: a Dona Maria ainda não respondeu nada, ela só vai ver o orçamento depois que eu encaminhar. Quando ela responder eu te aviso por aqui, pode deixar.
45. BOT: Que bom que ajudou! Quando a Dona Maria responder, é só me avisar por aqui. 😊
46. ADRIANO (áudio): Beleza, valeu! Então fica anotado: a Dona Maria ainda não respondeu, e eu aviso aqui quando ela responder. Só mais uma coisa: hoje comecei a lixar a cristaleira, ainda tá no começo, então ela não tá pronta ainda, tá?
   {entendido: (igual) · rota: global/job_progress}
47. BOT: 🎧 Ouvi: "Beleza, valeu! Então fica anotado: a Dona Maria ainda não…"
48. BOT: Qual deles? 🤔
   [botões: A cristaleira da Dona Maria]
49. ADRIANO (áudio): Isso mesmo, a cristaleira da Dona Maria. Hoje eu comecei a lixar, ainda tá no começo, então ela não tá pronta. Quando ficar pronta ela vem buscar. Pode anotar aí.
   {entendido: (igual) · rota: global/job_progress}
50. BOT: 🎧 Ouvi: "Isso mesmo, a cristaleira da Dona Maria. Hoje eu comecei…"
51. BOT: Anotado! Vou marcar a cristaleira da Dona Maria como em andamento, já que você começou a lixar hoje. 🪵

Confirma pra mim?
   [botões: Confirmar | Cancelar]
52. ADRIANO: [tocou: Confirmar]
53. BOT: Hmm, agora não dá pra mudar a cristaleira da Dona Maria direto pra esse estado, porque ela já está em execução. 🪵
```

</details>

## fora-do-roteiro — Fora do roteiro: oi, teste de áudio, conversa social e recomeçar

Notas: entendimento 1 · naturalidade 2 · acessibilidade 3 · uma_pergunta_por_vez 3 · sem_invencao 1 · eficiencia 1 · conclusao 2 · 88s

- ❌ depois de recomeçar não fica serviço aberto — {"n":1}

> O bot lidou bem com o teste de áudio, mas falhou no recomeço: tratou a cadeira como serviço já existente, inventou tamanho e 'novo', ignorou três correções de 'médio' e repetiu perguntas já respondidas. O usuário ficou frustrado e a conversa não se resolveu.

- [media] (texto_longo) turno 2: Resposta a um simples 'oi' é uma apresentação longa com lista numerada, em vez de saudação curta.
- [media] (fluxo_confuso) turno 8: Mensagens duplicadas (anotei + anotado) e comece a perguntas antes de ele terminar de falar; repete informação.
- [media] (perdeu_informacao) turno 12: Ele disse que quer ver a cadeira junto e pensar depois; o bot registrou 'estado: reparos' e seguiu perguntando, ignorando a hesitação e o pedido de recomeçar.
- [alta] (nao_entendeu) turno 20: Depois do recomeço, ele repete 'cadeira do seu João, pintura'. O bot trata como serviço já anotado e pergunta se é o mesmo, apesar do recomeço.
- [alta] (inventou) turno 22: Registrou tamanho 'grande, pequena, novo' e 'pequeno' sem ele ter dito; ele nem tinha respondido o tamanho (só perguntou).
- [media] (fluxo_confuso) turno 23: Duas mensagens seguidas do bot, uma com perguntas de orientação e outra com nova pergunta; fluxo picotado.
- [alta] (inventou) turno 26: Disse 'Corrigido' mantendo 'pequeno', quando ele corrigiu para médio; correção ignorada.
- [alta] (inventou) turno 27: Deu faixa de preço R$163–340 sem dados suficientes; passa valor que ele não pediu e com base em dados errados.
- [alta] (nao_entendeu) turno 30: Ele corrigiu pela segunda vez; o bot acrescentou 'novo' e continuou com 'pequeno'.
- [alta] (pergunta_repetida) turno 32: Pergunta o que consertar, mesmo ele já ter dito pernas bambas e pintura descascando e que o reparo vê depois.
- [alta] (nao_entendeu) turno 35: Na terceira correção o bot persiste em 'pequeno, nova', piorando; o usuário frustrado ('tu tá me entendendo errado') não é acolhido.

<details><summary>Conversa</summary>

```
1. ADRIANO: oi
2. BOT: Oi, Adriano! Que bom ter você por aqui. 😊

Eu sou o assistente da adripatina. Eu anoto seus serviços, faço as contas dos orçamentos e deixo tudo organizado pra você.

Como funciona:
1. Você me conta sobre o móvel, por áudio ou escrevendo, do seu jeito.
2. Eu faço algumas perguntas, uma de cada vez.
3. No final, eu calculo o orçamento e preparo o PDF pra você mandar ao cliente.

Também posso anotar gastos e pagamentos que você receber.

Pra começar, é só me contar. Por exemplo:
"Peguei uma cômoda da dona Ana para fazer pátina."
3. ADRIANO (áudio): oi, tudo bem? testando aqui o áudio, cê consegue me ouvir direitinho? depois te conto da cadeira do seu João
4. BOT: 🎧 Ouvi: "oi, tudo bem? testando aqui o áudio, cê consegue me…"
5. BOT: Tá chegando direitinho! 🎧 Pode mandar áudio à vontade que eu transcrevo.
6. ADRIANO (áudio): Opa, tudo bem sim! Tô por aqui. Então é isso, tá me ouvindo bem. Agora me conta da cadeira do seu João: é pra pintar, né? Quero começar essa.
   {entendido: (igual) · rota: global/new_job}
7. BOT: 🎧 Ouvi: "Opa, tudo bem sim! Tô por aqui. Então é isso,…"
8. BOT: Anotei um serviço novo:
• móvel: cadeira
• trabalho: pintura
• cliente: Seu Joao

Agora vou te fazer umas perguntinhas, uma de cada vez, pra montar o orçamento. Pode responder por áudio ou escrevendo.
9. BOT: Anotado: cadeira do Seu João, pintura. Como ela está hoje? Tá em bom estado, precisa de uns reparos ou tá bem estragada? 🪑
10. ADRIANO (áudio): Tô bem sim, obrigado! Ela tá meio judiada, com umas pernas bambas e a pintura descascando em alguns pontos. Acho que precisa de reparo nas pernas antes de pintar. Mas no começo deixa eu pensar nisso, quero que você veja a cadeira comigo. Quer que eu comece de novo, do zero, que eu me perdi um pouco.
   {entendido: Estado da cadeira: está meio judiada, com as pernas bambas e a pintura descascando em alguns pontos. Acha que precisa de reparo nas pernas antes de pintar. Quer pensar nisso no começo e ver a cadeira junto com o assistente. Também pediu para recomeçar do zero, porque se perdeu um pouco. · rota: pending_answer/item_condition_answer}
11. BOT: 🎧 Ouvi: "Tô bem sim, obrigado! Ela tá meio judiada, com umas…"
12. BOT: Anotado: estado: reparos. 📝
Também anotei: móvel: cadeira (meio judiada, pernas bambas).

E de tamanho, como ela é? Medida aproximada ou só "pequeno, médio ou grande", o que for mais fácil pra você. 🪑
13. ADRIANO (áudio): Ah, agora eu quero recomeçar do zero, que me perdi um pouco. Pode apagar essa cadeira e começar de novo. Mas antes, só um detalhe: a cadeira tá com as pernas bambas e a pintura descascando, então depois a gente vê o reparo. Por enquanto, recomeça aí.
14. BOT: 🎧 Ouvi: "Ah, agora eu quero recomeçar do zero, que me perdi…"
15. BOT: Entendi, Adriano! 😄 Quer recomeçar a cadeira do Seu Joao do zero? Eu tiro ele da lista (fica guardado no histórico) e você me conta tudo de novo. 🪑
   [botões: Recomeçar do zero | Continuar de onde parei]
16. ADRIANO: [tocou: Recomeçar do zero]
17. BOT: Pronto, recomecei. 👍

Me conta: qual é o móvel, de quem é e o que vai fazer nele? Pode ser por áudio.
18. ADRIANO (áudio): Beleza, recomeçou então. Pode apagar mesmo, e aquela parte das pernas bambas e da pintura descascando a gente vê depois, com calma. Agora me fala: é a cadeira do seu João de novo, pra pintar, e ela é pequena, média ou grande? Tem umas pernas bambas e tá com a pintura descascando, isso eu quero que tu anote no meio do orçamento, tá?
   {entendido: (igual) · rota: global/new_job}
19. BOT: 🎧 Ouvi: "Beleza, recomeçou então. Pode apagar mesmo, e aquela parte das…"
20. BOT: Beleza, Adriano! 😄 Acho que você está falando da cadeira do Seu João que a gente já anotou. É essa mesma? 🪑
   [botões: Sim, é essa | Não, é outro serviço | Não tenho certeza]
21. ADRIANO: [tocou: Não, é outro serviço]
22. BOT: Show! Anotei:
• móvel: cadeira (grande, pequena, novo)
• trabalho: pintura
• cliente: Seu Joao
• tamanho: pequeno

Agora vou te fazer umas perguntinhas, uma de cada vez, pra montar o orçamento. Pode responder por áudio ou escrevendo.
23. BOT: Entendi, Adriano! 📝 O serviço é só na madeira, só no estofado ou nos dois? 🪑
24. ADRIANO (áudio): Ah, errei o botão, Adriano, não é outro serviço, é a mesma cadeira do Seu João. E o tamanho não é pequeno, é médio, eu nem tinha dito isso. O serviço é só na madeira, sem estofado. Pode anotar a pintura descascando e as pernas bambas no meio do orçamento, tá?
   {entendido: corrigir: é a mesma cadeira do Seu João, não é outro serviço. O tamanho é médio, não pequeno. O serviço é só na madeira, sem estofado. Anotar no meio do orçamento: pintura descascando e pernas bambas. · rota: active_goal/collecting_continue}
25. BOT: 🎧 Ouvi: "Ah, errei o botão, Adriano, não é outro serviço, é…"
26. BOT: Corrigido! 📝 Ficou assim: móvel: cadeira (pequeno) (antes: móvel: cadeira (grande, pequena, novo)). Guardei o histórico. ✅
27. BOT: 💰 Só pra você ter uma ideia: pelo que já sei, deve ficar entre R$ 163,00 e R$ 340,00 (sem contar frete). Com o resto das respostas eu fecho o valor.

Como tá o estado dela? Pode descrever do seu jeito, tipo "tá bem judiada" ou "só uns riscos".
28. ADRIANO (áudio): Ô, errei de novo, Adriano. A cadeira é a mesma do Seu João, o tamanho é médio, não pequeno, e o serviço é só na madeira, sem estofado. Pode anotar a pintura descascando e as pernas bambas no meio do orçamento, tá? A cadeira tá bem judiada, as pernas bambas mesmo, e a pintura tá saindo em muita parte. Esse reparo das pernas a gente vê depois, com calma.
   {entendido: (igual) · rota: pending_answer/item_condition_answer}
29. BOT: 🎧 Ouvi: "Ô, errei de novo, Adriano. A cadeira é a mesma…"
30. BOT: Ajustei aqui: móvel: cadeira (pequeno, novo) (antes: móvel: cadeira (pequeno)). Guardei o histórico. 📝
31. BOT: Anotei aqui: estado: danificado. 🪑
32. BOT: Falta pouquinho! 🛠️ E sobre os consertos: o que precisa arrumar nela? Pode contar do seu jeito.
33. ADRIANO (áudio): Ô Bot, tu tá me entendendo errado. Não é nova, é a mesma cadeira do Seu João. Tamanho médio, não pequeno. O serviço é só na madeira, sem estofado. As pernas tão bambas e a pintura tá saindo em muita parte. Esse reparo das pernas eu vejo depois, com calma. Pode anotar isso aí.
   {entendido: corrigir: a cadeira é a mesma do Seu João (não é nova); tamanho: médio (não pequeno); serviço: pintura só na madeira, sem estofado; defeitos: pernas bambas e pintura saindo em muita parte; reparo das pernas fica para depois, com calma. · rota: pending_answer/job_field_answer}
34. BOT: 🎧 Ouvi: "Ô Bot, tu tá me entendendo errado. Não é nova,…"
35. BOT: Ajeitei aqui: móvel: cadeira (pequeno, nova) (antes: móvel: cadeira (pequeno, novo)). Guardei o histórico. 📝
36. BOT: Feito: estado: reparos (antes: estado: danificado). Guardei o histórico. ✅
37. BOT: Estamos quase lá! 🛠️ Você falou que ela tá precisando de cuidado. O que vai ter que consertar antes do acabamento? Tipo colar, trocar tábua, passar massa.
38. ADRIANO (áudio): Ô, de novo o bot se enrolou, viu. Não é nova nem pequena, é a mesma cadeira do Seu João, tamanho médio, e é só madeira, sem estofado. As pernas tão bambas, mas esse reparo eu vejo depois, com calma. Por enquanto só anota a pintura descascando em muita parte e as pernas bambas no meio do orçamento. Não precisa perguntar mais nada sobre conserto agora, é isso.
   {entendido: (igual) · rota: pending_answer/job_field_answer}
39. BOT: 🎧 Ouvi: "Ô, de novo o bot se enrolou, viu. Não é…"
40. BOT: Corrigi aqui: móvel: cadeira (pequena, nova, novo) (antes: móvel: cadeira (pequeno, nova)). Guardei o histórico. 📝
41. BOT: Quase lá! 🛠️ E sobre os consertos: o que precisa arrumar nela? Pode contar do seu jeito.
```

</details>

## correcoes — Correções do jeito dele no meio do orçamento

Notas: entendimento 3 · naturalidade 2 · acessibilidade 3 · uma_pergunta_por_vez 2 · sem_invencao 4 · eficiencia 2 · conclusao 5 · 61s

- ✅ 1 serviço
- ✅ cliente corrigida para Dona Bia
- ✅ método corrigido para rolo
- ✅ cor branca anotada

> O fluxo chegou ao fim: valor R$ 308,00, PDF enviado, cliente aceitou, e o banco confere. As correções (Dona Bia, rolo, sem frete) foram aplicadas. Mas o bot ignorou que ele já tinha dito 'tem 4 gavetas' e repetiu a mesma pergunta quatro vezes, forçando Adriano a reclamar duas vezes. Também deixou 4 gavetas fora do resumo final e fez pergunta dupla no transporte. Conclusão boa, experiência frustrante.

- [alta] (pergunta_repetida) turno 10: Bot repete a pergunta das gavetas, que Adriano já respondeu no turno 5 (4 gavetas), e ignora a resposta.
- [alta] (pergunta_repetida) turno 14: Pergunta das gavetas pela terceira vez, igual, mesmo depois de ele dizer que já respondeu.
- [alta] (pergunta_repetida) turno 16: Quarta vez a mesma pergunta das gavetas, sem reconhecer a frustração dele; só no turno 18 anota 4 gavetas.
- [media] (nao_entendeu) turno 7: No turno 5 ele deu gavetas, correção de cliente, rolo e sem frete de uma vez. O bot pulou para outra pergunta (por dentro ou por fora) e não confirmou nada na hora, só depois de ele reclamar.
- [media] (fluxo_confuso) turno 12: Correções confirmadas só após insistência dele, em mensagens separadas, e logo seguidas da mesma pergunta repetida. O sem frete não foi reconhecido na hora.
- [media] (pergunta_repetida) turno 18: Pergunta transporte com duas perguntas numa mensagem (traz? entrega?) mesmo ele já ter dito 'sem frete' duas vezes.
- [baixa] (perda_de_clareza) turno 22: O resumo traz 'observações: cor: branco; também citado: Dona Bia', texto estranho e redundante. As 4 gavetas não aparecem no resumo final.
- [baixa] (jargao) turno 24: 'Menos que R$ 249,00 você começa a ter prejuízo' é aceitável, mas o tom é mais de sistema do que de colega de oficina. Também não há tom de desculpa pelas repetições.
- [baixa] (decisao_dinheiro) turno 30: Sugere 'entrada recomendada R$ 205,00' sem ele pedir, mexendo em valor por conta própria.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): Fala aí, tudo certo? Peguei uma cômoda pra pintar de branco, é da dona Ana. Vou te falar as medidas: 90 de altura, 1 metro de largura e 45 de fundura. Tá boa, sem conserto nenhum, só é pra pintar por fora. Vou usar pincel pra pintar.
   {entendido: (igual) · rota: global/new_job}
2. BOT: 🎧 Ouvi: "Fala aí, tudo certo? Peguei uma cômoda pra pintar de…"
3. BOT: Anotei um serviço novo:
• móvel: cômoda (branco)
• trabalho: pintura
• cliente: Dona Ana
• aplicação: pincel
• estado: bom
• sem consertos
• medidas: altura 0,9 m, largura 1 m, fundura 0,45 m
• cor: branco

Agora vou te fazer umas perguntinhas, uma de cada vez, pra montar o orçamento. Pode responder por áudio ou escrevendo.
4. BOT: Anotado: cômoda branca da dona Ana, pintura com pincel, estado bom e sem consertos.

Quantas gavetas ela tem? 📦
5. ADRIANO (áudio): Ah, tem 4 gaveta. Mas peraí, na verdade a cliente é a dona Bia, não a Ana. E errei no pincel, é rolo mesmo. Sem frete, tá?
   {entendido: (igual) · rota: active_goal/collecting_continue}
6. BOT: 🎧 Ouvi: "Ah, tem 4 gaveta. Mas peraí, na verdade a cliente…"
7. BOT: Boa pergunta! Em armários, cômodas e cristaleiras, às vezes a parte de dentro (prateleiras, gavetas) também é trabalhada, e isso aumenta a área.

Você vai mexer só na parte de fora ou por dentro também (prateleiras, gavetas, portas por dentro)? 🎨
8. ADRIANO: Só por fora. Por dentro não mexe, nem gaveta nem prateleira.
   {entendido: só por fora; por dentro não mexe, nem gavetas nem prateleiras · rota: active_goal/collecting_continue}
9. BOT: Anotado: só por fora, por dentro não mexe.
10. BOT: Beleza, então é só a parte de fora. Quantas gavetas a cômoda tem? 📦
11. ADRIANO: Já respondi a da gaveta lá em cima: são 4 gavetas. E anotei a correção: a cliente é a dona Bia, não a Ana, e é rolo, não pincel. Sem frete. Pode seguir.
   {entendido: (igual) · rota: active_goal/collecting_continue}
12. BOT: Corrigido: cliente Dona Bia (antes era Dona Ana). Tudo certo por aqui. 🎨
13. BOT: Corrigido: aplicação com rolo (antes estava pincel). Histórico guardado. 🛠️
14. BOT: Quantas gavetas ela tem?
15. ADRIANO: Já falei, são 4 gavetas. Tá tudo corrigido: dona Bia, rolo, sem frete. Pode seguir pro orçamento.
   {entendido: São 4 gavetas. Correções já feitas: cliente Dona Bia, aplicação com rolo, sem frete. Pode seguir para o orçamento. · rota: active_goal/collecting_continue}
16. BOT: Quantas gavetas ela tem?
17. ADRIANO: Já falei, são 4 gavetas, tá? Pode seguir pro orçamento, por favor. Tá tudo certo: dona Bia, rolo, sem frete, só por fora.
   {entendido: 4 gavetas. Pode seguir pro orçamento. Confirmo: cliente dona Bia, aplicação com rolo, sem frete, só por fora. · rota: active_goal/collecting_continue}
18. BOT: Anotado: 4 gavetas. 📦

Só pra você ter uma ideia: pelo que já sei, deve ficar por volta de R$ 308,00 (sem contar frete). Com o resto das respostas eu fecho o valor. 💰

Última coisinha: o transporte. O cliente traz a cômoda aí, ou você vai precisar buscar? E depois, você entrega ou o cliente vem pegar?
19. ADRIANO (áudio): Já falei: sem frete. A cliente traz a cômoda aqui na oficina e ela mesma vem pegar depois, não precisa buscar nem entregar. Tá tudo certo: dona Bia, rolo, 4 gavetas, só por fora. Pode fechar o orçamento.
   {entendido: sem frete; a cliente traz a cômoda na oficina e ela mesma vem pegar depois, sem buscar nem entregar. Confirmado: dona Bia, rolo, 4 gavetas, só por fora. Pode fechar o orçamento. · rota: pending_answer/logistics_answer}
20. BOT: 🎧 Ouvi: "Já falei: sem frete. A cliente traz a cômoda aqui…"
21. BOT: Beleza, anotado: sem frete, a cliente traz a cômoda e vem pegar depois. 🚚
22. BOT: Pronto, Adriano! Já tenho o que preciso sobre a cômoda da Dona Bia. Dá uma conferida:

• móvel: cômoda (branco)
• trabalho: pintura
• cliente: Dona Bia
• aplicação: rolo
• estado: bom
• sem consertos
• medidas: altura 0,9 m, largura 1 m, fundura 0,45 m
• observações: cor: branco; também citado: Dona Bia
• só por fora
• sem frete

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
23. ADRIANO: [tocou: Pode calcular]
24. BOT: 🧮 Prontinho, fiz as contas da cômoda da Dona Bia!

💰 Minha sugestão é cobrar R$ 308,00.

⚠️ Menos que R$ 249,00 você começa a ter prejuízo.
🛒 Vai precisar comprar uns R$ 205,00 de material.
⏱️ Dá umas 5 horas de trabalho.

E aí, você concorda com esse valor? 🤝
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
25. ADRIANO: [tocou: 👍 Concordo]
26. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
27. BOT: Fechado! ✅

💰 Valor final: R$ 308,00

📄 Te mandei o PDF do orçamento pra você encaminhar pra Dona Bia.
28. BOT: Quando a Dona Bia responder, me avisa aqui: 👇
   [botões: 👍 Cliente aceitou | 👎 Cliente recusou]
29. ADRIANO: [tocou: 👍 Cliente aceitou]
30. BOT: Que ótimo! 🎉 Anotei que a Dona Bia aceitou o orçamento da cômoda por R$ 308,00.

Entrada recomendada: R$ 205,00. 💰
```

</details>

## decisao-valor — Decisão do valor: desconto abaixo do mínimo e depois acréscimo de frete

Notas: entendimento 2 · naturalidade 3 · acessibilidade 4 · uma_pergunta_por_vez 3 · sem_invencao 3 · eficiencia 1 · conclusao 4 · 77s

- ✅ PDF gerado
- ✅ orçamento fechado

> O orçamento fechou certo, com valor cheio de R$ 282 mais R$ 60 de frete, R$ 342, e PDF gerado. O caminho foi ruim: o bot perdeu a largura, repetiu perguntas sobre transporte e medidas até o Adriano se irritar, e não anotou o frete no resumo. A parte do desconto abaixo do mínimo foi bem tratada, com aviso claro de prejuízo.

- [alta] (perdeu_informacao) turno 9: Anotou só 0,4 × 0,8 m, perdendo a largura de 1,20 que o Adriano já tinha dito no áudio. Ainda deu faixa de preço com base em medidas incompletas.
- [media] (pergunta_repetida) turno 9: Pediu as medidas de novo depois que ele já tinha dado tudo no áudio (turno 5). Também já tinha perguntado como o aparador chega e volta, e depois voltou a perguntar a mesma coisa.
- [alta] (pergunta_repetida) turno 13: Perguntou de novo sobre o transporte, que ele já tinha respondido no turno 10, e juntou duas perguntas numa mensagem.
- [alta] (pergunta_repetida) turno 16: Só registrou que ele busca e voltou a perguntar sobre a entrega, que ele já tinha dito. Repetiu igual no turno 19, e ele ficou irritado.
- [alta] (pergunta_repetida) turno 19: Repetiu exatamente a mesma pergunta do turno 16, ignorando que ele dissera que busca e entrega. Ele precisou falar quatro vezes.
- [media] (perdeu_informacao) turno 22: Os 60 reais de frete, que ele disse que quer cobrar, nunca foram anotados no resumo. Só apareceu 'buscar e entregar'.
- [baixa] (tom) turno 28: O 'Assim fica R$ 141,00 😬' soa meio estranho. O aviso de prejuízo em si foi correto.
- [baixa] (fluxo_confuso) turno 32: Fechou direto sem confirmar o acréscimo do frete nem mostrar o valor antes do PDF. Deu certo, mas foi sem checagem.
- [baixa] (fluxo_confuso) turno 35: Respondeu 'Qualquer coisa é só chamar' como se fosse despedida, sem reforçar que ficará aguardando a resposta do cliente.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): e aí, tudo bem? to precisando de um orçamento pra um aparador do seu Luiz, é pra envernizar. ele ta bom, só precisa do verniz mesmo. dá pra fazer?
   {entendido: (igual) · rota: global/new_job}
2. BOT: 🎧 Ouvi: "e aí, tudo bem? to precisando de um orçamento pra…"
3. BOT: Beleza, serviço novo anotado:
• móvel: aparador (só precisa de verniz, peça em bom estado)
• trabalho: verniz
• cliente: Seu Luiz

Agora vou te fazer umas perguntinhas, uma de cada vez, pra montar o orçamento. Pode responder por áudio ou escrevendo.
4. BOT: Anotado: aparador do Seu Luiz, só verniz, peça em bom estado. 🪵

Como tá o estado dele? Pode descrever do seu jeito, tipo "tá bem judiado" ou "só uns riscos".
5. ADRIANO (áudio): Tá bom, tá inteiro. Não tem conserto nenhum, só precisa do verniz mesmo. Ele tem 1,20 de largura, 40 de fundura e 80 de altura. Pincel, que é o jeito que eu gosto de fazer.
   {entendido: Estado: tá inteiro, sem conserto nenhum, só precisa do verniz. Medidas: 1,20 de largura, 40 de profundidade e 80 de altura. Método: pincel. · rota: pending_answer/item_condition_answer}
6. BOT: 🎧 Ouvi: "Tá bom, tá inteiro. Não tem conserto nenhum, só precisa…"
7. BOT: Beleza, estado bom anotado. 👍

Também anotei: pincel e sem consertos.

Agora as medidas: quanto ele tem de largura, fundura e altura? 📏

Pode falar em centímetros, mais ou menos mesmo.
8. ADRIANO: Já falei as medidas ali no áudio, tá: 1,20 de largura, 40 de fundura e 80 de altura. Pincel também. Dá pra seguir daí.
   {entendido: medidas: 1,20 m de largura, 40 cm de fundura e 80 cm de altura; pincel; pode seguir. · rota: pending_answer/item_dimensions_answer}
9. BOT: Anotei: 0,4 × 0,8 m. 📏

💰 Só pra você ter uma ideia: pelo que já sei, deve ficar entre R$ 183,00 e R$ 317,00 (sem contar frete). Com o resto das respostas eu fecho o valor.

Falta uma coisa: como o aparador chega até você e volta pro cliente? Você busca e entrega, ou o cliente leva e traz?
10. ADRIANO (áudio): Eu busco na casa do Seu Luiz e entrego depois, eu mesmo. Esse frete é 60 reais, viu, quero cobrar isso. Ah, e a largura é 1,20, não 0,4, o 0,4 é a fundura. Dá pra conferir aí?
   {entendido: (igual) · rota: active_goal/collecting_continue}
11. BOT: 🎧 Ouvi: "Eu busco na casa do Seu Luiz e entrego depois,…"
12. BOT: Corrigido: medidas: altura 0,8 m, largura 1,2 m, fundura 0,4 m (antes: medidas: altura 0,8 m, fundura 0,4 m). Guardei o histórico.
13. BOT: Última coisinha: E o transporte: o cliente traz o aparador aí, ou você vai precisar buscar? E depois, você entrega ou o cliente vem pegar?
14. ADRIANO (áudio): Eu busco na casa do Seu Luiz e entrego depois, eu mesmo. Esse frete é 60 reais, viu, quero cobrar isso. As medidas tão certas agora: 1,20 de largura, 40 de fundura e 80 de altura. Pincel, sem conserto, só verniz.
   {entendido: Eu busco na casa do Seu Luiz e entrego depois, eu mesmo. Frete: R$ 60,00, quero cobrar isso. Medidas confirmadas: altura 0,8 m, largura 1,2 m, fundura 0,4 m. Aplicação: pincel. Sem consertos. Trabalho: verniz. · rota: active_goal/collecting_continue}
15. BOT: 🎧 Ouvi: "Eu busco na casa do Seu Luiz e entrego depois,…"
16. BOT: Certo, você vai buscar. E na volta, você entrega ou o cliente vem pegar?
17. ADRIANO (áudio): Já falei isso, tá? Eu busco na casa do Seu Luiz e entrego depois, eu mesmo. O frete é 60 reais, quero cobrar isso. O resto tá certo.
   {entendido: Eu busco na casa do Seu Luiz e entrego depois, eu mesmo. O frete é R$ 60,00, quero cobrar isso. O resto está certo. · rota: active_goal/collecting_continue}
18. BOT: 🎧 Ouvi: "Já falei isso, tá? Eu busco na casa do Seu…"
19. BOT: Certo, você vai buscar. E na volta, você entrega ou o cliente vem pegar?
20. ADRIANO (áudio): Já falei, tá? Eu busco e entrego eu mesmo. O frete é 60 reais, quero cobrar isso. O resto tá certo, pode seguir pro valor.
   {entendido: (igual) · rota: pending_answer/logistics_answer}
21. BOT: 🎧 Ouvi: "Já falei, tá? Eu busco e entrego eu mesmo. O…"
22. BOT: Show! Anotei: buscar e entregar. 👌
23. BOT: Pronto, Adriano! Já tenho o que preciso sobre o aparador do Seu Luiz. Dá uma conferida:

• móvel: aparador (só precisa de verniz, peça em bom estado)
• trabalho: verniz
• cliente: Seu Luiz
• estado: bom
• aplicação: pincel
• sem consertos
• medidas: altura 0,8 m, largura 1,2 m, fundura 0,4 m
• buscar e entregar

Tá tudo certo? Se sim, me diz "pode calcular" que eu faço as contas. Se quiser mudar algo, é só falar, tipo "a altura é 1,90".
   [botões: Pode calcular | Quero corrigir]
24. ADRIANO: [tocou: Pode calcular]
25. BOT: 🧮 Prontinho, fiz as contas do aparador do Seu Luiz!

💰 Minha sugestão é cobrar R$ 282,00.

⚠️ Menos que R$ 230,00 você começa a ter prejuízo.
🛒 Vai precisar comprar uns R$ 130,00 de material.
⏱️ Dá umas 4 horas de trabalho.
🚚 O frete não está na conta. Se for cobrar, é só acrescentar.

E aí, você concorda com esse valor? 🤝
   [botões: 👍 Concordo | ➖ Dar desconto | ➕ Acrescentar]
26. ADRIANO (áudio): Ah, valeu! Cara, 282 tá alto demais pra mim. Faz metade disso, 141 reais, que o Seu Luiz é conhecido meu.
   {entendido: Não concordo com R$ 282,00, está alto demais. Quero cobrar R$ 141,00 porque o Seu Luiz é conhecido meu. · rota: active_goal/quote_decision_continue}
27. BOT: 🎧 Ouvi: "Ah, valeu! Cara, 282 tá alto demais pra mim. Faz…"
28. BOT: Assim fica R$ 141,00. 😬

Só que abaixo de R$ 230,00 você fica no prejuízo. Quer fechar assim mesmo?
   [botões: Sim, fechar assim | Mudar o valor]
29. ADRIANO (áudio): Cara, então não dá pra fechar em 141 não, o prejuízo come tudo. Esquece o desconto, fica no valor cheio de 282 e acrescenta os 60 do frete. Pode fazer assim pra mim?
   {entendido: não fecho em R$ 141,00, o prejuízo come tudo. Cancelo o desconto, fica o valor cheio de R$ 282,00 e acrescenta R$ 60,00 de frete. Pode fazer assim? · rota: active_goal/quote_decision_continue}
30. BOT: 🎧 Ouvi: "Cara, então não dá pra fechar em 141 não, o…"
31. BOT: [PDF enviado: Proposta-AP-2026-0001-v1.pdf]
32. BOT: Fechado! ✅

💰 Valor final: R$ 342,00 (R$ 282,00 + R$ 60,00 de frete)

📄 Te mandei o PDF do orçamento pra você encaminhar pro Seu Luiz.
33. BOT: Quando o cliente responder, me avisa aqui: 👇
   [botões: 👍 Cliente aceitou | 👎 Cliente recusou]
34. ADRIANO: Valeu, tá fechado! Pode mandar o PDF que eu encaminho pro Seu Luiz. Quando ele responder eu te aviso por aqui.
35. BOT: Por nada, Adriano! Qualquer coisa é só chamar. 😊
```

</details>

## consulta — Consultas: quais serviços eu tenho e quanto falta receber

Notas: entendimento 1 · naturalidade 2 · acessibilidade 2 · uma_pergunta_por_vez 3 · sem_invencao 1 · eficiencia 1 · conclusao 1 · 78s


> Conversa falhou: o Adriano só queria ver os serviços e saber quanto a Dona Maria deve. A lista inicial foi ok, mas depois o bot inventou uma 2ª cristaleira e um estado 'bem danificado', repetiu a mesma confirmação errada várias vezes, pediu de novo detalhes já dados e nunca respondeu sobre o valor devido. Ele ficou irritado e o objetivo não foi atingido.

- [alta] (inventou) turno 8: Inventou uma segunda cristaleira ('uma cristaleira e outra cristaleira') quando o Adriano falou de uma só, duplicando o móvel.
- [alta] (inventou) turno 9: Disse que a 1ª cristaleira está 'bem danificada', contrariando o que ele disse (bom estado, sem nada quebrado), e criou uma 2ª cristaleira.
- [media] (nao_entendeu) turno 14: Perguntou 'Qual deles, então?' com um só botão, sem sentido diante da correção clara dele.
- [alta] (pergunta_repetida) turno 15: Repetiu a mesma confirmação errada (duas cristaleiras) nos turnos 15, 18 e 24, ignorando as correções repetidas dele.
- [alta] (perdeu_informacao) turno 21: Depois de ele ter dado todos os detalhes (bom estado, 1,80 m, só por fora, sem conserto), pediu de novo esses mesmos detalhes como se faltassem.
- [alta] (nao_respondeu) turno 3: Em nenhum momento respondeu quanto a Dona Maria ainda deve, pedido feito em quase todas as mensagens; também não houve resposta sobre o valor ou a situação do pagamento.
- [alta] (travou) turno 24: Fluxo em loop: a conversa terminou voltando ao erro das duas cristaleiras, frustrando o usuário ('Não, para!') sem saída.
- [baixa] (fluxo_confuso) turno 11: Exemplo de correção ('a cômoda também precisa de reparo') não tem relação com o caso e as perguntas de detalhe interromperam a consulta que ele queria.
- [media] (jargao) turno 5: Mostra código S-0001 e a lista 'Ainda falta saber' em formato de ficha, pouco natural para ele.

<details><summary>Conversa</summary>

```
1. ADRIANO (áudio): Oi, tudo bem? Me fala aí, quais serviços eu tenho anotados? Acho que são dois, a cristaleira da Dona Maria e a mesa do Seu João. E quanto a Dona Maria ainda deve, ela não pagou nada ainda, né?
   {entendido: (igual) · rota: global/list_jobs}
2. BOT: 🎧 Ouvi: "Oi, tudo bem? Me fala aí, quais serviços eu tenho…"
3. BOT: Aqui estão seus serviços:

• A cristaleira da Dona Maria — em orçamento
• A mesa do Seu João — em orçamento

Toca em um deles pra ver os detalhes. 👇
   [botões: A cristaleira da Dona Maria — Em orçamento | A mesa do Seu João — Em orçamento]
4. ADRIANO: [tocou: A cristaleira da Dona Maria — Em orçamento]
5. BOT: A cristaleira da Dona Maria — pátina (S-0001)
Situação: Em orçamento
Já anotado: móvel: cristaleira; cliente: Dona Maria; trabalho: pátina
Ainda falta saber: como o móvel está; o tamanho do móvel; se é só por fora ou por dentro também; se precisa de conserto
   [botões: Continuar este]
6. ADRIANO (áudio): Então, a cristaleira da Dona Maria é pátina, ela ainda não pagou nada. Agora eu vou te falar do móvel: ela tá em bom estado, sem nada quebrado, só desgastada na frente e nas laterais. É uma cristaleira média, mais ou menos 1,80 de altura. A pátina é só por fora mesmo. Não precisa de conserto. Quando tiver o valor, eu te falo.
   {entendido: (igual) · rota: global/new_job}
7. BOT: 🎧 Ouvi: "Então, a cristaleira da Dona Maria é pátina, ela ainda…"
8. BOT: Entendi: são 2 móveis para pátina 🎨: uma cristaleira e outra cristaleira, para a Dona Maria.
9. BOT: Entendi: a 1ª cristaleira leva pátina inteira e está bem danificada. A 2ª cristaleira também leva pátina inteira, sem reparos grandes. Certo? ✅
   [botões: Certo | Corrigir]
10. ADRIANO: [tocou: Corrigir]
11. BOT: Beleza, então vamos ajustar. O que ficou diferente? Pode me falar do seu jeito, por exemplo: "a cômoda também precisa de reparo".
12. ADRIANO (áudio): Não, não é isso não. É uma cristaleira só, da Dona Maria. Ela tá em bom estado, sem nada quebrado, só desgastada na frente e nas laterais. Tem uns 1,80 de altura, tamanho médio. A pátina é só por fora, não precisa de conserto. Esse é o único móvel dela. E o Seu João é a mesa, em orçamento também. Me diz aí quanto a Dona Maria ainda deve, ela não pagou nada.
   {entendido: corrigir: é uma cristaleira só, da Dona Maria (não são duas). Estado: em bom estado, sem nada quebrado, só desgastada na frente e nas laterais. Tamanho médio, cerca de 1,80 de altura. Serviço: pátina só por fora, sem conserto. Esse é o único móvel dela. Outro cliente: Seu João, com a mesa, também em orçamento. Pergunta: quanto a Dona Maria ainda deve? Ela não pagou nada. · rota: pending_answer/item_condition_answer}
13. BOT: 🎧 Ouvi: "Não, não é isso não. É uma cristaleira só, da…"
14. BOT: Qual deles, então?
   [botões: A cristaleira da Dona Maria]
15. BOT: Entendi: a 1ª cristaleira: fazer pátina inteira, sem reparos grandes; a 2ª cristaleira: fazer pátina inteira, sem reparos grandes. Certo?
   [botões: Certo | Corrigir]
16. ADRIANO (áudio): Não, é uma cristaleira só, da Dona Maria. Ela tá em bom estado, sem nada quebrado, só desgastada na frente e nas laterais. Tem uns 1,80 de altura, tamanho médio. A pátina é só por fora, não precisa de conserto. Esse é o único móvel dela. Pode corrigir aí, e me diz quanto a Dona Maria ainda deve, ela não pagou nada.
   {entendido: corrigir: é uma cristaleira só, da Dona Maria. Ela está em bom estado, sem nada quebrado, só desgastada na frente e nas laterais. Tem cerca de 1,80 de altura, tamanho médio. A pátina é só por fora, sem conserto. Esse é o único móvel dela. Também quer saber quanto a Dona Maria ainda deve; ela não pagou nada. · rota: active_goal/quote_request_continue}
17. BOT: 🎧 Ouvi: "Não, é uma cristaleira só, da Dona Maria. Ela tá…"
18. BOT: Entendi: a 1ª cristaleira: fazer pátina inteira, sem reparos grandes; a 2ª cristaleira: fazer pátina inteira, sem reparos grandes. Certo?
   [botões: Certo | Corrigir]
19. ADRIANO (áudio): Não, para! Só tem uma cristaleira, da Dona Maria. Ela tá em bom estado, sem nada quebrado, só desgastada na frente e nas laterais. Uns 1,80 de altura, tamanho médio. Pátina só por fora, sem conserto. O Seu João é a mesa, em orçamento também. Agora me diz quanto a Dona Maria ainda deve, ela não pagou nada.
20. BOT: 🎧 Ouvi: "Não, para! Só tem uma cristaleira, da Dona Maria. Ela…"
21. BOT: Anotei: a cristaleira da Dona Maria leva pátina (S-0001) 🎨

Situação: em orçamento
Já anotado: móvel: cristaleira; cliente: Dona Maria; trabalho: pátina
Ainda falta saber: como o móvel está; o tamanho do móvel; se é só por fora ou por dentro também; se precisa de conserto

Me conta esses detalhes que a gente segue daqui.
   [botões: Continuar este]
22. ADRIANO (áudio): Ah, agora foi! Só uma cristaleira, da Dona Maria, em bom estado, sem nada quebrado, só desgastada na frente e nas laterais. Uns 1,80 de altura, tamanho médio. Pátina só por fora, sem conserto. O Seu João é a mesa, em orçamento também. Quanto a Dona Maria ainda deve? Ela não pagou nada ainda.
   {entendido: Só uma cristaleira, da Dona Maria, em bom estado, sem nada quebrado, só desgastada na frente e nas laterais. Uns 1,80 de altura, tamanho médio. Pátina só por fora, sem conserto. O Seu João é a mesa, em orçamento também. Pergunta: quanto a Dona Maria ainda deve? Ela não pagou nada ainda. · rota: active_goal/quote_request_continue}
23. BOT: 🎧 Ouvi: "Ah, agora foi! Só uma cristaleira, da Dona Maria, em…"
24. BOT: Entendi: a 1ª cristaleira: fazer pátina inteira, sem reparos grandes; a 2ª cristaleira: fazer pátina inteira, sem reparos grandes. Certo?
   [botões: Certo | Corrigir]
```

</details>

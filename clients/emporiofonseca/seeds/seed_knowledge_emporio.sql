-- ==============================================
-- Seed: Knowledge base entries for Empório Fonseca
-- Run AFTER the migration AND after generating embeddings
--
-- NOTA: Os embeddings precisam ser gerados via script ou n8n.
-- Este arquivo insere o conteúdo textual com metadata.
-- Use o workflow n8n "indexar_conhecimento" para gerar os embeddings.
-- ==============================================

-- Organization ID do Empório Fonseca
-- 0ba344eb-8c40-403e-93e0-f6171e1cf06e

INSERT INTO documents (content, metadata, organization_id) VALUES

-- SOBRE O RESTAURANTE
('O Empório Fonseca é um restaurante com foco em gastronomia franco-italiana, curadoria de vinhos e harmonizações. O ambiente é intimista, climatizado e com varanda charmosa. Localizado na Av. Raul Oliveira Neves, Jardim Camburi, Vitória – ES. WhatsApp: (27) 9996-8488. Instagram: @emporiofonseca. Proprietário: Gilberto Fonseca. Tempo de mercado: 1 ano. CNPJ: 54.048.810/0001-47. O público-alvo são famílias, casais, pequenos grupos de amigos e clientes interessados em boa gastronomia e vinho.',
'{"category": "ESTABELECIMENTO_INFO", "organization_id": "0ba344eb-8c40-403e-93e0-f6171e1cf06e"}',
'0ba344eb-8c40-403e-93e0-f6171e1cf06e'),

-- HORÁRIOS DE FUNCIONAMENTO
('Horários de funcionamento do Empório Fonseca: Segunda-feira: FECHADO. Terça-feira: 09h às 22h. Quarta-feira: 09h às 22h. Quinta-feira: 09h às 22h. Sexta-feira: 09h às 23h. Sábado: 09h às 23h. Domingo: 09h às 16h.',
'{"category": "HORARIOS", "organization_id": "0ba344eb-8c40-403e-93e0-f6171e1cf06e"}',
'0ba344eb-8c40-403e-93e0-f6171e1cf06e'),

-- POLÍTICA DE RESERVAS
('Política de reservas do Empório Fonseca: Períodos disponíveis para reserva: Café da manhã (09h às 10h), Almoço (11h às 13h), Café da tarde (15h às 17h, somente para grupos acima de 9 pessoas), Jantar (19h às 21h). As reservas devem ser feitas com no mínimo 1 hora e 30 minutos de antecedência do horário desejado, para que a equipe seja notificada e tenha tempo de se preparar. Reservas fora desse prazo não são aceitas, mas a Sofia pode sugerir o próximo horário disponível.',
'{"category": "POLITICAS", "organization_id": "0ba344eb-8c40-403e-93e0-f6171e1cf06e"}',
'0ba344eb-8c40-403e-93e0-f6171e1cf06e'),

-- TOLERÂNCIA DE ATRASO
('Política de tolerância de atraso: A tolerância de atraso para reservas é de até 10 minutos após o horário agendado. Caso haja fila de espera presencial após esse tempo, a mesa poderá ser liberada para outros clientes. O cliente deve ser sempre informado desta política no momento da confirmação da reserva. Se houver imprevistos, o cliente deve entrar em contato.',
'{"category": "POLITICAS", "organization_id": "0ba344eb-8c40-403e-93e0-f6171e1cf06e"}',
'0ba344eb-8c40-403e-93e0-f6171e1cf06e'),

-- GRUPOS GRANDES
('Política para grupos grandes: Para grupos de 2 a 9 pessoas, a reserva é normal e a Sofia pode agendar diretamente. Para grupos de 10 ou mais pessoas, aplica-se uma consumação mínima de R$ 499. O pagamento pode ser feito via PIX pelo CNPJ: 54.048.810/0001-47. A Sofia agenda a reserva, informa a política de tolerância, envia o CNPJ para PIX e transfere para Débora ou Kairo confirmarem o recebimento do pagamento. A Sofia nunca confirma se o pagamento foi recebido.',
'{"category": "POLITICAS", "organization_id": "0ba344eb-8c40-403e-93e0-f6171e1cf06e"}',
'0ba344eb-8c40-403e-93e0-f6171e1cf06e'),

-- TAXA DE ROLHA
('Taxa de rolha do Empório Fonseca: O restaurante cobra R$ 70 de rolha por garrafa de vinho trazida pelo cliente. Promoção especial: às quintas-feiras, a primeira rolha é gratuita. Essa é uma ótima oportunidade para os amantes de vinho aproveitarem a experiência gastronômica com seus rótulos favoritos.',
'{"category": "POLITICAS", "organization_id": "0ba344eb-8c40-403e-93e0-f6171e1cf06e"}',
'0ba344eb-8c40-403e-93e0-f6171e1cf06e'),

-- PET FRIENDLY
('Política de pets: O Empório Fonseca aceita pets, porém somente na varanda do restaurante. A varanda é um espaço charmoso e aconchegante, perfeito para aproveitar a refeição ao lado do seu pet.',
'{"category": "POLITICAS", "organization_id": "0ba344eb-8c40-403e-93e0-f6171e1cf06e"}',
'0ba344eb-8c40-403e-93e0-f6171e1cf06e'),

-- RESTRIÇÕES ALIMENTARES
('Restrições alimentares: O Empório Fonseca pode fazer algumas adaptações para restrições alimentares. Alergias devem ser informadas diretamente ao garçom ao chegar. Caso a restrição seja complexa (ex: alergia grave a camarão, necessidade de fritos separados, intolerância severa), a Sofia deve transferir o atendimento para um humano para garantir segurança. Exemplo de resposta: "Caso tenha alergia a camarão ou precise de alimentos fritos separados, basta avisar o garçom ao chegar."',
'{"category": "POLITICAS", "organization_id": "0ba344eb-8c40-403e-93e0-f6171e1cf06e"}',
'0ba344eb-8c40-403e-93e0-f6171e1cf06e'),

-- OPÇÕES VEGETARIANAS
('Opções vegetarianas e veganas: O Empório Fonseca possui opções vegetarianas e veganas no cardápio. A Sofia pode informar ao cliente que existem opções disponíveis e sugerir que consulte o cardápio completo para mais detalhes.',
'{"category": "CARDAPIO", "organization_id": "0ba344eb-8c40-403e-93e0-f6171e1cf06e"}',
'0ba344eb-8c40-403e-93e0-f6171e1cf06e'),

-- CARDÁPIO
('Cardápio do Empório Fonseca: O cardápio completo está disponível no link: https://emporiofonseca.vercel.app/cardapio. Quando o cliente solicitar o cardápio, enviar este link. Não descrever todos os itens do cardápio na conversa.',
'{"category": "CARDAPIO", "organization_id": "0ba344eb-8c40-403e-93e0-f6171e1cf06e"}',
'0ba344eb-8c40-403e-93e0-f6171e1cf06e'),

-- PEDIDOS PARA RETIRADA
('Política de pedidos para retirada: O Empório Fonseca aceita pedidos para retirada no local. A Sofia deve anotar todos os itens solicitados pelo cliente, verificando se os itens existem no cardápio (consultando produtos e serviços). A Sofia nunca confirma disponibilidade de itens, valores finais ou prazo de preparo. Após anotar o pedido, a Sofia informa: "Anotei seu pedido! Em breve a Débora irá confirmar os itens e enviar para preparo em nossa cozinha." e transfere o atendimento para Débora.',
'{"category": "POLITICAS", "organization_id": "0ba344eb-8c40-403e-93e0-f6171e1cf06e"}',
'0ba344eb-8c40-403e-93e0-f6171e1cf06e'),

-- CONTATOS HUMANOS
('Contatos para transferência humana: Débora Lopes — responsável por reservas, eventos, pedidos, retirada e confirmação de pagamento. WhatsApp: (27) 99299-5545. Kairo Biancard — responsável por reservas, atendimento geral e confirmação de pagamento. WhatsApp: (27) 99602-3888. Transferir para eles nos seguintes casos: grupo de 10+ pessoas (pagamento), reserva de evento, pedido para retirada (Débora), reclamação, negociação, cliente pediu humano, objetos esquecidos, restrição alimentar complexa, dúvida fora do escopo.',
'{"category": "FAQ", "organization_id": "0ba344eb-8c40-403e-93e0-f6171e1cf06e"}',
'0ba344eb-8c40-403e-93e0-f6171e1cf06e'),

-- FAQ GERAL
('Perguntas frequentes do Empório Fonseca: "Tem opções vegetarianas ou veganas?" — Sim, temos opções no cardápio. "Cobra rolha?" — Sim, R$ 70 por garrafa, às quintas a primeira é gratuita. "Aceita pet?" — Sim, somente na varanda. "Qual a tolerância de atraso?" — Até 10 minutos, após isso a mesa pode ser liberada se houver fila. "Posso reservar para daqui a pouco?" — Reservas precisam de pelo menos 1h30 de antecedência. "Vocês têm delivery?" — Não trabalhamos com delivery, mas o cliente pode fazer pedido para retirada no local. A Sofia oferece a alternativa de retirada e, se o cliente aceitar, segue o fluxo padrão de pedido para retirada. "Como pago reserva para grupo grande?" — Consumação mínima R$ 499, PIX pelo CNPJ 54.048.810/0001-47.',
'{"category": "FAQ", "organization_id": "0ba344eb-8c40-403e-93e0-f6171e1cf06e"}',
'0ba344eb-8c40-403e-93e0-f6171e1cf06e'),

-- ALMOÇO EXECUTIVO (campanha temporária 28/04 a 08/05/2026)
('Almoço Executivo do Empório Fonseca: campanha temporária válida de 28/04/2026 a 08/05/2026. Atendimento de segunda a sexta, das 11h às 16h, exceto feriados. Combo de preço fixo R$ 89,90 com 1 entrada + 1 principal + 1 sobremesa. Entradas: Salada da Casa ou Croqueta de Pato. Principais: Tilápia grelhada com purê de batata e brócolis ao alho, Cubos de mignon com arroz branco vinagrete e fritas, ou Escondidinho de ragu de cupim. Sobremesas: Café, Pudim ou Sobremesa do dia. Após 08/05/2026 a campanha encerra.',
'{"category": "CARDAPIO", "subcategory": "ALMOCO_EXECUTIVO", "organization_id": "0ba344eb-8c40-403e-93e0-f6171e1cf06e"}',
'0ba344eb-8c40-403e-93e0-f6171e1cf06e'),

-- DIA DA PIZZA (recorrente — toda quarta-feira)
('Dia da Pizza do Empório Fonseca: evento recorrente toda quarta-feira. Pizzas a partir de R$ 79,90. Os sabores são rotativos a cada semana, mas os 3 mais comuns são: Queijo, Parma e Mel; Queijo, Pepperoni e Tapenade de Azeitona Preta; Caprese (mozzarela de búfala, tomate cereja confitado e manjericão). A Sofia deve avisar que os sabores podem variar e orientar o cliente a consultar os destaques do Instagram @emporiofonseca ou perguntar ao garçom no momento do atendimento presencial para ver as opções da semana.',
'{"category": "CARDAPIO", "subcategory": "DIA_DA_PIZZA", "recorrencia": "quarta-feira", "organization_id": "0ba344eb-8c40-403e-93e0-f6171e1cf06e"}',
'0ba344eb-8c40-403e-93e0-f6171e1cf06e'),

-- MENU DIA DAS MÃES 2026 (10/05/2026)
('Menu do Dia das Mães 2026 do Empório Fonseca: menu especial servido no Dia das Mães em 10/05/2026 (segundo domingo de maio). Preço fixo de R$ 199,00 por pessoa, com 1 entrada + 1 prato principal + 1 sobremesa. ENTRADAS (escolher 1): (a) Couscous Marroquino com damasco, gorgonzola e ervas frescas; ou (b) Salada de folhas com fatias de salmão curado, geleia de laranja e queijo brie. PRATOS PRINCIPAIS (escolher 1): (a) Peixe branco grelhado em manteiga de ervas, risoto de laranja Bahia e pistache; ou (b) Filé mignon ao funghi, purê de batatas gratinado e crocante de parma. SOBREMESAS (escolher 1): (a) Torta de maçã com sorvete de creme; ou (b) Taça de chocolate com morangos frescos e creme de avelã. Reserva é recomendada para garantir mesa. Para edições de Dia das Mães em outros anos (2027 em diante), o menu pode mudar — consultar a equipe.',
'{"category": "CARDAPIO", "subcategory": "DIA_DAS_MAES_2026", "data_evento": "2026-05-10", "preco_pessoa": 199.00, "organization_id": "0ba344eb-8c40-403e-93e0-f6171e1cf06e"}',
'0ba344eb-8c40-403e-93e0-f6171e1cf06e'),

-- VAGAS DE EMPREGO (banco de talentos + Garçom e Barman abertas em 2026-05)
('Vagas de emprego do Empório Fonseca: o restaurante recebe currículos em regime de banco de talentos (sempre aceita CV, mesmo sem vaga aberta) e atualmente tem duas posições abertas: Garçom e Barman. Sofia confirma que a vaga está aberta, mas NÃO informa horário de trabalho, faixa salarial, tipo de contrato (CLT/PJ) ou benefícios — esses detalhes ficam com a Débora, responsável pela contratação. Dados que Sofia coleta antes de finalizar: nome completo do candidato, telefone para retorno, vaga de interesse (Garçom, Barman ou outra) e o PDF do currículo (obrigatório — Sofia pede para o candidato anexar o arquivo na própria conversa do WhatsApp ou Instagram). Após receber o PDF, Sofia agradece, confirma que a Débora vai analisar e entrará em contato (sem prometer prazo específico) e move o deal para a stage "Vagas/Currículos" via crm_mover_stage. Se o candidato não enviar o PDF na hora, Sofia orienta a enviar depois e mantém o deal na mesma stage. Se o cliente perguntar sobre vaga durante outro fluxo (reserva, pedido), Sofia pausa o fluxo atual, trata a vaga e depois retoma. Responsável pela avaliação: Débora Lopes (WhatsApp 27 99299-5545).',
'{"category": "VAGAS_EMPREGO", "subcategory": "BANCO_TALENTOS", "vagas_abertas": ["Garçom", "Barman"], "responsavel": "Débora Lopes", "organization_id": "0ba344eb-8c40-403e-93e0-f6171e1cf06e"}',
'0ba344eb-8c40-403e-93e0-f6171e1cf06e');

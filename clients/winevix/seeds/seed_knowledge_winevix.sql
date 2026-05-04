-- ==============================================
-- Seed: Knowledge base entries for Wine Vix (organization 9bae9327-3f4e-4d57-9979-d63f380e528a)
-- Run AFTER the migration AND after generating embeddings.
--
-- NOTA: Os embeddings precisam ser gerados via script ou n8n.
-- Este arquivo insere o conteúdo textual com metadata; para a Cabernet
-- recuperar via tool `treinamento`, é necessário popular `documents` com
-- embeddings (text-embedding-3-small, 1536 dims).
-- ==============================================

-- Organization ID do Wine Vix
-- 9bae9327-3f4e-4d57-9979-d63f380e528a

INSERT INTO documents (content, metadata, organization_id) VALUES

-- MENU DIA DAS MÃES 2026 (válido em 09/05 e 10/05)
('Menu Dia das Mães 2026 do Wine Vix: menu reduzido especial para celebração do Dia das Mães, válido em 2 dias. DISPONIBILIDADE E HORÁRIOS: SÁBADO 09/05/2026 (antecipação) — o menu fica disponível durante todo o expediente normal do sábado; reservas aceitas normalmente, sem regras especiais. DOMINGO 10/05/2026 (Dia das Mães) — ABERTURA ESPECIAL: o Wine Vix normalmente NÃO abre aos domingos, mas neste domingo abrirá em homenagem ao Dia das Mães. Funcionamento APENAS no horário de almoço, das 10h às 16h. Reservas aceitas APENAS até 11h30; após esse horário, atendimento será por ordem de chegada (walk-in, sem reserva). PREÇO: R$ 199,00 por pessoa para o menu reduzido (1 entrada + 1 prato principal + 1 sobremesa). PRATOS COMPARTILHADOS R$ 329,00 cada (servem 2 pessoas). ENTRADAS: Burrata caprese quente; Steak tartare; Ceviche de salmão; Carpaccio; Cesta de torradas. PRINCIPAIS: Salmão com risoto de limão siciliano; Risoto de camarão; Ancho com batata. SOBREMESA do menu reduzido: Profiteroles com calda de chocolate e recheio de doce de leite. PRATOS COMPARTILHADOS (servem 2 pessoas, R$ 329,00 cada): (1) Tábua de frutos do mar — risoto de tomate seco com alho-poró, polvo, camarão VG, anéis de lula e lagostim grelhados; (2) Filé mignon com risoto três queijos — filé mignon grelhado, risoto de grana padano, gorgonzola e brie, demi-glace de vinho tinto. Sobremesa que acompanha os compartilhados: Pavlova de frutas vermelhas. HARMONIZAÇÃO COM VINHOS (opcional, +R$ 199,00 por pessoa): Tábua de frutos do mar harmoniza com Izadi Garnacha Branca (Espanha 🇪🇸); Filé mignon com risoto três queijos harmoniza com Lindeman''s Pinot Noir (Austrália 🇦🇺). Fotos dos pratos disponíveis no Instagram: https://www.instagram.com/p/DX7qNoPgBic/. REGRAS PARA A CABERNET (agente IA): (a) Confirmar a data com o cliente: oferecer reserva para 09/05 (sábado) com horário normal, ou para 10/05 (domingo) APENAS entre 10h-16h. (b) Para reservas de 10/05: aceitar reservas APENAS para horários até 11h30. Se cliente pedir reserva após 11h30 no domingo, informar que após esse horário é por ordem de chegada e sugerir vir mais cedo OU optar pelo sábado. (c) Sempre confirmar disponibilidade via tool `verificar_disponibilidade` antes de fechar reserva. (d) Para edições de Dia das Mães em outros anos (2027 em diante), o menu, datas e horários podem mudar — consultar a equipe.',
'{"category": "CARDAPIO", "subcategory": "DIA_DAS_MAES_2026", "data_evento": "2026-05-10", "datas_validas": ["2026-05-09", "2026-05-10"], "preco_pessoa_menu_reduzido": 199.00, "preco_compartilhado_para_2": 329.00, "preco_harmonizacao_vinhos": 199.00, "abertura_excepcional_domingo": "10h-16h", "reservas_domingo_ate": "11h30", "organization_id": "9bae9327-3f4e-4d57-9979-d63f380e528a"}',
'9bae9327-3f4e-4d57-9979-d63f380e528a');

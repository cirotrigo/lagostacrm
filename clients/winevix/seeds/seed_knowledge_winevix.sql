-- ==============================================
-- Seed: Knowledge base entries for Wine Vix (organization 9bae9327-3f4e-4d57-9979-d63f380e528a)
-- Run AFTER the migration AND after generating embeddings.
--
-- NOTA: Os embeddings precisam ser gerados via script ou n8n.
-- Este arquivo insere o conteúdo textual com metadata; para a Sofia/Cabernet
-- recuperar via tool `treinamento`, é necessário popular `documents` com
-- embeddings (text-embedding-3-small, 1536 dims).
-- ==============================================

-- Organization ID do Wine Vix
-- 9bae9327-3f4e-4d57-9979-d63f380e528a

INSERT INTO documents (content, metadata, organization_id) VALUES

-- MENU DIA DAS MÃES 2026 (10/05/2026)
('Menu Dia das Mães 2026 do Wine Vix: menu reduzido especial para 10/05/2026 (segundo domingo de maio). ENTRADAS: Burrata caprese quente; Steak tartare; Ceviche de salmão; Carpaccio; Cesta de torradas. PRINCIPAIS: Salmão com risoto de limão siciliano; Risoto de camarão; Ancho com batata. SOBREMESA do menu reduzido: Profiteroles com calda de chocolate e recheio de doce de leite. PRATOS COMPARTILHADOS (servem 2 pessoas, R$ 329,00 cada): (1) Tábua de frutos do mar — risoto de tomate seco com alho-poró, polvo, camarão VG, anéis de lula e lagostim grelhados; (2) Filé mignon com risoto três queijos — filé mignon grelhado, risoto de grana padano, gorgonzola e brie, demi-glace de vinho tinto. Sobremesa que acompanha os compartilhados: Pavlova de frutas vermelhas. HARMONIZAÇÃO COM VINHOS (opcional, +R$ 199,00): Tábua de frutos do mar harmoniza com Izadi Garnacha Branca (Espanha 🇪🇸); Filé mignon com risoto três queijos harmoniza com Lindeman''s Pinot Noir (Austrália 🇦🇺). Fotos dos pratos disponíveis no Instagram: https://www.instagram.com/p/DX7qNoPgBic/. Reserva é recomendada para garantir a mesa no Dia das Mães. Para edições de Dia das Mães em outros anos (2027 em diante), o menu pode mudar — consultar a equipe.',
'{"category": "CARDAPIO", "subcategory": "DIA_DAS_MAES_2026", "data_evento": "2026-05-10", "preco_compartilhado_para_2": 329.00, "preco_harmonizacao_vinhos": 199.00, "organization_id": "9bae9327-3f4e-4d57-9979-d63f380e528a"}',
'9bae9327-3f4e-4d57-9979-d63f380e528a');

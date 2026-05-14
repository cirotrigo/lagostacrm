-- Seed: Cardápio Empório Fonseca
-- Organization: 0ba344eb-8c40-403e-93e0-f6171e1cf06e

INSERT INTO public.products (organization_id, name, description, price, category, sort_order, active, available, featured, tags) VALUES

-- ═══════════════════════════════════════════════════════════════
-- ENTRADAS
-- ═══════════════════════════════════════════════════════════════
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Croquete de Costela', 'Costela cozida lentamente. Servido com aioli.', 66, 'Entradas', 1, true, true, false, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Croquete de Parma', 'Croquete à base de bechamel e presunto de parma. Servido com aioli.', 66, 'Entradas', 2, true, true, false, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Croquete de Camarão', 'Base de moqueca de camarão.', 66, 'Entradas', 3, true, true, false, '{"frutos do mar"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Croquete de Siri', 'Base de bechamel, carne de siri com temperos e aioli de açafrão.', 66, 'Entradas', 4, true, true, false, '{"frutos do mar"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Steak Tartare', 'Filé mignon cortado na ponta da faca, cebola roxa, mostarda dijon, salsa, picles e alcaparras. Acompanha aioli de alho assado. Servido com pão italiano ou batata frita.', 94, 'Entradas', 5, true, true, true, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Carpaccio Fonseca', 'Carpaccio de filé mignon com molho de alcaparras e parmesão. Servido com pão italiano.', 84, 'Entradas', 6, true, true, false, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Porção de Pastel (6 unidades)', 'Consultar sabores.', 66, 'Entradas', 7, true, true, false, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Camarão Cacio & Pepe', 'Camarão salteado com mandioca, parmesão, pimenta do reino e manteiga. Acompanha pães.', 95, 'Entradas', 8, true, true, false, '{"frutos do mar"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Vinagrete de Polvo', 'Polvo picado salteado na manteiga, cebola roxa, tomate, coentro, pimentão amarelo e temperos. Acompanha pães.', 95, 'Entradas', 9, true, true, false, '{"frutos do mar"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Burrata', 'Burrata ao pesto com tomates confit. Servido com pão italiano.', 95, 'Entradas', 10, true, true, true, '{"vegetariano"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Tábua de Queijos', 'Queijos Artelatte, presuntos crus, picles e mel. Acompanha pães.', 119, 'Entradas', 11, true, true, true, '{"para compartilhar"}'),

-- ═══════════════════════════════════════════════════════════════
-- PRINCIPAIS
-- ═══════════════════════════════════════════════════════════════
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Filé Alfredo', 'Medalhão de filé mignon, molho roti acompanhado de massa longa ao molho alfredo.', 124, 'Principais', 1, true, true, false, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Ancho Bernaise', 'Ancho grelhado, molho bernaise e fritas.', 114, 'Principais', 2, true, true, false, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Panzotti de Funghi com Tornedor de Filé', 'Massa fresca recheada com funghi secchi e mussarela servido ao molho bordelaise com tornedor de filé mignon.', 149, 'Principais', 3, true, true, true, '{"massa"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Fraldinha e Aligot', 'Fraldinha grelhada, aligot de queijos da montanha, legumes grelhados e molho roti.', 129, 'Principais', 4, true, true, false, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Arroz Caldoso de Pato', 'Arroz com pato cozido em seu molho, paio, legumes verdes, ervas, ovo pochet e batata palha da casa.', 119, 'Principais', 5, true, true, false, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Salada Niçoise', 'Atum selado, ovos, vagem, batata, tomate, azeitona preta, picles de cebola roxa, aioli e mix de folhas.', 94, 'Principais', 6, true, true, false, '{"frutos do mar"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Risoto de Pupunha com Camarões', 'Risoto de pupunha confitado e açafrão da terra, servido com camarões salteados.', 139, 'Principais', 7, true, true, true, '{"frutos do mar"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Linguine ao Bisque', 'Linguine ao molho bisque, camarões salteados, tomate confitado e manjericão.', 139, 'Principais', 8, true, true, false, '{"massa","frutos do mar"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Risoto de Polvo', 'Risoto com polvo picado, glace de polvo e polvo grelhado.', 129, 'Principais', 9, true, true, false, '{"frutos do mar"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Ravioli de Bacalhau', 'Massa fresca recheada com bacalhau servido ao molho de limão siciliano, azeite verde e tapenade de azeitonas pretas com alcaparras.', 109, 'Principais', 10, true, true, false, '{"massa","frutos do mar"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Pesca do Dia', 'Filé de peixe grelhado, purê de batata, legumes verdes e beurre blanc.', 124, 'Principais', 11, true, true, false, '{"frutos do mar"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Salmão com Arroz Negro', 'Filé de salmão, risoto de arroz negro, tartar de manga, legumes salteados e picles de cebola roxa.', 126, 'Principais', 12, true, true, false, '{"frutos do mar"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Ossobuco para Compartilhar', 'Ossobuco cozido em sous vide, risoto de cogumelo paris e pangratatto de bacon.', 249, 'Principais', 13, true, true, true, '{"para compartilhar"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Polvo para Compartilhar', 'Polvo grelhado e salteado com vinho branco, alho e ervas, batatas coradas, aioli de páprica defumada acompanhado por arroz de brócolis.', 299, 'Principais', 14, true, true, true, '{"para compartilhar","frutos do mar"}'),

-- ═══════════════════════════════════════════════════════════════
-- SOBREMESAS
-- ═══════════════════════════════════════════════════════════════
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Merengada', 'Mousse de chocolate branco, geleia de morango, merengue e crumble.', 49, 'Sobremesas', 1, true, true, true, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Pudim de Leite', NULL, 20, 'Sobremesas', 2, true, true, false, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Bola de Gelato com Culi de Morango', 'Consultar sabores com o garçom.', 0, 'Sobremesas', 3, true, true, false, '{}'),

-- ═══════════════════════════════════════════════════════════════
-- CAFÉ DA MANHÃ — TOASTS E SANDUÍCHES
-- ═══════════════════════════════════════════════════════════════
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Toast Caprese', 'Mussarela de búfala, tomate confit e pesto.', 39, 'Café da Manhã — Toasts e Sanduíches', 1, true, true, false, '{"vegetariano"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Toast Atum', 'Pão italiano, rillet de atum fresco, chilli crunch e brotos.', 43, 'Café da Manhã — Toasts e Sanduíches', 2, true, true, false, '{"frutos do mar"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Toast Salmão', 'Salmão marinado, sour cream e ovo poché.', 46, 'Café da Manhã — Toasts e Sanduíches', 3, true, true, false, '{"frutos do mar"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Misto Quente', 'Pão de fermentação natural, mussarela e presunto parma.', 39, 'Café da Manhã — Toasts e Sanduíches', 4, true, true, false, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Queijo Quente', 'Pão de fermentação natural, béchamel, mussarela e cebola caramelizada.', 34, 'Café da Manhã — Toasts e Sanduíches', 5, true, true, false, '{"vegetariano"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Croque Madame', 'Brioche de fermentação natural, mussarela, presunto de parma, béchamel e ovo frito.', 49, 'Café da Manhã — Toasts e Sanduíches', 6, true, true, true, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Ovos Benedict Parma ou Salmão', 'Brioche de fermentação natural, ovo poché, molho hollandaise, salmão curado ou parma. Acompanha batata frita.', 49, 'Café da Manhã — Toasts e Sanduíches', 7, true, true, false, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Filé Cheese', 'Pão de fermentação natural, rosbife, mostarda dijon, mussarela, cebola caramelizada e rúcula. Acompanha batata frita.', 65, 'Café da Manhã — Toasts e Sanduíches', 8, true, true, false, '{}'),

-- ═══════════════════════════════════════════════════════════════
-- CAFÉ DA MANHÃ — PRATOS
-- ═══════════════════════════════════════════════════════════════
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Bowl com Ovos, Pão e Bacon', '3 ovos mexidos, bacon e pão de fermentação natural.', 46, 'Café da Manhã — Pratos', 1, true, true, false, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Omelete Fonseca', 'Parmesão, tomate, cebola caramelizada, salsa, bacon e mussarela. Acompanha salada.', 49, 'Café da Manhã — Pratos', 2, true, true, false, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Cesta de Pão de Queijo (3un)', NULL, 22, 'Café da Manhã — Pratos', 3, true, true, false, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Croissant', NULL, 16, 'Café da Manhã — Pratos', 4, true, true, false, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Waffle', 'Acompanhado de creme de avelã ou geleia de morango ou mel.', 34, 'Café da Manhã — Pratos', 5, true, true, false, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Bowl de Frutas da Estação', 'Com iogurte natural, granola e mel.', 32, 'Café da Manhã — Pratos', 6, true, true, false, '{"saudável"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Mini Brunch (serve 1 a 2 pessoas)', 'Ovos mexidos, pão na chapa, bacon, frutas da estação, iogurte natural, granola, mel, manteiga e geleia de morango.', 89, 'Café da Manhã — Pratos', 7, true, true, true, '{"para compartilhar"}'),

-- ═══════════════════════════════════════════════════════════════
-- CAFÉ DA MANHÃ — ADICIONAIS
-- ═══════════════════════════════════════════════════════════════
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Manteiga', NULL, 6, 'Café da Manhã — Adicionais', 1, true, true, false, '{"adicional"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Parmesão', NULL, 7, 'Café da Manhã — Adicionais', 2, true, true, false, '{"adicional"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Mussarela', NULL, 10, 'Café da Manhã — Adicionais', 3, true, true, false, '{"adicional"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Nutella', NULL, 12, 'Café da Manhã — Adicionais', 4, true, true, false, '{"adicional"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Geleia de Morango', NULL, 12, 'Café da Manhã — Adicionais', 5, true, true, false, '{"adicional"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Bacon', NULL, 11, 'Café da Manhã — Adicionais', 6, true, true, false, '{"adicional"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Ovos Mexidos', NULL, 19, 'Café da Manhã — Adicionais', 7, true, true, false, '{"adicional"}'),

-- ═══════════════════════════════════════════════════════════════
-- MÉTODOS FILTRADOS (CAFÉ)
-- ═══════════════════════════════════════════════════════════════
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Hario V60 200ml', NULL, 20, 'Métodos Filtrados', 1, true, true, false, '{"café"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Hario V60 400ml', NULL, 35, 'Métodos Filtrados', 2, true, true, false, '{"café"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Prensa Francesa 200ml', NULL, 20, 'Métodos Filtrados', 3, true, true, false, '{"café"}'),

-- ═══════════════════════════════════════════════════════════════
-- BEBIDAS QUENTES
-- ═══════════════════════════════════════════════════════════════
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Espresso Curto 30ml', NULL, 12, 'Bebidas Quentes', 1, true, true, false, '{"café"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Espresso Longo 50ml', NULL, 12, 'Bebidas Quentes', 2, true, true, false, '{"café"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Machiatto', 'Espresso e crema do leite vaporizado.', 12, 'Bebidas Quentes', 3, true, true, false, '{"café"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Cappuccino Italiano', 'Espresso e leite vaporizado.', 18, 'Bebidas Quentes', 4, true, true, false, '{"café"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Chocolate Quente 200ml', 'Feito com cacau 70%.', 28, 'Bebidas Quentes', 5, true, true, false, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Cappuccino Nutella', 'Espresso, leite vaporizado e borda de nutella.', 28, 'Bebidas Quentes', 6, true, true, false, '{"café"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Cappuccino Doce de Leite 200ml', 'Espresso, leite vaporizado e doce de leite.', 23, 'Bebidas Quentes', 7, true, true, false, '{"café"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Cappuccino Doce de Leite com Paçoca 200ml', 'Espresso, leite vaporizado, doce de leite e paçoca.', 29, 'Bebidas Quentes', 8, true, true, false, '{"café"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Cappuccino Pistache 200ml', 'Espresso, leite vaporizado, pasta de pistache e pralinê de pistache.', 36, 'Bebidas Quentes', 9, true, true, true, '{"café"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Mocaccino 200ml', 'Café, leite vaporizado e chocolate.', 26, 'Bebidas Quentes', 10, true, true, false, '{"café"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Latte Macchiato', 'Espresso e leite vaporizado (mais leite do que café).', 19, 'Bebidas Quentes', 11, true, true, false, '{"café"}'),

-- ═══════════════════════════════════════════════════════════════
-- BEBIDAS GELADAS
-- ═══════════════════════════════════════════════════════════════
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Cappuccino Gelado', 'Espresso e leite aerado.', 17, 'Bebidas Geladas', 1, true, true, false, '{"café"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Latte Caramelo Salgado', 'Espresso, leite e caramelo salgado.', 25, 'Bebidas Geladas', 2, true, true, false, '{"café"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Iced Latte Avelã', 'Espresso, leite aerado e essência de avelã.', 19, 'Bebidas Geladas', 3, true, true, false, '{"café"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Iced Latte Baunilha', 'Espresso, leite aerado e essência de baunilha.', 19, 'Bebidas Geladas', 4, true, true, false, '{"café"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Orange Coffee', 'Espresso e suco de laranja.', 19, 'Bebidas Geladas', 5, true, true, false, '{"café"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Espresso Tônica Limão', 'Espresso, água tônica e limão espremido.', 19, 'Bebidas Geladas', 6, true, true, false, '{"café"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Espresso Tônica Morango', 'Espresso, água tônica e coulis de morango.', 23, 'Bebidas Geladas', 7, true, true, false, '{"café"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Espresso Tônica Maracujá', 'Espresso, água tônica e maracujá.', 23, 'Bebidas Geladas', 8, true, true, false, '{"café"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Matte Pêssego', 'Chá matte e purê de pêssego.', 19, 'Bebidas Geladas', 9, true, true, false, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Matte Pera', 'Chá matte e purê de pera.', 19, 'Bebidas Geladas', 10, true, true, false, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Affogato', 'Espresso com gelato.', 29, 'Bebidas Geladas', 11, true, true, false, '{"café"}'),

-- ═══════════════════════════════════════════════════════════════
-- BEBIDAS ALCOÓLICAS
-- ═══════════════════════════════════════════════════════════════
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Aperol Spritz', NULL, 42, 'Bebidas Alcoólicas', 1, true, true, true, '{"drink"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Gin & Tônica', NULL, 36, 'Bebidas Alcoólicas', 2, true, true, false, '{"drink"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Bellini', NULL, 29, 'Bebidas Alcoólicas', 3, true, true, false, '{"drink"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Fitzgerald', NULL, 45, 'Bebidas Alcoólicas', 4, true, true, false, '{"drink"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Negroni', NULL, 47, 'Bebidas Alcoólicas', 5, true, true, true, '{"drink"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Penicillin', NULL, 46, 'Bebidas Alcoólicas', 6, true, true, false, '{"drink"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Moscow Mule', NULL, 45, 'Bebidas Alcoólicas', 7, true, true, false, '{"drink"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Taça de Espumante', NULL, 30, 'Bebidas Alcoólicas', 8, true, true, false, '{"vinho"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Azurra Pilsen', NULL, 20, 'Bebidas Alcoólicas', 9, true, true, false, '{"cerveja"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Heineken', NULL, 17, 'Bebidas Alcoólicas', 10, true, true, false, '{"cerveja"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Heineken Zero', NULL, 17, 'Bebidas Alcoólicas', 11, true, true, false, '{"cerveja","sem álcool"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Dose Cointreau', NULL, 30, 'Bebidas Alcoólicas', 12, true, true, false, '{"destilado"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Dose Vinho do Porto', NULL, 38, 'Bebidas Alcoólicas', 13, true, true, false, '{"vinho"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Dose Amarula', NULL, 22, 'Bebidas Alcoólicas', 14, true, true, false, '{"destilado"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Dose Princesa Isabel Jaqueira', NULL, 36, 'Bebidas Alcoólicas', 15, true, true, false, '{"destilado"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Dose Whisky Chivas 12 anos', NULL, 25, 'Bebidas Alcoólicas', 16, true, true, false, '{"whisky"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Dose Whisky Jameson', NULL, 32, 'Bebidas Alcoólicas', 17, true, true, false, '{"whisky"}'),

-- ═══════════════════════════════════════════════════════════════
-- BEBIDAS SEM ÁLCOOL
-- ═══════════════════════════════════════════════════════════════
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Suco de Uva Integral', NULL, 20, 'Bebidas Sem Álcool', 1, true, true, false, '{"saudável"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Soda Italiana', NULL, 25, 'Bebidas Sem Álcool', 2, true, true, false, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Pink Lemonade', NULL, 25, 'Bebidas Sem Álcool', 3, true, true, false, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Suco de Laranja Natural', NULL, 15, 'Bebidas Sem Álcool', 4, true, true, false, '{"saudável"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Suco de Laranja com Morango', NULL, 18, 'Bebidas Sem Álcool', 5, true, true, false, '{"saudável"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Refrigerante', NULL, 13, 'Bebidas Sem Álcool', 6, true, true, false, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Água com Gás', NULL, 11, 'Bebidas Sem Álcool', 7, true, true, false, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Água Sem Gás', NULL, 11, 'Bebidas Sem Álcool', 8, true, true, false, '{}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Água Tônica', NULL, 11, 'Bebidas Sem Álcool', 9, true, true, false, '{}'),

-- ═══════════════════════════════════════════════════════════════
-- ALMOÇO EXECUTIVO (vigência 12/05 a 22/05/2026 — campanha temporária)
-- Após 22/05, desativar (active=false) os itens desta seção.
-- ═══════════════════════════════════════════════════════════════
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Almoço Executivo', 'Combo do almoço executivo (Seg-Sex, 11h-16h, exceto feriados): 1 entrada + 1 principal + 1 sobremesa por R$ 89,90. Vigência: 12/05 a 22/05/2026.', 89.90, 'Almoço Executivo', 0, true, true, true, '{"executivo","campanha-temporaria","destaque"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Salada da Casa', 'Opção de entrada do Almoço Executivo (incluso no combo R$ 89,90).', 0, 'Almoço Executivo', 1, true, true, false, '{"executivo","campanha-temporaria","entrada"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Mix de Folhas e Couscous Marroquino (Almoço Executivo)', 'Mix de folhas com couscous Marroquino, damasco e ervas frescas. Opção de entrada do Almoço Executivo (incluso no combo R$ 89,90).', 0, 'Almoço Executivo', 2, true, true, false, '{"executivo","campanha-temporaria","entrada"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Tilápia Empanada com Risoni à Margheritta (Almoço Executivo)', 'Tilápia empanada acompanhada de Risoni à Margheritta. Opção de principal do Almoço Executivo (incluso no combo R$ 89,90).', 0, 'Almoço Executivo', 3, true, true, false, '{"executivo","campanha-temporaria","principal"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Polenta com Ragu de Cupim e Parmesão (Almoço Executivo)', 'Polenta cremosa com ragu de cupim finalizada com parmesão. Opção de principal do Almoço Executivo (incluso no combo R$ 89,90).', 0, 'Almoço Executivo', 4, true, true, false, '{"executivo","campanha-temporaria","principal"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Sobrecoxa de Frango Assada com Salada de Batata e Rúcula (Almoço Executivo)', 'Sobrecoxa de frango assada acompanhada de salada de batata com rúcula. Opção de principal do Almoço Executivo (incluso no combo R$ 89,90).', 0, 'Almoço Executivo', 5, true, true, false, '{"executivo","campanha-temporaria","principal"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Café (Almoço Executivo)', 'Opção de sobremesa do Almoço Executivo (incluso no combo R$ 89,90).', 0, 'Almoço Executivo', 6, true, true, false, '{"executivo","campanha-temporaria"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Pudim (Almoço Executivo)', 'Opção de sobremesa do Almoço Executivo (incluso no combo R$ 89,90).', 0, 'Almoço Executivo', 7, true, true, false, '{"executivo","campanha-temporaria"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Sobremesa do Dia (Almoço Executivo)', 'Opção de sobremesa do Almoço Executivo (incluso no combo R$ 89,90). Consultar sabor com a equipe.', 0, 'Almoço Executivo', 8, true, true, false, '{"executivo","campanha-temporaria"}'),

-- ═══════════════════════════════════════════════════════════════
-- DIA DA PIZZA (recorrente — toda quarta-feira)
-- A partir de R$ 79,90. Sabores rotativos; os 3 abaixo são os mais
-- comuns. Cliente deve consultar destaques @emporiofonseca ou
-- garçom para ver as opções da semana.
-- ═══════════════════════════════════════════════════════════════
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Pizza Queijo, Parma e Mel', 'Disponível às quartas-feiras (Dia da Pizza). A partir de R$ 79,90. Sabores rotativos a cada semana — consulte os destaques do Instagram @emporiofonseca ou pergunte ao garçom para ver as opções do dia.', 79.90, 'Dia da Pizza', 1, true, true, true, '{"pizza","dia-da-pizza","recorrente-quarta"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Pizza Queijo, Pepperoni e Tapenade de Azeitona Preta', 'Disponível às quartas-feiras (Dia da Pizza). A partir de R$ 79,90. Sabores rotativos a cada semana — consulte os destaques do Instagram @emporiofonseca ou pergunte ao garçom para ver as opções do dia.', 79.90, 'Dia da Pizza', 2, true, true, true, '{"pizza","dia-da-pizza","recorrente-quarta"}'),
('0ba344eb-8c40-403e-93e0-f6171e1cf06e', 'Pizza Caprese', 'Mozzarela de búfala, tomate cereja confitado e manjericão. Disponível às quartas-feiras (Dia da Pizza). A partir de R$ 79,90. Sabores rotativos a cada semana — consulte os destaques do Instagram @emporiofonseca ou pergunte ao garçom para ver as opções do dia.', 79.90, 'Dia da Pizza', 3, true, true, true, '{"pizza","dia-da-pizza","recorrente-quarta","vegetariano"}');

-- Valor final decidido pelo artesão: ajuste (desconto/acréscimo) sobre o valor calculado.
-- Aparece no PDF comercial como linhas "Valor do serviço" e "Desconto"/"Acréscimo" (D-070).
ALTER TABLE quotes ADD COLUMN price_adjustment_json TEXT;

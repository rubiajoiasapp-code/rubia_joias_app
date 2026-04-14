-- Impede que quantidade_estoque fique negativa em NOVAS operações.
-- NOT VALID: a constraint só é verificada em INSERT/UPDATE a partir de agora;
-- linhas existentes (mesmo que historicamente negativas por algum bug anterior)
-- continuam válidas e não são tocadas.

ALTER TABLE produtos
  ADD CONSTRAINT produtos_estoque_nao_negativo
  CHECK (quantidade_estoque >= 0) NOT VALID;

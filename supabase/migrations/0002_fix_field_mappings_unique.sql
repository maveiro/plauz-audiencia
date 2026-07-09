-- 0002_fix_field_mappings_unique.sql
--
-- Corrige a constraint de unicidade em field_mappings. Como estava
-- (unique (source_id, source_field)), uma mesma coluna de origem não podia
-- ser mapeada para mais de um campo canônico — o que é exatamente o caso de
-- uso do transform "split_cidade_estado" citado no CLAUDE.md: uma coluna
-- livre "Cidade/Estado" precisa gerar duas linhas de mapeamento (uma para
-- canonical_field = 'cidade', outra para canonical_field = 'estado'), ambas
-- apontando para o mesmo source_field.
--
-- A unicidade correta é por (source_id, source_field, canonical_field): a
-- mesma coluna pode alimentar mais de um campo canônico, mas não pode
-- mapear a mesma coluna para o mesmo campo canônico duas vezes.

alter table field_mappings
  drop constraint field_mappings_source_id_source_field_key;

alter table field_mappings
  add constraint field_mappings_source_id_source_field_canonical_field_key
  unique (source_id, source_field, canonical_field);

comment on constraint field_mappings_source_id_source_field_canonical_field_key
  on field_mappings is
  'Uma coluna de origem pode ser mapeada para mais de um campo canônico (ex: split_cidade_estado gera duas linhas para a mesma coluna), mas não pode repetir o mesmo par coluna+campo canônico.';

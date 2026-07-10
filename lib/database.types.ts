/**
 * Tipos gerados manualmente a partir das migrações em supabase/migrations/.
 *
 * Idealmente, regenerar via Supabase CLI sempre que uma nova migração for
 * aplicada, para garantir que este arquivo reflita exatamente o schema:
 *
 *   supabase gen types typescript --linked > lib/database.types.ts
 *
 * Enquanto o projeto não estiver "linkado" (`supabase link`), mantenha este
 * arquivo em sincronia manualmente com as migrações. O campo `Relationships`
 * de cada tabela é exigido pelo @supabase/postgrest-js para tipar selects
 * com embed (ex: `.select("*, eventos(id, artista_id)")`) — sem ele, todo
 * mundo colapsa silenciosamente para `never`.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      artistas: {
        Row: {
          id: string;
          nome: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          nome: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          nome?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      eventos: {
        Row: {
          id: string;
          artista_id: string;
          nome: string;
          data_evento: string | null;
          status: "planejamento" | "vendas_abertas" | "encerrado";
          created_at: string;
        };
        Insert: {
          id?: string;
          artista_id: string;
          nome: string;
          data_evento?: string | null;
          status?: "planejamento" | "vendas_abertas" | "encerrado";
          created_at?: string;
        };
        Update: {
          id?: string;
          artista_id?: string;
          nome?: string;
          data_evento?: string | null;
          status?: "planejamento" | "vendas_abertas" | "encerrado";
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "eventos_artista_id_fkey";
            columns: ["artista_id"];
            isOneToOne: false;
            referencedRelation: "artistas";
            referencedColumns: ["id"];
          },
        ];
      };
      sources: {
        Row: {
          id: string;
          evento_id: string;
          name: string;
          tipo: "google_sheets" | "arquivo_upload";
          sheet_id: string | null;
          sheet_url: string | null;
          tab_name: string | null;
          arquivo_path: string | null;
          arquivo_nome_original: string | null;
          arquivo_enviado_em: string | null;
          status: "active" | "paused" | "error";
          last_synced_at: string | null;
          deleted_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          evento_id: string;
          name: string;
          tipo?: "google_sheets" | "arquivo_upload";
          sheet_id?: string | null;
          sheet_url?: string | null;
          tab_name?: string | null;
          arquivo_path?: string | null;
          arquivo_nome_original?: string | null;
          arquivo_enviado_em?: string | null;
          status?: "active" | "paused" | "error";
          last_synced_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          evento_id?: string;
          name?: string;
          tipo?: "google_sheets" | "arquivo_upload";
          sheet_id?: string | null;
          sheet_url?: string | null;
          tab_name?: string | null;
          arquivo_path?: string | null;
          arquivo_nome_original?: string | null;
          arquivo_enviado_em?: string | null;
          status?: "active" | "paused" | "error";
          last_synced_at?: string | null;
          deleted_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sources_evento_id_fkey";
            columns: ["evento_id"];
            isOneToOne: false;
            referencedRelation: "eventos";
            referencedColumns: ["id"];
          },
        ];
      };
      raw_responses: {
        Row: {
          id: string;
          source_id: string;
          row_hash: string;
          raw_data: Json;
          synced_at: string;
        };
        Insert: {
          id?: string;
          source_id: string;
          row_hash: string;
          raw_data: Json;
          synced_at?: string;
        };
        Update: {
          id?: string;
          source_id?: string;
          row_hash?: string;
          raw_data?: Json;
          synced_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "raw_responses_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      field_mappings: {
        Row: {
          id: string;
          source_id: string;
          source_field: string;
          canonical_field:
            | "nome_completo"
            | "telefone"
            | "email"
            | "cidade"
            | "estado"
            | "submitted_at";
          transform: string | null;
        };
        Insert: {
          id?: string;
          source_id: string;
          source_field: string;
          canonical_field:
            | "nome_completo"
            | "telefone"
            | "email"
            | "cidade"
            | "estado"
            | "submitted_at";
          transform?: string | null;
        };
        Update: {
          id?: string;
          source_id?: string;
          source_field?: string;
          canonical_field?:
            | "nome_completo"
            | "telefone"
            | "email"
            | "cidade"
            | "estado"
            | "submitted_at";
          transform?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "field_mappings_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      municipios_ref: {
        Row: {
          id: number;
          nome: string;
          uf: string;
          nome_normalizado: string;
        };
        Insert: {
          id?: number;
          nome: string;
          uf: string;
          nome_normalizado: string;
        };
        Update: {
          id?: number;
          nome?: string;
          uf?: string;
          nome_normalizado?: string;
        };
        Relationships: [];
      };
      interessados: {
        Row: {
          id: string;
          evento_id: string;
          artista_id: string;
          source_id: string;
          raw_response_id: string;
          nome_completo: string | null;
          telefone: string | null;
          telefone_valido: boolean | null;
          email: string | null;
          email_valido: boolean | null;
          cidade_informada: string | null;
          estado_informada: string | null;
          cidade_normalizada: string | null;
          estado_normalizado: string | null;
          local_confianca: number | null;
          local_revisao_pendente: boolean;
          submitted_at: string | null;
          extra: Json;
          synced_at: string;
        };
        Insert: {
          id?: string;
          evento_id: string;
          artista_id: string;
          source_id: string;
          raw_response_id: string;
          nome_completo?: string | null;
          telefone?: string | null;
          telefone_valido?: boolean | null;
          email?: string | null;
          email_valido?: boolean | null;
          cidade_informada?: string | null;
          estado_informada?: string | null;
          cidade_normalizada?: string | null;
          estado_normalizado?: string | null;
          local_confianca?: number | null;
          local_revisao_pendente?: boolean;
          submitted_at?: string | null;
          extra?: Json;
          synced_at?: string;
        };
        Update: {
          id?: string;
          evento_id?: string;
          artista_id?: string;
          source_id?: string;
          raw_response_id?: string;
          nome_completo?: string | null;
          telefone?: string | null;
          telefone_valido?: boolean | null;
          email?: string | null;
          email_valido?: boolean | null;
          cidade_informada?: string | null;
          estado_informada?: string | null;
          cidade_normalizada?: string | null;
          estado_normalizado?: string | null;
          local_confianca?: number | null;
          local_revisao_pendente?: boolean;
          submitted_at?: string | null;
          extra?: Json;
          synced_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "interessados_evento_id_fkey";
            columns: ["evento_id"];
            isOneToOne: false;
            referencedRelation: "eventos";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interessados_artista_id_fkey";
            columns: ["artista_id"];
            isOneToOne: false;
            referencedRelation: "artistas";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interessados_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "interessados_raw_response_id_fkey";
            columns: ["raw_response_id"];
            isOneToOne: true;
            referencedRelation: "raw_responses";
            referencedColumns: ["id"];
          },
        ];
      };
      sync_logs: {
        Row: {
          id: string;
          source_id: string;
          started_at: string;
          finished_at: string | null;
          rows_found: number | null;
          rows_inserted: number | null;
          status: "running" | "success" | "error";
          error_message: string | null;
        };
        Insert: {
          id?: string;
          source_id: string;
          started_at?: string;
          finished_at?: string | null;
          rows_found?: number | null;
          rows_inserted?: number | null;
          status?: "running" | "success" | "error";
          error_message?: string | null;
        };
        Update: {
          id?: string;
          source_id?: string;
          started_at?: string;
          finished_at?: string | null;
          rows_found?: number | null;
          rows_inserted?: number | null;
          status?: "running" | "success" | "error";
          error_message?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sync_logs_source_id_fkey";
            columns: ["source_id"];
            isOneToOne: false;
            referencedRelation: "sources";
            referencedColumns: ["id"];
          },
        ];
      };
      geo_ia_logs: {
        Row: {
          id: string;
          interessado_id: string;
          cidade_informada: string | null;
          estado_informada: string | null;
          cidade_sugerida: string | null;
          estado_sugerido: string | null;
          confianca_ia: number | null;
          confianca_similaridade: number | null;
          aplicado: boolean;
          modelo: string;
          motivo: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          interessado_id: string;
          cidade_informada?: string | null;
          estado_informada?: string | null;
          cidade_sugerida?: string | null;
          estado_sugerido?: string | null;
          confianca_ia?: number | null;
          confianca_similaridade?: number | null;
          aplicado: boolean;
          modelo: string;
          motivo?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          interessado_id?: string;
          cidade_informada?: string | null;
          estado_informada?: string | null;
          cidade_sugerida?: string | null;
          estado_sugerido?: string | null;
          confianca_ia?: number | null;
          confianca_similaridade?: number | null;
          aplicado?: boolean;
          modelo?: string;
          motivo?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "geo_ia_logs_interessado_id_fkey";
            columns: ["interessado_id"];
            isOneToOne: false;
            referencedRelation: "interessados";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      // Views "passthrough" (select * from ... where deleted_at is null),
      // então carregam as mesmas Relationships da tabela de origem — ver
      // CLAUDE.md, princípio 11 (a aplicação só consulta estas views).
      sources_ativas: {
        Row: Database["public"]["Tables"]["sources"]["Row"];
        Relationships: Database["public"]["Tables"]["sources"]["Relationships"];
      };
      interessados_ativos: {
        Row: Database["public"]["Tables"]["interessados"]["Row"];
        Relationships: Database["public"]["Tables"]["interessados"]["Relationships"];
      };
      publico_sobreposto: {
        Row: {
          email: string;
          artistas_distintos: number;
          artista_ids: string[];
          total_registros: number;
        };
        Relationships: [];
      };
      // Views de agregação do dashboard (0005_dashboard_views.sql) — ver
      // ARCHITECTURE.md, seção "Dashboard".
      // cidade/estado/dia abaixo foram adicionados na 0008_dash_filtros_clicaveis.sql
      // (filtro por clique nos gráficos de cidade/evento) — ver CLAUDE.md,
      // seção "Camada adicional: dashboard".
      dash_interessados_diarios: {
        Row: {
          dia: string;
          evento_id: string;
          evento_nome: string;
          artista_id: string;
          artista_nome: string;
          total: number;
          email_validos: number;
          telefone_validos: number;
          cidade: string | null;
          estado: string | null;
        };
        Relationships: [];
      };
      dash_qualidade_por_fonte: {
        Row: {
          source_id: string;
          source_name: string;
          tipo: "google_sheets" | "arquivo_upload";
          status: "active" | "paused" | "error";
          last_synced_at: string | null;
          evento_id: string;
          evento_nome: string;
          artista_id: string;
          artista_nome: string;
          total: number;
          email_validos: number;
          telefone_validos: number;
          local_pendentes: number;
          cidade: string | null;
          estado: string | null;
        };
        Relationships: [];
      };
      dash_geografia: {
        Row: {
          cidade: string;
          estado: string | null;
          artista_id: string;
          evento_id: string;
          total: number;
          dia: string;
        };
        Relationships: [];
      };
    };
    Functions: {
      match_municipio: {
        Args: { p_nome_normalizado: string; p_uf?: string | null };
        Returns: { nome: string; uf: string; similaridade: number }[];
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

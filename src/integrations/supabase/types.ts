export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agreements: {
        Row: {
          active: boolean
          created_at: string
          id: string
          jurisdiction: string | null
          local_union: string | null
          name: string
          notes: string | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          jurisdiction?: string | null
          local_union?: string | null
          name: string
          notes?: string | null
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          jurisdiction?: string | null
          local_union?: string | null
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
      calculation_results: {
        Row: {
          base_total: number
          breakdown: Json
          created_at: string
          effective_date: string | null
          extras_total: number
          grand_total: number
          id: string
          job_id: string
          metrics: Json
          premiums_total: number
          rate_table_id: string | null
        }
        Insert: {
          base_total?: number
          breakdown?: Json
          created_at?: string
          effective_date?: string | null
          extras_total?: number
          grand_total?: number
          id?: string
          job_id: string
          metrics?: Json
          premiums_total?: number
          rate_table_id?: string | null
        }
        Update: {
          base_total?: number
          breakdown?: Json
          created_at?: string
          effective_date?: string | null
          extras_total?: number
          grand_total?: number
          id?: string
          job_id?: string
          metrics?: Json
          premiums_total?: number
          rate_table_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calculation_results_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calculation_results_rate_table_id_fkey"
            columns: ["rate_table_id"]
            isOneToOne: false
            referencedRelation: "rate_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      job_areas: {
        Row: {
          ceiling_height: number | null
          floor: string | null
          id: string
          job_id: string
          name: string
          room: string | null
          sort_order: number
          unit: string | null
          zone: string | null
        }
        Insert: {
          ceiling_height?: number | null
          floor?: string | null
          id?: string
          job_id: string
          name: string
          room?: string | null
          sort_order?: number
          unit?: string | null
          zone?: string | null
        }
        Update: {
          ceiling_height?: number | null
          floor?: string | null
          id?: string
          job_id?: string
          name?: string
          room?: string | null
          sort_order?: number
          unit?: string | null
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_areas_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_boarding_items: {
        Row: {
          area_id: string | null
          entry_mode: string
          height_category: string | null
          id: string
          job_id: string
          location: string | null
          material: string
          notes: string | null
          quantity: number
          sheet_height: number
          sheet_width: number
          sq_ft: number
          thickness: string | null
        }
        Insert: {
          area_id?: string | null
          entry_mode?: string
          height_category?: string | null
          id?: string
          job_id: string
          location?: string | null
          material: string
          notes?: string | null
          quantity?: number
          sheet_height?: number
          sheet_width?: number
          sq_ft?: number
          thickness?: string | null
        }
        Update: {
          area_id?: string | null
          entry_mode?: string
          height_category?: string | null
          id?: string
          job_id?: string
          location?: string | null
          material?: string
          notes?: string | null
          quantity?: number
          sheet_height?: number
          sheet_width?: number
          sq_ft?: number
          thickness?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_boarding_items_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "job_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_boarding_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_extra_items: {
        Row: {
          area_id: string | null
          id: string
          item_code: string
          item_name: string | null
          job_id: string
          notes: string | null
          quantity: number
          unit: string | null
        }
        Insert: {
          area_id?: string | null
          id?: string
          item_code: string
          item_name?: string | null
          job_id: string
          notes?: string | null
          quantity?: number
          unit?: string | null
        }
        Update: {
          area_id?: string | null
          id?: string
          item_code?: string
          item_name?: string | null
          job_id?: string
          notes?: string | null
          quantity?: number
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "job_extra_items_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "job_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_extra_items_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      job_premiums: {
        Row: {
          id: string
          item_code: string
          item_name: string | null
          job_id: string
          notes: string | null
          quantity: number
        }
        Insert: {
          id?: string
          item_code: string
          item_name?: string | null
          job_id: string
          notes?: string | null
          quantity?: number
        }
        Update: {
          id?: string
          item_code?: string
          item_name?: string | null
          job_id?: string
          notes?: string | null
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "job_premiums_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          address: string | null
          agreement_id: string | null
          contractor: string | null
          created_at: string
          id: string
          job_date: string
          name: string
          notes: string | null
          project_subtype: string | null
          project_type: string
          rate_table_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          agreement_id?: string | null
          contractor?: string | null
          created_at?: string
          id?: string
          job_date?: string
          name: string
          notes?: string | null
          project_subtype?: string | null
          project_type: string
          rate_table_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          agreement_id?: string | null
          contractor?: string | null
          created_at?: string
          id?: string
          job_date?: string
          name?: string
          notes?: string | null
          project_subtype?: string | null
          project_type?: string
          rate_table_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jobs_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_rate_table_id_fkey"
            columns: ["rate_table_id"]
            isOneToOne: false
            referencedRelation: "rate_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
        }
        Relationships: []
      }
      rate_items: {
        Row: {
          active: boolean
          calculation_type: string
          category: string
          created_at: string
          height_category: string | null
          id: string
          included_qty: number
          item_code: string
          item_name: string
          material: string | null
          notes: string | null
          project_type: string
          rate: number
          rate_table_id: string
          thickness: string | null
          unit: string
        }
        Insert: {
          active?: boolean
          calculation_type?: string
          category: string
          created_at?: string
          height_category?: string | null
          id?: string
          included_qty?: number
          item_code: string
          item_name: string
          material?: string | null
          notes?: string | null
          project_type: string
          rate?: number
          rate_table_id: string
          thickness?: string | null
          unit: string
        }
        Update: {
          active?: boolean
          calculation_type?: string
          category?: string
          created_at?: string
          height_category?: string | null
          id?: string
          included_qty?: number
          item_code?: string
          item_name?: string
          material?: string | null
          notes?: string | null
          project_type?: string
          rate?: number
          rate_table_id?: string
          thickness?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_items_rate_table_id_fkey"
            columns: ["rate_table_id"]
            isOneToOne: false
            referencedRelation: "rate_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_rules: {
        Row: {
          active: boolean
          auto_apply: boolean
          condition: Json
          id: string
          item_code: string
          name: string
          project_type: string | null
          rate_table_id: string
        }
        Insert: {
          active?: boolean
          auto_apply?: boolean
          condition?: Json
          id?: string
          item_code: string
          name: string
          project_type?: string | null
          rate_table_id: string
        }
        Update: {
          active?: boolean
          auto_apply?: boolean
          condition?: Json
          id?: string
          item_code?: string
          name?: string
          project_type?: string | null
          rate_table_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_rules_rate_table_id_fkey"
            columns: ["rate_table_id"]
            isOneToOne: false
            referencedRelation: "rate_tables"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_tables: {
        Row: {
          active: boolean
          agreement_id: string
          created_at: string
          effective_from: string
          effective_to: string | null
          id: string
          notes: string | null
          version: string
        }
        Insert: {
          active?: boolean
          agreement_id: string
          created_at?: string
          effective_from: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          version: string
        }
        Update: {
          active?: boolean
          agreement_id?: string
          created_at?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          notes?: string | null
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_tables_agreement_id_fkey"
            columns: ["agreement_id"]
            isOneToOne: false
            referencedRelation: "agreements"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_tiers: {
        Row: {
          id: string
          max_qty: number | null
          min_qty: number
          rate: number
          rate_item_id: string
        }
        Insert: {
          id?: string
          max_qty?: number | null
          min_qty?: number
          rate: number
          rate_item_id: string
        }
        Update: {
          id?: string
          max_qty?: number | null
          min_qty?: number
          rate?: number
          rate_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_tiers_rate_item_id_fkey"
            columns: ["rate_item_id"]
            isOneToOne: false
            referencedRelation: "rate_items"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          content: Json
          created_at: string
          id: string
          job_id: string
          title: string
          user_id: string
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          job_id: string
          title?: string
          user_id: string
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          job_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          id: string
          key: string
          user_id: string
          value: Json
        }
        Insert: {
          id?: string
          key: string
          user_id: string
          value?: Json
        }
        Update: {
          id?: string
          key?: string
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "estimator" | "worker"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "estimator", "worker"],
    },
  },
} as const

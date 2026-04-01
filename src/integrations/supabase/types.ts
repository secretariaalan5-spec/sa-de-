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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_states: {
        Row: {
          emult_state: Json | null
          id: string
          portal_codes: Json | null
          service_state: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          emult_state?: Json | null
          id?: string
          portal_codes?: Json | null
          service_state?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          emult_state?: Json | null
          id?: string
          portal_codes?: Json | null
          service_state?: Json | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          active: boolean
          color: string
          created_at: string
          id: string
          name: string
          slug: string
          team_id: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          id?: string
          name: string
          slug: string
          team_id: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          id?: string
          name?: string
          slug?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      category_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          admin_id: string
          category_ids: string[]
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          label: string
          max_uses: number | null
          token: string
          updated_at: string
          uses_count: number
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          admin_id: string
          category_ids: string[]
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string
          max_uses?: number | null
          token: string
          updated_at?: string
          uses_count?: number
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          admin_id?: string
          category_ids?: string[]
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string
          max_uses?: number | null
          token?: string
          updated_at?: string
          uses_count?: number
        }
        Relationships: []
      }
      employees: {
        Row: {
          active: boolean
          category_id: string | null
          created_at: string
          id: string
          monthly_hours: number
          name: string
          team_id: string
          unit_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          id?: string
          monthly_hours?: number
          name: string
          team_id: string
          unit_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          category_id?: string | null
          created_at?: string
          id?: string
          monthly_hours?: number
          name?: string
          team_id?: string
          unit_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      invites: {
        Row: {
          category_id: string | null
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          role: string
          team_id: string
          token: string
          unit_id: string | null
          used: boolean
          used_by: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          role?: string
          team_id: string
          token?: string
          unit_id?: string | null
          used?: boolean
          used_by?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          role?: string
          team_id?: string
          token?: string
          unit_id?: string | null
          used?: boolean
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_credits: {
        Row: {
          amount: number
          created_at: string
          employee_id: string
          id: string
          origin: string
          reference_id: string | null
          team_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          employee_id: string
          id?: string
          origin: string
          reference_id?: string | null
          team_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          employee_id?: string
          id?: string
          origin?: string
          reference_id?: string | null
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_credits_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_credits_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          created_at: string
          days_requested: number
          decided_at: string | null
          decided_by: string | null
          employee_id: string
          id: string
          leave_dates: string[]
          observations: string | null
          requested_by: string | null
          status: string
          team_id: string
        }
        Insert: {
          created_at?: string
          days_requested?: number
          decided_at?: string | null
          decided_by?: string | null
          employee_id: string
          id?: string
          leave_dates?: string[]
          observations?: string | null
          requested_by?: string | null
          status?: string
          team_id: string
        }
        Update: {
          created_at?: string
          days_requested?: number
          decided_at?: string | null
          decided_by?: string | null
          employee_id?: string
          id?: string
          leave_dates?: string[]
          observations?: string | null
          requested_by?: string | null
          status?: string
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          team_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          team_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          team_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_leave_requests: {
        Row: {
          created_at: string
          days_requested: number | null
          id: string
          leave_dates: string[] | null
          observations: string | null
          professional_id: string | null
          status: string
          team_id: string | null
        }
        Insert: {
          created_at?: string
          days_requested?: number | null
          id?: string
          leave_dates?: string[] | null
          observations?: string | null
          professional_id?: string | null
          status?: string
          team_id?: string | null
        }
        Update: {
          created_at?: string
          days_requested?: number | null
          id?: string
          leave_dates?: string[] | null
          observations?: string | null
          professional_id?: string | null
          status?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_leave_requests_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      professional_users: {
        Row: {
          category: string
          created_at: string
          full_name: string
          function_name: string | null
          id: string
          professional_id: string | null
          status: string
          team_id: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          full_name?: string
          function_name?: string | null
          id?: string
          professional_id?: string | null
          status?: string
          team_id?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          full_name?: string
          function_name?: string | null
          id?: string
          professional_id?: string | null
          status?: string
          team_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "professional_users_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          team_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          team_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          team_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      schedules: {
        Row: {
          created_at: string
          created_by: string | null
          date: string
          employee_id: string
          id: string
          team_id: string
          type: string
          unit_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          date: string
          employee_id: string
          id?: string
          team_id: string
          type?: string
          unit_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          date?: string
          employee_id?: string
          id?: string
          team_id?: string
          type?: string
          unit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "schedules_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schedules_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      teams: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      transfer_history: {
        Row: {
          employee_id: string
          from_unit_id: string | null
          id: string
          team_id: string
          to_unit_id: string | null
          transferred_at: string
          transferred_by: string | null
        }
        Insert: {
          employee_id: string
          from_unit_id?: string | null
          id?: string
          team_id: string
          to_unit_id?: string | null
          transferred_at?: string
          transferred_by?: string | null
        }
        Update: {
          employee_id?: string
          from_unit_id?: string | null
          id?: string
          team_id?: string
          to_unit_id?: string | null
          transferred_at?: string
          transferred_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transfer_history_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_history_from_unit_id_fkey"
            columns: ["from_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_history_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_history_to_unit_id_fkey"
            columns: ["to_unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          team_id: string
          type: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          team_id: string
          type?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          team_id?: string
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "units_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          category: string | null
          category_id: string | null
          created_at: string
          id: string
          role: string
          team_id: string | null
          unit_id: string | null
          user_id: string
        }
        Insert: {
          category?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          role?: string
          team_id?: string | null
          unit_id?: string | null
          user_id: string
        }
        Update: {
          category?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          role?: string
          team_id?: string | null
          unit_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_category_invite: { Args: { p_token: string }; Returns: Json }
      generate_invite_token: { Args: never; Returns: string }
      grant_pending_extra_credits: { Args: never; Returns: number }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
      remove_user_completely: { Args: { p_user_id: string }; Returns: Json }
      user_category_id: { Args: never; Returns: string }
      user_category_ids: { Args: never; Returns: string[] }
      user_is: { Args: { _role: string }; Returns: boolean }
      user_is_any: { Args: { _roles: string[] }; Returns: boolean }
      user_unit_id: { Args: never; Returns: string }
    }
    Enums: {
      app_role:
        | "admin"
        | "category_chief"
        | "unit_manager"
        | "rh"
        | "professional"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: [
        "admin",
        "category_chief",
        "unit_manager",
        "rh",
        "professional",
      ],
    },
  },
} as const

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
      apology_letters: {
        Row: {
          case_id: string
          content: string
          id: string
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          status: Database["public"]["Enums"]["apology_status"]
          student_id: string
          submitted_at: string
        }
        Insert: {
          case_id: string
          content: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["apology_status"]
          student_id: string
          submitted_at?: string
        }
        Update: {
          case_id?: string
          content?: string
          id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          status?: Database["public"]["Enums"]["apology_status"]
          student_id?: string
          submitted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "apology_letters_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apology_letters_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "apology_letters_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      case_history: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          case_id: string
          created_at: string
          details: string | null
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          case_id: string
          created_at?: string
          details?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          case_id?: string
          created_at?: string
          details?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          case_number: string
          created_at: string
          description: string
          id: string
          incident_date: string | null
          incident_location: string | null
          offense_category: string
          reportee_type: string
          reporter_id: string | null
          severity: Database["public"]["Enums"]["case_severity"]
          status: Database["public"]["Enums"]["case_status"]
          student_department: string | null
          student_id: string | null
          student_level: string | null
          student_matric: string | null
          student_name: string
          title: string
          updated_at: string
        }
        Insert: {
          case_number: string
          created_at?: string
          description: string
          id?: string
          incident_date?: string | null
          incident_location?: string | null
          offense_category: string
          reportee_type?: string
          reporter_id?: string | null
          severity?: Database["public"]["Enums"]["case_severity"]
          status?: Database["public"]["Enums"]["case_status"]
          student_department?: string | null
          student_id?: string | null
          student_level?: string | null
          student_matric?: string | null
          student_name: string
          title: string
          updated_at?: string
        }
        Update: {
          case_number?: string
          created_at?: string
          description?: string
          id?: string
          incident_date?: string | null
          incident_location?: string | null
          offense_category?: string
          reportee_type?: string
          reporter_id?: string | null
          severity?: Database["public"]["Enums"]["case_severity"]
          status?: Database["public"]["Enums"]["case_status"]
          student_department?: string | null
          student_id?: string | null
          student_level?: string | null
          student_matric?: string | null
          student_name?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          case_id: string
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_type: string | null
          id: string
          uploader_id: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_type?: string | null
          id?: string
          uploader_id?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_type?: string | null
          id?: string
          uploader_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "evidence_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evidence_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      hearings: {
        Row: {
          case_id: string
          created_at: string
          created_by: string | null
          id: string
          location: string | null
          notes: string | null
          outcome: string | null
          reminder_sent_at: string | null
          scheduled_at: string
          status: Database["public"]["Enums"]["hearing_status"]
          unavailability_reason: string | null
          unavailability_review_notes: string | null
          unavailability_reviewed_at: string | null
          unavailability_reviewed_by: string | null
          unavailability_status: string | null
          unavailability_submitted_at: string | null
        }
        Insert: {
          case_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          outcome?: string | null
          reminder_sent_at?: string | null
          scheduled_at: string
          status?: Database["public"]["Enums"]["hearing_status"]
          unavailability_reason?: string | null
          unavailability_review_notes?: string | null
          unavailability_reviewed_at?: string | null
          unavailability_reviewed_by?: string | null
          unavailability_status?: string | null
          unavailability_submitted_at?: string | null
        }
        Update: {
          case_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          outcome?: string | null
          reminder_sent_at?: string | null
          scheduled_at?: string
          status?: Database["public"]["Enums"]["hearing_status"]
          unavailability_reason?: string | null
          unavailability_review_notes?: string | null
          unavailability_reviewed_at?: string | null
          unavailability_reviewed_by?: string | null
          unavailability_status?: string | null
          unavailability_submitted_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hearings_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hearings_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "hearings_unavailability_reviewed_by_fkey"
            columns: ["unavailability_reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          email: string | null
          faculty: string | null
          full_name: string
          id: string
          level: string | null
          matric_number: string | null
          phone: string | null
          staff_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string | null
          faculty?: string | null
          full_name: string
          id: string
          level?: string | null
          matric_number?: string | null
          phone?: string | null
          staff_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string | null
          faculty?: string | null
          full_name?: string
          id?: string
          level?: string | null
          matric_number?: string | null
          phone?: string | null
          staff_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      sanctions: {
        Row: {
          case_id: string
          description: string | null
          duration_days: number | null
          duration_semesters: number | null
          ends_at: string | null
          id: string
          issued_at: string
          issued_by: string | null
          starts_at: string | null
          type: Database["public"]["Enums"]["sanction_type"]
        }
        Insert: {
          case_id: string
          description?: string | null
          duration_days?: number | null
          duration_semesters?: number | null
          ends_at?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          starts_at?: string | null
          type: Database["public"]["Enums"]["sanction_type"]
        }
        Update: {
          case_id?: string
          description?: string | null
          duration_days?: number | null
          duration_semesters?: number | null
          ends_at?: string | null
          id?: string
          issued_at?: string
          issued_by?: string | null
          starts_at?: string | null
          type?: Database["public"]["Enums"]["sanction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "sanctions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sanctions_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          faculty: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          faculty?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          faculty?: string | null
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
      [_ in never]: never
    }
    Enums: {
      apology_status: "submitted" | "accepted" | "rejected"
      app_role:
        | "admin"
        | "dsa"
        | "chair"
        | "committee"
        | "faculty"
        | "student"
        | "dean"
        | "hod"
        | "lecturer"
        | "staff"
      case_severity: "low" | "medium" | "high" | "critical"
      case_status:
        | "pending_review"
        | "reported"
        | "under_review"
        | "hearing_scheduled"
        | "decided"
        | "closed"
        | "appealed"
      hearing_status: "scheduled" | "completed" | "cancelled" | "rescheduled"
      sanction_type:
        | "warning"
        | "probation"
        | "community_service"
        | "fine"
        | "suspension"
        | "expulsion"
        | "dismissed"
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
      apology_status: ["submitted", "accepted", "rejected"],
      app_role: [
        "admin",
        "dsa",
        "chair",
        "committee",
        "faculty",
        "student",
        "dean",
        "hod",
        "lecturer",
        "staff",
      ],
      case_severity: ["low", "medium", "high", "critical"],
      case_status: [
        "pending_review",
        "reported",
        "under_review",
        "hearing_scheduled",
        "decided",
        "closed",
        "appealed",
      ],
      hearing_status: ["scheduled", "completed", "cancelled", "rescheduled"],
      sanction_type: [
        "warning",
        "probation",
        "community_service",
        "fine",
        "suspension",
        "expulsion",
        "dismissed",
      ],
    },
  },
} as const

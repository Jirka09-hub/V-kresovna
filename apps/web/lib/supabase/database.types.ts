
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "assignments": {
                  Row: {
                    "created_at": string,"created_by": string | null,"due_at": string | null,"group_id": string,"id": string,"lesson_slug": string,"module_slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"due_at"?: string | null,"group_id": string,"id"?: string,"lesson_slug": string,"module_slug": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"due_at"?: string | null,"group_id"?: string,"id"?: string,"lesson_slug"?: string,"module_slug"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assignments_group_id_fkey"
      columns: ["group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id"]
    }
                  ]
                },"attempts": {
                  Row: {
                    "answer": Json | null,"created_at": string,"difficulty": number,"duration_ms": number | null,"engine_version": string,"error_codes": (string)[],"exercise_type": string,"focus": string | null,"id": number,"is_correct": boolean,"lesson_slug": string,"module_slug": string,"org_id": string | null,"run_id": string | null,"score": number,"seed": number,"task_index": number | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer"?: Json | null,"created_at"?: string,"difficulty": number,"duration_ms"?: number | null,"engine_version": string,"error_codes"?: (string)[],"exercise_type": string,"focus"?: string | null,"id"?: never,"is_correct": boolean,"lesson_slug": string,"module_slug": string,"org_id"?: string | null,"run_id"?: string | null,"score": number,"seed": number,"task_index"?: number | null,"user_id"?: string
                  }
                  Update: {
                    "answer"?: Json | null,"created_at"?: string,"difficulty"?: number,"duration_ms"?: number | null,"engine_version"?: string,"error_codes"?: (string)[],"exercise_type"?: string,"focus"?: string | null,"id"?: never,"is_correct"?: boolean,"lesson_slug"?: string,"module_slug"?: string,"org_id"?: string | null,"run_id"?: string | null,"score"?: number,"seed"?: number,"task_index"?: number | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attempts_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attempts_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "lesson_runs"
      referencedColumns: ["id"]
    }
                  ]
                },"certificates": {
                  Row: {
                    "holder_name": string,"id": string,"issued_at": string,"module_slug": string,"org_id": string | null,"org_name": string | null,"run_id": string | null,"score": number,"user_id": string,"verification_code": string
                  }
                  ComputedFields: never
                  Insert: {
                    "holder_name": string,"id"?: string,"issued_at"?: string,"module_slug": string,"org_id"?: string | null,"org_name"?: string | null,"run_id"?: string | null,"score": number,"user_id": string,"verification_code": string
                  }
                  Update: {
                    "holder_name"?: string,"id"?: string,"issued_at"?: string,"module_slug"?: string,"org_id"?: string | null,"org_name"?: string | null,"run_id"?: string | null,"score"?: number,"user_id"?: string,"verification_code"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "certificates_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "certificates_run_id_fkey"
      columns: ["run_id"]
isOneToOne: false
      referencedRelation: "lesson_runs"
      referencedColumns: ["id"]
    }
                  ]
                },"group_members": {
                  Row: {
                    "created_at": string,"group_id": string,"org_id": string,"role": Database["public"]['Enums']["group_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"group_id": string,"org_id": string,"role"?: Database["public"]['Enums']["group_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"group_id"?: string,"org_id"?: string,"role"?: Database["public"]['Enums']["group_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "group_members_group_id_org_id_fkey"
      columns: ["group_id","org_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id","org_id"]
    },{
      foreignKeyName: "group_members_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "group_members_user_id_org_id_fkey"
      columns: ["user_id","org_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["user_id","org_id"]
    }
                  ]
                },"groups": {
                  Row: {
                    "archived_at": string | null,"created_at": string,"created_by": string | null,"id": string,"join_code": string | null,"name": string,"org_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"join_code"?: string | null,"name": string,"org_id": string
                  }
                  Update: {
                    "archived_at"?: string | null,"created_at"?: string,"created_by"?: string | null,"id"?: string,"join_code"?: string | null,"name"?: string,"org_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "groups_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"created_by": string | null,"expires_at": string,"group_id": string | null,"id": string,"note": string | null,"org_id": string,"role": Database["public"]['Enums']["org_role"],"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"expires_at": string,"group_id"?: string | null,"id"?: string,"note"?: string | null,"org_id": string,"role": Database["public"]['Enums']["org_role"],"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"group_id"?: string | null,"id"?: string,"note"?: string | null,"org_id"?: string,"role"?: Database["public"]['Enums']["org_role"],"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_group_id_org_id_fkey"
      columns: ["group_id","org_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["id","org_id"]
    },{
      foreignKeyName: "invitations_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"lesson_runs": {
                  Row: {
                    "correct_count": number | null,"engine_version": string,"finished_at": string | null,"id": string,"lesson_slug": string,"module_slug": string,"org_id": string | null,"seed": number | null,"started_at": string,"task_count": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "correct_count"?: number | null,"engine_version": string,"finished_at"?: string | null,"id"?: string,"lesson_slug": string,"module_slug": string,"org_id"?: string | null,"seed"?: number | null,"started_at"?: string,"task_count": number,"user_id"?: string
                  }
                  Update: {
                    "correct_count"?: number | null,"engine_version"?: string,"finished_at"?: string | null,"id"?: string,"lesson_slug"?: string,"module_slug"?: string,"org_id"?: string | null,"seed"?: number | null,"started_at"?: string,"task_count"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "lesson_runs_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"org_id": string,"role": Database["public"]['Enums']["org_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"org_id": string,"role"?: Database["public"]['Enums']["org_role"],"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"org_id"?: string,"role"?: Database["public"]['Enums']["org_role"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "created_at": string,"id": string,"join_code": string,"kind": Database["public"]['Enums']["org_kind"],"license_valid_until": string,"name": string,"seat_limit": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"join_code"?: string,"kind"?: Database["public"]['Enums']["org_kind"],"license_valid_until": string,"name": string,"seat_limit"?: number
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"join_code"?: string,"kind"?: Database["public"]['Enums']["org_kind"],"license_valid_until"?: string,"name"?: string,"seat_limit"?: number
                  }
                  Relationships: [
                    
                  ]
                },"platform_admins": {
                  Row: {
                    "created_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"platform_invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"expires_at": string,"id": string,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"expires_at": string,"id"?: string,"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"expires_at"?: string,"id"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string,"id": string,"locale": string,"username": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name": string,"id": string,"locale"?: string,"username"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string,"id"?: string,"locale"?: string,"username"?: string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "lesson_progress": {
                  Row: {
                    "best_score": number | null,"finished_runs": number | null,"last_finished_at": string | null,"last_started_at": string | null,"lesson_slug": string,"module_slug": string,"org_id": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Relationships: [
                    {
      foreignKeyName: "lesson_runs_org_id_fkey"
      columns: ["org_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "accept_invitation":
{ Args: { "p_token": string }; Returns: string
                           },
"accept_platform_invitation":
{ Args: { "p_token": string,"p_user": string }; Returns: undefined
                           },
"add_participant":
{ Args: { "p_group"?: string,"p_org": string,"p_user": string }; Returns: undefined
                           },
"can_manage_account":
{ Args: { "p_actor": string,"p_target": string }; Returns: boolean
                           },
"create_invitation":
{ Args: { "p_group"?: string,"p_note"?: string,"p_org": string,"p_role": Database["public"]['Enums']["org_role"],"p_valid_days"?: number }; Returns: string
                           },
"create_organization":
{ Args: { "p_kind": Database["public"]['Enums']["org_kind"],"p_name": string,"p_seat_limit": number,"p_valid_until": string }; Returns: string
                           },
"delete_my_account":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"finish_lesson_run":
{ Args: { "p_run": string }; Returns: number
                           },
"invitation_preview":
{ Args: { "p_token": string }; Returns: {
              "group_name": string,"org_name": string,"role": Database["public"]['Enums']["org_role"],"status": string
            }[]
                           },
"issue_certificate":
{ Args: { "p_run": string }; Returns: string
                           },
"join_code_preview":
{ Args: { "p_code": string }; Returns: {
              "group_name": string,"org_name": string,"status": string
            }[]
                           },
"join_organization":
{ Args: { "p_code": string }; Returns: string
                           },
"platform_invitation_valid":
{ Args: { "p_token": string }; Returns: boolean
                           },
"platform_organizations":
{ Args: Record<PropertyKey, never>; Returns: {
              "created_at": string,"id": string,"join_code": string,"kind": Database["public"]['Enums']["org_kind"],"license_valid_until": string,"name": string,"participants": number,"seat_limit": number,"staff": number
            }[]
                           },
"regenerate_join_code":
{ Args: { "p_group"?: string,"p_org"?: string }; Returns: string
                           },
"update_organization_license":
{ Args: { "p_org": string,"p_seat_limit": number,"p_valid_until": string }; Returns: undefined
                           },
"verify_certificate":
{ Args: { "p_code": string }; Returns: {
              "holder_name": string,"issued_at": string,"module_slug": string,"org_name": string,"score": number
            }[]
                           }
          }
          Enums: {
            "group_role": "participant"|"trainer","org_kind": "company"|"school","org_role": "participant"|"trainer"|"org_admin"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "group_role": ["participant", "trainer"],"org_kind": ["company", "school"],"org_role": ["participant", "trainer", "org_admin"]
          }
        }
} as const

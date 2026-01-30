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
      doctrine_documents: {
        Row: {
          content: string
          created_at: string
          document_type: string | null
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          document_type?: string | null
          id?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          document_type?: string | null
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      episode_feedback: {
        Row: {
          created_at: string
          episode_id: string
          id: string
          pacing_feedback: string | null
          rating: number
          story_quality_feedback: string | null
          tone_feedback: string | null
          updated_at: string
          user_id: string
          what_didnt_work: string | null
          what_worked: string | null
        }
        Insert: {
          created_at?: string
          episode_id: string
          id?: string
          pacing_feedback?: string | null
          rating: number
          story_quality_feedback?: string | null
          tone_feedback?: string | null
          updated_at?: string
          user_id: string
          what_didnt_work?: string | null
          what_worked?: string | null
        }
        Update: {
          created_at?: string
          episode_id?: string
          id?: string
          pacing_feedback?: string | null
          rating?: number
          story_quality_feedback?: string | null
          tone_feedback?: string | null
          updated_at?: string
          user_id?: string
          what_didnt_work?: string | null
          what_worked?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "episode_feedback_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      episodes: {
        Row: {
          audio_url: string | null
          content_length: number
          created_at: string
          episode_number: number
          episode_summary: string | null
          guest_id: string | null
          id: string
          key_stories: string[] | null
          output_mode: string
          people_mentioned: string[] | null
          risk_domains: string[]
          script_content: string | null
          status: string | null
          target_audience: string
          themes: string[] | null
          title: string
          tone_intensity: string
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audio_url?: string | null
          content_length?: number
          created_at?: string
          episode_number?: number
          episode_summary?: string | null
          guest_id?: string | null
          id?: string
          key_stories?: string[] | null
          output_mode?: string
          people_mentioned?: string[] | null
          risk_domains?: string[]
          script_content?: string | null
          status?: string | null
          target_audience: string
          themes?: string[] | null
          title: string
          tone_intensity?: string
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audio_url?: string | null
          content_length?: number
          created_at?: string
          episode_number?: number
          episode_summary?: string | null
          guest_id?: string | null
          id?: string
          key_stories?: string[] | null
          output_mode?: string
          people_mentioned?: string[] | null
          risk_domains?: string[]
          script_content?: string | null
          status?: string | null
          target_audience?: string
          themes?: string[] | null
          title?: string
          tone_intensity?: string
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "episodes_guest_id_fkey"
            columns: ["guest_id"]
            isOneToOne: false
            referencedRelation: "guest_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      guest_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          expires_at: string
          guest_email: string | null
          guest_name: string
          guest_user_id: string | null
          host_user_id: string
          id: string
          invite_token: string
          status: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          expires_at?: string
          guest_email?: string | null
          guest_name: string
          guest_user_id?: string | null
          host_user_id: string
          id?: string
          invite_token?: string
          status?: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          expires_at?: string
          guest_email?: string | null
          guest_name?: string
          guest_user_id?: string | null
          host_user_id?: string
          id?: string
          invite_token?: string
          status?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      guest_profiles: {
        Row: {
          bio: string
          created_at: string
          cta_text: string | null
          cta_url: string | null
          display_name: string
          expertise: string[]
          id: string
          invitation_id: string | null
          name: string
          notable_quotes: string[] | null
          onboarding_completed: boolean | null
          social_links: Json | null
          speaking_style: string | null
          updated_at: string
          user_id: string
          voice_id: string
        }
        Insert: {
          bio: string
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          display_name: string
          expertise?: string[]
          id?: string
          invitation_id?: string | null
          name: string
          notable_quotes?: string[] | null
          onboarding_completed?: boolean | null
          social_links?: Json | null
          speaking_style?: string | null
          updated_at?: string
          user_id: string
          voice_id?: string
        }
        Update: {
          bio?: string
          created_at?: string
          cta_text?: string | null
          cta_url?: string | null
          display_name?: string
          expertise?: string[]
          id?: string
          invitation_id?: string | null
          name?: string
          notable_quotes?: string[] | null
          onboarding_completed?: boolean | null
          social_links?: Json | null
          speaking_style?: string | null
          updated_at?: string
          user_id?: string
          voice_id?: string
        }
        Relationships: []
      }
      interview_sessions: {
        Row: {
          created_at: string
          final_video_url: string | null
          guest_user_id: string
          host_user_id: string
          id: string
          invitation_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          final_video_url?: string | null
          guest_user_id: string
          host_user_id: string
          id?: string
          invitation_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          final_video_url?: string | null
          guest_user_id?: string
          host_user_id?: string
          id?: string
          invitation_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "interview_sessions_invitation_id_fkey"
            columns: ["invitation_id"]
            isOneToOne: false
            referencedRelation: "guest_invitations"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_assets: {
        Row: {
          asset_type: string
          content: string
          created_at: string
          episode_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_type: string
          content: string
          created_at?: string
          episode_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_type?: string
          content?: string
          created_at?: string
          episode_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketing_assets_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          role: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          role?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recording_segments: {
        Row: {
          created_at: string
          end_time: number | null
          id: string
          is_retake: boolean | null
          original_segment_id: string | null
          segment_number: number
          session_id: string
          start_time: number | null
          status: string
          transcript: string | null
          updated_at: string
          video_url: string | null
        }
        Insert: {
          created_at?: string
          end_time?: number | null
          id?: string
          is_retake?: boolean | null
          original_segment_id?: string | null
          segment_number: number
          session_id: string
          start_time?: number | null
          status?: string
          transcript?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Update: {
          created_at?: string
          end_time?: number | null
          id?: string
          is_retake?: boolean | null
          original_segment_id?: string | null
          segment_number?: number
          session_id?: string
          start_time?: number | null
          status?: string
          transcript?: string | null
          updated_at?: string
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "recording_segments_original_segment_id_fkey"
            columns: ["original_segment_id"]
            isOneToOne: false
            referencedRelation: "recording_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recording_segments_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "interview_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      video_clips: {
        Row: {
          ai_score: number | null
          ai_suggested: boolean | null
          aspect_ratio: string
          caption_style: Json | null
          captions: Json | null
          created_at: string
          duration_seconds: number | null
          end_time: number
          export_status: string | null
          exported_path: string | null
          headline_text: string | null
          id: string
          platform: string | null
          source_video_id: string
          start_time: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_score?: number | null
          ai_suggested?: boolean | null
          aspect_ratio?: string
          caption_style?: Json | null
          captions?: Json | null
          created_at?: string
          duration_seconds?: number | null
          end_time: number
          export_status?: string | null
          exported_path?: string | null
          headline_text?: string | null
          id?: string
          platform?: string | null
          source_video_id: string
          start_time: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_score?: number | null
          ai_suggested?: boolean | null
          aspect_ratio?: string
          caption_style?: Json | null
          captions?: Json | null
          created_at?: string
          duration_seconds?: number | null
          end_time?: number
          export_status?: string | null
          exported_path?: string | null
          headline_text?: string | null
          id?: string
          platform?: string | null
          source_video_id?: string
          start_time?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_clips_source_video_id_fkey"
            columns: ["source_video_id"]
            isOneToOne: false
            referencedRelation: "video_uploads"
            referencedColumns: ["id"]
          },
        ]
      }
      video_uploads: {
        Row: {
          created_at: string
          description: string | null
          duration_seconds: number | null
          file_size_bytes: number | null
          id: string
          mime_type: string | null
          original_filename: string
          status: string
          storage_path: string
          thumbnail_path: string | null
          title: string
          transcription: string | null
          transcription_segments: Json | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          original_filename: string
          status?: string
          storage_path: string
          thumbnail_path?: string | null
          title: string
          transcription?: string | null
          transcription_segments?: Json | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          duration_seconds?: number | null
          file_size_bytes?: number | null
          id?: string
          mime_type?: string | null
          original_filename?: string
          status?: string
          storage_path?: string
          thumbnail_path?: string | null
          title?: string
          transcription?: string | null
          transcription_segments?: Json | null
          updated_at?: string
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
      [_ in never]: never
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
    Enums: {},
  },
} as const

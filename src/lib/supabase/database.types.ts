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
  internal: {
    Tables: {
      admin_notes: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          transaction_id: string | null
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          transaction_id?: string | null
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          transaction_id?: string | null
        }
        Relationships: []
      }
      allowed_transitions: {
        Row: {
          from_status: string
          to_status: string
        }
        Insert: {
          from_status: string
          to_status: string
        }
        Update: {
          from_status?: string
          to_status?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          at: string
          entity_id: string
          entity_type: string
          from_status: string | null
          id: string
          meta: Json | null
          reason: string | null
          to_status: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          at?: string
          entity_id: string
          entity_type: string
          from_status?: string | null
          id?: string
          meta?: Json | null
          reason?: string | null
          to_status?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          at?: string
          entity_id?: string
          entity_type?: string
          from_status?: string | null
          id?: string
          meta?: Json | null
          reason?: string | null
          to_status?: string | null
        }
        Relationships: []
      }
      delivery_otps: {
        Row: {
          attempts: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          delivery_id: string
          expires_at: string
          id: string
          max_attempts: number
          transaction_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          delivery_id: string
          expires_at: string
          id?: string
          max_attempts?: number
          transaction_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          delivery_id?: string
          expires_at?: string
          id?: string
          max_attempts?: number
          transaction_id?: string
        }
        Relationships: []
      }
      ledger_accounts: {
        Row: {
          code: string
          currency: string
          id: string
          name: string
          type: string
        }
        Insert: {
          code: string
          currency?: string
          id?: string
          name: string
          type: string
        }
        Update: {
          code?: string
          currency?: string
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      ledger_entries: {
        Row: {
          account_id: string
          credit_minor: number
          debit_minor: number
          id: string
          ledger_transaction_id: string
          memo: string | null
        }
        Insert: {
          account_id: string
          credit_minor?: number
          debit_minor?: number
          id?: string
          ledger_transaction_id: string
          memo?: string | null
        }
        Update: {
          account_id?: string
          credit_minor?: number
          debit_minor?: number
          id?: string
          ledger_transaction_id?: string
          memo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "ledger_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ledger_entries_ledger_transaction_id_fkey"
            columns: ["ledger_transaction_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      ledger_transactions: {
        Row: {
          created_at: string
          id: string
          memo: string
          ref_id: string
          reversal_of_id: string | null
          transaction_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          memo: string
          ref_id: string
          reversal_of_id?: string | null
          transaction_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          memo?: string
          ref_id?: string
          reversal_of_id?: string | null
          transaction_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ledger_transactions_reversal_of_id_fkey"
            columns: ["reversal_of_id"]
            isOneToOne: false
            referencedRelation: "ledger_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_events: {
        Row: {
          id: string
          payment_intent_id: string
          provider_event_id: string
          raw: Json | null
          received_at: string
          type: string
        }
        Insert: {
          id?: string
          payment_intent_id: string
          provider_event_id: string
          raw?: Json | null
          received_at?: string
          type: string
        }
        Update: {
          id?: string
          payment_intent_id?: string
          provider_event_id?: string
          raw?: Json | null
          received_at?: string
          type?: string
        }
        Relationships: []
      }
      provider_webhook_events: {
        Row: {
          error: string | null
          event_type: string
          id: string
          processed_at: string | null
          provider: string
          provider_event_id: string
          raw: Json
          received_at: string
          signature_verified: boolean
        }
        Insert: {
          error?: string | null
          event_type: string
          id?: string
          processed_at?: string | null
          provider: string
          provider_event_id: string
          raw: Json
          received_at?: string
          signature_verified?: boolean
        }
        Update: {
          error?: string | null
          event_type?: string
          id?: string
          processed_at?: string | null
          provider?: string
          provider_event_id?: string
          raw?: Json
          received_at?: string
          signature_verified?: boolean
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount_minor: number
          completed_at: string | null
          created_at: string
          currency: string
          id: string
          idempotency_key: string | null
          payer_id: string
          provider: string
          provider_ref: string | null
          reason: string | null
          status: string
          transaction_id: string
        }
        Insert: {
          amount_minor: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string | null
          payer_id: string
          provider: string
          provider_ref?: string | null
          reason?: string | null
          status: string
          transaction_id: string
        }
        Update: {
          amount_minor?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string | null
          payer_id?: string
          provider?: string
          provider_ref?: string | null
          reason?: string | null
          status?: string
          transaction_id?: string
        }
        Relationships: []
      }
      risk_flags: {
        Row: {
          created_at: string
          flagged_by: string | null
          id: string
          profile_id: string | null
          reason: string
          severity: string
          status: string
          transaction_id: string | null
        }
        Insert: {
          created_at?: string
          flagged_by?: string | null
          id?: string
          profile_id?: string | null
          reason: string
          severity: string
          status?: string
          transaction_id?: string | null
        }
        Update: {
          created_at?: string
          flagged_by?: string | null
          id?: string
          profile_id?: string | null
          reason?: string
          severity?: string
          status?: string
          transaction_id?: string | null
        }
        Relationships: []
      }
      settlements: {
        Row: {
          amount_minor: number
          completed_at: string | null
          created_at: string
          currency: string
          id: string
          provider: string
          provider_ref: string | null
          recipient_id: string
          status: string
          transaction_id: string
        }
        Insert: {
          amount_minor: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          provider: string
          provider_ref?: string | null
          recipient_id: string
          status: string
          transaction_id: string
        }
        Update: {
          amount_minor?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          provider?: string
          provider_ref?: string | null
          recipient_id?: string
          status?: string
          transaction_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      append_audit: {
        Args: {
          p_action: string
          p_actor_id: string
          p_entity_id: string
          p_entity_type: string
          p_from_status?: string
          p_meta?: Json
          p_reason?: string
          p_to_status?: string
        }
        Returns: string
      }
      can_view_transaction: {
        Args: { p_transaction_id: string }
        Returns: boolean
      }
      get_audit_log: {
        Args: { p_entity_id?: string; p_entity_type?: string; p_limit?: number }
        Returns: {
          action: string
          actor_id: string | null
          at: string
          entity_id: string
          entity_type: string
          from_status: string | null
          id: string
          meta: Json | null
          reason: string | null
          to_status: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "audit_logs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      has_role: { Args: { p_role: string }; Returns: boolean }
      has_role_any: { Args: { p_roles: string[] }; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      issue_delivery_otp: {
        Args: {
          p_code_hash: string
          p_delivery_id: string
          p_max_attempts?: number
          p_transaction_id: string
          p_ttl_seconds?: number
        }
        Returns: string
      }
      post_double_entry: {
        Args: {
          p_amount_minor: number
          p_credit_code: string
          p_debit_code: string
          p_memo: string
          p_ref_id: string
          p_transaction_id: string
        }
        Returns: string
      }
      transition_transaction: {
        Args: {
          p_actor_id?: string
          p_meta?: Json
          p_reason?: string
          p_to_status: string
          p_transaction_id: string
        }
        Returns: string
      }
      verify_delivery_otp: {
        Args: { p_code_hash: string; p_otp_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      bank_accounts: {
        Row: {
          account_name: string
          account_number: string
          bank_code: string | null
          bank_name: string
          created_at: string
          id: string
          is_default: boolean
          profile_id: string
          provider: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_name: string
          account_number: string
          bank_code?: string | null
          bank_name: string
          created_at?: string
          id?: string
          is_default?: boolean
          profile_id: string
          provider?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_name?: string
          account_number?: string
          bank_code?: string | null
          bank_name?: string
          created_at?: string
          id?: string
          is_default?: boolean
          profile_id?: string
          provider?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bank_accounts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          carrier_details: string | null
          courier_name: string | null
          delivered_at: string | null
          dispatched_at: string | null
          id: string
          inspection_deadline_at: string | null
          status: string | null
          tracking_number: string | null
          transaction_id: string
        }
        Insert: {
          carrier_details?: string | null
          courier_name?: string | null
          delivered_at?: string | null
          dispatched_at?: string | null
          id?: string
          inspection_deadline_at?: string | null
          status?: string | null
          tracking_number?: string | null
          transaction_id: string
        }
        Update: {
          carrier_details?: string | null
          courier_name?: string | null
          delivered_at?: string | null
          dispatched_at?: string | null
          id?: string
          inspection_deadline_at?: string | null
          status?: string | null
          tracking_number?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_events: {
        Row: {
          actor_id: string | null
          at: string
          delivery_id: string
          id: string
          note: string | null
          type: string
        }
        Insert: {
          actor_id?: string | null
          at?: string
          delivery_id: string
          id?: string
          note?: string | null
          type: string
        }
        Update: {
          actor_id?: string | null
          at?: string
          delivery_id?: string
          id?: string
          note?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delivery_events_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_evidence: {
        Row: {
          created_at: string
          dispute_id: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string | null
          uploader_id: string
        }
        Insert: {
          created_at?: string
          dispute_id: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          uploader_id: string
        }
        Update: {
          created_at?: string
          dispute_id?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          uploader_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_evidence_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_evidence_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dispute_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          dispute_id: string
          id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          dispute_id: string
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          dispute_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispute_messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispute_messages_dispute_id_fkey"
            columns: ["dispute_id"]
            isOneToOne: false
            referencedRelation: "disputes"
            referencedColumns: ["id"]
          },
        ]
      }
      disputes: {
        Row: {
          created_at: string
          details: string | null
          id: string
          opened_by: string
          reason: string
          resolution: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          opened_by: string
          reason: string
          resolution?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          opened_by?: string
          reason?: string
          resolution?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "disputes_opened_by_fkey"
            columns: ["opened_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "disputes_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      kyc_profiles: {
        Row: {
          created_at: string
          doc_type: string | null
          id: string
          profile_id: string
          rejected_reason: string | null
          status: string
          updated_at: string
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          doc_type?: string | null
          id?: string
          profile_id: string
          rejected_reason?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          doc_type?: string | null
          id?: string
          profile_id?: string
          rejected_reason?: string | null
          status?: string
          updated_at?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kyc_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          profile_id: string
          read_at: string | null
          title: string
          transaction_id: string | null
          type: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          profile_id: string
          read_at?: string | null
          title: string
          transaction_id?: string | null
          type: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          profile_id?: string
          read_at?: string | null
          title?: string
          transaction_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_intents: {
        Row: {
          amount_minor: number
          created_at: string
          currency: string
          id: string
          idempotency_key: string
          payer_id: string
          provider: string
          provider_event_id: string | null
          provider_intent_id: string | null
          raw_event: Json | null
          secured_at: string | null
          status: string
          transaction_id: string
        }
        Insert: {
          amount_minor: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key: string
          payer_id: string
          provider: string
          provider_event_id?: string | null
          provider_intent_id?: string | null
          raw_event?: Json | null
          secured_at?: string | null
          status?: string
          transaction_id: string
        }
        Update: {
          amount_minor?: number
          created_at?: string
          currency?: string
          id?: string
          idempotency_key?: string
          payer_id?: string
          provider?: string
          provider_event_id?: string | null
          provider_intent_id?: string | null
          raw_event?: Json | null
          secured_at?: string | null
          status?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_intents_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_intents_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          auth_provider: string
          auth_subject: string | null
          country: string | null
          created_at: string
          display_name: string | null
          email: string | null
          full_name: string | null
          id: string
          onboarded: boolean
          phone: string | null
          public_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          auth_provider?: string
          auth_subject?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          onboarded?: boolean
          phone?: string | null
          public_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          auth_provider?: string
          auth_subject?: string | null
          country?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          onboarded?: boolean
          phone?: string | null
          public_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      terms_acceptances: {
        Row: {
          accepted_at: string
          id: string
          profile_id: string
          version: number
        }
        Insert: {
          accepted_at?: string
          id?: string
          profile_id: string
          version: number
        }
        Update: {
          accepted_at?: string
          id?: string
          profile_id?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "terms_acceptances_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "terms_acceptances_version_fkey"
            columns: ["version"]
            isOneToOne: false
            referencedRelation: "terms_versions"
            referencedColumns: ["version"]
          },
        ]
      }
      terms_versions: {
        Row: {
          content: string
          effective_at: string
          id: string
          version: number
        }
        Insert: {
          content: string
          effective_at: string
          id?: string
          version: number
        }
        Update: {
          content?: string
          effective_at?: string
          id?: string
          version?: number
        }
        Relationships: []
      }
      transaction_items: {
        Row: {
          id: string
          name: string
          note: string | null
          transaction_id: string
        }
        Insert: {
          id?: string
          name: string
          note?: string | null
          transaction_id: string
        }
        Update: {
          id?: string
          name?: string
          note?: string | null
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_items_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_media: {
        Row: {
          created_at: string
          id: string
          kind: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string | null
          transaction_id: string
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          transaction_id: string
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          transaction_id?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transaction_media_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_participants: {
        Row: {
          accepted_at: string | null
          email: string | null
          id: string
          profile_id: string
          role: string
          transaction_id: string
        }
        Insert: {
          accepted_at?: string | null
          email?: string | null
          id?: string
          profile_id: string
          role: string
          transaction_id: string
        }
        Update: {
          accepted_at?: string | null
          email?: string | null
          id?: string
          profile_id?: string
          role?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_participants_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_participants_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transaction_status_history: {
        Row: {
          actor_id: string | null
          at: string
          from_status: string | null
          id: string
          meta: Json | null
          reason: string | null
          to_status: string
          transaction_id: string
        }
        Insert: {
          actor_id?: string | null
          at?: string
          from_status?: string | null
          id?: string
          meta?: Json | null
          reason?: string | null
          to_status: string
          transaction_id: string
        }
        Update: {
          actor_id?: string | null
          at?: string
          from_status?: string | null
          id?: string
          meta?: Json | null
          reason?: string | null
          to_status?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_status_history_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_status_history_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          agreed_deadline_at: string | null
          amount_minor: number
          buyer_email: string | null
          buyer_id: string | null
          buyer_phone: string | null
          category: string
          condition: string | null
          created_at: string
          currency: string
          delivery_fee_minor: number
          description: string
          dispute_blocked: boolean
          fee_charged_to: string | null
          fee_minor: number
          id: string
          inspection_window_days: number
          public_id: string
          released_at: string | null
          return_terms: string | null
          seller_id: string
          slug: string
          status: string
          title: string
          total_minor: number
          updated_at: string
        }
        Insert: {
          agreed_deadline_at?: string | null
          amount_minor: number
          buyer_email?: string | null
          buyer_id?: string | null
          buyer_phone?: string | null
          category: string
          condition?: string | null
          created_at?: string
          currency?: string
          delivery_fee_minor: number
          description: string
          dispute_blocked?: boolean
          fee_charged_to?: string | null
          fee_minor?: number
          id?: string
          inspection_window_days?: number
          public_id: string
          released_at?: string | null
          return_terms?: string | null
          seller_id: string
          slug: string
          status: string
          title: string
          total_minor: number
          updated_at?: string
        }
        Update: {
          agreed_deadline_at?: string | null
          amount_minor?: number
          buyer_email?: string | null
          buyer_id?: string | null
          buyer_phone?: string | null
          category?: string
          condition?: string | null
          created_at?: string
          currency?: string
          delivery_fee_minor?: number
          description?: string
          dispute_blocked?: boolean
          fee_charged_to?: string | null
          fee_minor?: number
          id?: string
          inspection_window_days?: number
          public_id?: string
          released_at?: string | null
          return_terms?: string | null
          seller_id?: string
          slug?: string
          status?: string
          title?: string
          total_minor?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          id: string
          profile_id: string
          revoked_at: string | null
          role: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          profile_id: string
          revoked_at?: string | null
          role: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          id?: string
          profile_id?: string
          revoked_at?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_my_roles: {
        Args: never
        Returns: {
          role: string
        }[]
      }
      get_transaction_by_slug: {
        Args: { p_slug: string }
        Returns: {
          agreed_deadline_at: string
          amount_minor: number
          category: string
          condition: string
          currency: string
          delivery_fee_minor: number
          description: string
          fee_charged_to: string
          fee_minor: number
          id: string
          inspection_window_days: number
          public_id: string
          return_terms: string
          seller_created_at: string
          seller_display_name: string
          seller_id: string
          status: string
          title: string
          total_minor: number
        }[]
      }
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
  internal: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          role: 'owner' | 'trainer' | 'member'
          gym_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name?: string | null
          avatar_url?: string | null
          role?: 'owner' | 'trainer' | 'member'
          gym_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string | null
          avatar_url?: string | null
          role?: 'owner' | 'trainer' | 'member'
          gym_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      gyms: {
        Row: {
          id: string
          name: string
          owner_id: string
          address: string | null
          phone: string | null
          email: string | null
          logo_url: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          owner_id: string
          address?: string | null
          phone?: string | null
          email?: string | null
          logo_url?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          address?: string | null
          phone?: string | null
          email?: string | null
          logo_url?: string | null
        }
        Relationships: []
      }
      members: {
        Row: {
          id: string
          gym_id: string
          profile_id: string
          membership_id: string | null
          status: 'active' | 'inactive' | 'suspended' | 'lead'
          joined_at: string
          expires_at: string | null
        }
        Insert: {
          id?: string
          gym_id: string
          profile_id: string
          membership_id?: string | null
          status?: 'active' | 'inactive' | 'suspended' | 'lead'
          joined_at?: string
          expires_at?: string | null
        }
        Update: {
          membership_id?: string | null
          status?: 'active' | 'inactive' | 'suspended' | 'lead'
          expires_at?: string | null
        }
        Relationships: []
      }
      memberships: {
        Row: {
          id: string
          gym_id: string
          name: string
          description: string | null
          price: number
          billing_period: 'monthly' | 'quarterly' | 'yearly'
          features: string[]
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          gym_id: string
          name: string
          description?: string | null
          price: number
          billing_period?: 'monthly' | 'quarterly' | 'yearly'
          features?: string[]
          is_active?: boolean
          created_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          price?: number
          billing_period?: 'monthly' | 'quarterly' | 'yearly'
          features?: string[]
          is_active?: boolean
        }
        Relationships: []
      }
      check_ins: {
        Row: {
          id: string
          gym_id: string
          member_id: string
          checked_in_at: string
          checked_out_at: string | null
        }
        Insert: {
          id?: string
          gym_id: string
          member_id: string
          checked_in_at?: string
          checked_out_at?: string | null
        }
        Update: {
          checked_out_at?: string | null
        }
        Relationships: []
      }
      classes: {
        Row: {
          id: string
          gym_id: string
          trainer_id: string
          name: string
          description: string | null
          capacity: number
          duration_minutes: number
          scheduled_at: string
          location: string | null
          created_at: string
        }
        Insert: {
          id?: string
          gym_id: string
          trainer_id: string
          name: string
          description?: string | null
          capacity?: number
          duration_minutes?: number
          scheduled_at: string
          location?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          description?: string | null
          capacity?: number
          duration_minutes?: number
          scheduled_at?: string
          location?: string | null
        }
        Relationships: []
      }
      class_bookings: {
        Row: {
          id: string
          class_id: string
          member_id: string
          status: 'confirmed' | 'cancelled' | 'waitlist'
          booked_at: string
        }
        Insert: {
          id?: string
          class_id: string
          member_id: string
          status?: 'confirmed' | 'cancelled' | 'waitlist'
          booked_at?: string
        }
        Update: {
          status?: 'confirmed' | 'cancelled' | 'waitlist'
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

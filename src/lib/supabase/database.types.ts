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
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          diff: Json | null
          entity: string
          entity_id: string | null
          id: number
          summary: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          entity: string
          entity_id?: string | null
          id?: number
          summary?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          diff?: Json | null
          entity?: string
          entity_id?: string | null
          id?: number
          summary?: string | null
        }
        Relationships: []
      }
      award_types: {
        Row: {
          code: string
          description: string | null
          is_per_game: boolean
          label: string
          sort_order: number
        }
        Insert: {
          code: string
          description?: string | null
          is_per_game?: boolean
          label: string
          sort_order?: number
        }
        Update: {
          code?: string
          description?: string | null
          is_per_game?: boolean
          label?: string
          sort_order?: number
        }
        Relationships: []
      }
      base_runner_movements: {
        Row: {
          created_at: string
          end_base: number | null
          id: string
          is_earned: boolean
          is_out: boolean
          out_type: string | null
          plate_appearance_id: string
          rbi_credited: boolean
          runner_id: string | null
          scored: boolean | null
          start_base: number
        }
        Insert: {
          created_at?: string
          end_base?: number | null
          id?: string
          is_earned?: boolean
          is_out?: boolean
          out_type?: string | null
          plate_appearance_id: string
          rbi_credited?: boolean
          runner_id?: string | null
          scored?: boolean | null
          start_base: number
        }
        Update: {
          created_at?: string
          end_base?: number | null
          id?: string
          is_earned?: boolean
          is_out?: boolean
          out_type?: string | null
          plate_appearance_id?: string
          rbi_credited?: boolean
          runner_id?: string | null
          scored?: boolean | null
          start_base?: number
        }
        Relationships: [
          {
            foreignKeyName: "base_runner_movements_plate_appearance_id_fkey"
            columns: ["plate_appearance_id"]
            isOneToOne: false
            referencedRelation: "plate_appearances"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "base_runner_movements_runner_id_fkey"
            columns: ["runner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      captains_log_posts: {
        Row: {
          author_name: string | null
          author_player_id: string | null
          body: string
          created_at: string
          excerpt: string | null
          game_id: string | null
          hero_media_id: string | null
          id: string
          is_published: boolean
          legacy_id: string | null
          published_at: string | null
          season_id: string | null
          slug: string
          title: string
          updated_at: string
        }
        Insert: {
          author_name?: string | null
          author_player_id?: string | null
          body: string
          created_at?: string
          excerpt?: string | null
          game_id?: string | null
          hero_media_id?: string | null
          id?: string
          is_published?: boolean
          legacy_id?: string | null
          published_at?: string | null
          season_id?: string | null
          slug: string
          title: string
          updated_at?: string
        }
        Update: {
          author_name?: string | null
          author_player_id?: string | null
          body?: string
          created_at?: string
          excerpt?: string | null
          game_id?: string | null
          hero_media_id?: string | null
          id?: string
          is_published?: boolean
          legacy_id?: string | null
          published_at?: string | null
          season_id?: string | null
          slug?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "captains_log_posts_author_player_id_fkey"
            columns: ["author_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captains_log_posts_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_results"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "captains_log_posts_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_scoreboard"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "captains_log_posts_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captains_log_posts_hero_media_id_fkey"
            columns: ["hero_media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "captains_log_posts_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      game_events: {
        Row: {
          actor_id: string | null
          created_at: string
          description: string | null
          event_type: Database["public"]["Enums"]["game_event_type"]
          game_id: string
          half: Database["public"]["Enums"]["inning_half"] | null
          id: number
          inning: number | null
          payload: Json
          plate_appearance_id: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          description?: string | null
          event_type: Database["public"]["Enums"]["game_event_type"]
          game_id: string
          half?: Database["public"]["Enums"]["inning_half"] | null
          id?: number
          inning?: number | null
          payload?: Json
          plate_appearance_id?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          description?: string | null
          event_type?: Database["public"]["Enums"]["game_event_type"]
          game_id?: string
          half?: Database["public"]["Enums"]["inning_half"] | null
          id?: number
          inning?: number | null
          payload?: Json
          plate_appearance_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_events_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_results"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "game_events_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_scoreboard"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "game_events_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_events_plate_appearance_id_fkey"
            columns: ["plate_appearance_id"]
            isOneToOne: false
            referencedRelation: "plate_appearances"
            referencedColumns: ["id"]
          },
        ]
      }
      game_innings: {
        Row: {
          created_at: string
          game_id: string
          id: string
          inning: number
          our_runs: number | null
          their_runs: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          inning: number
          our_runs?: number | null
          their_runs?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          inning?: number
          our_runs?: number | null
          their_runs?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_innings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_results"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "game_innings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_scoreboard"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "game_innings_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      game_lineup_players: {
        Row: {
          batting_order: number
          created_at: string
          entered_inning: number | null
          exited_inning: number | null
          id: string
          is_starter: boolean
          lineup_id: string
          player_id: string
          position: string | null
        }
        Insert: {
          batting_order: number
          created_at?: string
          entered_inning?: number | null
          exited_inning?: number | null
          id?: string
          is_starter?: boolean
          lineup_id: string
          player_id: string
          position?: string | null
        }
        Update: {
          batting_order?: number
          created_at?: string
          entered_inning?: number | null
          exited_inning?: number | null
          id?: string
          is_starter?: boolean
          lineup_id?: string
          player_id?: string
          position?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "game_lineup_players_lineup_id_fkey"
            columns: ["lineup_id"]
            isOneToOne: false
            referencedRelation: "game_lineups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_lineup_players_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_lineup_players_position_fkey"
            columns: ["position"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["code"]
          },
        ]
      }
      game_lineups: {
        Row: {
          copied_from_lineup_id: string | null
          created_at: string
          created_by: string | null
          game_id: string
          id: string
          notes: string | null
          updated_at: string
        }
        Insert: {
          copied_from_lineup_id?: string | null
          created_at?: string
          created_by?: string | null
          game_id: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Update: {
          copied_from_lineup_id?: string | null
          created_at?: string
          created_by?: string | null
          game_id?: string
          id?: string
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_lineups_copied_from_lineup_id_fkey"
            columns: ["copied_from_lineup_id"]
            isOneToOne: false
            referencedRelation: "game_lineups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_lineups_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "game_results"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "game_lineups_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "game_scoreboard"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "game_lineups_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: true
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          created_at: string
          current_half: Database["public"]["Enums"]["inning_half"] | null
          current_inning: number | null
          current_outs: number | null
          finalized_at: string | null
          game_number: number
          home_away: Database["public"]["Enums"]["home_away"]
          id: string
          is_forfeit: boolean
          is_mercy: boolean
          legacy_id: string | null
          live_started_at: string | null
          notes: string | null
          opponent_id: string | null
          our_runs_recorded: number | null
          recap: string | null
          scheduled_innings: number
          season_id: string
          series_key: string | null
          starts_at: string
          state_override_after_seq: number | null
          state_override_inning: number | null
          state_override_outs: number | null
          status: Database["public"]["Enums"]["game_status"]
          their_runs_recorded: number | null
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          created_at?: string
          current_half?: Database["public"]["Enums"]["inning_half"] | null
          current_inning?: number | null
          current_outs?: number | null
          finalized_at?: string | null
          game_number?: number
          home_away?: Database["public"]["Enums"]["home_away"]
          id?: string
          is_forfeit?: boolean
          is_mercy?: boolean
          legacy_id?: string | null
          live_started_at?: string | null
          notes?: string | null
          opponent_id?: string | null
          our_runs_recorded?: number | null
          recap?: string | null
          scheduled_innings?: number
          season_id: string
          series_key?: string | null
          starts_at: string
          state_override_after_seq?: number | null
          state_override_inning?: number | null
          state_override_outs?: number | null
          status?: Database["public"]["Enums"]["game_status"]
          their_runs_recorded?: number | null
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          created_at?: string
          current_half?: Database["public"]["Enums"]["inning_half"] | null
          current_inning?: number | null
          current_outs?: number | null
          finalized_at?: string | null
          game_number?: number
          home_away?: Database["public"]["Enums"]["home_away"]
          id?: string
          is_forfeit?: boolean
          is_mercy?: boolean
          legacy_id?: string | null
          live_started_at?: string | null
          notes?: string | null
          opponent_id?: string | null
          our_runs_recorded?: number | null
          recap?: string | null
          scheduled_innings?: number
          season_id?: string
          series_key?: string | null
          starts_at?: string
          state_override_after_seq?: number | null
          state_override_inning?: number | null
          state_override_outs?: number | null
          status?: Database["public"]["Enums"]["game_status"]
          their_runs_recorded?: number | null
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_opponent_id_fkey"
            columns: ["opponent_id"]
            isOneToOne: false
            referencedRelation: "opponents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_stat_baselines: {
        Row: {
          at_bats: number | null
          batting_average_override: number | null
          created_at: string
          doubles: number | null
          games: number | null
          hit_by_pitch: number | null
          hits: number | null
          home_runs: number | null
          id: string
          imported_at: string
          notes: string | null
          plate_appearances: number | null
          player_id: string
          rbi: number | null
          runs: number | null
          sacrifice_flies: number | null
          season_id: string
          source_url: string | null
          total_bases: number | null
          triples: number | null
          updated_at: string
          walks: number | null
        }
        Insert: {
          at_bats?: number | null
          batting_average_override?: number | null
          created_at?: string
          doubles?: number | null
          games?: number | null
          hit_by_pitch?: number | null
          hits?: number | null
          home_runs?: number | null
          id?: string
          imported_at?: string
          notes?: string | null
          plate_appearances?: number | null
          player_id: string
          rbi?: number | null
          runs?: number | null
          sacrifice_flies?: number | null
          season_id: string
          source_url?: string | null
          total_bases?: number | null
          triples?: number | null
          updated_at?: string
          walks?: number | null
        }
        Update: {
          at_bats?: number | null
          batting_average_override?: number | null
          created_at?: string
          doubles?: number | null
          games?: number | null
          hit_by_pitch?: number | null
          hits?: number | null
          home_runs?: number | null
          id?: string
          imported_at?: string
          notes?: string | null
          plate_appearances?: number | null
          player_id?: string
          rbi?: number | null
          runs?: number | null
          sacrifice_flies?: number | null
          season_id?: string
          source_url?: string | null
          total_bases?: number | null
          triples?: number | null
          updated_at?: string
          walks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "legacy_stat_baselines_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "legacy_stat_baselines_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      media: {
        Row: {
          alt_text: string | null
          byte_size: number | null
          caption: string | null
          created_at: string
          credit: string | null
          game_id: string | null
          height: number | null
          id: string
          is_featured: boolean
          kind: Database["public"]["Enums"]["media_kind"]
          legacy_id: string | null
          original_format: string | null
          original_path: string | null
          placeholder: string | null
          player_id: string | null
          season_id: string | null
          sort_order: number
          storage_path: string
          taken_at: string | null
          updated_at: string
          width: number | null
        }
        Insert: {
          alt_text?: string | null
          byte_size?: number | null
          caption?: string | null
          created_at?: string
          credit?: string | null
          game_id?: string | null
          height?: number | null
          id?: string
          is_featured?: boolean
          kind?: Database["public"]["Enums"]["media_kind"]
          legacy_id?: string | null
          original_format?: string | null
          original_path?: string | null
          placeholder?: string | null
          player_id?: string | null
          season_id?: string | null
          sort_order?: number
          storage_path: string
          taken_at?: string | null
          updated_at?: string
          width?: number | null
        }
        Update: {
          alt_text?: string | null
          byte_size?: number | null
          caption?: string | null
          created_at?: string
          credit?: string | null
          game_id?: string | null
          height?: number | null
          id?: string
          is_featured?: boolean
          kind?: Database["public"]["Enums"]["media_kind"]
          legacy_id?: string | null
          original_format?: string | null
          original_path?: string | null
          placeholder?: string | null
          player_id?: string | null
          season_id?: string | null
          sort_order?: number
          storage_path?: string
          taken_at?: string | null
          updated_at?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "media_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_results"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "media_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_scoreboard"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "media_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "media_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      opponents: {
        Row: {
          created_at: string
          id: string
          logo_path: string | null
          name: string
          notes: string | null
          primary_color: string | null
          short_name: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          logo_path?: string | null
          name: string
          notes?: string | null
          primary_color?: string | null
          short_name?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          logo_path?: string | null
          name?: string
          notes?: string | null
          primary_color?: string | null
          short_name?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      pa_result_types: {
        Row: {
          batter_reaches: boolean
          code: string
          counts_as_ab: boolean
          counts_as_pa: boolean
          default_outs: number
          is_active: boolean
          is_error: boolean
          is_fielders_choice: boolean
          is_hbp: boolean
          is_hit: boolean
          is_sac_bunt: boolean
          is_sac_fly: boolean
          is_strikeout: boolean
          is_walk: boolean
          label: string
          short_label: string
          sort_order: number
          total_bases: number
        }
        Insert: {
          batter_reaches?: boolean
          code: string
          counts_as_ab?: boolean
          counts_as_pa?: boolean
          default_outs?: number
          is_active?: boolean
          is_error?: boolean
          is_fielders_choice?: boolean
          is_hbp?: boolean
          is_hit?: boolean
          is_sac_bunt?: boolean
          is_sac_fly?: boolean
          is_strikeout?: boolean
          is_walk?: boolean
          label: string
          short_label: string
          sort_order?: number
          total_bases?: number
        }
        Update: {
          batter_reaches?: boolean
          code?: string
          counts_as_ab?: boolean
          counts_as_pa?: boolean
          default_outs?: number
          is_active?: boolean
          is_error?: boolean
          is_fielders_choice?: boolean
          is_hbp?: boolean
          is_hit?: boolean
          is_sac_bunt?: boolean
          is_sac_fly?: boolean
          is_strikeout?: boolean
          is_walk?: boolean
          label?: string
          short_label?: string
          sort_order?: number
          total_bases?: number
        }
        Relationships: []
      }
      plate_appearances: {
        Row: {
          batter_id: string | null
          batting_team: string
          created_at: string
          created_by: string | null
          game_id: string
          half: Database["public"]["Enums"]["inning_half"]
          hit_location: string | null
          id: string
          inning: number
          is_hard_hit: boolean | null
          lineup_spot: number | null
          notes: string | null
          outs_before: number
          outs_on_play: number
          result_code: string
          sequence: number
          updated_at: string
        }
        Insert: {
          batter_id?: string | null
          batting_team?: string
          created_at?: string
          created_by?: string | null
          game_id: string
          half: Database["public"]["Enums"]["inning_half"]
          hit_location?: string | null
          id?: string
          inning: number
          is_hard_hit?: boolean | null
          lineup_spot?: number | null
          notes?: string | null
          outs_before?: number
          outs_on_play?: number
          result_code: string
          sequence: number
          updated_at?: string
        }
        Update: {
          batter_id?: string | null
          batting_team?: string
          created_at?: string
          created_by?: string | null
          game_id?: string
          half?: Database["public"]["Enums"]["inning_half"]
          hit_location?: string | null
          id?: string
          inning?: number
          is_hard_hit?: boolean | null
          lineup_spot?: number | null
          notes?: string | null
          outs_before?: number
          outs_on_play?: number
          result_code?: string
          sequence?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "plate_appearances_batter_id_fkey"
            columns: ["batter_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plate_appearances_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_results"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "plate_appearances_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_scoreboard"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "plate_appearances_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plate_appearances_result_code_fkey"
            columns: ["result_code"]
            isOneToOne: false
            referencedRelation: "pa_result_types"
            referencedColumns: ["code"]
          },
        ]
      }
      player_awards: {
        Row: {
          award_code: string
          awarded_on: string | null
          citation: string | null
          created_at: string
          game_id: string | null
          id: string
          legacy_id: string | null
          media_id: string | null
          player_id: string
          season_id: string | null
          updated_at: string
        }
        Insert: {
          award_code: string
          awarded_on?: string | null
          citation?: string | null
          created_at?: string
          game_id?: string | null
          id?: string
          legacy_id?: string | null
          media_id?: string | null
          player_id: string
          season_id?: string | null
          updated_at?: string
        }
        Update: {
          award_code?: string
          awarded_on?: string | null
          citation?: string | null
          created_at?: string
          game_id?: string | null
          id?: string
          legacy_id?: string | null
          media_id?: string | null
          player_id?: string
          season_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_awards_award_code_fkey"
            columns: ["award_code"]
            isOneToOne: false
            referencedRelation: "award_types"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "player_awards_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_results"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "player_awards_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "game_scoreboard"
            referencedColumns: ["game_id"]
          },
          {
            foreignKeyName: "player_awards_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_awards_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_awards_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_awards_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      player_seasons: {
        Row: {
          created_at: string
          id: string
          jersey_number: number | null
          joined_on: string | null
          left_on: string | null
          player_id: string
          primary_position: string | null
          roster_order: number | null
          season_id: string
          secondary_positions: string[]
          status: Database["public"]["Enums"]["player_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          jersey_number?: number | null
          joined_on?: string | null
          left_on?: string | null
          player_id: string
          primary_position?: string | null
          roster_order?: number | null
          season_id: string
          secondary_positions?: string[]
          status?: Database["public"]["Enums"]["player_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          jersey_number?: number | null
          joined_on?: string | null
          left_on?: string | null
          player_id?: string
          primary_position?: string | null
          roster_order?: number | null
          season_id?: string
          secondary_positions?: string[]
          status?: Database["public"]["Enums"]["player_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "player_seasons_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "player_seasons_primary_position_fkey"
            columns: ["primary_position"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "player_seasons_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          bats: string | null
          bio: string | null
          created_at: string
          display_name: string
          first_name: string
          hometown: string | null
          id: string
          joined_year: number | null
          last_name: string
          legacy_id: string | null
          legacy_position_label: string | null
          photo_height: number | null
          photo_original_path: string | null
          photo_path: string | null
          photo_placeholder: string | null
          photo_width: number | null
          primary_position: string | null
          secondary_positions: string[]
          slug: string
          status: Database["public"]["Enums"]["player_status"]
          throws: string | null
          updated_at: string
        }
        Insert: {
          bats?: string | null
          bio?: string | null
          created_at?: string
          display_name: string
          first_name: string
          hometown?: string | null
          id?: string
          joined_year?: number | null
          last_name: string
          legacy_id?: string | null
          legacy_position_label?: string | null
          photo_height?: number | null
          photo_original_path?: string | null
          photo_path?: string | null
          photo_placeholder?: string | null
          photo_width?: number | null
          primary_position?: string | null
          secondary_positions?: string[]
          slug: string
          status?: Database["public"]["Enums"]["player_status"]
          throws?: string | null
          updated_at?: string
        }
        Update: {
          bats?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          first_name?: string
          hometown?: string | null
          id?: string
          joined_year?: number | null
          last_name?: string
          legacy_id?: string | null
          legacy_position_label?: string | null
          photo_height?: number | null
          photo_original_path?: string | null
          photo_path?: string | null
          photo_placeholder?: string | null
          photo_width?: number | null
          primary_position?: string | null
          secondary_positions?: string[]
          slug?: string
          status?: Database["public"]["Enums"]["player_status"]
          throws?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_primary_position_fkey"
            columns: ["primary_position"]
            isOneToOne: false
            referencedRelation: "positions"
            referencedColumns: ["code"]
          },
        ]
      }
      positions: {
        Row: {
          category: string
          code: string
          label: string
          short_label: string
          sort_order: number
        }
        Insert: {
          category: string
          code: string
          label: string
          short_label: string
          sort_order?: number
        }
        Update: {
          category?: string
          code?: string
          label?: string
          short_label?: string
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          player_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          player_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          player_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          ends_on: string | null
          id: string
          is_current: boolean
          label: string | null
          league_name: string | null
          name: string
          slug: string
          sort_order: number
          starts_on: string | null
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          ends_on?: string | null
          id?: string
          is_current?: boolean
          label?: string | null
          league_name?: string | null
          name: string
          slug: string
          sort_order?: number
          starts_on?: string | null
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          ends_on?: string | null
          id?: string
          is_current?: boolean
          label?: string | null
          league_name?: string | null
          name?: string
          slug?: string
          sort_order?: number
          starts_on?: string | null
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      sponsors: {
        Row: {
          blurb: string | null
          created_at: string
          id: string
          is_active: boolean
          legacy_id: string | null
          logo_path: string | null
          name: string
          slug: string
          sort_order: number
          tier: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          blurb?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          legacy_id?: string | null
          logo_path?: string | null
          name: string
          slug: string
          sort_order?: number
          tier?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          blurb?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          legacy_id?: string | null
          logo_path?: string | null
          name?: string
          slug?: string
          sort_order?: number
          tier?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      venues: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          display_name: string | null
          field: string | null
          id: string
          latitude: number | null
          longitude: number | null
          map_url: string | null
          name: string
          notes: string | null
          postal_code: string | null
          slug: string
          state: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          field?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          map_url?: string | null
          name: string
          notes?: string | null
          postal_code?: string | null
          slug: string
          state?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          display_name?: string | null
          field?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          map_url?: string | null
          name?: string
          notes?: string | null
          postal_code?: string | null
          slug?: string
          state?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      game_inning_runs: {
        Row: {
          derived_our_runs: number | null
          game_id: string | null
          inning: number | null
          our_runs: number | null
          our_runs_override: number | null
          their_runs: number | null
        }
        Relationships: []
      }
      game_results: {
        Row: {
          game_id: string | null
          has_event_data: boolean | null
          our_runs: number | null
          result: string | null
          season_id: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["game_status"] | null
          their_runs: number | null
        }
        Relationships: [
          {
            foreignKeyName: "games_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      game_scoreboard: {
        Row: {
          game_id: string | null
          has_event_data: boolean | null
          our_runs: number | null
          season_id: string | null
          their_runs: number | null
        }
        Relationships: [
          {
            foreignKeyName: "games_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      player_career_stats: {
        Row: {
          ab: number | null
          batting_average: number | null
          bb: number | null
          doubles: number | null
          g: number | null
          h: number | null
          hr: number | null
          k: number | null
          player_id: string | null
          r: number | null
          rbi: number | null
          seasons: number | null
          triples: number | null
        }
        Relationships: []
      }
      player_game_stats: {
        Row: {
          ab: number | null
          bb: number | null
          doubles: number | null
          fc: number | null
          game_id: string | null
          h: number | null
          hbp: number | null
          hr: number | null
          k: number | null
          pa: number | null
          player_id: string | null
          r: number | null
          rbi: number | null
          roe: number | null
          sac: number | null
          season_id: string | null
          sf: number | null
          singles: number | null
          tb: number | null
          triples: number | null
        }
        Relationships: []
      }
      player_season_stats: {
        Row: {
          ab: number | null
          batting_average: number | null
          batting_average_basis: string | null
          batting_average_display: number | null
          bb: number | null
          doubles: number | null
          g: number | null
          h: number | null
          has_derived: boolean | null
          has_legacy: boolean | null
          hbp: number | null
          hr: number | null
          k: number | null
          obp: number | null
          ops: number | null
          pa: number | null
          player_id: string | null
          r: number | null
          rbi: number | null
          sac: number | null
          season_id: string | null
          sf: number | null
          singles: number | null
          slg: number | null
          tb: number | null
          triples: number | null
        }
        Relationships: []
      }
      team_season_record: {
        Row: {
          games_played: number | null
          losses: number | null
          runs_allowed: number | null
          runs_scored: number | null
          season_id: string | null
          ties: number | null
          wins: number | null
        }
        Relationships: [
          {
            foreignKeyName: "games_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      can_score: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      slugify: { Args: { value: string }; Returns: string }
      unaccent_fallback: { Args: { value: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "scorekeeper" | "viewer"
      game_event_type:
        | "game_start"
        | "inning_change"
        | "plate_appearance"
        | "substitution"
        | "opponent_runs"
        | "correction"
        | "note"
        | "status_change"
        | "game_final"
      game_status:
        | "scheduled"
        | "pregame"
        | "live"
        | "final"
        | "cancelled"
        | "postponed"
      home_away: "home" | "away"
      inning_half: "top" | "bottom"
      media_kind: "photo" | "video"
      player_status: "active" | "inactive" | "alumni"
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
      app_role: ["admin", "scorekeeper", "viewer"],
      game_event_type: [
        "game_start",
        "inning_change",
        "plate_appearance",
        "substitution",
        "opponent_runs",
        "correction",
        "note",
        "status_change",
        "game_final",
      ],
      game_status: [
        "scheduled",
        "pregame",
        "live",
        "final",
        "cancelled",
        "postponed",
      ],
      home_away: ["home", "away"],
      inning_half: ["top", "bottom"],
      media_kind: ["photo", "video"],
      player_status: ["active", "inactive", "alumni"],
    },
  },
} as const

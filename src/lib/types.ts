export type Priority = 1 | 2 | 3;
export type Energy = "deep" | "shallow" | "admin";

export interface CalendarEvent {
  title: string;
  start: string;
  end: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  duration_minutes: number;
  priority: Priority;
  energy: Energy;
  suggested_start: string;
  suggested_end: string;
  completed_at?: string;
  source?: "ai" | "manual";
}

export interface GeneratedPlan {
  existing_events: CalendarEvent[];
  tasks: Task[];
  generated_at: string;
  target_date: string;
}

export interface DayHistoryEntry {
  date: string;
  tasks: Task[];
  xp_earned: number;
  completed_count: number;
  planned_count: number;
}

export type BadgeId =
  | "first_blood"
  | "dawn_patrol"
  | "deep_diver"
  | "combo_king"
  | "week_warrior"
  | "centurion"
  | "iron_streak";

export interface UnlockedBadge {
  id: BadgeId;
  unlocked_at: string;
}

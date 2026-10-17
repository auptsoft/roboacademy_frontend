import {
  Award, Bot, Cpu, Flag, Flame, Footprints, GraduationCap, Hand, Heart, Languages, Lightbulb, Medal, Repeat, Rocket, Route,
  Sparkles, Star, Target, Trophy, Zap,
} from 'lucide-vue-next'

// The icon names the backend allows (BadgeIcons): the built-in badges' and schools' own. An unknown name (a badge added on the server
// before the app knows it) falls back to a generic award.
const icons: Record<string, typeof Award> = {
  footprints: Footprints,
  bot: Bot,
  sparkles: Sparkles,
  star: Star,
  repeat: Repeat,
  languages: Languages,
  hand: Hand,
  'graduation-cap': GraduationCap,
  route: Route,
  flame: Flame,
  award: Award,
  trophy: Trophy,
  medal: Medal,
  rocket: Rocket,
  cpu: Cpu,
  zap: Zap,
  target: Target,
  heart: Heart,
  flag: Flag,
  lightbulb: Lightbulb,
}

export function badgeIcon(name: string): typeof Award {
  return icons[name] ?? Award
}

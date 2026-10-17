import {
  Award, Bot, Cpu, Flag, Flame, Footprints, GraduationCap, Hand, Heart, Languages, Lightbulb, Medal, Repeat, Rocket, Route,
  Sparkles, Star, Target, Trophy, Zap,
} from 'lucide-vue-next'

// The same names the web app maps (apps/web components/gamification/badge-icons.ts).
const icons: Record<string, typeof Award> = {
  award: Award, trophy: Trophy, medal: Medal, star: Star, sparkles: Sparkles, rocket: Rocket, bot: Bot, cpu: Cpu,
  zap: Zap, target: Target, heart: Heart, flag: Flag, lightbulb: Lightbulb, flame: Flame, footprints: Footprints,
  repeat: Repeat, languages: Languages, hand: Hand, 'graduation-cap': GraduationCap, route: Route,
}

export function badgeIcon(name: string): typeof Award {
  return icons[name] ?? Award
}

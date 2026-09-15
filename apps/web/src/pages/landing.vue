<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useThemeSwitcher } from '@roboacademy/ui'
import {
  Cpu, ArrowRight, PlayCircle, Sun, Moon,
  Home, BookOpen, BarChart3, Shield,
  Send, Lightbulb, Terminal,
} from 'lucide-vue-next'

const router = useRouter()
const { mode, isDark } = useThemeSwitcher()

onMounted(() => {
  document.documentElement.style.overflowX = 'hidden'
})


function toggleTheme() {
  mode.value = isDark.value ? 'light' : 'dark'
}

const categories = [
  {
    name: 'Foundations',
    level: 1,
    desc: "Mathematical modeling of motion. Forward and inverse kinematics, joint frames, and the building blocks every other category assumes.",
    prereq: 'None',
    ph: 'category · manipulator + workbench',
  },
  {
    name: 'Perception',
    level: 2,
    desc: "Sensors and the algorithms that turn their data into a usable picture of the world — LiDAR, stereo vision, ultrasonic ranging, and SLAM fundamentals.",
    prereq: 'Linear Algebra',
    ph: 'category · sensor + point cloud',
  },
  {
    name: 'Control',
    level: 2,
    desc: "Feedback loops, tuning, and stability analysis. The math behind a robot that doesn’t oscillate when you tell it to stop.",
    prereq: 'Calculus II',
    ph: 'category · step response',
  },
  {
    name: 'Scripting',
    level: 1,
    desc: "Drive the simulator in the language you already know. Lua, JavaScript, or visual blocks — pick the rung you’re on and write your way up.",
    prereq: 'None',
    ph: 'category · script editor + sim',
  },
  {
    name: 'Planning',
    level: 3,
    desc: "From a goal pose to a trajectory. Search, sampling, cost-map design, and dynamic obstacle avoidance for autonomous behavior.",
    prereq: 'Data Structures',
    ph: 'category · grid + waypoints',
  },
  {
    name: 'Industrial',
    level: 3,
    desc: "Safety protocols, force-limited modes, and human-robot interaction patterns for collaborative robots on the shop floor.",
    prereq: 'Foundations',
    ph: 'category · cobot + operator',
  },
]

const levelLabel: Record<number, string> = { 1: 'Beginner', 2: 'Intermediate', 3: 'Advanced' }

const logEntries = [
  { t: '14:20:01', cls: 'info',    tag: 'INFO:',    m: 'Simulation kernel initialized.' },
  { t: '14:20:02', cls: 'ok',      tag: 'SUCCESS:', m: 'Lesson 04 sim loaded · scripting in Lua.' },
  { t: '14:20:14', cls: 'info',    tag: 'INFO:',    m: 'Target pose received from script.' },
  { t: '14:21:10', cls: 'info',    tag: 'INFO:',    m: '[0, 45, −90, 0, 90, 0]' },
  { t: '14:21:11', cls: 'ok',      tag: 'SUCCESS:', m: 'IK solver converged in 4 iter.' },
  { t: '14:21:12', cls: 'ok',      tag: 'SUCCESS:', m: 'Trajectory queued.' },
  { t: '14:21:18', cls: 'warn',    tag: 'WARN:',    m: 'Near-singularity at J5 80°.' },
  { t: '14:21:19', cls: 'info',    tag: 'INFO:',    m: 'Awaiting next command...' },
]

const logClass: Record<string, string> = {
  ok: 'text-(--success) font-semibold',
  info: 'text-(--brand-blue) font-semibold',
  warn: 'text-(--warning) font-semibold',
}
</script>

<template>
  <div class="bg-(--bg-0) text-(--fg-2) font-sans antialiased overflow-x-hidden">

    <!-- ===== Top bar ===== -->
    <header class="sticky top-0 z-50 h-(--topbar-h) flex items-center bg-(--topbar-bg) backdrop-blur-md [-webkit-backdrop-filter:blur(12px)] border-b border-(--line-1) transition-colors duration-(--dur-2) ease-(--ease-out)">
      <div class="w-full max-w-[1280px] mx-auto px-[clamp(16px,4vw,32px)] flex items-center gap-[clamp(16px,3vw,32px)]">
        <a href="#" class="flex items-center gap-3 font-bold text-(--fg-1) text-base tracking-[-0.005em] no-underline">
          <span class="w-7 h-7 rounded-full bg-(--brand-blue) grid place-items-center text-white shrink-0"><Cpu :size="16" /></span>
          <span>RoboAcademy</span>
        </a>
        <nav class="flex gap-[clamp(16px,2.4vw,28px)] ml-3 max-[1100px]:hidden">
          <a href="#curriculum" class="text-[13px] text-(--fg-3) transition-colors duration-(--dur-1) ease-(--ease-out) hover:text-(--fg-1) no-underline">Curriculum</a>
          <a href="#simulator" class="text-[13px] text-(--fg-3) transition-colors duration-(--dur-1) ease-(--ease-out) hover:text-(--fg-1) no-underline">Simulator</a>
          <a href="#lessons" class="text-[13px] text-(--fg-3) transition-colors duration-(--dur-1) ease-(--ease-out) hover:text-(--fg-1) no-underline">Pedagogy</a>
          <a href="#institutions" class="text-[13px] text-(--fg-3) transition-colors duration-(--dur-1) ease-(--ease-out) hover:text-(--fg-1) no-underline">For Institutions</a>
          <a href="#pricing" class="text-[13px] text-(--fg-3) transition-colors duration-(--dur-1) ease-(--ease-out) hover:text-(--fg-1) no-underline">Pricing</a>
        </nav>
        <div class="ml-auto flex items-center gap-[clamp(8px,1.5vw,14px)]">
          <button
            class="w-9 h-9 rounded-full bg-transparent border border-(--line-2) text-(--fg-3) cursor-pointer inline-grid place-items-center relative transition-colors duration-(--dur-1) ease-(--ease-out) p-0 hover:text-(--fg-1) hover:bg-(--bg-3) hover:border-(--line-3)"
            type="button" @click="toggleTheme" aria-label="Toggle theme"
          >
            <Sun :size="16" :class="['absolute opacity-0 rotate-90 [transition:opacity_var(--dur-2)_var(--ease-out),transform_var(--dur-3)_var(--ease-out)]', isDark && 'opacity-100 rotate-0']" />
            <Moon :size="16" :class="['absolute opacity-0 rotate-90 [transition:opacity_var(--dur-2)_var(--ease-out),transform_var(--dur-3)_var(--ease-out)]', !isDark && 'opacity-100 rotate-0']" />
          </button>
          <button
            class="inline-flex items-center gap-2 rounded-(--radius-md) font-sans text-sm font-semibold cursor-pointer border-0 bg-transparent text-(--fg-2) px-1 h-auto transition-colors duration-(--dur-1) ease-(--ease-out) hover:text-(--fg-1) no-underline max-[480px]:hidden"
            @click="router.push('/auth')"
          >Sign In</button>
          <a
            href="#pricing"
            class="group inline-flex items-center gap-2 h-10 px-4.5 rounded-(--radius-md) font-sans text-sm font-semibold cursor-pointer border-0 bg-(--brand-blue) text-white transition-colors duration-(--dur-1) ease-(--ease-out) hover:bg-(--brand-blue-hover) active:bg-(--brand-blue-press) no-underline whitespace-nowrap"
          >
            Start Learning
            <ArrowRight :size="16" class="transition-transform duration-(--dur-2) ease-(--ease-out) group-hover:translate-x-[3px]" />
          </a>
        </div>
      </div>
    </header>

    <!-- ===== Hero ===== -->
    <section class="pt-[clamp(40px,6vw,72px)] pb-[clamp(48px,7vw,88px)] relative">
      <div class="w-full max-w-[1280px] mx-auto px-[clamp(16px,4vw,32px)]">
        <div class="grid grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-[clamp(32px,4.5vw,56px)] items-center max-[1100px]:grid-cols-1 max-[1100px]:gap-10 max-[1100px]:items-start">
          <div>
            <span class="inline-flex items-center gap-2 text-[11px] tracking-widest uppercase text-(--brand-blue) font-semibold">
              <i class="w-1.5 h-1.5 rounded-full bg-(--brand-blue) inline-block shrink-0" />
              Professional Robotics LMS
            </span>
            <h1 class="text-[clamp(36px,5.6vw,64px)] leading-[1.08] font-bold tracking-[-0.025em] text-(--fg-1) mt-4.5 mb-5 [text-wrap:balance]">Train on the robots you'll actually build.</h1>
            <p class="text-[clamp(15px,1.4vw,17px)] leading-[1.6] text-(--fg-3) max-w-140">
              A structured curriculum in <span class="text-(--brand-blue)">kinematics</span>, <span class="text-(--brand-blue)">perception</span>,
              and <span class="text-(--brand-blue)">control</span> — every lesson paired with an interactive simulation you
              drive yourself in <span class="text-(--brand-blue)">Lua</span>, <span class="text-(--brand-blue)">JavaScript</span>, or visual
              blocks. Theory in the morning, moving robots by lunch.
            </p>
            <div class="flex gap-3 items-center mt-8 flex-wrap">
              <a href="#pricing" class="group inline-flex items-center gap-2 h-12 px-5.5 rounded-(--radius-md) font-sans text-[15px] font-semibold cursor-pointer border-0 bg-(--brand-blue) text-white transition-colors duration-(--dur-1) ease-(--ease-out) hover:bg-(--brand-blue-hover) active:bg-(--brand-blue-press) no-underline whitespace-nowrap">
                Start a free course
                <ArrowRight :size="16" class="transition-transform duration-(--dur-2) ease-(--ease-out) group-hover:translate-x-[3px]" />
              </a>
              <a href="#simulator" class="inline-flex items-center gap-2 h-12 px-5.5 rounded-(--radius-md) font-sans text-[15px] font-semibold cursor-pointer border border-(--line-3) bg-transparent text-(--fg-2) transition-colors duration-(--dur-1) ease-(--ease-out) hover:bg-(--bg-3) hover:text-(--fg-1) no-underline whitespace-nowrap">
                <PlayCircle :size="16" />
                See the simulator
              </a>
            </div>
            <div class="font-mono text-[11px] text-(--fg-4) uppercase tracking-[0.06em] flex gap-4.5 flex-wrap items-center mt-9 pt-6 border-t border-(--line-1) max-[680px]:gap-3">
              <span><i class="w-1.5 h-1.5 rounded-full bg-(--success) shadow-[0_0_0_3px_rgba(34,197,94,0.16)] inline-block align-middle mr-1.5" /><b class="text-(--fg-2) font-semibold">SIMULATOR READY</b></span>
              <span>LATENCY <b class="text-(--fg-2) font-semibold">12ms</b></span>
              <span>SESSION <b class="text-(--fg-2) font-semibold">RX-882-SIM</b></span>
              <span><b class="text-(--fg-2) font-semibold">60&nbsp;FPS</b> · 1080p</span>
            </div>
          </div>

          <!-- Composed dashboard mock -->
          <div class="bg-(--bg-1) border border-(--line-2) rounded-(--radius-xl) shadow-(--elev-3) overflow-hidden" aria-hidden="true">
            <div class="h-9 bg-(--bg-2) flex items-center gap-2 px-3.5 border-b border-(--line-1)">
              <div class="flex gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-(--bg-4)" /><span class="w-2.5 h-2.5 rounded-full bg-(--bg-4)" /><span class="w-2.5 h-2.5 rounded-full bg-(--bg-4)" />
              </div>
              <div class="ml-2 font-mono text-[11px] text-(--fg-4) bg-(--bg-1) border border-(--line-1) rounded-[6px] h-[22px] inline-flex items-center px-2.5">roboacademy.app/dashboard</div>
              <div class="ml-auto font-mono text-[10px] tracking-widest text-(--success) flex items-center gap-1.5">
                <i class="w-1.5 h-1.5 rounded-full bg-(--success) shadow-[0_0_0_3px_rgba(34,197,94,0.18)] inline-block" />
                SIMULATOR READY
              </div>
            </div>
            <div class="p-5 grid grid-cols-[56px_1fr] gap-4">
              <div class="bg-(--bg-2) border border-(--line-1) rounded-(--radius-md) py-3 flex flex-col items-center gap-3.5">
                <div class="w-7 h-7 rounded-[6px] grid place-items-center text-(--fg-3)"><Home :size="16" /></div>
                <div class="w-7 h-7 rounded-[6px] grid place-items-center bg-(--brand-blue-soft) text-(--brand-blue) relative">
                  <span class="absolute -left-2.5 top-1 bottom-1 w-0.5 bg-(--brand-blue) rounded-full" />
                  <BookOpen :size="16" />
                </div>
                <div class="w-7 h-7 rounded-[6px] grid place-items-center text-(--fg-3)"><Cpu :size="16" /></div>
                <div class="w-7 h-7 rounded-[6px] grid place-items-center text-(--fg-3)"><BarChart3 :size="16" /></div>
                <div class="w-7 h-7 rounded-[6px] grid place-items-center text-(--fg-3)"><Shield :size="16" /></div>
              </div>
              <div class="flex flex-col gap-3.5">
                <div>
                  <h3 class="text-base font-bold text-(--fg-1) m-0">Welcome back, Alex Rivera.</h3>
                  <p class="text-xs text-(--fg-3) mt-1 mb-0">You have made great progress this week.</p>
                </div>
                <div class="grid grid-cols-3 gap-2.5">
                  <div class="bg-(--bg-2) border border-(--line-1) rounded-(--radius-md) py-3 px-3.5">
                    <div class="text-[9px] uppercase tracking-widest text-(--fg-3) font-semibold">Active Courses</div>
                    <div class="text-[22px] font-bold text-(--fg-1) tracking-[-0.01em] mt-1 [font-variant-numeric:tabular-nums]">4</div>
                    <div class="text-[10px] text-(--fg-4) mt-1">2 due this week</div>
                  </div>
                  <div class="bg-(--bg-2) border border-(--line-1) rounded-(--radius-md) py-3 px-3.5">
                    <div class="text-[9px] uppercase tracking-widest text-(--fg-3) font-semibold">Completed Lessons</div>
                    <div class="text-[22px] font-bold text-(--fg-1) tracking-[-0.01em] mt-1 [font-variant-numeric:tabular-nums]">28</div>
                    <div class="text-[10px] text-(--success) mt-1">+5 from last month</div>
                  </div>
                  <div class="bg-(--bg-2) border border-(--line-1) rounded-(--radius-md) py-3 px-3.5">
                    <div class="text-[9px] uppercase tracking-widest text-(--fg-3) font-semibold">Sim Hours</div>
                    <div class="text-[22px] font-bold text-(--fg-1) tracking-[-0.01em] mt-1 [font-variant-numeric:tabular-nums]">12.5</div>
                    <div class="text-[10px] text-(--fg-4) mt-1">Top 10% of class</div>
                  </div>
                </div>
                <div class="bg-[linear-gradient(135deg,var(--bg-3)_0%,var(--bg-2)_100%)] border border-(--line-1) rounded-(--radius-lg) p-4">
                  <span class="inline-flex items-center gap-1.5 bg-(--brand-blue-soft) text-(--brand-blue) text-[10px] font-semibold py-1 px-2 rounded-full uppercase tracking-[0.08em]">Current Focus</span>
                  <h4 class="text-sm font-bold text-(--fg-1) mt-2.5 mb-1">Intro to Kinematics · Lesson 04</h4>
                  <p class="text-[11px] text-(--fg-3) m-0">Inverse kinematics of a 3-DOF anthropomorphic arm.</p>
                  <div class="flex items-center justify-between gap-4 mt-3">
                    <div class="font-mono text-[10px] text-(--fg-4) tracking-[0.06em]">UNIT 2 · 45M REMAINING</div>
                    <button class="bg-(--brand-blue) text-white text-[11px] font-semibold py-[7px] px-3 rounded-[6px] border-0 cursor-pointer">Continue Learning</button>
                  </div>
                </div>
                <div class="grid grid-cols-3 gap-2.5">
                  <div class="bg-(--bg-2) border border-(--line-1) rounded-(--radius-md) overflow-hidden">
                    <div class="h-14 relative bg-[repeating-linear-gradient(135deg,var(--thumb-stripe-a)_0_8px,var(--thumb-stripe-b)_8px_16px)]">
                      <span class="absolute top-1.5 right-1.5 font-mono text-[8px] tracking-[0.08em] bg-(--tag-bg) text-(--fg-2) py-0.5 px-1.5 rounded uppercase">In Progress</span>
                    </div>
                    <div class="py-2.5 px-3">
                      <div class="text-[11px] font-semibold text-(--fg-1)">Intro to Kinematics</div>
                      <div class="h-1 bg-(--bg-4) rounded-full mt-2 overflow-hidden"><i class="block h-full bg-(--brand-blue) rounded-full w-[65%]" /></div>
                      <div class="text-[9px] text-(--fg-4) font-mono mt-1.5 tracking-[0.04em]">65% · 14 of 22</div>
                    </div>
                  </div>
                  <div class="bg-(--bg-2) border border-(--line-1) rounded-(--radius-md) overflow-hidden">
                    <div class="h-14 relative bg-[repeating-linear-gradient(45deg,var(--thumb-stripe-a)_0_8px,var(--thumb-stripe-b2)_8px_16px)]">
                      <span class="absolute top-1.5 right-1.5 font-mono text-[8px] tracking-[0.08em] bg-(--tag-bg) text-(--fg-2) py-0.5 px-1.5 rounded uppercase">In Progress</span>
                    </div>
                    <div class="py-2.5 px-3">
                      <div class="text-[11px] font-semibold text-(--fg-1)">Sensors &amp; Perception</div>
                      <div class="h-1 bg-(--bg-4) rounded-full mt-2 overflow-hidden"><i class="block h-full bg-(--brand-blue) rounded-full w-[30%]" /></div>
                      <div class="text-[9px] text-(--fg-4) font-mono mt-1.5 tracking-[0.04em]">30% · 6 of 19</div>
                    </div>
                  </div>
                  <div class="bg-(--bg-2) border border-(--line-1) rounded-(--radius-md) overflow-hidden">
                    <div class="h-14 relative bg-[repeating-linear-gradient(90deg,var(--thumb-stripe-a)_0_8px,var(--thumb-stripe-b3)_8px_16px)]">
                      <span class="absolute top-1.5 right-1.5 font-mono text-[8px] tracking-[0.08em] bg-(--tag-bg) text-(--fg-2) py-0.5 px-1.5 rounded uppercase">Completed</span>
                    </div>
                    <div class="py-2.5 px-3">
                      <div class="text-[11px] font-semibold text-(--fg-1)">Python for Robotics</div>
                      <div class="h-1 bg-(--bg-4) rounded-full mt-2 overflow-hidden"><i class="block h-full bg-(--success) rounded-full w-full" /></div>
                      <div class="text-[9px] text-(--fg-4) font-mono mt-1.5 tracking-[0.04em]">100% · 18 of 18</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== Trust strip ===== -->
    <div class="py-7 border-t border-(--line-1) border-b border-(--line-1)">
      <div class="w-full max-w-[1280px] mx-auto px-[clamp(16px,4vw,32px)] flex items-center justify-between flex-wrap gap-[clamp(20px,3vw,28px)] max-[680px]:justify-start">
        <div class="font-mono text-[11px] tracking-widest uppercase text-(--fg-4)">In use at engineering programs and robotics labs</div>
        <div class="flex items-center gap-[clamp(20px,3vw,36px)] flex-wrap">
          <div class="[font-family:'Georgia',serif] tracking-[0.02em] text-sm font-bold text-(--fg-3) opacity-85">Halberd&nbsp;Tech</div>
          <div class="text-sm font-bold text-(--fg-3) tracking-[-0.01em] opacity-85">
            <span class="inline-flex items-center gap-1.5 py-1 px-2 border border-(--line-2) rounded font-mono text-[11px] tracking-[0.08em] uppercase">
              <span class="w-1.5 h-1.5 bg-(--fg-3) rounded-[1px]" />MERIDIAN
            </span>
          </div>
          <div class="[font-family:'Georgia',serif] tracking-[0.02em] text-sm font-bold text-(--fg-3) opacity-85">Stoneridge University</div>
          <div class="text-sm font-bold text-(--fg-3) tracking-[-0.01em] opacity-85">NORTHFIELD&nbsp;ROBOTICS</div>
          <div class="[font-family:'Georgia',serif] tracking-[0.02em] text-sm font-bold text-(--fg-3) opacity-85">Kepler Institute</div>
        </div>
      </div>
    </div>

    <!-- ===== Curriculum ===== -->
    <section id="curriculum" class="py-[clamp(56px,8vw,96px)] relative max-[680px]:py-14">
      <div class="w-full max-w-[1280px] mx-auto px-[clamp(16px,4vw,32px)]">
        <div class="grid grid-cols-[1.1fr_1fr] gap-[clamp(32px,4.5vw,56px)] items-end mb-[clamp(40px,5vw,56px)] max-[1100px]:grid-cols-1 max-[1100px]:gap-10 max-[1100px]:items-start">
          <div>
            <span class="inline-flex items-center gap-2 text-[11px] tracking-widest uppercase text-(--brand-blue) font-semibold">
              <i class="w-1.5 h-1.5 rounded-full bg-(--brand-blue) inline-block shrink-0" />Course Catalog
            </span>
            <h2 class="text-[clamp(28px,3.6vw,40px)] leading-[1.15] font-bold tracking-[-0.02em] text-(--fg-1) my-3.5 [text-wrap:balance]">Browse by category. Choose by level. Follow the prerequisites.</h2>
          </div>
          <div class="flex flex-col gap-4">
            <p class="text-[clamp(15px,1.4vw,17px)] leading-[1.6] text-(--fg-3) max-w-140">
              Courses are grouped into six categories from foundations to industrial robotics.
              Every course shows a level — beginner, intermediate, advanced — and any prerequisites
              you'll need to get in.
            </p>
            <div class="font-mono text-[11px] text-(--fg-4) uppercase tracking-[0.06em] flex gap-4.5 flex-wrap items-center pb-3 border-b border-(--line-1)">
              <span>BEGINNER</span>
              <span>INTERMEDIATE</span>
              <span>ADVANCED</span>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-[clamp(16px,2vw,20px)]">
          <article
            v-for="cat in categories" :key="cat.name"
            class="bg-(--bg-2) border border-(--line-1) rounded-(--radius-xl) overflow-hidden flex flex-col transition-[transform,border-color] duration-(--dur-2) ease-(--ease-out) hover:-translate-y-0.5 hover:border-(--line-2)"
          >
            <div class="aspect-video bg-(--bg-3) bg-[repeating-linear-gradient(135deg,var(--ph-stripe)_0_12px,transparent_12px_24px)] border-b border-(--line-1) relative grid place-items-center">
              <span class="absolute top-3 left-3 font-mono text-[10px] text-(--fg-2) bg-(--tag-bg) border border-(--line-1) rounded py-1 px-2 tracking-[0.08em] uppercase inline-flex items-center gap-2">
                <span class="inline-flex gap-[3px]">
                  <span v-for="n in 3" :key="n" class="w-[5px] h-[5px] rounded-full" :class="n <= cat.level ? 'bg-(--brand-blue)' : 'bg-white/[0.18]'" />
                </span>
                {{ levelLabel[cat.level] }}
              </span>
              <span class="font-mono text-[11px] text-(--fg-4) tracking-[0.08em] uppercase">{{ cat.ph }}</span>
            </div>
            <div class="p-5.5 flex flex-col gap-3 flex-1">
              <h3 class="text-lg font-bold text-(--fg-1) m-0 tracking-[-0.005em]">{{ cat.name }}</h3>
              <p class="text-[13px] leading-5 text-(--fg-3) m-0">{{ cat.desc }}</p>
              <div class="mt-auto pt-3.5 border-t border-(--line-1) flex items-center justify-between gap-4 font-mono text-[11px] text-(--fg-4) tracking-[0.06em] uppercase">
                <div class="flex flex-col gap-1">
                  <div class="inline-flex gap-2 items-baseline"><span class="text-(--fg-4)">Prereq</span><span class="text-(--fg-2)">{{ cat.prereq }}</span></div>
                </div>
                <a href="#" class="text-(--brand-blue) inline-flex items-center gap-1.5 no-underline">
                  <span>Browse category</span>
                  <ArrowRight :size="12" />
                </a>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- ===== Simulator ===== -->
    <section id="simulator" class="py-[clamp(56px,8vw,96px)] relative max-[680px]:py-14">
      <div class="w-full max-w-[1280px] mx-auto px-[clamp(16px,4vw,32px)]">
        <div class="grid grid-cols-[1fr_1.4fr] gap-[clamp(32px,4.5vw,56px)] items-center max-[1100px]:grid-cols-1 max-[1100px]:gap-10 max-[1100px]:items-start">
          <div>
            <span class="inline-flex items-center gap-2 text-[11px] tracking-widest uppercase text-(--brand-blue) font-semibold">
              <i class="w-1.5 h-1.5 rounded-full bg-(--brand-blue) inline-block shrink-0" />In-browser Simulator
            </span>
            <h2 class="text-[clamp(28px,3.6vw,40px)] leading-[1.15] font-bold tracking-[-0.02em] text-(--fg-1) my-3.5 [text-wrap:balance]">Read the lesson. Move the robot. Same window.</h2>
            <p class="text-[clamp(15px,1.4vw,17px)] leading-[1.6] text-(--fg-3) max-w-140">
              Every simulation is wired to the lesson it belongs to — the joint you just read
              about is the joint you wiggle. Write moves in Lua, JavaScript, or drag visual
              blocks, then read pose and velocity straight back. No installs, no separate IDE.
            </p>
            <div class="font-mono text-[11px] text-(--fg-4) uppercase tracking-[0.06em] flex gap-4.5 flex-wrap items-center mt-7">
              <span><i class="w-1.5 h-1.5 rounded-full bg-(--success) shadow-[0_0_0_3px_rgba(34,197,94,0.16)] inline-block align-middle mr-1.5" /><b class="text-(--fg-2) font-semibold">SIMULATOR READY</b></span>
              <span>LUA · JS · BLOCKS</span>
              <span>6 DOF</span>
            </div>
            <div class="flex gap-3 items-center mt-7 flex-wrap">
              <a href="#" class="group inline-flex items-center gap-2 h-10 px-4.5 rounded-(--radius-md) font-sans text-sm font-semibold cursor-pointer border-0 bg-(--brand-blue) text-white transition-colors duration-(--dur-1) ease-(--ease-out) hover:bg-(--brand-blue-hover) active:bg-(--brand-blue-press) no-underline whitespace-nowrap">
                Try the demo lab
                <ArrowRight :size="16" class="transition-transform duration-(--dur-2) ease-(--ease-out) group-hover:translate-x-[3px]" />
              </a>
              <a href="#" class="inline-flex items-center gap-2 h-10 px-4.5 rounded-(--radius-md) font-sans text-sm font-semibold cursor-pointer border border-(--line-3) bg-transparent text-(--fg-2) transition-colors duration-(--dur-1) ease-(--ease-out) hover:bg-(--bg-3) hover:text-(--fg-1) no-underline whitespace-nowrap">Read the simulator docs</a>
            </div>
          </div>

          <div class="bg-(--bg-1) border border-(--line-2) rounded-(--radius-xl) overflow-hidden shadow-(--elev-3)">
            <div class="py-3.5 px-4.5 border-b border-(--line-1) flex items-center gap-3.5 font-mono text-[11px] text-(--fg-3) tracking-[0.06em] uppercase">
              <span>SIMULATION INTERFACE</span>
              <span class="text-(--fg-5)">/</span>
              <span>SESSION_ID: <b class="text-(--fg-1) font-semibold">RX-882-SIM</b></span>
              <span class="text-(--fg-5)">/</span>
              <span class="text-(--success) inline-flex items-center gap-1.5">
                <i class="w-1.5 h-1.5 rounded-full bg-(--success) shadow-[0_0_0_3px_rgba(34,197,94,0.18)] inline-block animate-[pulse_2s_ease-in-out_infinite]" />
                LIVE ENGINE
              </span>
            </div>
            <div class="grid grid-cols-[220px_1fr_240px] min-h-[380px] max-[680px]:grid-cols-1">
              <!-- Left: kinematics -->
              <div class="p-4">
                <h5 class="text-[10px] tracking-widest uppercase text-(--fg-3) mb-3.5 font-semibold font-sans">Kinematics Control</h5>
                <div class="mb-3.5">
                  <div class="flex justify-between font-mono text-[11px] text-(--fg-3) mb-1.5"><span>J1 · BASE</span><b class="text-(--fg-1) font-semibold [font-variant-numeric:tabular-nums]">+42°</b></div>
                  <div class="h-1 bg-(--bg-4) rounded-full relative"><i class="absolute inset-y-0 left-0 bg-(--brand-blue) rounded-full w-[42%]" /><span class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 left-[42%] w-3 h-3 rounded-full bg-(--knob-bg) shadow-[0_0_0_4px_var(--brand-blue-soft)]" /></div>
                </div>
                <div class="mb-3.5">
                  <div class="flex justify-between font-mono text-[11px] text-(--fg-3) mb-1.5"><span>J2 · SHOULDER</span><b class="text-(--fg-1) font-semibold [font-variant-numeric:tabular-nums]">+68°</b></div>
                  <div class="h-1 bg-(--bg-4) rounded-full relative"><i class="absolute inset-y-0 left-0 bg-(--brand-blue) rounded-full w-[68%]" /><span class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 left-[68%] w-3 h-3 rounded-full bg-(--knob-bg) shadow-[0_0_0_4px_var(--brand-blue-soft)]" /></div>
                </div>
                <div class="mb-3.5">
                  <div class="flex justify-between font-mono text-[11px] text-(--fg-3) mb-1.5"><span>J3 · ELBOW</span><b class="text-(--fg-1) font-semibold [font-variant-numeric:tabular-nums]">−28°</b></div>
                  <div class="h-1 bg-(--bg-4) rounded-full relative"><i class="absolute inset-y-0 left-0 bg-(--brand-blue) rounded-full w-[28%]" /><span class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 left-[28%] w-3 h-3 rounded-full bg-(--knob-bg) shadow-[0_0_0_4px_var(--brand-blue-soft)]" /></div>
                </div>
                <div class="mb-3.5">
                  <div class="flex justify-between font-mono text-[11px] text-(--fg-3) mb-1.5"><span>J4 · W1</span><b class="text-(--fg-1) font-semibold [font-variant-numeric:tabular-nums]">+05°</b></div>
                  <div class="h-1 bg-(--bg-4) rounded-full relative"><i class="absolute inset-y-0 left-0 bg-(--brand-blue) rounded-full w-[55%]" /><span class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 left-[55%] w-3 h-3 rounded-full bg-(--knob-bg) shadow-[0_0_0_4px_var(--brand-blue-soft)]" /></div>
                </div>
                <div class="mb-3.5">
                  <div class="flex justify-between font-mono text-[11px] text-(--fg-3) mb-1.5"><span>J5 · W2</span><b class="text-(--fg-1) font-semibold [font-variant-numeric:tabular-nums]">+80°</b></div>
                  <div class="h-1 bg-(--bg-4) rounded-full relative"><i class="absolute inset-y-0 left-0 bg-(--brand-blue) rounded-full w-[80%]" /><span class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 left-[80%] w-3 h-3 rounded-full bg-(--knob-bg) shadow-[0_0_0_4px_var(--brand-blue-soft)]" /></div>
                </div>
                <div class="mb-3.5">
                  <div class="flex justify-between font-mono text-[11px] text-(--fg-3) mb-1.5"><span>J6 · TCP</span><b class="text-(--fg-1) font-semibold [font-variant-numeric:tabular-nums]">−14°</b></div>
                  <div class="h-1 bg-(--bg-4) rounded-full relative"><i class="absolute inset-y-0 left-0 bg-(--brand-blue) rounded-full w-[14%]" /><span class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 left-[14%] w-3 h-3 rounded-full bg-(--knob-bg) shadow-[0_0_0_4px_var(--brand-blue-soft)]" /></div>
                </div>
                <button class="w-full mt-3 bg-(--brand-blue) text-white text-xs font-semibold border-0 rounded-[6px] py-2.5 px-3 inline-flex items-center justify-center gap-1.5 cursor-pointer"><Send :size="12" />Send Command</button>
              </div>

              <!-- Center: viewport -->
              <div class="bg-[radial-gradient(ellipse_at_60%_55%,rgba(59,130,246,0.10)_0%,transparent_55%),var(--bg-0)] relative overflow-hidden max-[680px]:min-h-[240px]">
                <div class="absolute inset-0 [background-image:linear-gradient(var(--grid-line)_1px,transparent_1px),linear-gradient(90deg,var(--grid-line)_1px,transparent_1px)] [background-size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,rgba(0,0,0,0.85)_0%,transparent_75%)] [-webkit-mask-image:radial-gradient(ellipse_at_center,rgba(0,0,0,0.85)_0%,transparent_75%)]" />
                <div class="absolute inset-0 grid place-items-center">
                  <svg viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" class="w-[70%] h-[70%] text-(--brand-blue)">
                    <rect x="80" y="170" width="40" height="14" rx="3" fill="currentColor" fill-opacity="0.15"></rect>
                    <line x1="100" y1="170" x2="100" y2="120"></line>
                    <circle cx="100" cy="120" r="6" fill="currentColor" fill-opacity="0.2"></circle>
                    <line x1="100" y1="120" x2="148" y2="80"></line>
                    <circle cx="148" cy="80" r="6" fill="currentColor" fill-opacity="0.2"></circle>
                    <line x1="148" y1="80" x2="170" y2="40"></line>
                    <rect x="160" y="28" width="22" height="14" rx="2" fill="currentColor" fill-opacity="0.15"></rect>
                  </svg>
                </div>
                <div class="absolute right-3.5 top-3 font-mono text-[10px] text-(--success) tracking-[0.08em] inline-flex items-center gap-1.5">
                  <i class="w-1.5 h-1.5 rounded-full bg-(--success) inline-block" />TARGET_LOCK
                </div>
                <div class="absolute left-3.5 bottom-3 font-mono text-[10px] text-(--fg-3) tracking-[0.06em]">VIEWPORT · TCP <b class="text-(--fg-1) font-semibold">[ 0.42 m, 0.18 m, 0.66 m ]</b> · 60&nbsp;FPS</div>
              </div>

              <!-- Right: log -->
              <div class="p-0">
                <div class="pt-4 px-4">
                  <h5 class="mb-3.5 text-[10px] tracking-widest uppercase text-(--fg-3) font-semibold font-sans">Command History</h5>
                </div>
                <div class="bg-(--bg-1) p-3.5 font-mono text-[11px] leading-[18px] text-(--fg-3) flex flex-col gap-1">
                  <div v-for="(e, i) in logEntries" :key="i">
                    <span class="text-(--fg-4)">[{{ e.t }}]</span>
                    <span :class="logClass[e.cls]">{{ e.tag }}</span>
                    {{ e.m }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== Pedagogy ===== -->
    <section id="lessons" class="py-[clamp(56px,8vw,96px)] relative max-[680px]:py-14">
      <div class="w-full max-w-[1280px] mx-auto px-[clamp(16px,4vw,32px)]">
        <div class="grid grid-cols-[1fr_1.1fr] gap-[clamp(32px,4.5vw,56px)] items-center max-[1100px]:grid-cols-1 max-[1100px]:gap-10 max-[1100px]:items-start">
          <div class="bg-(--bg-2) border border-(--line-1) rounded-(--radius-xl) py-7 px-8 max-[880px]:p-5.5">
            <div class="font-mono text-[11px] text-(--fg-4) tracking-[0.06em] uppercase mb-3.5">
              <span>Introduction to Kinematics</span> · <b class="text-(--brand-blue)">LESSON 04</b>
            </div>
            <h3 class="text-[22px] font-bold text-(--fg-1) mt-0 mb-3 tracking-[-0.005em]">Inverse Kinematics of a 3-DOF Arm</h3>
            <p class="text-sm leading-[22px] text-(--fg-2) mt-0 mb-4">
              For a serial manipulator with revolute joints, we represent each joint's transformation
              using a <b>Denavit–Hartenberg matrix</b>. The full forward kinematics chain is the product of
              these matrices from base to end-effector.
            </p>
            <div class="bg-(--bg-3) rounded-md py-4.5 px-5 font-mono text-sm text-(--fg-1) text-center my-4.5 max-[880px]:text-[13px] max-[880px]:py-3.5 max-[880px]:px-3">
              T<sub>0</sub><sup>n</sup> &nbsp;=&nbsp; ∏<sub>i=1..n</sub> &nbsp;
              <span class="text-(--brand-blue)">A<sub>i</sub></span>(<span class="text-(--brand-blue)">θ<sub>i</sub></span>, d<sub>i</sub>, a<sub>i</sub>, α<sub>i</sub>)
            </div>
            <p class="text-sm leading-[22px] text-(--fg-2) mt-0 mb-4">
              The inverse problem — solving for <span class="text-(--brand-blue)">θ<sub>i</sub></span> given a
              desired TCP — admits multiple closed-form solutions for a 3-DOF anthropomorphic arm.
              In the simulation lab you'll implement the analytic solver and test it against the IK engine.
            </p>
            <div class="border border-(--line-2) rounded-[10px] py-3.5 px-4 flex gap-3 bg-(--bg-1)">
              <Lightbulb :size="16" class="text-(--brand-blue) shrink-0 mt-0.5" />
              <div>
                <div class="text-xs font-bold text-(--fg-1) uppercase tracking-[0.06em]">Pro Tip · Coordinate Frames</div>
                <div class="text-[13px] leading-5 text-(--fg-3) mt-1">Always define your base coordinate system relative to the robot's mount point to avoid complex offset calculations during simulation.</div>
              </div>
            </div>
          </div>

          <div>
            <span class="inline-flex items-center gap-2 text-[11px] tracking-widest uppercase text-(--brand-blue) font-semibold">
              <i class="w-1.5 h-1.5 rounded-full bg-(--brand-blue) inline-block shrink-0" />Pedagogy
            </span>
            <h2 class="text-[clamp(28px,3.6vw,40px)] leading-[1.15] font-bold tracking-[-0.02em] text-(--fg-1) my-3.5 [text-wrap:balance]">Lessons that teach like a lab manual.</h2>
            <p class="text-[clamp(15px,1.4vw,17px)] leading-[1.6] text-(--fg-3) max-w-140">
              Textbook-grade prose. Inline equations and code blocks. A "Launch Simulation"
              card at the end of every chapter. Concepts get boldface highlights where they
              earn it — and a Pro Tip box for the things you only learn on the bench.
            </p>
            <div class="flex flex-col gap-4.5 mt-7">
              <div class="flex gap-3.5 items-start">
                <div class="w-7 h-7 rounded-md bg-(--brand-blue-soft) text-(--brand-blue) grid place-items-center shrink-0"><BookOpen :size="14" /></div>
                <div>
                  <div class="text-sm font-semibold text-(--fg-1)">Theory then application</div>
                  <div class="text-[13px] leading-5 text-(--fg-3) mt-1">Every lesson ends in a hands-on simulation lab, not a quiz.</div>
                </div>
              </div>
              <div class="flex gap-3.5 items-start">
                <div class="w-7 h-7 rounded-md bg-(--brand-blue-soft) text-(--brand-blue) grid place-items-center shrink-0"><Terminal :size="14" /></div>
                <div>
                  <div class="text-sm font-semibold text-(--fg-1)">Script in Lua, JavaScript, or blocks</div>
                  <div class="text-[13px] leading-5 text-(--fg-3) mt-1">Drive the simulator in the language you already know — or start with visual blocks and graduate to code as the concepts click.</div>
                </div>
              </div>
              <div class="flex gap-3.5 items-start">
                <div class="w-7 h-7 rounded-md bg-(--brand-blue-soft) text-(--brand-blue) grid place-items-center shrink-0"><BarChart3 :size="14" /></div>
                <div>
                  <div class="text-sm font-semibold text-(--fg-1)">Instructor dashboards</div>
                  <div class="text-[13px] leading-5 text-(--fg-3) mt-1">See cohort progress, lab completion rates, and per-student command logs.</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ===== Stats strip ===== -->
    <div class="bg-(--bg-1) border-t border-(--line-1) border-b border-(--line-1)">
      <div class="w-full max-w-[1280px] mx-auto px-[clamp(16px,4vw,32px)] grid grid-cols-3 max-[880px]:grid-cols-2 max-[680px]:grid-cols-1">
        <div class="py-[clamp(28px,4vw,40px)] px-[clamp(20px,3vw,24px)] border-r border-(--line-1) max-[880px]:border-b max-[880px]:border-(--line-1) max-[680px]:border-r-0 max-[680px]:border-b">
          <div class="text-[clamp(40px,6vw,56px)] font-bold text-(--fg-1) tracking-[-0.03em] leading-none [font-variant-numeric:tabular-nums]">42<small class="text-2xl text-(--brand-blue) font-semibold ml-0.5">+</small></div>
          <div class="mt-2.5 text-[11px] text-(--fg-3) uppercase tracking-widest font-semibold">Courses</div>
          <div class="mt-2 text-[13px] text-(--fg-4) leading-[18px]">Across kinematics, perception, control, planning, and industrial robotics.</div>
        </div>
        <div class="py-[clamp(28px,4vw,40px)] px-[clamp(20px,3vw,24px)] border-r border-(--line-1) max-[880px]:border-r-0 max-[880px]:border-b max-[880px]:border-(--line-1) max-[680px]:border-b">
          <div class="text-[clamp(40px,6vw,56px)] font-bold text-(--fg-1) tracking-[-0.03em] leading-none [font-variant-numeric:tabular-nums]">210</div>
          <div class="mt-2.5 text-[11px] text-(--fg-3) uppercase tracking-widest font-semibold">Simulation Labs</div>
          <div class="mt-2 text-[13px] text-(--fg-4) leading-[18px]">Each lab is wired to a specific lesson — drive a virtual manipulator with Lua, JavaScript, or visual blocks.</div>
        </div>
        <div class="py-[clamp(28px,4vw,40px)] px-[clamp(20px,3vw,24px)] max-[880px]:col-span-2 max-[680px]:col-span-1">
          <div class="text-[clamp(40px,6vw,56px)] font-bold text-(--fg-1) tracking-[-0.03em] leading-none [font-variant-numeric:tabular-nums]">60<small class="text-2xl text-(--brand-blue) font-semibold ml-0.5">fps</small></div>
          <div class="mt-2.5 text-[11px] text-(--fg-3) uppercase tracking-widest font-semibold">Simulator Throughput</div>
          <div class="mt-2 text-[13px] text-(--fg-4) leading-[18px]">1&nbsp;kHz control loop, 12ms median input latency, 4K viewport.</div>
        </div>
      </div>
    </div>

    <!-- ===== Final CTA ===== -->
    <section class="py-[clamp(72px,11vw,120px)] text-center relative overflow-hidden" id="pricing">
      <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(1240px,190vw)] aspect-square rounded-full border border-(--line-1) pointer-events-none" />
      <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(980px,160vw)] aspect-square rounded-full border border-(--line-1) pointer-events-none" />
      <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(720px,130vw)] aspect-square rounded-full border border-(--line-1) pointer-events-none" />
      <div class="w-full max-w-[1280px] mx-auto px-[clamp(16px,4vw,32px)] relative z-[1]">
        <span class="inline-flex items-center gap-2 text-[11px] tracking-widest uppercase text-(--brand-blue) font-semibold justify-center">
          <i class="w-1.5 h-1.5 rounded-full bg-(--brand-blue) inline-block shrink-0" />Get started
        </span>
        <h2 class="text-[clamp(32px,5.2vw,56px)] leading-[1.14] font-bold tracking-[-0.025em] text-(--fg-1) m-0 mb-4.5 [text-wrap:balance]">Open the lab.<br />Run your first joint command in&nbsp;90&nbsp;seconds.</h2>
        <p class="text-[clamp(15px,1.4vw,17px)] leading-[1.55] text-(--fg-3) mx-auto mb-8 max-w-135">Free for individual learners. Site licenses available for engineering programs, robotics labs, and corporate training.</p>
        <div class="flex gap-3 items-center mt-8 flex-wrap justify-center">
          <a href="#" class="group inline-flex items-center gap-2 h-12 px-5.5 rounded-(--radius-md) font-sans text-[15px] font-semibold cursor-pointer border-0 bg-(--brand-blue) text-white transition-colors duration-(--dur-1) ease-(--ease-out) hover:bg-(--brand-blue-hover) active:bg-(--brand-blue-press) no-underline whitespace-nowrap">
            Create account
            <ArrowRight :size="16" class="transition-transform duration-(--dur-2) ease-(--ease-out) group-hover:translate-x-[3px]" />
          </a>
          <a href="#" class="inline-flex items-center gap-2 h-12 px-5.5 rounded-(--radius-md) font-sans text-[15px] font-semibold cursor-pointer border border-(--line-3) bg-transparent text-(--fg-2) transition-colors duration-(--dur-1) ease-(--ease-out) hover:bg-(--bg-3) hover:text-(--fg-1) no-underline whitespace-nowrap">Talk to an institution lead</a>
        </div>
        <div class="font-mono text-[11px] text-(--fg-4) uppercase tracking-[0.06em] flex gap-4.5 flex-wrap items-center mt-10 justify-center">
          <span><i class="w-1.5 h-1.5 rounded-full bg-(--success) shadow-[0_0_0_3px_rgba(34,197,94,0.16)] inline-block align-middle mr-1.5" />ENCRYPTED SECURE SESSION</span>
          <span>SSO · GITHUB · GOOGLE</span>
          <span>SOC 2 TYPE II</span>
        </div>
      </div>
    </section>

    <!-- ===== Footer ===== -->
    <footer class="pt-[clamp(40px,5vw,56px)] pb-10 border-t border-(--line-1)">
      <div class="w-full max-w-[1280px] mx-auto px-[clamp(16px,4vw,32px)] grid grid-cols-[2fr_1fr_1fr_1fr_1fr] gap-[clamp(24px,3vw,32px)] max-[1100px]:grid-cols-4 max-[680px]:grid-cols-2 max-[480px]:grid-cols-1">
        <div class="max-[1100px]:col-span-full max-[680px]:col-span-full">
          <a href="#" class="flex items-center gap-3 font-bold text-(--fg-1) text-base tracking-[-0.005em] no-underline mb-2">
            <span class="w-7 h-7 rounded-full bg-(--brand-blue) grid place-items-center text-white shrink-0"><Cpu :size="16" /></span>
            <span>RoboAcademy</span>
          </a>
          <p class="text-[13px] leading-5 text-(--fg-3) mt-3.5 mb-0 max-w-70">Professional Robotics LMS — a structured path from joint angles to autonomous behavior, with an interactive simulator built in.</p>
        </div>
        <div>
          <h6 class="text-[11px] text-(--fg-3) uppercase tracking-widest font-semibold m-0 mb-3.5">Product</h6>
          <a href="#" class="block text-[13px] text-(--fg-2) py-1 transition-colors duration-(--dur-1) ease-(--ease-out) hover:text-(--fg-1) no-underline">Curriculum</a>
          <a href="#" class="block text-[13px] text-(--fg-2) py-1 transition-colors duration-(--dur-1) ease-(--ease-out) hover:text-(--fg-1) no-underline">Simulator</a>
          <a href="#" class="block text-[13px] text-(--fg-2) py-1 transition-colors duration-(--dur-1) ease-(--ease-out) hover:text-(--fg-1) no-underline">Mobile app</a>
          <a href="#" class="block text-[13px] text-(--fg-2) py-1 transition-colors duration-(--dur-1) ease-(--ease-out) hover:text-(--fg-1) no-underline">Changelog</a>
        </div>
        <div>
          <h6 class="text-[11px] text-(--fg-3) uppercase tracking-widest font-semibold m-0 mb-3.5">For</h6>
          <a href="#" class="block text-[13px] text-(--fg-2) py-1 transition-colors duration-(--dur-1) ease-(--ease-out) hover:text-(--fg-1) no-underline">Students</a>
          <a href="#" class="block text-[13px] text-(--fg-2) py-1 transition-colors duration-(--dur-1) ease-(--ease-out) hover:text-(--fg-1) no-underline">Instructors</a>
          <a href="#" class="block text-[13px] text-(--fg-2) py-1 transition-colors duration-(--dur-1) ease-(--ease-out) hover:text-(--fg-1) no-underline">Institutions</a>
          <a href="#" class="block text-[13px] text-(--fg-2) py-1 transition-colors duration-(--dur-1) ease-(--ease-out) hover:text-(--fg-1) no-underline">Industry</a>
        </div>
        <div>
          <h6 class="text-[11px] text-(--fg-3) uppercase tracking-widest font-semibold m-0 mb-3.5">Resources</h6>
          <a href="#" class="block text-[13px] text-(--fg-2) py-1 transition-colors duration-(--dur-1) ease-(--ease-out) hover:text-(--fg-1) no-underline">Documentation</a>
          <a href="#" class="block text-[13px] text-(--fg-2) py-1 transition-colors duration-(--dur-1) ease-(--ease-out) hover:text-(--fg-1) no-underline">Simulator API</a>
          <a href="#" class="block text-[13px] text-(--fg-2) py-1 transition-colors duration-(--dur-1) ease-(--ease-out) hover:text-(--fg-1) no-underline">Hardware list</a>
          <a href="#" class="block text-[13px] text-(--fg-2) py-1 transition-colors duration-(--dur-1) ease-(--ease-out) hover:text-(--fg-1) no-underline">Status</a>
        </div>
        <div>
          <h6 class="text-[11px] text-(--fg-3) uppercase tracking-widest font-semibold m-0 mb-3.5">Company</h6>
          <a href="#" class="block text-[13px] text-(--fg-2) py-1 transition-colors duration-(--dur-1) ease-(--ease-out) hover:text-(--fg-1) no-underline">About</a>
          <a href="#" class="block text-[13px] text-(--fg-2) py-1 transition-colors duration-(--dur-1) ease-(--ease-out) hover:text-(--fg-1) no-underline">Careers</a>
          <a href="#" class="block text-[13px] text-(--fg-2) py-1 transition-colors duration-(--dur-1) ease-(--ease-out) hover:text-(--fg-1) no-underline">Press</a>
          <a href="#" class="block text-[13px] text-(--fg-2) py-1 transition-colors duration-(--dur-1) ease-(--ease-out) hover:text-(--fg-1) no-underline">Contact</a>
        </div>
      </div>
      <div class="w-full max-w-[1280px] mx-auto px-[clamp(16px,4vw,32px)]">
        <div class="mt-12 pt-5 border-t border-(--line-1) flex justify-between items-center flex-wrap gap-4 font-mono text-[11px] text-(--fg-4) tracking-[0.06em] max-[480px]:flex-col max-[480px]:items-start max-[480px]:gap-2.5">
          <div>© 2026 ROBOACADEMY · PROFESSIONAL ROBOTICS LMS</div>
          <div class="flex gap-5.5 max-[480px]:flex-wrap">
            <span>PRIVACY</span>
            <span>TERMS</span>
            <span>SECURITY</span>
            <span>V 4.2.1</span>
          </div>
        </div>
      </div>
    </footer>

  </div><!-- .lp-root -->
</template>

<style scoped>
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 3px rgba(34,197,94,0.18); }
  50% { box-shadow: 0 0 0 5px rgba(34,197,94,0.06); }
}
</style>

<template>
    <header class="container mx-auto">
        <div class="flex justify-between py-4 px-4">
            <div class="text-2xl font-bold">
                <span class="">ROBO</span>
                <span class="text-primary">ACADEMY</span>
            </div>

            <div class="flex gap-8 items-center">
                <RouterLink class="text-sm simple-link" to="/courses">Courses</RouterLink>
                <RouterLink class="text-sm simple-link" to="/landing#simulator">Simulation</RouterLink>
                <RouterLink class="text-sm simple-link" to="/hardware">Hardware</RouterLink>
                <RouterLink class="text-sm simple-link" to="/bootcamp">Bootcamp</RouterLink>
                <RouterLink class="text-sm simple-link" to="/auth/register">
                    <Button>Sign up</Button>
                </RouterLink>
            </div>
            <ThemePicker />
        </div>
    </header>
    <div class="min-h-screen">
        <slot />
    </div>
    <footer class="container mx-auto  p-4">
        <hr />
        <div class="flex justify-between py-4 px-4 items-center">
            <div class="text-2xl font-bold">
                <span class="text-gray-400">ROBO</span>
                <span class="text-primary ">ACADEMY</span>
            </div>

            <RouterLink class="text-sm simple-link" to="/courses">COURSES</RouterLink>
            <RouterLink class="text-sm simple-link" to="/landing#simulator">SIMULATION</RouterLink>
            <RouterLink class="text-sm simple-link" to="/hardware">HARDWARE</RouterLink>
            <RouterLink class="text-sm simple-link" to="/bootcamp">BOOTCAMP</RouterLink>
            
            <div class="text-xs">
                &copy; ROBOACADEMY
            </div>

        </div>
    </footer>
</template>

<script lang="ts" setup>
import ThemePicker from '@/components/ThemePicker.vue';
import Button from '@/components/ui/button/Button.vue';
import { onMounted } from 'vue';


onMounted(() => {
    // document.documentElement.classList.toggle("dark")
})
</script>
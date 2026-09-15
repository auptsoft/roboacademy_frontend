
<template>
<LandingLayout>
    <div class="flex items-center flex-col gap-4 p-20">
        <div class="text-2xl">Page Not found </div>
        <div class="text-center">
            <Button @click="$router.push('/')">Go Back Home</Button>
        </div>
    </div>
</LandingLayout>
</template>

<script lang="ts" setup>
import LandingLayout from '@/components/landing-layout.vue';
import Button from '@/components/ui/button/Button.vue';

</script>
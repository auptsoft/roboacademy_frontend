<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { CourseCatalogItem } from '@/api/learning'
import CourseTile from '@/components/courses/CourseTile.vue'
import { catalogTileProps } from '@/components/courses/course-tile'

const props = defineProps<CourseCatalogItem>()

const router = useRouter()
</script>

<template>
  <CourseTile v-bind="catalogTileProps(props)" @open="router.push(`/app/explore/courses/${props.id}`)" />
</template>

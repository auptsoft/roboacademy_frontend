<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { LearningPathItem } from '@/api/learning'
import CourseTile from '@/components/courses/CourseTile.vue'
import { catalogPathTileProps } from '@/components/courses/course-tile'

const props = defineProps<LearningPathItem>()

const router = useRouter()
</script>

<template>
  <CourseTile v-bind="catalogPathTileProps(props)" @open="router.push(`/app/explore/paths/${props.id}`)" />
</template>

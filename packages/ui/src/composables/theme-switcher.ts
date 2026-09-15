import { onMounted, onUnmounted, ref, watch } from "vue";

export const THEME_STORAGE_KEY = "ra-theme";

export type ThemeMode = "light" | "dark" | "system";

function systemPrefersDark() {
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(mode: ThemeMode): "light" | "dark" {
    if (mode === "system") {
        return systemPrefersDark() ? "dark" : "light";
    }
    return mode;
}

export function applyTheme(mode: ThemeMode) {
    const resolved = resolveTheme(mode);
    document.documentElement.setAttribute("data-theme", resolved);
    document.documentElement.classList.toggle("dark", resolved === "dark");
    localStorage.setItem(THEME_STORAGE_KEY, mode);
}

export function initTheme(defaultMode: ThemeMode = "system"): ThemeMode {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeMode | null;
    const mode = stored || defaultMode;
    applyTheme(mode);
    return mode;
}

export function useThemeSwitcher() {
    const mode = ref<ThemeMode>(initTheme());
    const isDark = ref(resolveTheme(mode.value) === "dark");

    const sync = () => {
        applyTheme(mode.value);
        isDark.value = resolveTheme(mode.value) === "dark";
    };

    watch(mode, sync);

    onMounted(() => {
        window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", sync);
    });

    onUnmounted(() => {
        window.matchMedia("(prefers-color-scheme: dark)").removeEventListener("change", sync);
    });

    return { mode, isDark };
}

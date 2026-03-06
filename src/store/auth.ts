import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

interface User {
    id: string;
    account: string;
    nickname: string;
    avatar: string;
    token: string;
}

export const useAuthStore = defineStore('auth', () => {
    const user = ref<User | null>(null);

    function setUser(u: User) {
        user.value = u;
        localStorage.setItem('auth_user', JSON.stringify(u));
        localStorage.setItem('auth_token', u.token);
    }

    function load() {
        const s = localStorage.getItem('auth_user');
        if (s) {
            const u = JSON.parse(s) as User;
            user.value = u;
        }
    }

    function clear() {
        user.value = null;
        localStorage.removeItem('auth_user');
        localStorage.removeItem('auth_token');
    }

    const isAuthenticated = computed(() => !!user.value);

    load();

    return { user, isAuthenticated, setUser, clear };
});
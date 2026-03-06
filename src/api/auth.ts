import http from '@/config/http';

export function login(account: string, password: string) {
    const form = new FormData();
    form.append('account', account);
    form.append('password', password);
    return http.post('/auth/login', form);
}

export function register(account: string, password: string, nickname: string, avatarFile?: File) {
    const form = new FormData();
    form.append('account', account);
    form.append('password', password);
    form.append('nickname', nickname);
    if (avatarFile) form.append('avatarFile', avatarFile);
    return http.post('/auth/register', form);
}

export function logout(token: string) {
    const form = new FormData();
    form.append('token', token);
    return http.post('/auth/logout', form);
}
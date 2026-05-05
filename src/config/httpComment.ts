import axios from 'axios';
import { GATEWAY_BASE } from '@/config/api';

const httpComment = axios.create({
    baseURL: import.meta.env.DEV ? '/api' : GATEWAY_BASE
});

httpComment.interceptors.request.use((config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        config.headers = config.headers || {};
        config.headers['token'] = token;
        config.headers['Authorization'] = token;
    }
    return config;
});

httpComment.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error && error.response && error.response.status === 401) {
            try {
                localStorage.removeItem('auth_user');
                localStorage.removeItem('auth_token');
            } catch {}
            if (window.location.pathname !== '/auth') {
                window.location.href = '/auth';
            }
        }
        return Promise.reject(error);
    }
);

export default httpComment;
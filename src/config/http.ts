import axios from 'axios';
import { GATEWAY_BASE } from '@/config/api';

const http = axios.create({
    baseURL: import.meta.env.DEV ? '/api' : GATEWAY_BASE
});

http.interceptors.request.use((config) => {
    const token = localStorage.getItem('auth_token');
    if (token) {
        config.headers = config.headers || {};
        config.headers['Authorization'] = token;
    }
    return config;
});

export default http;
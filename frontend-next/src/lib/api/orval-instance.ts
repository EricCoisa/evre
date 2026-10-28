/** Axios mutator customizado usado pelos clients gerados pelo Orval. */
import axios, { type AxiosRequestConfig } from 'axios';
import { getServerAccessToken, getServerLang } from '../actions/auth/server-auth';
import { clientIpHeader } from './client-ip';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

const instance = axios.create({ baseURL: BASE_URL, withCredentials: true });

instance.interceptors.request.use(async (config) => {
  const token = await getServerAccessToken();
  config.headers = config.headers || {};
  if (token) config.headers['Authorization'] = `Bearer ${token}`;
  config.headers['Accept-Language'] = (await getServerLang()) ?? 'pt-BR';
  Object.assign(config.headers, await clientIpHeader());
  return config;
});

/** Opções por chamada repassadas pelas funções geradas (headers extras, signal, responseType). */
export type RequestOptions = Omit<AxiosRequestConfig, 'url' | 'method' | 'data' | 'params'>;

export const customInstance = <T>(
  config: AxiosRequestConfig,
  options?: RequestOptions,
): Promise<T> => {
  return instance({ ...config, ...options, headers: { ...config.headers, ...options?.headers } }).then((res) => res.data);
};

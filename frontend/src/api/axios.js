import axios from 'axios';
import { authStorage } from '../auth/authStorage';
import { BRANCH_STORAGE_KEY } from '../store/slices/branchSlice';
import { toast } from '../context/ToastContext';
import { getApiSuccessMessage, getApiErrorMessage, shouldSkipSuccessToast } from './toastMessages';
import {
  emitDataChanged,
  keysFromMutationUrl,
  shouldEmitDataRefresh,
} from '../lib/dataRefresh';

/** Same-origin /api via Nginx — works on HTTP and HTTPS without mixed-content issues */
const API = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

API.interceptors.request.use((config) => {
  const token = authStorage.getToken();
  const selectedBranchId =
    typeof window !== 'undefined' ? window.localStorage.getItem(BRANCH_STORAGE_KEY) : null;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    authStorage.touchActivity();
  }
  if (selectedBranchId) {
    config.headers['x-branch-id'] = selectedBranchId;
    const method = (config.method || 'get').toLowerCase();
    const url = config.url || '';
    const skipBranchQueryParam = url.includes('/public-packages') || url.includes('/uno-packages');
    if (method === 'get') {
      if (!skipBranchQueryParam) {
        config.params = {
          ...(config.params || {}),
          branchId: config.params?.branchId || selectedBranchId,
        };
      }
    }
  }
  return config;
});

API.interceptors.response.use(
  (response) => {
    const { config, data } = response;
    if (shouldEmitDataRefresh(config)) {
      emitDataChanged(keysFromMutationUrl(config.url, config.method));
    }
    if (!shouldSkipSuccessToast(config)) {
      toast.success(getApiSuccessMessage(config, data));
    }
    return response;
  },
  (error) => {
    const isLogoutRequest = error.config?.url?.includes('/auth/logout');
    if (error.response?.status === 401 && !isLogoutRequest) {
      authStorage.clearSession();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    } else if (!error.config?.skipErrorToast) {
      toast.error(getApiErrorMessage(error));
    }
    return Promise.reject(error);
  }
);

export default API;

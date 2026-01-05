import axios from "axios";

const serverUrl = import.meta.env.VITE_SERVER_URL;

const api = axios.create({
  baseURL: serverUrl,
  withCredentials: true,
});

export default api;

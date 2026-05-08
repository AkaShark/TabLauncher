import { createApp } from 'vue';
import { createPinia } from 'pinia';
import SettingsView from './SettingsView.vue';
import '@/styles/index.css';

const app = createApp(SettingsView);
app.use(createPinia());
app.mount('#app');
